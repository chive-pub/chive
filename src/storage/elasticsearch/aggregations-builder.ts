/**
 * Faceted aggregations builder for Elasticsearch.
 *
 * @remarks
 * Constructs Elasticsearch aggregations for all 10 facet dimensions:
 * - PMEST: Matter, Energy, Space, Time, Personality
 * - FAST entities: Person, Organization, Event, Work, Form-Genre
 *
 * Also supports:
 * - Author aggregations (nested)
 * - Year aggregations (date histogram)
 * - Language aggregations (terms)
 * - License aggregations (terms)
 * - Subject aggregations (terms)
 *
 * @packageDocumentation
 */

import type { estypes } from '@elastic/elasticsearch';

/**
 * Facet aggregation configuration.
 *
 * @public
 */
export interface FacetAggregationConfig {
  /**
   * Maximum number of buckets to return for terms aggregations.
   *
   * @defaultValue 20
   */
  readonly maxBuckets?: number;

  /**
   * Maximum number of author buckets.
   *
   * @defaultValue 50
   */
  readonly maxAuthorBuckets?: number;

  /**
   * Date histogram calendar interval for year aggregations.
   *
   * @defaultValue 'year'
   */
  readonly yearInterval?: 'year' | 'quarter' | 'month';

  /**
   * Minimum document count for including a bucket.
   *
   * @remarks
   * Buckets with fewer documents than this threshold are excluded.
   *
   * @defaultValue 1
   */
  readonly minDocCount?: number;
}

/**
 * Default facet aggregation configuration.
 *
 * @public
 */
export const DEFAULT_AGGREGATION_CONFIG: Required<FacetAggregationConfig> = {
  maxBuckets: 20,
  maxAuthorBuckets: 50,
  yearInterval: 'year',
  minDocCount: 1,
};

/**
 * Builds Elasticsearch aggregations for faceted search.
 *
 * @remarks
 * Supports all 10 facet dimensions plus common aggregations:
 *
 * **PMEST Facets:**
 * - matter: Subject matter
 * - energy: Methods/approaches
 * - space: Spatial/geographic aspects
 * - time: Temporal/chronological aspects
 * - personality: Focus/perspective
 *
 * **FAST Entity Facets:**
 * - person: Named persons
 * - organization: Organizations
 * - event: Named events
 * - work: Creative works
 * - form_genre: Document types
 *
 * **Common Facets:**
 * - subjects: Field nodes
 * - author: Author names (nested aggregation)
 * - year: Publication year (date histogram)
 * - language: Document language
 * - license: License type
 *
 * @example
 * ```typescript
 * const builder = new FacetedAggregationsBuilder();
 * const aggregations = builder.build(['matter', 'author', 'year']);
 *
 * // Returns:
 * // {
 * //   matter: { terms: { field: 'facets.matter', size: 20 } },
 * //   author: { nested: { path: 'authors' }, aggs: { ... } },
 * //   year: { date_histogram: { field: 'created_at', calendar_interval: 'year' } }
 * // }
 * ```
 *
 * @public
 */
export class FacetedAggregationsBuilder {
  private readonly config: Required<FacetAggregationConfig>;

  constructor(config: FacetAggregationConfig = {}) {
    this.config = {
      maxBuckets: config.maxBuckets ?? DEFAULT_AGGREGATION_CONFIG.maxBuckets,
      maxAuthorBuckets: config.maxAuthorBuckets ?? DEFAULT_AGGREGATION_CONFIG.maxAuthorBuckets,
      yearInterval: config.yearInterval ?? DEFAULT_AGGREGATION_CONFIG.yearInterval,
      minDocCount: config.minDocCount ?? DEFAULT_AGGREGATION_CONFIG.minDocCount,
    };
  }

  /**
   * Builds aggregations for requested facets.
   *
   * @param facetNames - Facet dimensions to aggregate
   * @returns Elasticsearch aggregations
   *
   * @remarks
   * Each facet name maps to a specific aggregation type:
   * - PMEST facets → terms aggregations on facets.{dimension}
   * - FAST facets → terms aggregations on facets.{dimension}
   * - subjects → terms on field_nodes
   * - author → nested + terms on authors.name.keyword
   * - year → date_histogram on created_at
   * - language → terms on language
   * - license → terms on license
   *
   * @public
   */
  build(facetNames: readonly string[]): Record<string, estypes.AggregationsAggregationContainer> {
    const aggregations: Record<string, estypes.AggregationsAggregationContainer> = {};

    for (const facetName of facetNames) {
      const aggregation = this.buildFacetAggregation(facetName);
      if (aggregation) {
        aggregations[facetName] = aggregation;
      }
    }

    return aggregations;
  }

  /**
   * Builds aggregation for a single facet.
   *
   * @param facetName - Facet dimension name
   * @returns Aggregation container or undefined if unknown facet
   */
  private buildFacetAggregation(
    facetName: string
  ): estypes.AggregationsAggregationContainer | undefined {
    switch (facetName) {
      // PMEST facets
      case 'matter':
        return this.buildTermsAggregation('facets.matter');
      case 'energy':
        return this.buildTermsAggregation('facets.energy');
      case 'space':
        return this.buildTermsAggregation('facets.space');
      case 'time':
        return this.buildTermsAggregation('facets.time');
      case 'personality':
        return this.buildTermsAggregation('facets.personality');

      // FAST entity facets
      case 'person':
        return this.buildTermsAggregation('facets.person');
      case 'organization':
        return this.buildTermsAggregation('facets.organization');
      case 'event':
        return this.buildTermsAggregation('facets.event');
      case 'work':
        return this.buildTermsAggregation('facets.work');
      case 'form_genre':
        return this.buildTermsAggregation('facets.form_genre');

      // Common facets
      case 'subjects':
        return this.buildSubjectsAggregation();
      case 'author':
        return this.buildAuthorAggregation();
      case 'year':
        return this.buildYearAggregation();
      case 'language':
        return this.buildTermsAggregation('language');
      case 'license':
        return this.buildTermsAggregation('license');

      default:
        return undefined;
    }
  }

  /**
   * Builds terms aggregation for a field.
   *
   * @param field - Field name
   * @returns Terms aggregation
   */
  private buildTermsAggregation(field: string): estypes.AggregationsAggregationContainer {
    return {
      terms: {
        field,
        size: this.config.maxBuckets,
        min_doc_count: this.config.minDocCount,
      },
    };
  }

  /**
   * Builds nested author aggregation.
   *
   * @returns Nested aggregation with sub-aggregation
   *
   * @remarks
   * Uses nested aggregation because authors are stored as nested documents.
   * Sub-aggregation groups by author name (keyword field).
   */
  private buildAuthorAggregation(): estypes.AggregationsAggregationContainer {
    return {
      nested: {
        path: 'authors',
      },
      aggs: {
        author_terms: {
          terms: {
            field: 'authors.name.keyword',
            size: this.config.maxAuthorBuckets,
            min_doc_count: this.config.minDocCount,
          },
        },
      },
    };
  }

  /**
   * Builds nested subjects aggregation.
   *
   * @returns Nested aggregation with sub-aggregation
   *
   * @remarks
   * Uses nested aggregation because field_nodes are stored as nested documents
   * with id (UUID) and label fields. Aggregates by label for display.
   */
  private buildSubjectsAggregation(): estypes.AggregationsAggregationContainer {
    return {
      nested: {
        path: 'field_nodes',
      },
      aggs: {
        subject_terms: {
          terms: {
            field: 'field_nodes.label.keyword',
            size: this.config.maxBuckets,
            min_doc_count: this.config.minDocCount,
          },
        },
      },
    };
  }

  /**
   * Builds date histogram aggregation for publication year.
   *
   * @returns Date histogram aggregation
   *
   * @remarks
   * Groups documents by year of creation.
   * Output format is 'yyyy' (e.g., "2023").
   */
  private buildYearAggregation(): estypes.AggregationsAggregationContainer {
    return {
      date_histogram: {
        field: 'created_at',
        calendar_interval: this.config.yearInterval,
        format: 'yyyy',
        min_doc_count: this.config.minDocCount,
      },
    };
  }
}
