/**
 * XRPC handler for pub.chive.graph.getEdge.
 *
 * @remarks
 * Retrieves a knowledge graph edge by AT-URI.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/graph/getEdge.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
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
}): OutputSchema {
  return {
    id: edge.id,
    uri: edge.uri,
    cid: edge.cid,
    sourceUri: edge.sourceUri,
    targetUri: edge.targetUri,
    relationUri: edge.relationUri,
    relationSlug: edge.relationSlug,
    // Lexicon expects weight as integer 0-1000 (scaled from 0-1)
    weight: edge.weight !== undefined ? Math.round(edge.weight * 1000) : undefined,
    metadata: edge.metadata
      ? {
          // Lexicon expects confidence as integer 0-1000 (scaled from 0-1)
          confidence:
            edge.metadata.confidence !== undefined
              ? Math.round(edge.metadata.confidence * 1000)
              : undefined,
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
 * XRPC method for pub.chive.graph.getEdge query.
 *
 * @public
 */
export const getEdge: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { edgeService } = c.get('services');
    const logger = c.get('logger');

    logger.debug('Getting edge', { uri: params.uri });

    const edge = await edgeService.getEdge(params.uri as AtUri);

    if (!edge) {
      throw new NotFoundError('Edge', params.uri);
    }

    const response = mapEdgeToResponse(edge);

    logger.info('Edge retrieved', { uri: params.uri, relationSlug: edge.relationSlug });

    return { encoding: 'application/json', body: response };
  },
};
