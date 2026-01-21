/**
 * XRPC handler for pub.chive.graph.listEdges.
 *
 * @remarks
 * Lists knowledge graph edges with optional filtering.
 *
 * @packageDocumentation
 * @public
 */

import type { GraphEdge } from '../../../../lexicons/generated/types/pub/chive/graph/getEdge.js';
import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/graph/listEdges.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Maps a GraphEdge to API response format.
 */
function mapEdgeToResponse(edge: {
  id: string;
  uri: string;
  cid?: string;
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
}): GraphEdge {
  return {
    id: edge.id,
    uri: edge.uri,
    cid: edge.cid,
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
    status: edge.status,
    proposalUri: edge.proposalUri,
    createdAt: edge.createdAt.toISOString(),
    createdBy: edge.createdBy,
    updatedAt: edge.updatedAt?.toISOString(),
  };
}

/**
 * XRPC method for pub.chive.graph.listEdges query.
 *
 * @public
 */
export const listEdges: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
      status: params.status as 'proposed' | 'established' | 'deprecated' | undefined,
      limit: params.limit,
      cursor: params.cursor,
    });

    const response: OutputSchema = {
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

    return { encoding: 'application/json', body: response };
  },
};
