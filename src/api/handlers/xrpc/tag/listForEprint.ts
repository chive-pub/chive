/**
 * XRPC handler for pub.chive.tag.listForEprint.
 *
 * @remarks
 * Lists tags for a specific eprint with TaxoFolk suggestions.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/tag/listForEprint.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.tag.listForEprint.
 *
 * @public
 */
export const listForEprint: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const tagManager = c.get('services').tagManager;

    logger.debug('Listing tags for eprint', {
      eprintUri: params.eprintUri,
    });

    // Get tags for the eprint
    const eprintTags = await tagManager.getTagsForRecord(params.eprintUri as AtUri);

    // Map to API UserTag format
    // Note: The API schema expects a different format than the Neo4j UserTag
    const tags: OutputSchema['tags'] = eprintTags.map((tag) => ({
      uri: `at://tags/${tag.normalizedForm}`, // Synthetic URI for tags
      cid: 'placeholder', // CID would come from tag record
      eprintUri: params.eprintUri,
      author: {
        did: 'did:plc:unknown' as string, // Tags don't track individual authors in aggregated form
        handle: 'unknown',
      },
      displayForm: tag.rawForm,
      normalizedForm: tag.normalizedForm,
      createdAt: tag.createdAt.toISOString(),
    }));

    // Get suggestions based on co-occurrence with existing tags
    let suggestions: OutputSchema['suggestions'] = [];
    const topTag = eprintTags[0];
    if (topTag) {
      try {
        // Use the most popular tag to get co-occurrence suggestions
        const coOccurrences = await tagManager.getTagSuggestions(topTag.normalizedForm, 5);
        suggestions = coOccurrences.map(({ tag, coOccurrenceCount }) => ({
          displayForm: tag.rawForm,
          normalizedForm: tag.normalizedForm,
          confidence: Math.min(coOccurrenceCount / 10, 1), // Normalize to 0-1
          source: 'cooccurrence' as const,
          matchedTerm: topTag.normalizedForm,
        }));
      } catch (error) {
        // Log but don't fail - suggestions are optional
        logger.debug('Failed to get tag suggestions', {
          error: error instanceof Error ? error.message : String(error),
          topTag: topTag.normalizedForm,
        });
      }
    }

    const response: OutputSchema = {
      tags,
      suggestions,
    };

    logger.info('Tags listed for eprint', {
      eprintUri: params.eprintUri,
      count: response.tags.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
