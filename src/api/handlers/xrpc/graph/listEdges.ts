/**
 * XRPC handler for pub.chive.graph.listEdges.
 *
 * @remarks
 * Lists knowledge graph edges with optional filtering.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  listEdgesParamsSchema,
  edgeListResponseSchema,
  type ListEdgesParams,
  type EdgeListResponse,
  type GraphEdgeResponse,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Maps a GraphEdge to API response format.
 */
function mapEdgeToResponse(edge: {
  id: string;
  uri: string;
  sourceUri: string;
  targetUri: string;
  relationUri?: string;
  relationSlug: string;
  weight?: number;
  metadata?: {
    confidence?: number;
    startDate?: Date;
    endDate?: Date;
    source?: string;
  };
  status: string;
  proposalUri?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
}): GraphEdgeResponse {
  return {
    id: edge.id,
    uri: edge.uri,
    sourceUri: edge.sourceUri,
    targetUri: edge.targetUri,
    relationUri: edge.relationUri,
    relationSlug: edge.relationSlug,
    weight: edge.weight,
    metadata: edge.metadata
      ? {
          confidence: edge.metadata.confidence,
          startDate: edge.metadata.startDate?.toISOString(),
          endDate: edge.metadata.endDate?.toISOString(),
          source: edge.metadata.source,
        }
      : undefined,
    status: edge.status as 'proposed' | 'established' | 'deprecated',
    proposalUri: edge.proposalUri,
    createdAt: edge.createdAt.toISOString(),
    createdBy: edge.createdBy,
    updatedAt: edge.updatedAt?.toISOString(),
  };
}

/**
 * Handler for pub.chive.graph.listEdges query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Edge list with pagination
 *
 * @public
 */
export async function listEdgesHandler(
  c: Context<ChiveEnv>,
  params: ListEdgesParams
): Promise<EdgeListResponse> {
  const { edgeService } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Listing edges', {
    sourceUri: params.sourceUri,
    targetUri: params.targetUri,
    relationSlug: params.relationSlug,
    status: params.status,
    limit: params.limit,
  });

  const result = await edgeService.listEdges({
    sourceUri: params.sourceUri as AtUri | undefined,
    targetUri: params.targetUri as AtUri | undefined,
    relationSlug: params.relationSlug,
    status: params.status,
    limit: params.limit,
    cursor: params.cursor,
  });

  const response: EdgeListResponse = {
    edges: result.edges.map(mapEdgeToResponse),
    cursor: result.cursor,
    hasMore: result.hasMore,
    total: result.total,
  };

  logger.info('Edges listed', {
    sourceUri: params.sourceUri,
    relationSlug: params.relationSlug,
    total: result.total,
    returned: response.edges.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.listEdges.
 *
 * @public
 */
export const listEdgesEndpoint: XRPCEndpoint<ListEdgesParams, EdgeListResponse> = {
  method: 'pub.chive.graph.listEdges' as never,
  type: 'query',
  description: 'List knowledge graph edges with optional filtering',
  inputSchema: listEdgesParamsSchema,
  outputSchema: edgeListResponseSchema,
  handler: listEdgesHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
