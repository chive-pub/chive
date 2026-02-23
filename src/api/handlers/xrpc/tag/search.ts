/**
 * XRPC handler for pub.chive.tag.search.
 *
 * @remarks
 * Searches for tags and keywords matching a query.
 * Merges community tag results from Neo4j with author keyword
 * results from PostgreSQL.
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
    const eprintService = c.get('services').eprint;

    logger.debug('Searching tags', {
      query: params.q,
      limit: params.limit,
      minQuality: params.minQuality,
    });

    const limit = params.limit ?? 50;

    // Search community tags from Neo4j
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

    // Map Neo4j results to TagSummary format
    // Lexicon expects qualityScore as integer 0-100 (scaled from 0-1)
    const tags: OutputSchema['tags'] = filteredTags.map((tag) => ({
      normalizedForm: tag.normalizedForm,
      displayForms: [tag.rawForm],
      usageCount: tag.usageCount ?? 0,
      qualityScore: Math.round((tag.qualityScore ?? 0) * 100),
      isPromoted: false,
      promotedTo: undefined,
    }));

    // Also search author keywords from PostgreSQL
    const keywordResults = await eprintService.searchKeywords(params.q, limit);

    // Merge keyword-only results (not already in Neo4j results)
    const existingForms = new Set(tags.map((t) => t.normalizedForm));
    for (const kw of keywordResults) {
      if (!existingForms.has(kw.normalizedForm)) {
        tags.push({
          normalizedForm: kw.normalizedForm,
          displayForms: [kw.displayForm],
          usageCount: kw.usageCount,
          qualityScore: 0,
          isPromoted: false,
          promotedTo: undefined,
        });
        existingForms.add(kw.normalizedForm);
      }
    }

    // Trim to limit
    const trimmedTags = tags.slice(0, limit);

    const response: OutputSchema = {
      tags: trimmedTags,
      hasMore: tags.length > limit || searchResults.total > limit,
      total: tags.length,
    };

    logger.info('Tag search completed', {
      query: params.q,
      count: response.tags.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
