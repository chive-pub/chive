/**
 * XRPC handler for pub.chive.tag.listForPreprint.
 *
 * @remarks
 * Lists tags for a specific preprint with TaxoFolk suggestions.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  listTagsForPreprintParamsSchema,
  preprintTagsResponseSchema,
  type ListTagsForPreprintParams,
  type PreprintTagsResponse,
} from '../../../schemas/tag.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.tag.listForPreprint query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Tags and suggestions for the preprint
 *
 * @public
 */
export async function listForPreprintHandler(
  c: Context<ChiveEnv>,
  params: ListTagsForPreprintParams
): Promise<PreprintTagsResponse> {
  const logger = c.get('logger');
  const tagManager = c.get('services').tagManager;

  logger.debug('Listing tags for preprint', {
    preprintUri: params.preprintUri,
  });

  // Get tags for the preprint
  const preprintTags = await tagManager.getTagsForRecord(params.preprintUri as AtUri);

  // Map to API UserTag format
  // Note: The API schema expects a different format than the Neo4j UserTag
  const tags: PreprintTagsResponse['tags'] = preprintTags.map((tag) => ({
    uri: `at://tags/${tag.normalizedForm}`, // Synthetic URI for tags
    preprintUri: params.preprintUri,
    author: {
      did: 'did:plc:unknown' as string, // Tags don't track individual authors in aggregated form
      handle: 'unknown',
    },
    displayForm: tag.rawForm,
    normalizedForm: tag.normalizedForm,
    createdAt: tag.createdAt.toISOString(),
  }));

  // Get suggestions based on co-occurrence with existing tags
  let suggestions: PreprintTagsResponse['suggestions'] = [];
  const topTag = preprintTags[0];
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

  const response: PreprintTagsResponse = {
    tags,
    suggestions,
  };

  logger.info('Tags listed for preprint', {
    preprintUri: params.preprintUri,
    count: response.tags.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.tag.listForPreprint.
 *
 * @public
 */
export const listForPreprintEndpoint: XRPCEndpoint<
  ListTagsForPreprintParams,
  PreprintTagsResponse
> = {
  method: 'pub.chive.tag.listForPreprint' as never,
  type: 'query',
  description: 'List tags for a preprint',
  inputSchema: listTagsForPreprintParamsSchema,
  outputSchema: preprintTagsResponseSchema,
  handler: listForPreprintHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
