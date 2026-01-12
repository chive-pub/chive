/**
 * XRPC handler for pub.chive.metrics.getTrending.
 *
 * @remarks
 * Returns trending preprints based on view counts within a time window.
 * Supports 24h, 7d, and 30d windows.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import { STALENESS_THRESHOLD_MS } from '../../../config.js';
import { paginationQuerySchema } from '../../../schemas/common.js';
import { preprintSummarySchema } from '../../../schemas/preprint.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Trending window schema.
 */
const trendingWindowSchema = z.enum(['24h', '7d', '30d']).default('7d');

/**
 * Get trending params schema.
 */
export const getTrendingParamsSchema = paginationQuerySchema.extend({
  window: trendingWindowSchema.describe('Time window for trending calculation'),
});

/**
 * Get trending params type.
 */
export type GetTrendingParams = z.infer<typeof getTrendingParamsSchema>;

/**
 * Trending entry schema.
 */
const trendingEntrySchema = preprintSummarySchema.extend({
  viewsInWindow: z.number().int().describe('Views in the selected window'),
  rank: z.number().int().describe('Trending rank'),
  velocity: z
    .number()
    .optional()
    .describe('Velocity indicator: >0 accelerating, <0 decelerating (compared to baseline)'),
});

/**
 * Trending response schema.
 */
export const getTrendingResponseSchema = z.object({
  trending: z.array(trendingEntrySchema).describe('Trending preprints'),
  window: trendingWindowSchema,
  cursor: z.string().optional(),
  hasMore: z.boolean(),
});

/**
 * Trending response type.
 */
export type GetTrendingResponse = z.infer<typeof getTrendingResponseSchema>;

/**
 * Handler for pub.chive.metrics.getTrending query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Trending preprints for the selected time window
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.metrics.getTrending?window=7d&limit=20
 *
 * Response:
 * {
 *   "trending": [
 *     { "uri": "...", "title": "...", "viewsInWindow": 1500, "rank": 1 },
 *     ...
 *   ],
 *   "window": "7d"
 * }
 * ```
 *
 * @public
 */
export async function getTrendingHandler(
  c: Context<ChiveEnv>,
  params: GetTrendingParams
): Promise<GetTrendingResponse> {
  const { metrics, preprint } = c.get('services');
  const logger = c.get('logger');

  const limit = params.limit ?? 20;
  const window = params.window ?? '7d';

  logger.debug('Getting trending preprints', {
    window,
    limit,
  });

  // Get trending entries from metrics service
  const trendingEntries = await metrics.getTrending(window, limit);

  // Enrich with preprint data
  const enrichedTrending = await Promise.all(
    trendingEntries.map(async (entry, index) => {
      const preprintData = await preprint.getPreprint(entry.uri);

      if (!preprintData) {
        // Skip entries where preprint is no longer indexed
        return null;
      }

      // Extract rkey for record URL
      const rkey = preprintData.uri.split('/').pop() ?? '';
      // Determine which PDS holds the record (paper's PDS if paperDid set, otherwise submitter's)
      const recordOwner = preprintData.paperDid ?? preprintData.submittedBy;
      const recordUrl = `${preprintData.pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(recordOwner)}&collection=pub.chive.preprint.submission&rkey=${rkey}`;

      // Calculate staleness using configured threshold
      const stalenessThreshold = Date.now() - STALENESS_THRESHOLD_MS;

      return {
        uri: preprintData.uri,
        cid: preprintData.cid,
        title: preprintData.title,
        abstract: preprintData.abstract.substring(0, 500),
        authors: preprintData.authors.map((author) => ({
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
        submittedBy: preprintData.submittedBy,
        paperDid: preprintData.paperDid,
        fields: undefined as
          | { id?: string; uri: string; name: string; parentUri?: string }[]
          | undefined,
        license: preprintData.license,
        createdAt: preprintData.createdAt.toISOString(),
        indexedAt: preprintData.indexedAt.toISOString(),
        source: {
          pdsEndpoint: preprintData.pdsUrl,
          recordUrl,
          blobUrl: undefined as string | undefined,
          lastVerifiedAt: preprintData.indexedAt.toISOString(),
          stale: preprintData.indexedAt.getTime() < stalenessThreshold,
        },
        metrics: preprintData.metrics
          ? {
              views: preprintData.metrics.views,
              downloads: preprintData.metrics.downloads,
              endorsements: preprintData.metrics.endorsements,
            }
          : undefined,
        viewsInWindow: entry.score,
        rank: index + 1,
        velocity: entry.velocity,
      };
    })
  );

  // Filter out null entries and build response
  const validEntries = enrichedTrending.filter((e): e is NonNullable<typeof e> => e !== null);

  const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
  const hasMore = validEntries.length >= limit;

  const response: GetTrendingResponse = {
    trending: validEntries,
    window,
    cursor: hasMore ? String(offset + validEntries.length) : undefined,
    hasMore,
  };

  logger.info('Trending fetched', {
    window,
    count: validEntries.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.metrics.getTrending.
 *
 * @public
 */
export const getTrendingEndpoint: XRPCEndpoint<GetTrendingParams, GetTrendingResponse> = {
  method: 'pub.chive.metrics.getTrending' as never,
  type: 'query',
  description: 'Get trending preprints by view count in time window',
  inputSchema: getTrendingParamsSchema,
  outputSchema: getTrendingResponseSchema,
  handler: getTrendingHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
