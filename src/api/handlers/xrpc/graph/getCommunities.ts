/**
 * XRPC handler for pub.chive.graph.getCommunities.
 *
 * @remarks
 * Detects communities in the knowledge graph using graph clustering algorithms.
 * Uses cached results from GraphAlgorithmCache when available.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/graph/getCommunities.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.graph.getCommunities query.
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.graph.getCommunities?algorithm=louvain&limit=20
 *
 * Response:
 * {
 *   "communities": [
 *     {
 *       "communityId": 1,
 *       "members": ["at://...", "at://..."],
 *       "size": 15
 *     }
 *   ],
 *   "algorithm": "louvain",
 *   "total": 42,
 *   "generatedAt": "2025-01-15T12:00:00Z"
 * }
 * ```
 *
 * @public
 */
export const getCommunities: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { graphAlgorithmCache } = c.get('services');
    const logger = c.get('logger');

    const algorithm = params.algorithm ?? 'louvain';
    const limit = params.limit ?? 20;
    const minSize = params.minSize ?? 2;

    logger.debug('Fetching communities', { algorithm, limit, minSize });

    // Try to get cached communities
    let communities = await graphAlgorithmCache?.getCommunities(
      algorithm as 'louvain' | 'label-propagation'
    );

    if (!communities) {
      logger.info('No cached communities available', { algorithm });
      communities = [];
    }

    // Filter by minSize and limit
    const filtered = communities.filter((c) => c.size >= minSize).slice(0, limit);

    const response: OutputSchema = {
      communities: filtered.map((community) => ({
        communityId: community.communityId,
        members: community.members,
        size: community.size,
      })),
      algorithm,
      total: filtered.length,
      generatedAt: new Date().toISOString(),
    };

    logger.info('Community detection completed', {
      algorithm,
      totalCommunities: response.total,
      limit,
    });

    return { encoding: 'application/json', body: response };
  },
};
