/**
 * XRPC handler for pub.chive.metrics.getTrending.
 *
 * @remarks
 * Returns trending eprints based on view counts within a time window.
 * Supports 24h, 7d, and 30d windows.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  TrendingEntry,
} from '../../../../lexicons/generated/types/pub/chive/metrics/getTrending.js';
import type { AtUri } from '../../../../types/atproto.js';
import { extractPlainText } from '../../../../utils/rich-text.js';
import { STALENESS_THRESHOLD_MS } from '../../../config.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.metrics.getTrending.
 *
 * @public
 */
export const getTrending: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { metrics, eprint, graphAlgorithmCache } = c.get('services');
    const logger = c.get('logger');

    const limit = params.limit ?? 20;
    const window: QueryParams['window'] = params.window ?? '7d';

    logger.debug('Getting trending eprints', {
      window,
      limit,
      usingCache: !!graphAlgorithmCache,
    });

    // Try graph algorithm cache first for faster response
    let trendingEntries: { uri: string; score: number; velocity?: number }[] = [];

    if (graphAlgorithmCache) {
      try {
        const cachedTrending = await graphAlgorithmCache.getTrending(window);
        if (cachedTrending && cachedTrending.length > 0) {
          trendingEntries = cachedTrending.slice(0, limit).map((paper) => ({
            uri: paper.uri as string,
            score: paper.viewCount ?? paper.score,
            velocity: undefined,
          }));
          logger.debug('Using cached trending data', { count: trendingEntries.length });
        }
      } catch (error) {
        logger.warn('Failed to get cached trending', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fall back to metrics service if no cached data
    if (trendingEntries.length === 0) {
      const metricsEntries = await metrics.getTrending(window, limit);
      trendingEntries = metricsEntries.map((entry) => ({
        uri: entry.uri as string,
        score: entry.score,
        velocity: entry.velocity,
      }));
    }

    // Enrich with eprint data
    const enrichedTrending = await Promise.all(
      trendingEntries.map(async (entry, index) => {
        const eprintData = await eprint.getEprint(entry.uri as AtUri);

        if (!eprintData) {
          // Skip entries where eprint is no longer indexed
          return null;
        }

        // Extract rkey for record URL
        const rkey = eprintData.uri.split('/').pop() ?? '';
        // Determine which PDS holds the record (paper's PDS if paperDid set, otherwise submitter's)
        const recordOwner = eprintData.paperDid ?? eprintData.submittedBy;
        const recordUrl = `${eprintData.pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(recordOwner)}&collection=pub.chive.eprint.submission&rkey=${rkey}`;

        // Calculate staleness using configured threshold
        const stalenessThreshold = Date.now() - STALENESS_THRESHOLD_MS;

        const plainAbstract = eprintData.abstractPlainText ?? extractPlainText(eprintData.abstract);
        return {
          uri: eprintData.uri,
          cid: eprintData.cid,
          title: eprintData.title,
          abstract: plainAbstract.substring(0, 500),
          authors: eprintData.authors.map((author) => ({
            did: author.did,
            name: author.name,
            orcid: author.orcid,
            email: author.email,
            order: author.order,
            affiliations: (author.affiliations ?? []).map((aff) => ({
              name: aff.name,
              rorId: aff.rorId,
              department: aff.department,
            })),
            contributions: (author.contributions ?? []).map((contrib) => ({
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
          submittedBy: eprintData.submittedBy,
          paperDid: eprintData.paperDid,
          fields: undefined as
            | { id?: string; uri: string; label: string; parentUri?: string }[]
            | undefined,
          license: eprintData.license,
          createdAt: eprintData.createdAt.toISOString(),
          indexedAt: eprintData.indexedAt.toISOString(),
          source: {
            pdsEndpoint: eprintData.pdsUrl,
            recordUrl,
            blobUrl: undefined as string | undefined,
            lastVerifiedAt: eprintData.indexedAt.toISOString(),
            stale: eprintData.indexedAt.getTime() < stalenessThreshold,
          },
          metrics: eprintData.metrics
            ? {
                views: eprintData.metrics.views,
                downloads: eprintData.metrics.downloads,
                endorsements: eprintData.metrics.endorsements,
              }
            : undefined,
          viewsInWindow: entry.score,
          rank: index + 1,
          // Lexicon expects velocity as integer percentage (scaled from 0-1 ratio)
          velocity: entry.velocity !== undefined ? Math.round(entry.velocity * 100) : undefined,
        };
      })
    );

    // Filter out null entries and build response
    const validEntries = enrichedTrending.filter((e): e is NonNullable<typeof e> => e !== null);

    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
    const hasMore = validEntries.length >= limit;

    const response: OutputSchema = {
      trending: validEntries as TrendingEntry[],
      window,
      cursor: hasMore ? String(offset + validEntries.length) : undefined,
      hasMore,
    };

    logger.info('Trending fetched', {
      window,
      count: validEntries.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
