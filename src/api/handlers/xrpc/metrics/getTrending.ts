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
import type { AtUri, DID } from '../../../../types/atproto.js';
import { expandFieldsWithNarrower } from '../../../../utils/field-expansion.js';
import { toWireFormat } from '../../../../utils/rich-text.js';
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
    const { metrics, eprint, graph, graphAlgorithmCache, profileHydrator } = c.get('services');
    const logger = c.get('logger');

    const limit = params.limit ?? 20;
    const window: QueryParams['window'] = params.window ?? '7d';

    // Expand field URIs to include child fields for consistent matching
    const expandedFieldUris = await expandFieldsWithNarrower(graph, params.fieldUris);
    const fieldUriSet = expandedFieldUris.length > 0 ? new Set(expandedFieldUris) : null;

    logger.debug('Getting trending eprints', {
      window,
      limit,
      usingCache: !!graphAlgorithmCache,
      fieldUriCount: fieldUriSet?.size ?? 0,
    });

    // The cursor is an offset into the ranked list. It was parsed only at the
    // end, to build the next cursor, and never passed to either data source, so
    // every page returned the same first `limit` entries while the cursor kept
    // advancing — paging that looked like it worked and never moved.
    const parsedCursor = params.cursor ? Number.parseInt(params.cursor, 10) : 0;
    const offset = Number.isFinite(parsedCursor) && parsedCursor > 0 ? parsedCursor : 0;

    // Try graph algorithm cache first for faster response
    let trendingEntries: { uri: string; score: number; velocity?: number }[] = [];

    if (graphAlgorithmCache) {
      try {
        const cachedTrending = await graphAlgorithmCache.getTrending(window);
        if (cachedTrending && cachedTrending.length > 0) {
          trendingEntries = cachedTrending.slice(offset, offset + limit).map((paper) => ({
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
      const metricsEntries = await metrics.getTrending(window, limit, offset);
      trendingEntries = metricsEntries.map((entry) => ({
        uri: entry.uri as string,
        score: entry.score,
        velocity: entry.velocity,
      }));
    }

    // One query for the page's eprints, and one profile lookup for every author
    // across the whole page. This used to issue a `getEprint` and a separate
    // call to the public Bluesky appview per entry — 40 network round trips for
    // 20 entries — and its `slice(0, 25)` silently dropped authors beyond the
    // first 25 of each eprint rather than batching them.
    const eprintsByUri = await eprint.getEprints(
      trendingEntries.map((entry) => entry.uri as AtUri)
    );

    const authorDidsOnPage = [
      ...new Set(
        [...eprintsByUri.values()].flatMap((data) =>
          (data.authors ?? [])
            .filter((a): a is typeof a & { did: DID } => Boolean(a.did) && !a.avatarUrl)
            .map((a) => a.did)
        )
      ),
    ];

    const profilesByDid = profileHydrator
      ? await profileHydrator.hydrate(authorDidsOnPage)
      : new Map<DID, { handle?: string; avatar?: string }>();

    // Enrich with eprint data
    // No longer async: the eprints and profiles for the whole page are already
    // resolved above, so this is a pure mapping over data in hand.
    const enrichedTrending = trendingEntries.map((entry, index) => {
      const eprintData = eprintsByUri.get(entry.uri as AtUri);

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

      // Profiles for this entry's authors, taken from the page-wide lookup.
      const avatarMap = profilesByDid;

      return {
        uri: eprintData.uri,
        cid: eprintData.cid,
        title: eprintData.title,
        abstract: toWireFormat(eprintData.abstract) ?? [],
        authors: eprintData.authors.map((author) => {
          const profile = author.did ? avatarMap.get(author.did) : undefined;
          return {
            did: author.did,
            name: author.name,
            orcid: author.orcid,
            email: author.email,
            order: author.order,
            affiliations: (author.affiliations ?? []).map((aff) => ({
              name: aff.name,
              institutionUri: aff.institutionUri,
              rorId: aff.rorId,
              children: aff.children,
            })),
            contributions: (author.contributions ?? []).map((contrib) => ({
              typeUri: contrib.typeUri,
              typeId: contrib.typeId,
              typeLabel: contrib.typeLabel,
              degree: contrib.degree,
            })),
            isCorrespondingAuthor: author.isCorrespondingAuthor,
            isHighlighted: author.isHighlighted,
            handle: author.handle ?? profile?.handle,
            avatarUrl: author.avatarUrl ?? profile?.avatar,
          };
        }),
        submittedBy: eprintData.submittedBy,
        paperDid: eprintData.paperDid,
        fields: eprintData.fields?.map((f) => ({
          id: f.id,
          uri: f.uri,
          label: f.label,
          parentUri: f.parentUri,
        })),
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
        inUserFields: undefined as boolean | undefined,
      };
    });

    // Filter out null entries and build response
    const validEntries = enrichedTrending.filter((e): e is NonNullable<typeof e> => e !== null);

    // If fieldUris were provided, flag entries that match and sort in-field first
    if (fieldUriSet) {
      for (const entry of validEntries) {
        const eprintFieldUris = entry.fields?.map((f) => f.uri) ?? [];
        entry.inUserFields = eprintFieldUris.some((uri) => fieldUriSet.has(uri));
      }

      // Stable sort: in-field entries first, preserving original rank order within groups
      validEntries.sort((a, b) => {
        const aInField = a.inUserFields ? 1 : 0;
        const bInField = b.inUserFields ? 1 : 0;
        if (aInField !== bInField) return bInField - aInField;
        return a.rank - b.rank;
      });

      // Re-assign ranks after sorting
      for (let i = 0; i < validEntries.length; i++) {
        const entry = validEntries[i];
        if (entry) {
          entry.rank = i + 1;
        }
      }
    }

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
