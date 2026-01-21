/**
 * XRPC handler for pub.chive.tag.getSuggestions.
 *
 * @remarks
 * Gets tag suggestions based on TaxoFolk system.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/tag/getSuggestions.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.tag.getSuggestions.
 *
 * @public
 */
export const getSuggestions: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
    const suggestions: OutputSchema['suggestions'] = searchResults.tags.map((tag) => ({
      displayForm: tag.rawForm,
      normalizedForm: tag.normalizedForm,
      confidence: tag.qualityScore ?? 0.5,
      source: 'cooccurrence' as const,
      matchedTerm: params.q,
    }));

    const response: OutputSchema = {
      suggestions,
    };

    logger.info('Tag suggestions returned', {
      query: params.q,
      count: response.suggestions.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
