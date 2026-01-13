/**
 * Search query builder for Elasticsearch.
 *
 * @remarks
 * Constructs Elasticsearch Query DSL from search parameters with:
 * - Field boosting (title^3, abstract^2, etc.)
 * - Fuzzy matching with AUTO fuzziness
 * - Multi-field search (title, abstract, full text, authors, keywords, facets)
 * - Author filtering (nested queries)
 * - Subject filtering (terms queries)
 * - Date range filtering
 * - Type-safe query construction
 *
 * @packageDocumentation
 */

import type { estypes } from '@elastic/elasticsearch';

import type { SearchQuery } from '../../types/interfaces/search.interface.js';

/**
 * Field boost configuration for search.
 *
 * @remarks
 * Boost values prioritize different fields in search relevance:
 * - Title fields get highest boost (most important)
 * - Abstract gets high boost (very relevant)
 * - Authors and keywords get medium boost
 * - Facets and authorities get low-medium boost
 * - Tags get lowest boost (least important)
 *
 * @public
 */
export interface FieldBoostConfig {
  /**
   * Main title field boost.
   *
   * @defaultValue 3.0
   */
  readonly title: number;

  /**
   * Title ngram field boost (for partial matching).
   *
   * @defaultValue 2.0
   */
  readonly titleNgram: number;

  /**
   * Abstract field boost.
   *
   * @defaultValue 2.0
   */
  readonly abstract: number;

  /**
   * Full text field boost.
   *
   * @defaultValue 1.0
   */
  readonly fullText: number;

  /**
   * Author name field boost.
   *
   * @defaultValue 2.0
   */
  readonly authorName: number;

  /**
   * Keywords field boost.
   *
   * @defaultValue 1.5
   */
  readonly keywords: number;

  /**
   * Matter facet boost (subject matter).
   *
   * @defaultValue 1.3
   */
  readonly facetsMatter: number;

  /**
   * Energy facet boost (methods/approaches).
   *
   * @defaultValue 1.1
   */
  readonly facetsEnergy: number;

  /**
   * Authority terms boost.
   *
   * @defaultValue 1.2
   */
  readonly authorities: number;

  /**
   * Tags boost.
   *
   * @defaultValue 0.8
   */
  readonly tags: number;
}

/**
 * Default field boost configuration.
 *
 * @remarks
 * Optimized for academic eprint search:
 * - Titles are most important (3x weight)
 * - Abstracts are very important (2x weight)
 * - Authors and keywords are important (1.5-2x weight)
 * - Facets provide context (1.1-1.3x weight)
 * - Tags are supplementary (0.8x weight)
 *
 * @public
 */
export const DEFAULT_FIELD_BOOSTS: FieldBoostConfig = {
  title: 3.0,
  titleNgram: 2.0,
  abstract: 2.0,
  fullText: 1.0,
  authorName: 2.0,
  keywords: 1.5,
  facetsMatter: 1.3,
  facetsEnergy: 1.1,
  authorities: 1.2,
  tags: 0.8,
};

/**
 * Search query builder configuration.
 *
 * @public
 */
export interface SearchQueryBuilderConfig {
  /**
   * Field boost configuration.
   *
   * @defaultValue DEFAULT_FIELD_BOOSTS
   */
  readonly fieldBoosts?: FieldBoostConfig;

  /**
   * Fuzzy matching fuzziness level.
   *
   * @remarks
   * - 'AUTO': Automatically determines fuzziness based on term length
   * - 0: No fuzzy matching
   * - 1: Allow 1 character difference
   * - 2: Allow 2 character differences
   *
   * @defaultValue 'AUTO'
   */
  readonly fuzziness?: 'AUTO' | 0 | 1 | 2;

  /**
   * Minimum prefix length for fuzzy matching.
   *
   * @remarks
   * First N characters must match exactly before fuzzy matching applies.
   * Higher values improve performance but reduce recall.
   *
   * @defaultValue 2
   */
  readonly prefixLength?: number;

  /**
   * Multi-match query type.
   *
   * @remarks
   * - 'best_fields': Finds documents matching any field (best scoring field wins)
   * - 'most_fields': Combines scores from all matching fields
   * - 'cross_fields': Treats all fields as one large field
   *
   * @defaultValue 'best_fields'
   */
  readonly multiMatchType?: 'best_fields' | 'most_fields' | 'cross_fields';

  /**
   * Multi-match operator.
   *
   * @remarks
   * - 'or': Document matches if any term matches
   * - 'and': Document matches only if all terms match
   *
   * @defaultValue 'or'
   */
  readonly operator?: 'or' | 'and';
}

/**
 * Builds Elasticsearch queries from search parameters.
 *
 * @remarks
 * Constructs type-safe Query DSL with:
 * - Multi-match queries with field boosting
 * - Nested author queries
 * - Subject filtering (terms)
 * - Date range filtering
 * - Match all fallback
 *
 * @example
 * ```typescript
 * const builder = new SearchQueryBuilder();
 * const query = builder.build({
 *   q: 'machine learning',
 *   filters: {
 *     author: 'did:plc:abc123',
 *     subjects: ['Computer Science'],
 *     dateFrom: new Date('2023-01-01'),
 *   },
 * });
 * ```
 *
 * @public
 */
export class SearchQueryBuilder {
  private readonly config: Required<SearchQueryBuilderConfig>;

  constructor(config: SearchQueryBuilderConfig = {}) {
    this.config = {
      fieldBoosts: config.fieldBoosts ?? DEFAULT_FIELD_BOOSTS,
      fuzziness: config.fuzziness ?? 'AUTO',
      prefixLength: config.prefixLength ?? 2,
      multiMatchType: config.multiMatchType ?? 'best_fields',
      operator: config.operator ?? 'or',
    };
  }

  /**
   * Builds Elasticsearch query from search parameters.
   *
   * @param query - Search query parameters
   * @returns Elasticsearch Query DSL
   *
   * @remarks
   * Constructs bool query with:
   * - `must` clauses: Full-text search (if query text provided)
   * - `filter` clauses: Author, subjects, date range
   *
   * Returns `match_all` if no search criteria provided.
   *
   * @public
   */
  build(query: SearchQuery): estypes.QueryDslQueryContainer {
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];

    const textQuery = this.buildTextQuery(query.q);
    if (textQuery) {
      must.push(textQuery);
    }

    const authorFilter = this.buildAuthorFilter(query.filters?.author);
    if (authorFilter) {
      filter.push(authorFilter);
    }

    const subjectsFilter = this.buildSubjectsFilter(query.filters?.subjects);
    if (subjectsFilter) {
      filter.push(subjectsFilter);
    }

    const dateRangeFilter = this.buildDateRangeFilter(
      query.filters?.dateFrom,
      query.filters?.dateTo
    );
    if (dateRangeFilter) {
      filter.push(dateRangeFilter);
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
   * Builds multi-match text query with field boosting.
   *
   * @param queryText - Search text
   * @returns Multi-match query or undefined if no text
   */
  private buildTextQuery(
    queryText: string | undefined
  ): estypes.QueryDslQueryContainer | undefined {
    if (!queryText?.trim()) {
      return undefined;
    }

    const boosts = this.config.fieldBoosts;
    const fields = [
      `title^${boosts.title}`,
      `title.ngram^${boosts.titleNgram}`,
      `abstract^${boosts.abstract}`,
      `full_text^${boosts.fullText}`,
      `authors.name^${boosts.authorName}`,
      `keywords^${boosts.keywords}`,
      `facets.matter^${boosts.facetsMatter}`,
      `facets.energy^${boosts.facetsEnergy}`,
      `authorities^${boosts.authorities}`,
      `tags^${boosts.tags}`,
    ];

    return {
      multi_match: {
        query: queryText,
        fields,
        type: this.config.multiMatchType,
        operator: this.config.operator,
        fuzziness: this.config.fuzziness,
        prefix_length: this.config.prefixLength,
      },
    };
  }

  /**
   * Builds nested author filter query.
   *
   * @param authorDid - Author DID to filter by
   * @returns Nested query or undefined if no author
   */
  private buildAuthorFilter(
    authorDid: string | undefined
  ): estypes.QueryDslQueryContainer | undefined {
    if (!authorDid) {
      return undefined;
    }

    return {
      nested: {
        path: 'authors',
        query: {
          term: {
            'authors.did': authorDid,
          },
        },
      },
    };
  }

  /**
   * Builds subjects filter query.
   *
   * @param subjects - Subject URIs to filter by
   * @returns Terms query or undefined if no subjects
   */
  private buildSubjectsFilter(
    subjects: readonly string[] | undefined
  ): estypes.QueryDslQueryContainer | undefined {
    if (!subjects || subjects.length === 0) {
      return undefined;
    }

    return {
      terms: {
        field_nodes: [...subjects],
      },
    };
  }

  /**
   * Builds date range filter query.
   *
   * @param dateFrom - Start date (inclusive)
   * @param dateTo - End date (inclusive)
   * @returns Range query or undefined if no dates
   */
  private buildDateRangeFilter(
    dateFrom: Date | undefined,
    dateTo: Date | undefined
  ): estypes.QueryDslQueryContainer | undefined {
    if (!dateFrom && !dateTo) {
      return undefined;
    }

    const rangeClause: Record<string, string> = {};

    if (dateFrom) {
      rangeClause.gte = dateFrom.toISOString();
    }

    if (dateTo) {
      rangeClause.lte = dateTo.toISOString();
    }

    return {
      range: {
        created_at: rangeClause,
      },
    };
  }
}
