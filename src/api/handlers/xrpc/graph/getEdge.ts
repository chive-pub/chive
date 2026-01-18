/**
 * XRPC handler for pub.chive.graph.getEdge.
 *
 * @remarks
 * Retrieves a knowledge graph edge by AT-URI.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
import {
  getEdgeParamsSchema,
  graphEdgeSchema,
  type GetEdgeParams,
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
 * Handler for pub.chive.graph.getEdge query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Edge details
 * @throws NotFoundError if edge not found
 *
 * @public
 */
export async function getEdgeHandler(
  c: Context<ChiveEnv>,
  params: GetEdgeParams
): Promise<GraphEdgeResponse> {
  const { edgeService } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Getting edge', { uri: params.uri });

  const edge = await edgeService.getEdge(params.uri as AtUri);

  if (!edge) {
    throw new NotFoundError('Edge', params.uri);
  }

  const response = mapEdgeToResponse(edge);

  logger.info('Edge retrieved', { uri: params.uri, relationSlug: edge.relationSlug });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.getEdge.
 *
 * @public
 */
export const getEdgeEndpoint: XRPCEndpoint<GetEdgeParams, GraphEdgeResponse> = {
  method: 'pub.chive.graph.getEdge' as never,
  type: 'query',
  description: 'Get a knowledge graph edge by AT-URI',
  inputSchema: getEdgeParamsSchema,
  outputSchema: graphEdgeSchema,
  handler: getEdgeHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
