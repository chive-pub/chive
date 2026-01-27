/**
 * XRPC handler for pub.chive.tag.listEprints.
 *
 * @remarks
 * Lists eprints that have a specific tag applied.
 * Uses TagManager.getRecordsWithTag() to find matching eprints,
 * then fetches eprint details from the EprintService.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/tag/listEprints.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Maximum abstract length for summaries.
 */
const MAX_ABSTRACT_LENGTH = 300;

/**
 * Truncates text to a maximum length, preserving word boundaries.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

/**
 * XRPC method for pub.chive.tag.listEprints.
 *
 * @public
 */
export const listEprints: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const tagManager = c.get('services').tagManager;
    const eprintService = c.get('services').eprint;

    const limit = params.limit ?? 25;
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;

    logger.debug('Listing eprints for tag', {
      tag: params.tag,
      limit,
      offset,
    });

    // Normalize the tag for lookup
    const normalizedTag = tagManager.normalizeTag(params.tag);

    // Verify tag exists
    const tag = await tagManager.getTag(normalizedTag);
    if (!tag) {
      throw new NotFoundError('Tag', params.tag);
    }

    // Get eprint URIs with this tag
    // Note: getRecordsWithTag doesn't support pagination, so we fetch more and slice
    const allEprintUris = await tagManager.getRecordsWithTag(normalizedTag, 500);
    const total = allEprintUris.length;

    // Apply pagination
    const paginatedUris = allEprintUris.slice(offset, offset + limit);

    // Fetch eprint details for each URI
    const eprintPromises = paginatedUris.map(async (uri) => {
      try {
        const eprint = await eprintService.getEprint(uri);
        if (!eprint) return null;

        return {
          uri,
          title: eprint.title,
          authors: eprint.authors?.map((a) => ({
            did: a.did,
            name: a.name,
          })),
          abstract: eprint.abstractPlainText
            ? truncateText(eprint.abstractPlainText, MAX_ABSTRACT_LENGTH)
            : undefined,
          indexedAt: eprint.indexedAt?.toISOString(),
          createdAt: eprint.createdAt?.toISOString(),
        };
      } catch (error) {
        logger.warn('Failed to fetch eprint for tag listing', {
          uri,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });

    const eprintResults = await Promise.all(eprintPromises);
    const eprints = eprintResults.filter((e): e is NonNullable<typeof e> => e !== null);

    // Calculate next cursor
    const hasMore = offset + limit < total;
    const nextCursor = hasMore ? String(offset + limit) : undefined;

    const response: OutputSchema = {
      eprints,
      total,
      cursor: nextCursor,
    };

    logger.info('Eprints listed for tag', {
      tag: params.tag,
      total,
      returned: eprints.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
