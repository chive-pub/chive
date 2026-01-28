/**
 * XRPC handler for pub.chive.eprint.listByAuthor.
 *
 * @remarks
 * Lists all eprints by a specific author DID with pagination.
 * Supports sorting by date or view count.
 *
 * **ATProto Compliance:**
 * - Returns pdsUrl for each result
 * - Index data only (rebuildable from firehose)
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/eprint/listByAuthor.js';
import type { DID } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import { normalizeFieldUri } from '../../../../utils/at-uri.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.eprint.listByAuthor.
 *
 * @public
 */
export const listByAuthor: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { eprint } = c.get('services');
    const logger = c.get('logger');

    // Validate required parameter
    if (!params.did) {
      throw new ValidationError('Missing required parameter: did', 'did');
    }

    logger.debug('Listing eprints by author', {
      did: params.did,
      limit: params.limit,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });

    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
    const limit = params.limit ?? 50;

    // Map lexicon sortBy values to storage interface values
    const sortByMap: Record<string, 'createdAt' | 'indexedAt' | 'title'> = {
      indexedAt: 'indexedAt',
      publishedAt: 'createdAt',
      updatedAt: 'createdAt',
    };
    const mappedSortBy = sortByMap[params.sortBy] ?? 'createdAt';
    const mappedSortOrder: 'asc' | 'desc' = params.sortOrder === 'asc' ? 'asc' : 'desc';

    const results = await eprint.getEprintsByAuthor(params.did as DID, {
      limit,
      offset,
      sortBy: mappedSortBy,
      sortOrder: mappedSortOrder,
    });

    const hasMore = offset + results.eprints.length < results.total;

    const response: OutputSchema = {
      eprints: results.eprints.map((p) => ({
        uri: p.uri,
        cid: p.cid,
        title: p.title,
        abstract: p.abstractPlainText,
        authors: (p.authors ?? []).map((author) => ({
          // Only include did if it's a valid DID (not empty string)
          ...(author.did ? { did: author.did } : {}),
          handle: author.handle,
          displayName: author.name,
          avatarUrl: author.avatarUrl,
        })),
        fields: p.fields?.map((f) => ({
          uri: normalizeFieldUri(f.uri),
          label: f.label,
          id: f.id,
        })),
        indexedAt: p.indexedAt.toISOString(),
        publishedAt: p.createdAt.toISOString(),
      })),
      cursor: hasMore ? String(offset + results.eprints.length) : undefined,
      total: results.total,
    };

    logger.info('Author eprints listed', {
      did: params.did,
      count: response.eprints.length,
      total: results.total,
    });

    return { encoding: 'application/json', body: response };
  },
};
