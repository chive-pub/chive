/**
 * XRPC handler for pub.chive.eprint.searchSubmissions.
 *
 * @remarks
 * Full-text search across indexed eprints with faceted filtering.
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

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/eprint/searchSubmissions.js';
import { TaxonomyCategoryMatcher } from '../../../../services/search/category-matcher.js';
import type { LTRFeatureVector } from '../../../../services/search/relevance-logger.js';
import { AcademicTextScorer } from '../../../../services/search/text-scorer.js';
import type { DID } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

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
  return Math.exp(-ageDays / 365);
}

/**
 * XRPC method for pub.chive.eprint.searchSubmissions.
 *
 * @public
 */
export const searchSubmissions: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { search, eprint, relevanceLogger, ranking } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

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

    // Use '*' as the query string for browsing mode (returns all documents)
    const queryString = params.q ?? '*';

    logger.debug('Searching eprints', {
      query: queryString,
      limit: params.limit,
      fieldUris: params.fieldUris,
      author: params.author,
      browsingMode: !params.q,
    });

    const searchQuery = {
      q: queryString,
      limit: params.limit ?? 20,
      offset: params.cursor ? parseInt(params.cursor, 10) : 0,
      filters: {
        author: params.author as DID | undefined,
        subjects: params.fieldUris,
        dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
        dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
      },
    };

    const searchResults = await search.search(searchQuery);

    // For LTR logging, we still need to fetch eprint data
    const eprintDataMap = new Map<string, Awaited<ReturnType<typeof eprint.getEprint>>>();
    const userQuery = params.q;
    const hasTextQuery = userQuery !== undefined && userQuery !== '*';

    if (hasTextQuery && searchResults.hits.length > 0) {
      const eprintPromises = searchResults.hits.map(async (hit) => {
        const data = await eprint.getEprint(hit.uri);
        if (data) {
          eprintDataMap.set(hit.uri, data);
        }
      });
      await Promise.all(eprintPromises);

      const impressionId = relevanceLogger.createImpressionId();
      const queryId = relevanceLogger.computeQueryId(userQuery);

      const textScorer = new AcademicTextScorer();
      const categoryMatcher = new TaxonomyCategoryMatcher();

      const impressionResults = searchResults.hits.map((hit, index) => {
        const eprintData = eprintDataMap.get(hit.uri);
        const title = eprintData?.title ?? '';
        const abstract = eprintData?.abstractPlainText ?? '';
        const titleMatchScore = textScorer.score(userQuery, title);
        const abstractMatchScore = abstract ? textScorer.score(userQuery, abstract) : 0;
        const textRelevance = textScorer.scoreMultiField(
          userQuery,
          { title, abstract },
          { title: 1.0, abstract: 0.5 }
        );

        const itemCategories = eprintData?.fields?.map((f) => f.label) ?? [];
        const fieldMatchScore =
          userFields.length > 0 && itemCategories.length > 0
            ? categoryMatcher.computeFieldScore(itemCategories, userFields)
            : 0;

        const createdAt = eprintData?.createdAt?.toISOString() ?? new Date().toISOString();
        const features: LTRFeatureVector = {
          textRelevance,
          fieldMatchScore,
          titleMatchScore,
          abstractMatchScore,
          recencyScore: computeRecencyScore(createdAt),
          bm25Score: hit.score ?? 0,
          originalPosition: index,
        };

        return { uri: hit.uri, position: index, features };
      });

      relevanceLogger
        .logImpression({
          impressionId,
          queryId,
          query: userQuery,
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

    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
    const hasMore = offset + searchResults.hits.length < searchResults.total;

    const response: OutputSchema = {
      hits: searchResults.hits.map((hit) => ({
        uri: hit.uri,
        // Lexicon expects integer score scaled by 1000 for precision
        score: Math.round((hit.score ?? 0) * 1000),
        highlight: hit.highlight
          ? {
              title: hit.highlight.title ? [...hit.highlight.title] : undefined,
              abstract: hit.highlight.abstract ? [...hit.highlight.abstract] : undefined,
            }
          : undefined,
      })),
      cursor: hasMore ? String(offset + searchResults.hits.length) : undefined,
      total: searchResults.total,
      facetAggregations: undefined,
    };

    logger.info('Search completed', {
      query: queryString,
      totalHits: searchResults.total,
      returnedHits: response.hits.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
