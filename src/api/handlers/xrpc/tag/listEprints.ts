/**
 * XRPC handler for pub.chive.tag.listEprints.
 *
 * @remarks
 * Lists eprints that have a specific tag or keyword applied.
 * Queries PostgreSQL for both community tags and author keywords.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/tag/listEprints.js';
import { NotFoundError } from '../../../../types/errors.js';
import { normalizeTag } from '../../../../utils/normalize-tag.js';
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
    const eprintService = c.get('services').eprint;

    const limit = params.limit ?? 25;
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;

    logger.debug('Listing eprints for tag', {
      tag: params.tag,
      limit,
      offset,
    });

    const normalizedTerm = normalizeTag(params.tag);

    // Query PostgreSQL for eprints matching as community tag OR author keyword.
    const { uris: eprintUris, total } = await eprintService.getEprintUrisForTerm(
      normalizedTerm,
      limit,
      offset
    );

    if (total === 0 && offset === 0) {
      throw new NotFoundError('Tag', params.tag);
    }

    // Fetch eprint details for each URI
    const eprintPromises = eprintUris.map(async (uri) => {
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
