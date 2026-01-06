/**
 * XRPC handler for pub.chive.preprint.searchSubmissions.
 *
 * @remarks
 * Full-text search across indexed preprints with faceted filtering.
 * Supports field, author, license, and date range filters.
 *
 * **ATProto Compliance:**
 * - Returns pdsUrl for each result
 * - Search operates on index data only
 *
 * **LTR Training:**
 * - Logs impressions with feature vectors for each result
 * - Returns impressionId for click correlation
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { TaxonomyCategoryMatcher } from '../../../../services/search/category-matcher.js';
import type { LTRFeatureVector } from '../../../../services/search/relevance-logger.js';
import { AcademicTextScorer } from '../../../../services/search/text-scorer.js';
import type { DID } from '../../../../types/atproto.js';
import { STALENESS_THRESHOLD_MS } from '../../../config.js';
import {
  searchPreprintsParamsSchema,
  searchResultsResponseSchema,
  type SearchPreprintsParams,
  type SearchResultsResponse,
} from '../../../schemas/preprint.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.preprint.searchSubmissions query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated search parameters
 * @returns Search results with facets and pagination
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.preprint.searchSubmissions?q=quantum+computing&limit=20
 *
 * Response:
 * {
 *   "hits": [...],
 *   "total": 150,
 *   "hasMore": true,
 *   "cursor": "...",
 *   "facets": { "field": [...], "license": [...] }
 * }
 * ```
 *
 * @public
 */
export async function searchSubmissionsHandler(
  c: Context<ChiveEnv>,
  params: SearchPreprintsParams
): Promise<SearchResultsResponse> {
  const { search, preprint, relevanceLogger, ranking } = c.get('services');
  const logger = c.get('logger');
  const user = c.get('user');

  // Get user's research fields for personalized ranking (if available)
  let userFields: readonly string[] = [];
  if (user?.did && ranking) {
    try {
      userFields = await ranking.getUserFields(user.did);
    } catch (error) {
      logger.warn('Failed to get user fields for ranking', {
        userDid: user.did,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.debug('Searching preprints', {
    query: params.q,
    limit: params.limit,
    field: params.field,
    author: params.author,
  });

  // Build search query
  const searchQuery = {
    q: params.q,
    limit: params.limit ?? 20,
    offset: params.cursor ? parseInt(params.cursor, 10) : 0,
    filters: {
      author: params.author as DID | undefined,
      subjects: params.field ? [params.field] : undefined,
      dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
      dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
    },
  };

  const searchResults = await search.search(searchQuery);

  // Calculate staleness using configured threshold
  const stalenessThreshold = Date.now() - STALENESS_THRESHOLD_MS;

  // Fetch full preprint details for each hit
  const enrichedHits = await Promise.all(
    searchResults.hits.map(async (hit) => {
      const preprintData = await preprint.getPreprint(hit.uri);

      if (!preprintData) {
        // Preprint may have been deleted, skip it
        return null;
      }

      // Extract rkey for record URL
      const rkey = preprintData.uri.split('/').pop() ?? '';
      const recordUrl = `${preprintData.pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(preprintData.author)}&collection=pub.chive.preprint.submission&rkey=${rkey}`;

      return {
        uri: preprintData.uri,
        cid: preprintData.cid,
        title: preprintData.title,
        abstract: preprintData.abstract.substring(0, 500), // Truncate for list view
        author: {
          did: preprintData.author,
          handle: undefined as string | undefined,
          displayName: undefined as string | undefined,
        },
        coAuthors: undefined as
          | { did: string; handle?: string; displayName?: string }[]
          | undefined,
        fields: undefined as { uri: string; name: string; parentUri?: string }[] | undefined,
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
        score: hit.score,
        highlights: hit.highlight
          ? Object.fromEntries(
              Object.entries({
                title: hit.highlight.title,
                abstract: hit.highlight.abstract,
              })
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, [...(v ?? [])]])
            )
          : undefined,
      };
    })
  );

  // Filter out null results (deleted preprints)
  const validHits = enrichedHits.filter((hit): hit is NonNullable<typeof hit> => hit !== null);

  const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
  const hasMore = offset + validHits.length < searchResults.total;

  // Generate impression ID and log impression for LTR training
  let impressionId: string | undefined;
  if (params.q && validHits.length > 0) {
    impressionId = relevanceLogger.createImpressionId();
    const queryId = relevanceLogger.computeQueryId(params.q);

    // Create text scorer and category matcher for computing feature scores
    const textScorer = new AcademicTextScorer();
    const categoryMatcher = new TaxonomyCategoryMatcher();

    // Extract features for each result
    const impressionResults = validHits.map((hit, index) => {
      // Compute text relevance features using academic text scorer
      const titleMatchScore = textScorer.score(params.q, hit.title);
      const abstractMatchScore = hit.abstract ? textScorer.score(params.q, hit.abstract) : 0;

      // Combined text relevance with field weights
      const textRelevance = textScorer.scoreMultiField(
        params.q,
        { title: hit.title, abstract: hit.abstract },
        { title: 1.0, abstract: 0.5 }
      );

      // Compute field match score if user has research fields
      // Note: hit.fields contains field URIs, we need to extract category names
      const itemCategories = hit.fields?.map((f) => f.name) ?? [];
      const fieldMatchScore =
        userFields.length > 0 && itemCategories.length > 0
          ? categoryMatcher.computeFieldScore(itemCategories, userFields)
          : 0;

      const features: LTRFeatureVector = {
        textRelevance,
        fieldMatchScore,
        titleMatchScore,
        abstractMatchScore,
        recencyScore: computeRecencyScore(hit.createdAt),
        bm25Score: hit.score ?? 0,
        originalPosition: index,
      };

      return {
        uri: hit.uri,
        position: index,
        features,
      };
    });

    // Log impression asynchronously (don't block response)
    relevanceLogger
      .logImpression({
        impressionId,
        queryId,
        query: params.q,
        userDid: user?.did,
        sessionId: c.get('requestId'),
        timestamp: new Date(),
        results: impressionResults,
      })
      .catch((error) => {
        logger.warn('Failed to log search impression', {
          impressionId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  const response: SearchResultsResponse = {
    hits: validHits,
    cursor: hasMore ? String(offset + validHits.length) : undefined,
    hasMore,
    total: searchResults.total,
    facets: undefined, // Faceted search not in basic interface
    impressionId,
  };

  logger.info('Search completed', {
    query: params.q,
    totalHits: searchResults.total,
    returnedHits: response.hits.length,
    impressionId,
  });

  return response;
}

/**
 * Computes recency score from publication date.
 *
 * @param dateStr - ISO date string
 * @returns Score from 0 (old) to 1 (recent)
 */
function computeRecencyScore(dateStr: string): number {
  const date = new Date(dateStr);
  const ageMs = Date.now() - date.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // Decay function: 1.0 for today, 0.5 at 365 days, asymptotic to 0
  return Math.exp(-ageDays / 365);
}

/**
 * Endpoint definition for pub.chive.preprint.searchSubmissions.
 *
 * @public
 */
export const searchSubmissionsEndpoint: XRPCEndpoint<SearchPreprintsParams, SearchResultsResponse> =
  {
    method: 'pub.chive.preprint.searchSubmissions' as never,
    type: 'query',
    description: 'Search preprint submissions with full-text and faceted filtering',
    inputSchema: searchPreprintsParamsSchema,
    outputSchema: searchResultsResponseSchema,
    handler: searchSubmissionsHandler,
    auth: 'optional',
    rateLimit: 'authenticated',
  };
