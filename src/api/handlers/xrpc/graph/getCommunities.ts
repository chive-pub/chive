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

import type { Context } from 'hono';

import {
  getCommunitiesParamsSchema,
  communitiesResponseSchema,
  type GetCommunitiesParams,
  type CommunitiesResponse,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.getCommunities query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Detected communities
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
export async function getCommunitiesHandler(
  c: Context<ChiveEnv>,
  params: GetCommunitiesParams
): Promise<CommunitiesResponse> {
  const { graphAlgorithmCache } = c.get('services');
  const logger = c.get('logger');

  const algorithm = params.algorithm ?? 'louvain';
  const limit = params.limit ?? 20;
  const minSize = params.minSize ?? 2;

  logger.debug('Fetching communities', { algorithm, limit, minSize });

  // Try to get cached communities
  let communities = await graphAlgorithmCache?.getCommunities(algorithm);

  if (!communities) {
    logger.info('No cached communities available', { algorithm });
    communities = [];
  }

  // Filter by minSize and limit
  const filtered = communities.filter((c) => c.size >= minSize).slice(0, limit);

  const response: CommunitiesResponse = {
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

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.getCommunities.
 *
 * @public
 */
export const getCommunitiesEndpoint: XRPCEndpoint<GetCommunitiesParams, CommunitiesResponse> = {
  method: 'pub.chive.graph.getCommunities' as never,
  type: 'query',
  description: 'Detect communities in the knowledge graph',
  inputSchema: getCommunitiesParamsSchema,
  outputSchema: communitiesResponseSchema,
  handler: getCommunitiesHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
