/**
 * XRPC handler for pub.chive.tag.search.
 *
 * @remarks
 * Searches for tags matching a query.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/tag/search.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.tag.search.
 *
 * @public
 */
export const search: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
    const tags: OutputSchema['tags'] = filteredTags.map((tag) => ({
      normalizedForm: tag.normalizedForm,
      displayForms: [tag.rawForm],
      usageCount: tag.usageCount ?? 0,
      qualityScore: tag.qualityScore ?? 0,
      isPromoted: false,
      promotedTo: undefined,
    }));

    const response: OutputSchema = {
      tags,
      hasMore: searchResults.total > limit,
      total: searchResults.total,
    };

    logger.info('Tag search completed', {
      query: params.q,
      count: response.tags.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
