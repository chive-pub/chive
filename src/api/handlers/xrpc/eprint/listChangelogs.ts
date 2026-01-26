/**
 * XRPC handler for pub.chive.eprint.listChangelogs.
 *
 * @remarks
 * Lists all changelog entries for a specific eprint with pagination.
 * Returns changelogs ordered by creation date (newest first).
 *
 * **ATProto Compliance:**
 * - Returns indexed data only
 * - Never writes to user PDS
 * - Index data rebuildable from firehose
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  ChangelogView,
} from '../../../../lexicons/generated/types/pub/chive/eprint/listChangelogs.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Default number of changelogs per page.
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum number of changelogs per page.
 */
const MAX_LIMIT = 100;

/**
 * XRPC method for pub.chive.eprint.listChangelogs.
 *
 * @remarks
 * Returns a paginated list of changelogs for a specific eprint,
 * ordered by creation date (newest first).
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.eprint.listChangelogs?eprintUri=at://did:plc:abc/pub.chive.eprint.submission/xyz&limit=10
 *
 * Response:
 * {
 *   "changelogs": [
 *     {
 *       "uri": "at://did:plc:abc/pub.chive.eprint.changelog/v2",
 *       "cid": "bafyrei...",
 *       "eprintUri": "at://did:plc:abc/pub.chive.eprint.submission/xyz",
 *       "version": { "major": 2, "minor": 0, "patch": 0 },
 *       "previousVersion": { "major": 1, "minor": 0, "patch": 0 },
 *       "summary": "Major revision",
 *       "sections": [...],
 *       "createdAt": "2024-02-01T00:00:00Z"
 *     }
 *   ],
 *   "cursor": "10"
 * }
 * ```
 *
 * @public
 */
export const listChangelogs: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { eprint } = c.get('services');
    const logger = c.get('logger');

    // Validate required parameter
    if (!params.eprintUri) {
      throw new ValidationError('Missing required parameter: eprintUri', 'eprintUri');
    }

    // Apply default and max limits
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;

    logger.debug('Listing changelogs', {
      eprintUri: params.eprintUri,
      limit,
      cursor: params.cursor,
    });

    // Fetch changelogs from storage via eprint service
    const result = await eprint.listChangelogs(params.eprintUri as AtUri, {
      limit,
      offset,
    });

    // Map results to ChangelogView format
    // Convert readonly arrays to mutable for lexicon compatibility
    const changelogs: ChangelogView[] = result.changelogs.map((changelog) => ({
      uri: changelog.uri,
      cid: changelog.cid,
      eprintUri: changelog.eprintUri,
      version: changelog.version,
      previousVersion: changelog.previousVersion,
      summary: changelog.summary,
      sections: changelog.sections.map((section) => ({
        category: section.category,
        items: section.items.map((item) => ({ ...item })),
      })),
      reviewerResponse: changelog.reviewerResponse,
      createdAt: changelog.createdAt,
    }));

    // Calculate cursor for next page
    const hasMore = offset + changelogs.length < result.total;
    const nextCursor = hasMore ? String(offset + changelogs.length) : undefined;

    const response: OutputSchema = {
      changelogs,
      cursor: nextCursor,
    };

    logger.info('Changelogs listed', {
      eprintUri: params.eprintUri,
      count: changelogs.length,
      total: result.total,
    });

    return { encoding: 'application/json', body: response };
  },
};
