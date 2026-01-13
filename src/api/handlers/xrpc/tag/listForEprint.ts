/**
 * XRPC handler for pub.chive.tag.listForEprint.
 *
 * @remarks
 * Lists tags for a specific eprint with TaxoFolk suggestions.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  listTagsForEprintParamsSchema,
  eprintTagsResponseSchema,
  type ListTagsForEprintParams,
  type EprintTagsResponse,
} from '../../../schemas/tag.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.tag.listForEprint query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Tags and suggestions for the eprint
 *
 * @public
 */
export async function listForEprintHandler(
  c: Context<ChiveEnv>,
  params: ListTagsForEprintParams
): Promise<EprintTagsResponse> {
  const logger = c.get('logger');
  const tagManager = c.get('services').tagManager;

  logger.debug('Listing tags for eprint', {
    eprintUri: params.eprintUri,
  });

  // Get tags for the eprint
  const eprintTags = await tagManager.getTagsForRecord(params.eprintUri as AtUri);

  // Map to API UserTag format
  // Note: The API schema expects a different format than the Neo4j UserTag
  const tags: EprintTagsResponse['tags'] = eprintTags.map((tag) => ({
    uri: `at://tags/${tag.normalizedForm}`, // Synthetic URI for tags
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
  let suggestions: EprintTagsResponse['suggestions'] = [];
  const topTag = eprintTags[0];
  if (topTag) {
    // Use the most popular tag to get co-occurrence suggestions
    const coOccurrences = await tagManager.getTagSuggestions(topTag.normalizedForm, 5);
    suggestions = coOccurrences.map(({ tag, coOccurrenceCount }) => ({
      displayForm: tag.rawForm,
      normalizedForm: tag.normalizedForm,
      confidence: Math.min(coOccurrenceCount / 10, 1), // Normalize to 0-1
      source: 'cooccurrence' as const,
      matchedTerm: topTag.normalizedForm,
    }));
  }

  const response: EprintTagsResponse = {
    tags,
    suggestions,
  };

  logger.info('Tags listed for eprint', {
    eprintUri: params.eprintUri,
    count: response.tags.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.tag.listForEprint.
 *
 * @public
 */
export const listForEprintEndpoint: XRPCEndpoint<ListTagsForEprintParams, EprintTagsResponse> = {
  method: 'pub.chive.tag.listForEprint' as never,
  type: 'query',
  description: 'List tags for a eprint',
  inputSchema: listTagsForEprintParamsSchema,
  outputSchema: eprintTagsResponseSchema,
  handler: listForEprintHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
