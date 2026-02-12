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
import type { KnowledgeGraphService } from '../../../../services/knowledge-graph/graph-service.js';
import { TaxonomyCategoryMatcher } from '../../../../services/search/category-matcher.js';
import type { LTRFeatureVector } from '../../../../services/search/relevance-logger.js';
import { AcademicTextScorer } from '../../../../services/search/text-scorer.js';
import type { DID } from '../../../../types/atproto.js';
import type { GraphNode } from '../../../../types/interfaces/graph.interface.js';
import { normalizeFieldUri } from '../../../../utils/at-uri.js';
import { resolveFieldLabels } from '../../../../utils/field-label.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Computes recency score from publication date.
 *
 * @param dateStr - ISO date string
 * @returns score from 0 (old) to 1 (recent)
 *
 * @example
 * ```typescript
 * computeRecencyScore('2024-01-15T00:00:00Z'); // ~0.97 for a recent date
 * computeRecencyScore('2020-01-15T00:00:00Z'); // ~0.37 for an older date
 * ```
 */
function computeRecencyScore(dateStr: string): number {
  const date = new Date(dateStr);
  const ageMs = Date.now() - date.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays / 365);
}

/**
 * Hierarchy type returned by KnowledgeGraphService.getHierarchy.
 *
 * @internal
 */
interface HierarchyNode {
  node: GraphNode;
  children: HierarchyNode[];
  depth: number;
}

/**
 * Flattens a hierarchy to extract all URIs including children.
 *
 * @param hierarchy - the node hierarchy to flatten
 * @returns array of all node URIs in the hierarchy
 *
 * @example
 * ```typescript
 * const uris = flattenHierarchy(hierarchy);
 * // ['at://did:plc:abc/pub.chive.graph.node/2d3e4f5a-6b7c-8d9e-0f1a-2b3c4d5e6f7a', 'at://did:plc:abc/pub.chive.graph.node/3e4f5a6b-7c8d-9e0f-1a2b-3c4d5e6f7a8b']
 * ```
 */
function flattenHierarchy(hierarchy: HierarchyNode): string[] {
  const uris: string[] = [];
  if (hierarchy.node.uri) {
    uris.push(hierarchy.node.uri);
  }
  for (const child of hierarchy.children) {
    uris.push(...flattenHierarchy(child));
  }
  return uris;
}

/**
 * Expands field URIs to include narrower (child) fields.
 *
 * @param graph - the knowledge graph service
 * @param fieldUris - array of field URIs to expand
 * @param maxDepth - maximum depth to traverse (default: 3)
 * @returns expanded array including original and child field URIs
 *
 * @example
 * ```typescript
 * const expanded = await expandFieldsWithNarrower(graph, ['at://did/col/cs'], 2);
 * // ['at://did/col/cs', 'at://did/col/cs.ai', 'at://did/col/cs.ml']
 * ```
 */
async function expandFieldsWithNarrower(
  graph: KnowledgeGraphService | undefined,
  fieldUris: readonly string[] | undefined,
  maxDepth = 3
): Promise<string[]> {
  if (!graph || !fieldUris || fieldUris.length === 0) {
    return fieldUris ? [...fieldUris] : [];
  }

  // Normalize all field URIs to AT-URI format before hierarchy lookup
  const normalizedUris = fieldUris.map((uri) => normalizeFieldUri(uri));
  const expanded = new Set<string>(normalizedUris);

  const expansionPromises = normalizedUris.map(async (uri) => {
    try {
      const hierarchy = await graph.getHierarchy(uri, maxDepth);
      if (!hierarchy) {
        return [uri];
      }
      const childUris = flattenHierarchy(hierarchy as HierarchyNode);
      return childUris;
    } catch {
      // If hierarchy lookup fails, just use the original URI
      return [uri];
    }
  });

  const results = await Promise.all(expansionPromises);
  for (const uris of results) {
    for (const uri of uris) {
      expanded.add(uri);
    }
  }

  return Array.from(expanded);
}

/**
 * XRPC method for pub.chive.eprint.searchSubmissions.
 *
 * @remarks
 * Performs full-text search with optional faceted filtering.
 * Supports browsing mode (no query) which returns all indexed eprints.
 * Logs impressions for LTR training when a text query is provided.
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.eprint.searchSubmissions?q=neural+networks&limit=20
 *
 * Response:
 * {
 *   "hits": [
 *     { "uri": "at://did:plc:abc/pub.chive.eprint.submission/xyz", "score": 1500, "title": "..." }
 *   ],
 *   "total": 42,
 *   "cursor": "20"
 * }
 * ```
 *
 * @public
 */
export const searchSubmissions: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { search, eprint, relevanceLogger, ranking, graph } = c.get('services');
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

    // Expand fieldUris to include narrower (child) fields
    const expandedFieldUris = await expandFieldsWithNarrower(graph, params.fieldUris);

    logger.debug('Searching eprints', {
      query: queryString,
      limit: params.limit,
      fieldUris: params.fieldUris,
      expandedFieldUris:
        expandedFieldUris.length > (params.fieldUris?.length ?? 0) ? expandedFieldUris : undefined,
      author: params.author,
      browsingMode: !params.q,
    });

    const searchQuery = {
      q: queryString,
      limit: params.limit ?? 20,
      offset: params.cursor ? parseInt(params.cursor, 10) : 0,
      filters: {
        author: params.author as DID | undefined,
        subjects: expandedFieldUris.length > 0 ? expandedFieldUris : undefined,
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

    // Fetch eprint data for all results to include title/authors
    const eprintDataForResponse = new Map<string, Awaited<ReturnType<typeof eprint.getEprint>>>();
    if (searchResults.hits.length > 0) {
      // If we already fetched for LTR logging, reuse that data
      if (hasTextQuery && eprintDataMap.size > 0) {
        for (const [uri, data] of eprintDataMap) {
          eprintDataForResponse.set(uri, data);
        }
      } else {
        // Otherwise fetch eprint data for response
        const eprintPromises = searchResults.hits.map(async (hit) => {
          const data = await eprint.getEprint(hit.uri);
          if (data) {
            eprintDataForResponse.set(hit.uri, data);
          }
        });
        await Promise.all(eprintPromises);
      }
    }

    // Collect author DIDs for avatar fetching
    const allAuthorDids = new Set<string>();
    for (const [, data] of eprintDataForResponse) {
      for (const author of data?.authors ?? []) {
        if (author.did && !author.avatarUrl) {
          allAuthorDids.add(author.did);
        }
      }
    }

    // Fetch avatars from Bluesky API
    const avatarMap = new Map<string, { handle?: string; avatar?: string }>();
    if (allAuthorDids.size > 0) {
      const dids = Array.from(allAuthorDids);
      const batchSize = 25;
      for (let i = 0; i < dids.length; i += batchSize) {
        const batch = dids.slice(i, i + batchSize);
        try {
          const urlParams = new URLSearchParams();
          for (const did of batch) {
            urlParams.append('actors', did);
          }
          const profileResponse = await fetch(
            `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${urlParams.toString()}`,
            {
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(5000),
            }
          );
          if (profileResponse.ok) {
            const profileData = (await profileResponse.json()) as {
              profiles: { did: string; handle?: string; avatar?: string }[];
            };
            for (const profile of profileData.profiles) {
              avatarMap.set(profile.did, { handle: profile.handle, avatar: profile.avatar });
            }
          }
        } catch {
          // Silently ignore avatar fetch failures
        }
      }
    }

    // Resolve field labels for all eprints in one batch
    const { nodeRepository } = c.get('services');

    const response: OutputSchema = {
      hits: await Promise.all(
        searchResults.hits.map(async (hit) => {
          const eprintData = eprintDataForResponse.get(hit.uri);
          return {
            uri: hit.uri,
            // Lexicon expects integer score scaled by 1000 for precision
            score: Math.round((hit.score ?? 0) * 1000),
            title: eprintData?.title,
            authors: eprintData?.authors?.map((a) => {
              const profile = a.did ? avatarMap.get(a.did) : undefined;
              return {
                ...(a.did ? { did: a.did } : {}),
                name: a.name,
                handle: a.handle ?? profile?.handle,
                avatarUrl: a.avatarUrl ?? profile?.avatar,
              };
            }),
            abstract: eprintData?.abstractPlainText,
            fields: await resolveFieldLabels(eprintData?.fields, nodeRepository).catch(
              () => undefined
            ),
            // Include dates for frontend display
            indexedAt: eprintData?.indexedAt?.toISOString(),
            createdAt: eprintData?.createdAt?.toISOString(),
            highlight: hit.highlight
              ? {
                  title: hit.highlight.title ? [...hit.highlight.title] : undefined,
                  abstract: hit.highlight.abstract ? [...hit.highlight.abstract] : undefined,
                }
              : undefined,
          };
        })
      ),
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
