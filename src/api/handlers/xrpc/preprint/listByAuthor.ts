/**
 * XRPC handler for pub.chive.preprint.listByAuthor.
 *
 * @remarks
 * Lists all preprints by a specific author DID with pagination.
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
  preprintListResponseSchema,
  type ListByAuthorParams,
  type PreprintListResponse,
} from '../../../schemas/preprint.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.preprint.listByAuthor query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters with author DID
 * @returns Paginated list of author's preprints
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.preprint.listByAuthor?did=did:plc:abc&limit=20&sort=date
 *
 * Response:
 * {
 *   "preprints": [...],
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
): Promise<PreprintListResponse> {
  const { preprint } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Listing preprints by author', {
    did: params.did,
    limit: params.limit,
    sort: params.sort,
  });

  const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
  const limit = params.limit ?? 50;

  const results = await preprint.getPreprintsByAuthor(params.did as DID, {
    limit,
    offset,
    sortBy: params.sort === 'date' ? 'createdAt' : 'createdAt',
    sortOrder: 'desc',
  });

  const hasMore = offset + results.preprints.length < results.total;

  // Calculate staleness using configured threshold
  const stalenessThreshold = Date.now() - STALENESS_THRESHOLD_MS;

  // Map to response format
  const response: PreprintListResponse = {
    preprints: results.preprints.map((p) => {
      // Extract rkey for record URL
      const rkey = p.uri.split('/').pop() ?? '';
      // Determine which PDS holds the record (paper's PDS if paperDid set, otherwise submitter's)
      const recordOwner = p.paperDid ?? p.submittedBy;
      const recordUrl = `${p.pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(recordOwner)}&collection=pub.chive.preprint.submission&rkey=${rkey}`;

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
    cursor: hasMore ? String(offset + results.preprints.length) : undefined,
    hasMore,
    total: results.total,
  };

  logger.info('Author preprints listed', {
    did: params.did,
    count: response.preprints.length,
    total: results.total,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.preprint.listByAuthor.
 *
 * @public
 */
export const listByAuthorEndpoint: XRPCEndpoint<ListByAuthorParams, PreprintListResponse> = {
  method: 'pub.chive.preprint.listByAuthor' as never,
  type: 'query',
  description: 'List preprint submissions by author DID',
  inputSchema: listByAuthorParamsSchema,
  outputSchema: preprintListResponseSchema,
  handler: listByAuthorHandler,
  auth: 'optional',
  rateLimit: 'authenticated',
};
