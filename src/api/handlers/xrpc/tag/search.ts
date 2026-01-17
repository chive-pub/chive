/**
 * XRPC handler for pub.chive.tag.search.
 *
 * @remarks
 * Searches for tags matching a query.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  searchTagsParamsSchema,
  tagSearchResponseSchema,
  type SearchTagsParams,
  type TagSearchResponse,
} from '../../../schemas/tag.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.tag.search query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Tag search results
 *
 * @public
 */
export async function searchHandler(
  c: Context<ChiveEnv>,
  params: SearchTagsParams
): Promise<TagSearchResponse> {
  const logger = c.get('logger');
  const tagManager = c.get('services').tagManager;

  logger.debug('Searching tags', {
    query: params.q,
    limit: params.limit,
    minQuality: params.minQuality,
  });

  const limit = params.limit ?? 50;

  // Search tags using TagManager
  const searchResults = await tagManager.searchTags(params.q, limit);

  // Filter by minimum quality if specified
  let filteredTags = searchResults.tags;
  if (params.minQuality !== undefined) {
    const minQuality = params.minQuality;
    filteredTags = filteredTags.filter((tag) => (tag.qualityScore ?? 0) >= minQuality);
  }

  // Filter out spam tags unless explicitly included
  if (!params.includeSpam) {
    filteredTags = filteredTags.filter((tag) => (tag.spamScore ?? 0) < 0.5);
  }

  // Map to TagSummary format
  const tags: TagSearchResponse['tags'] = filteredTags.map((tag) => ({
    normalizedForm: tag.normalizedForm,
    displayForms: [tag.rawForm],
    usageCount: tag.usageCount ?? 0,
    qualityScore: tag.qualityScore ?? 0,
    isPromoted: false,
    promotedTo: undefined,
  }));

  const response: TagSearchResponse = {
    tags,
    hasMore: searchResults.total > limit,
    total: searchResults.total,
  };

  logger.info('Tag search completed', {
    query: params.q,
    count: response.tags.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.tag.search.
 *
 * @public
 */
export const searchEndpoint: XRPCEndpoint<SearchTagsParams, TagSearchResponse> = {
  method: 'pub.chive.tag.search' as never,
  type: 'query',
  description: 'Search for tags',
  inputSchema: searchTagsParamsSchema,
  outputSchema: tagSearchResponseSchema,
  handler: searchHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
