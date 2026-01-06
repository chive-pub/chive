/**
 * XRPC handler for pub.chive.tag.getSuggestions.
 *
 * @remarks
 * Gets tag suggestions based on TaxoFolk system.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  getTagSuggestionsParamsSchema,
  tagSuggestionsResponseSchema,
  type GetTagSuggestionsParams,
  type TagSuggestionsResponse,
} from '../../../schemas/tag.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.tag.getSuggestions query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Tag suggestions
 *
 * @public
 */
export async function getSuggestionsHandler(
  c: Context<ChiveEnv>,
  params: GetTagSuggestionsParams
): Promise<TagSuggestionsResponse> {
  const logger = c.get('logger');
  const tagManager = c.get('services').tagManager;

  logger.debug('Getting tag suggestions', {
    query: params.q,
    limit: params.limit,
  });

  const limit = params.limit ?? 10;

  // Search for tags matching the query
  const searchResults = await tagManager.searchTags(params.q, limit);

  // Map search results to suggestion format
  const suggestions: TagSuggestionsResponse['suggestions'] = searchResults.tags.map((tag) => ({
    displayForm: tag.rawForm,
    normalizedForm: tag.normalizedForm,
    confidence: tag.qualityScore,
    source: 'cooccurrence' as const,
    matchedTerm: params.q,
  }));

  const response: TagSuggestionsResponse = {
    suggestions,
  };

  logger.info('Tag suggestions returned', {
    query: params.q,
    count: response.suggestions.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.tag.getSuggestions.
 *
 * @public
 */
export const getSuggestionsEndpoint: XRPCEndpoint<GetTagSuggestionsParams, TagSuggestionsResponse> =
  {
    method: 'pub.chive.tag.getSuggestions' as never,
    type: 'query',
    description: 'Get tag suggestions',
    inputSchema: getTagSuggestionsParamsSchema,
    outputSchema: tagSuggestionsResponseSchema,
    handler: getSuggestionsHandler,
    auth: 'none',
    rateLimit: 'anonymous',
  };
