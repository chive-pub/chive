/**
 * XRPC handler for pub.chive.tag.getTrending.
 *
 * @remarks
 * Gets trending tags within a time window.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  getTrendingTagsParamsSchema,
  trendingTagsResponseSchema,
  type GetTrendingTagsParams,
  type TrendingTagsResponse,
} from '../../../schemas/tag.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.tag.getTrending query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Trending tags
 *
 * @public
 */
export async function getTrendingHandler(
  c: Context<ChiveEnv>,
  params: GetTrendingTagsParams
): Promise<TrendingTagsResponse> {
  const logger = c.get('logger');
  const tagManager = c.get('services').tagManager;

  logger.debug('Getting trending tags', {
    timeWindow: params.timeWindow,
    limit: params.limit,
  });

  const limit = params.limit ?? 20;

  // Get trending tags from TagManager with time window support
  const trendingTags = await tagManager.getTrendingTags(limit, {
    timeWindow: params.timeWindow,
  });

  // Map to TagSummary format
  const tags: TrendingTagsResponse['tags'] = trendingTags.map((tag) => ({
    normalizedForm: tag.normalizedForm,
    displayForms: [tag.rawForm],
    usageCount: tag.usageCount ?? 0,
    qualityScore: tag.qualityScore ?? 0,
    isPromoted: false,
    promotedTo: undefined,
  }));

  const response: TrendingTagsResponse = {
    tags,
    timeWindow: params.timeWindow,
  };

  logger.info('Trending tags returned', {
    timeWindow: params.timeWindow,
    count: response.tags.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.tag.getTrending.
 *
 * @public
 */
export const getTrendingEndpoint: XRPCEndpoint<GetTrendingTagsParams, TrendingTagsResponse> = {
  method: 'pub.chive.tag.getTrending' as never,
  type: 'query',
  description: 'Get trending tags',
  inputSchema: getTrendingTagsParamsSchema,
  outputSchema: trendingTagsResponseSchema,
  handler: getTrendingHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
