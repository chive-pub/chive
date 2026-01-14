/**
 * Handler for pub.chive.backlink.getCounts.
 *
 * @remarks
 * Gets aggregated backlink counts for an eprint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  getBacklinkCountsParamsSchema,
  backlinkCountsSchema,
  type GetBacklinkCountsParams,
  type BacklinkCounts,
} from '../../../schemas/backlink.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.backlink.getCounts.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Aggregated backlink counts
 *
 * @public
 */
export async function getBacklinkCountsHandler(
  c: Context<ChiveEnv>,
  params: GetBacklinkCountsParams
): Promise<BacklinkCounts> {
  const logger = c.get('logger');
  const { backlink } = c.get('services');

  logger.debug('Getting backlink counts', { targetUri: params.targetUri });

  const counts = await backlink.getCounts(params.targetUri);

  return {
    sembleCollections: counts.sembleCollections,
    leafletLists: counts.leafletLists,
    whitewindBlogs: counts.whitewindBlogs,
    blueskyPosts: counts.blueskyPosts,
    blueskyEmbeds: counts.blueskyEmbeds,
    other: counts.other,
    total: counts.total,
  };
}

/**
 * Endpoint definition for pub.chive.backlink.getCounts.
 *
 * @public
 */
export const getBacklinkCountsEndpoint: XRPCEndpoint<GetBacklinkCountsParams, BacklinkCounts> = {
  method: 'pub.chive.backlink.getCounts' as never,
  type: 'query',
  description: 'Get aggregated backlink counts for an eprint',
  inputSchema: getBacklinkCountsParamsSchema,
  outputSchema: backlinkCountsSchema,
  handler: getBacklinkCountsHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
