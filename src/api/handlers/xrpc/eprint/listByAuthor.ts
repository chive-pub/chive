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

import type { Context } from 'hono';

import type { DID } from '../../../../types/atproto.js';
import { STALENESS_THRESHOLD_MS } from '../../../config.js';
import {
  listByAuthorParamsSchema,
  eprintListResponseSchema,
  type ListByAuthorParams,
  type EprintListResponse,
} from '../../../schemas/eprint.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.eprint.listByAuthor query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters with author DID
 * @returns Paginated list of author's eprints
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.eprint.listByAuthor?did=did:plc:abc&limit=20&sort=date
 *
 * Response:
 * {
 *   "eprints": [...],
 *   "hasMore": true,
 *   "cursor": "...",
 *   "total": 45
 * }
 * ```
 *
 * @public
 */
export async function listByAuthorHandler(
  c: Context<ChiveEnv>,
  params: ListByAuthorParams
): Promise<EprintListResponse> {
  const { eprint } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Listing eprints by author', {
    did: params.did,
    limit: params.limit,
    sort: params.sort,
  });

  const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
  const limit = params.limit ?? 50;

  const results = await eprint.getEprintsByAuthor(params.did as DID, {
    limit,
    offset,
    sortBy: params.sort === 'date' ? 'createdAt' : 'createdAt',
    sortOrder: 'desc',
  });

  const hasMore = offset + results.eprints.length < results.total;

  // Calculate staleness using configured threshold
  const stalenessThreshold = Date.now() - STALENESS_THRESHOLD_MS;

  // Map to response format
  const response: EprintListResponse = {
    eprints: results.eprints.map((p) => {
      // Extract rkey for record URL
      const rkey = p.uri.split('/').pop() ?? '';
      // Determine which PDS holds the record (paper's PDS if paperDid set, otherwise submitter's)
      const recordOwner = p.paperDid ?? p.submittedBy;
      const recordUrl = `${p.pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(recordOwner)}&collection=pub.chive.eprint.submission&rkey=${rkey}`;

      return {
        uri: p.uri,
        cid: p.cid,
        title: p.title,
        abstract: p.abstract.substring(0, 500), // Truncate for list view
        authors: p.authors.map((author) => ({
          did: author.did,
          name: author.name,
          orcid: author.orcid,
          email: author.email,
          order: author.order,
          affiliations: author.affiliations.map((aff) => ({
            name: aff.name,
            rorId: aff.rorId,
            department: aff.department,
          })),
          contributions: author.contributions.map((contrib) => ({
            typeUri: contrib.typeUri,
            typeId: contrib.typeId,
            typeLabel: contrib.typeLabel,
            degree: contrib.degree,
          })),
          isCorrespondingAuthor: author.isCorrespondingAuthor,
          isHighlighted: author.isHighlighted,
          handle: undefined as string | undefined,
          avatarUrl: undefined as string | undefined,
        })),
        submittedBy: p.submittedBy,
        paperDid: p.paperDid,
        fields: undefined as
          | { id?: string; uri: string; name: string; parentUri?: string }[]
          | undefined,
        license: p.license,
        createdAt: p.createdAt.toISOString(),
        indexedAt: p.indexedAt.toISOString(),
        source: {
          pdsEndpoint: p.pdsUrl,
          recordUrl,
          blobUrl: undefined as string | undefined,
          lastVerifiedAt: p.indexedAt.toISOString(),
          stale: p.indexedAt.getTime() < stalenessThreshold,
        },
        metrics: p.metrics
          ? {
              views: p.metrics.views,
              downloads: p.metrics.downloads,
              endorsements: p.metrics.endorsements,
            }
          : undefined,
      };
    }),
    cursor: hasMore ? String(offset + results.eprints.length) : undefined,
    hasMore,
    total: results.total,
  };

  logger.info('Author eprints listed', {
    did: params.did,
    count: response.eprints.length,
    total: results.total,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.eprint.listByAuthor.
 *
 * @public
 */
export const listByAuthorEndpoint: XRPCEndpoint<ListByAuthorParams, EprintListResponse> = {
  method: 'pub.chive.eprint.listByAuthor' as never,
  type: 'query',
  description: 'List eprint submissions by author DID',
  inputSchema: listByAuthorParamsSchema,
  outputSchema: eprintListResponseSchema,
  handler: listByAuthorHandler,
  auth: 'optional',
  rateLimit: 'authenticated',
};
