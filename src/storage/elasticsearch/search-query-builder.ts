/**
 * Search query builder for Elasticsearch.
 *
 * @remarks
 * Constructs Elasticsearch Query DSL from search parameters with:
 * - Field boosting (title^5, abstract^1.5, etc.)
 * - Multi-field search (title, abstract, full text, authors, keywords)
 * - Author filtering (nested queries)
 * - Subject filtering (terms queries)
 * - Date range filtering
 * - Type-safe query construction
 *
 * @packageDocumentation
 */

import type { estypes } from '@elastic/elasticsearch';

import type { SearchQuery } from '../../types/interfaces/search.interface.js';
import { extractRkeyOrPassthrough } from '../../utils/at-uri.js';

/**
 * Field boost configuration for search.
 *
 * @remarks
 * Boost values prioritize different fields in search relevance:
 * - Title fields get highest boost (most important)
 * - Authors and keywords get high boost
 * - Abstract gets medium boost
 * - Tags get lowest boost (least important)
 *
 * @public
 */
export interface FieldBoostConfig {
  /**
   * Main title field boost.
   *
   * @defaultValue 5.0
   */
  readonly title: number;

  /**
   * Abstract field boost.
   *
   * @defaultValue 1.5
   */
  readonly abstract: number;

  /**
   * Full text field boost.
   *
   * @defaultValue 0.5
   */
  readonly fullText: number;

  /**
   * Author name field boost.
   *
   * @defaultValue 2.5
   */
  readonly authorName: number;

  /**
   * Keywords field boost.
   *
   * @defaultValue 2.0
   */
  readonly keywords: number;

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
 * - Titles are most important (5x weight)
 * - Authors and keywords are strong signals (2-2.5x weight)
 * - Abstracts are moderate (1.5x weight)
 * - Tags are supplementary (0.8x weight)
 * - Full text is low priority (0.5x weight)
 *
 * @public
 */
export const DEFAULT_FIELD_BOOSTS: FieldBoostConfig = {
  title: 5.0,
  abstract: 1.5,
  fullText: 0.5,
  authorName: 2.5,
  keywords: 2.0,
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
   * @defaultValue 0
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
   * - 'bool_prefix': Search-as-you-type (term queries + prefix on last term)
   *
   * @defaultValue 'bool_prefix'
   */
  readonly multiMatchType?: 'best_fields' | 'most_fields' | 'cross_fields' | 'bool_prefix';

  /**
   * Multi-match operator.
   *
   * @remarks
   * - 'or': Document matches if any term matches
   * - 'and': Document matches only if all terms match
   *
   * @defaultValue 'and'
   */
  readonly operator?: 'or' | 'and';

  /**
   * Minimum percentage of terms that must match.
   *
   * @remarks
   * Safety net for multi-term queries. With `operator: 'and'` this is
   * technically redundant, but protects against unexpected tokenization.
   *
   * @defaultValue '75%'
   */
  readonly minimumShouldMatch?: string;
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
      fuzziness: config.fuzziness ?? 0,
      prefixLength: config.prefixLength ?? 2,
      multiMatchType: config.multiMatchType ?? 'bool_prefix',
      operator: config.operator ?? 'and',
      minimumShouldMatch: config.minimumShouldMatch ?? '75%',
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
      `abstract^${boosts.abstract}`,
      `full_text^${boosts.fullText}`,
      `authors.name^${boosts.authorName}`,
      `keywords^${boosts.keywords}`,
      `tags^${boosts.tags}`,
    ];

    const isBoolPrefix = this.config.multiMatchType === 'bool_prefix';

    return {
      multi_match: {
        query: queryText,
        fields,
        type: this.config.multiMatchType,
        operator: this.config.operator,
        // These parameters don't apply to bool_prefix type
        ...(!isBoolPrefix && this.config.fuzziness !== 0 && { fuzziness: this.config.fuzziness }),
        ...(!isBoolPrefix && { minimum_should_match: this.config.minimumShouldMatch }),
        ...(!isBoolPrefix && { prefix_length: this.config.prefixLength }),
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
   * @remarks
   * Uses nested query since field_nodes is a nested type with id and label.
   * Subjects can be provided as AT-URIs or plain UUIDs - they are normalized
   * to UUIDs for matching against the indexed field_nodes.id values.
   *
   * @param subjects - Subject URIs to filter by (AT-URIs or UUIDs)
   * @returns Nested query or undefined if no subjects
   */
  private buildSubjectsFilter(
    subjects: readonly string[] | undefined
  ): estypes.QueryDslQueryContainer | undefined {
    if (!subjects || subjects.length === 0) {
      return undefined;
    }

    // Normalize AT-URIs to UUIDs using the centralized utility
    const normalizedSubjects = subjects.map((s) => extractRkeyOrPassthrough(s));

    // Use nested query since field_nodes is a nested type
    return {
      nested: {
        path: 'field_nodes',
        query: {
          terms: {
            'field_nodes.id': normalizedSubjects,
          },
        },
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
