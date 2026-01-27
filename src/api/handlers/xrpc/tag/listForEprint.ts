/**
 * XRPC handler for pub.chive.tag.listForEprint.
 *
 * @remarks
 * Lists tags for a specific eprint with TaxoFolk suggestions.
 * User tags are fetched from the PostgreSQL index (individual records),
 * while suggestions come from the Neo4j TagManager (co-occurrence analysis).
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
 * Normalizes a tag string to lowercase, hyphenated form.
 *
 * @param tag - Raw tag string
 * @returns Normalized form
 */
function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * XRPC method for pub.chive.tag.listForEprint.
 *
 * @public
 */
export const listForEprint: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const eprintService = c.get('services').eprint;
    const tagManager = c.get('services').tagManager;

    logger.debug('Listing tags for eprint', {
      eprintUri: params.eprintUri,
    });

    // Get individual user tags from PostgreSQL index
    const indexedTags = await eprintService.getTagsForEprint(params.eprintUri as AtUri);

    // Map to API UserTag format
    const tags: OutputSchema['tags'] = indexedTags.map((tag) => ({
      uri: tag.uri,
      cid: tag.cid,
      eprintUri: tag.eprintUri,
      author: {
        did: tag.taggerDid,
      },
      displayForm: tag.tag,
      normalizedForm: normalizeTag(tag.tag),
      createdAt: tag.createdAt.toISOString(),
    }));

    // Get suggestions based on co-occurrence with existing tags
    let suggestions: OutputSchema['suggestions'] = [];
    const firstTag = indexedTags[0];
    if (firstTag) {
      try {
        // Use the first tag's normalized form to get co-occurrence suggestions
        const normalizedFirstTag = normalizeTag(firstTag.tag);
        const coOccurrences = await tagManager.getTagSuggestions(normalizedFirstTag, 5);

        // Filter out tags that are already applied to this eprint
        const existingNormalized = new Set(tags.map((t) => t.normalizedForm));

        suggestions = coOccurrences
          .filter(({ tag: suggestedTag }) => !existingNormalized.has(suggestedTag.normalizedForm))
          .map(({ tag: suggestedTag, coOccurrenceCount }) => ({
            displayForm: suggestedTag.rawForm,
            normalizedForm: suggestedTag.normalizedForm,
            // Lexicon expects integer 0-100 (scaled from 0-1)
            confidence: Math.round(Math.min(coOccurrenceCount / 10, 1) * 100),
            source: 'cooccurrence' as const,
            matchedTerm: normalizedFirstTag,
          }));
      } catch (error) {
        // Log but don't fail; suggestions are optional
        logger.debug('Failed to get tag suggestions', {
          error: error instanceof Error ? error.message : String(error),
          tag: firstTag.tag,
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
