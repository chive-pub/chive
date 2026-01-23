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
    // minQuality from lexicon is 0-100, tag.qualityScore from TagManager is 0-1
    let filteredTags = searchResults.tags;
    if (params.minQuality !== undefined) {
      const minQualityNormalized = params.minQuality / 100;
      filteredTags = filteredTags.filter((tag) => (tag.qualityScore ?? 0) >= minQualityNormalized);
    }

    // Filter out spam tags unless explicitly included
    if (!params.includeSpam) {
      filteredTags = filteredTags.filter((tag) => (tag.spamScore ?? 0) < 0.5);
    }

    // Map to TagSummary format
    // Lexicon expects qualityScore as integer 0-100 (scaled from 0-1)
    const tags: OutputSchema['tags'] = filteredTags.map((tag) => ({
      normalizedForm: tag.normalizedForm,
      displayForms: [tag.rawForm],
      usageCount: tag.usageCount ?? 0,
      qualityScore: Math.round((tag.qualityScore ?? 0) * 100),
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
