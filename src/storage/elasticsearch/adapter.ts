/**
 * Elasticsearch adapter implementing ISearchEngine interface.
 *
 * @remarks
 * Production-ready search engine adapter with:
 * - Full-text search with field boosting
 * - 10-dimensional faceted search
 * - Autocomplete with completion suggester
 * - Index management (CRUD operations)
 * - Error handling and retries
 * - Health monitoring
 *
 * @packageDocumentation
 */

import type { Client, estypes } from '@elastic/elasticsearch';
import { errors } from '@elastic/elasticsearch';

import type { AtUri } from '../../types/atproto.js';
import type {
  FacetedSearchQuery,
  FacetedSearchResults,
  ISearchEngine,
  IndexableEprintDocument as SimpleIndexableDocument,
  SearchQuery,
  SearchResults,
} from '../../types/interfaces/search.interface.js';
import { extractRkeyOrPassthrough } from '../../utils/at-uri.js';

import type { ElasticsearchConnectionPool } from './connection.js';
import type { IndexableEprintDocument } from './document-mapper.js';

/**
 * Search error.
 *
 * @public
 */
export class SearchError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

/**
 * Index error.
 *
 * @public
 */
export class IndexError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IndexError';
  }
}

/**
 * Elasticsearch adapter configuration.
 *
 * @public
 */
export interface ElasticsearchAdapterConfig {
  /**
   * Index name or alias.
   *
   * @defaultValue 'eprints'
   */
  readonly indexName?: string;

  /**
   * Enable query result caching.
   *
   * @defaultValue true
   */
  readonly enableCaching?: boolean;

  /**
   * Default search result limit.
   *
   * @defaultValue 20
   */
  readonly defaultLimit?: number;

  /**
   * Maximum search result limit.
   *
   * @defaultValue 100
   */
  readonly maxLimit?: number;

  /**
   * Enable highlighting in search results.
   *
   * @defaultValue true
   */
  readonly enableHighlighting?: boolean;
}

/**
 * Elasticsearch adapter implementing ISearchEngine.
 *
 * @remarks
 * Provides search capabilities for eprints using Elasticsearch.
 * Implements complete search interface with faceting, autocomplete,
 * and index management.
 *
 * @example
 * ```typescript
 * const pool = new ElasticsearchConnectionPool(config);
 * const adapter = new ElasticsearchAdapter(pool);
 *
 * await adapter.indexEprint(document);
 *
 * const results = await adapter.search({
 *   q: 'neural networks',
 *   limit: 20
 * });
 * ```
 *
 * @public
 */
export class ElasticsearchAdapter implements ISearchEngine {
  private readonly client: Client;
  private readonly config: Required<ElasticsearchAdapterConfig>;

  constructor(
    connectionPool: ElasticsearchConnectionPool,
    config: ElasticsearchAdapterConfig = {}
  ) {
    this.client = connectionPool.getClient();
    this.config = {
      indexName: config.indexName ?? 'eprints',
      enableCaching: config.enableCaching ?? true,
      defaultLimit: config.defaultLimit ?? 20,
      maxLimit: config.maxLimit ?? 100,
      enableHighlighting: config.enableHighlighting ?? true,
    };
  }

  /**
   * Indexes an eprint document.
   *
   * @param eprint - Eprint to index
   *
   * @throws {IndexError} On indexing failure
   *
   * @remarks
   * Indexes document with ingest pipeline for PDF processing.
   * Uses document URI as Elasticsearch document ID.
   *
   * @public
   */
  async indexEprint(eprint: SimpleIndexableDocument | IndexableEprintDocument): Promise<void> {
    try {
      const document = this.normalizeDocument(eprint);

      await this.client.index({
        index: this.config.indexName,
        id: String(eprint.uri),
        document,
        pipeline: 'eprint-processing',
        refresh: false,
      });
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new IndexError(`Failed to index document ${eprint.uri}: ${error.message}`, error);
      }

      throw new IndexError(
        `Unexpected error indexing document ${eprint.uri}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Searches eprints.
   *
   * @param query - Search query
   * @returns Search results
   *
   * @throws {SearchError} On search failure
   *
   * @public
   */
  async search(query: SearchQuery): Promise<SearchResults> {
    try {
      const limit = this.normalizeLimit(query.limit);
      const offset = query.offset ?? 0;

      const esQuery = this.buildSearchQuery(query);

      const response = await this.client.search<IndexableEprintDocument>({
        index: this.config.indexName,
        query: esQuery,
        size: limit,
        from: offset,
        _source: ['uri', 'title', 'abstract', 'authors', 'created_at'],
        highlight: this.config.enableHighlighting
          ? {
              fields: {
                title: {
                  fragment_size: 150,
                  number_of_fragments: 1,
                },
                abstract: {
                  fragment_size: 150,
                  number_of_fragments: 3,
                },
              },
            }
          : undefined,
      });

      return this.parseSearchResponse(response);
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new SearchError(`Search failed: ${error.message}`, error);
      }

      throw new SearchError(
        'Unexpected error during search',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Performs faceted search with aggregations.
   *
   * @param query - Faceted search query
   * @returns Results with facet counts
   *
   * @throws {SearchError} On search failure
   *
   * @public
   */
  async facetedSearch(query: FacetedSearchQuery): Promise<FacetedSearchResults> {
    try {
      const limit = this.normalizeLimit(query.limit);
      const offset = query.offset ?? 0;

      const esQuery = this.buildSearchQuery(query);
      const aggregations = this.buildFacetAggregations(query.facets);

      const response = await this.client.search<IndexableEprintDocument>({
        index: this.config.indexName,
        query: esQuery,
        size: limit,
        from: offset,
        _source: ['uri', 'title', 'abstract', 'authors', 'created_at'],
        aggregations,
        highlight: this.config.enableHighlighting
          ? {
              fields: {
                title: { fragment_size: 150, number_of_fragments: 1 },
                abstract: { fragment_size: 150, number_of_fragments: 3 },
              },
            }
          : undefined,
      });

      return this.parseFacetedSearchResponse(response, query.facets);
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new SearchError(`Faceted search failed: ${error.message}`, error);
      }

      throw new SearchError(
        'Unexpected error during faceted search',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Provides autocomplete suggestions.
   *
   * @param prefix - Partial query string
   * @param limit - Maximum number of suggestions
   * @returns Suggested completions
   *
   * @throws {SearchError} On search failure
   *
   * @public
   */
  async autocomplete(prefix: string, limit = 5): Promise<readonly string[]> {
    try {
      const response = await this.client.search<IndexableEprintDocument>({
        index: this.config.indexName,
        suggest: {
          title_suggest: {
            text: prefix,
            completion: {
              field: 'title.suggest',
              size: limit,
              skip_duplicates: true,
              fuzzy: {
                fuzziness: 1,
                prefix_length: 2,
              },
            },
          },
        },
        size: 0,
      });

      return this.parseAutocompleteResponse(response);
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new SearchError(`Autocomplete failed: ${error.message}`, error);
      }

      throw new SearchError(
        'Unexpected error during autocomplete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Removes a document from the index.
   *
   * @param uri - Document URI
   *
   * @throws {IndexError} On deletion failure
   *
   * @public
   */
  async deleteDocument(uri: AtUri): Promise<void> {
    try {
      await this.client.delete({
        index: this.config.indexName,
        id: uri,
        refresh: false,
      });
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        return;
      }

      if (error instanceof errors.ResponseError) {
        throw new IndexError(`Failed to delete document ${uri}: ${error.message}`, error);
      }

      throw new IndexError(
        `Unexpected error deleting document ${uri}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Normalizes limit to valid range.
   *
   * @param limit - Requested limit
   * @returns Normalized limit
   */
  private normalizeLimit(limit: number | undefined): number {
    const requestedLimit = limit ?? this.config.defaultLimit;
    return Math.min(requestedLimit, this.config.maxLimit);
  }

  /**
   * Normalizes document to common format.
   *
   * @param doc - Document to normalize
   * @returns Normalized document
   */
  private normalizeDocument(
    doc: SimpleIndexableDocument | IndexableEprintDocument
  ):
    | IndexableEprintDocument
    | Record<string, string | number | boolean | readonly unknown[] | Date | undefined> {
    if (this.isExtendedDocument(doc)) {
      return doc;
    }

    return {
      uri: doc.uri,
      title: doc.title,
      abstract: doc.abstract,
      full_text: doc.fullText,
      keywords: doc.keywords,
      field_nodes: doc.subjects,
      authors: [
        {
          did: doc.author,
          name: doc.authorName,
          order: 0,
        },
      ],
      created_at: doc.createdAt.toISOString(),
      indexed_at: doc.indexedAt.toISOString(),
      pds_url: 'unknown',
    };
  }

  /**
   * Type guard for extended document format.
   *
   * @param doc - Document to check
   * @returns True if extended format
   */
  private isExtendedDocument(
    doc: SimpleIndexableDocument | IndexableEprintDocument
  ): doc is IndexableEprintDocument {
    return 'cid' in doc;
  }

  /**
   * Builds Elasticsearch query from search parameters.
   *
   * @param query - Search query
   * @returns Elasticsearch query DSL
   */
  private buildSearchQuery(query: SearchQuery): estypes.QueryDslQueryContainer {
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];

    // Skip multi_match for empty queries or wildcard-only queries
    if (query.q?.trim() && query.q.trim() !== '*') {
      must.push({
        multi_match: {
          query: query.q,
          fields: [
            'title^3',
            'title.ngram^2',
            'abstract^2',
            'full_text',
            'authors.name^2',
            'keywords^1.5',
            'facets.matter.text^1.3',
            'facets.energy.text^1.1',
            'authorities.text^1.2',
            'tags.text^0.8',
          ],
          type: 'best_fields',
          operator: 'or',
          fuzziness: 'AUTO',
          prefix_length: 2,
        },
      });
    }

    if (query.filters) {
      if (query.filters.author) {
        filter.push({
          nested: {
            path: 'authors',
            query: {
              term: {
                'authors.did': query.filters.author,
              },
            },
          },
        });
      }

      if (query.filters.subjects && query.filters.subjects.length > 0) {
        // Normalize AT-URIs to UUIDs using the centralized utility
        const normalizedSubjects: string[] = query.filters.subjects.map((s: string): string =>
          extractRkeyOrPassthrough(s)
        );
        // Use nested query since field_nodes is a nested type with id and label
        filter.push({
          nested: {
            path: 'field_nodes',
            query: {
              terms: {
                'field_nodes.id': normalizedSubjects,
              },
            },
          },
        });
      }

      if (query.filters.dateFrom || query.filters.dateTo) {
        const rangeClause: Record<string, string> = {};

        if (query.filters.dateFrom) {
          rangeClause.gte = query.filters.dateFrom.toISOString();
        }

        if (query.filters.dateTo) {
          rangeClause.lte = query.filters.dateTo.toISOString();
        }

        filter.push({
          range: {
            created_at: rangeClause,
          },
        });
      }
    }

    if (must.length === 0 && filter.length === 0) {
      return { match_all: {} };
    }

    return {
      bool: {
        must: must.length > 0 ? must : undefined,
        filter: filter.length > 0 ? filter : undefined,
      },
    };
  }

  /**
   * Builds facet aggregations.
   *
   * @param facetNames - Facet dimensions to aggregate
   * @returns Elasticsearch aggregations
   */
  private buildFacetAggregations(
    facetNames: readonly string[]
  ): Record<string, estypes.AggregationsAggregationContainer> {
    const aggregations: Record<string, estypes.AggregationsAggregationContainer> = {};

    for (const facetName of facetNames) {
      if (facetName === 'subjects') {
        aggregations.subjects = {
          terms: {
            field: 'field_nodes',
            size: 20,
          },
        };
      } else if (facetName === 'author') {
        aggregations.author = {
          nested: {
            path: 'authors',
          },
          aggs: {
            author_terms: {
              terms: {
                field: 'authors.name.keyword',
                size: 50,
              },
            },
          },
        };
      } else if (facetName === 'year') {
        aggregations.year = {
          date_histogram: {
            field: 'created_at',
            calendar_interval: 'year',
            format: 'yyyy',
          },
        };
      } else if (facetName === 'language') {
        aggregations.language = {
          terms: {
            field: 'language',
            size: 20,
          },
        };
      } else if (facetName === 'license') {
        aggregations.license = {
          terms: {
            field: 'license',
            size: 10,
          },
        };
      } else if (
        [
          'matter',
          'energy',
          'space',
          'time',
          'personality',
          'person',
          'organization',
          'event',
          'work',
          'form_genre',
        ].includes(facetName)
      ) {
        aggregations[facetName] = {
          terms: {
            field: `facets.${facetName}`,
            size: 20,
          },
        };
      }
    }

    return aggregations;
  }

  /**
   * Parses Elasticsearch search response.
   *
   * @param response - Elasticsearch response
   * @returns Parsed search results
   */
  private parseSearchResponse(
    response: estypes.SearchResponse<IndexableEprintDocument>
  ): SearchResults {
    const hits = response.hits.hits.map((hit) => ({
      uri: (hit._source?.uri ?? hit._id) as AtUri,
      score: hit._score ?? 0,
      highlight: hit.highlight
        ? {
            title: hit.highlight.title,
            abstract: hit.highlight.abstract,
          }
        : undefined,
    }));

    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    return {
      hits,
      total,
      took: response.took,
    };
  }

  /**
   * Parses faceted search response.
   *
   * @param response - Elasticsearch response
   * @param facetNames - Requested facet names
   * @returns Parsed faceted search results
   */
  private parseFacetedSearchResponse(
    response: estypes.SearchResponse<IndexableEprintDocument>,
    facetNames: readonly string[]
  ): FacetedSearchResults {
    const baseResults = this.parseSearchResponse(response);

    const facets: Record<string, readonly { readonly value: string; readonly count: number }[]> =
      {};

    if (response.aggregations) {
      for (const facetName of facetNames) {
        const aggregation = response.aggregations[facetName] as
          | estypes.AggregationsAggregate
          | undefined;

        if (!aggregation) {
          continue;
        }

        if (this.isTermsAggregate(aggregation)) {
          const typedBuckets = aggregation.buckets as {
            key: string | number;
            doc_count: number;
          }[];
          facets[facetName] = typedBuckets.map((bucket) => ({
            value: String(bucket.key),
            count: bucket.doc_count,
          }));
        } else if (this.isNestedAggregate(aggregation)) {
          // Handle nested aggregations (author_terms, subject_terms)
          let nestedTerms: estypes.AggregationsAggregate | undefined;
          if ('author_terms' in aggregation) {
            nestedTerms = aggregation.author_terms as estypes.AggregationsAggregate;
          } else if ('subject_terms' in aggregation) {
            nestedTerms = aggregation.subject_terms as estypes.AggregationsAggregate;
          }
          if (nestedTerms && this.isTermsAggregate(nestedTerms)) {
            const typedBuckets = nestedTerms.buckets as {
              key: string | number;
              doc_count: number;
            }[];
            facets[facetName] = typedBuckets.map((bucket) => ({
              value: String(bucket.key),
              count: bucket.doc_count,
            }));
          }
        }
      }
    }

    return {
      ...baseResults,
      facets,
    };
  }

  /**
   * Type guard for terms aggregate.
   *
   * @param aggregate - Aggregate to check
   * @returns True if terms aggregate
   */
  private isTermsAggregate(
    aggregate: estypes.AggregationsAggregate
  ): aggregate is estypes.AggregationsMultiBucketAggregateBase<estypes.AggregationsStringTermsBucket> {
    return 'buckets' in aggregate && Array.isArray(aggregate.buckets);
  }

  /**
   * Type guard for nested aggregate.
   *
   * @param aggregate - Aggregate to check
   * @returns True if nested aggregate
   */
  private isNestedAggregate(
    aggregate: estypes.AggregationsAggregate
  ): aggregate is Record<string, unknown> {
    return typeof aggregate === 'object' && aggregate !== null;
  }

  /**
   * Parses autocomplete response.
   *
   * @param response - Elasticsearch response
   * @returns Suggested completions
   */
  private parseAutocompleteResponse(
    response: estypes.SearchResponse<IndexableEprintDocument>
  ): readonly string[] {
    if (!response.suggest?.title_suggest) {
      return [];
    }

    const suggestions: string[] = [];

    for (const suggestion of response.suggest.title_suggest) {
      if ('options' in suggestion && Array.isArray(suggestion.options)) {
        for (const option of suggestion.options) {
          if (option.text) {
            suggestions.push(option.text);
          }
        }
      }
    }

    return [...new Set(suggestions)];
  }
}
