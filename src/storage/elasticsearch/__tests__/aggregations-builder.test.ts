/**
 * Unit tests for FacetedAggregationsBuilder.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_AGGREGATION_CONFIG, FacetedAggregationsBuilder } from '../aggregations-builder.js';

describe('FacetedAggregationsBuilder', () => {
  describe('constructor', () => {
    it('should use default configuration', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['matter']);

      expect(aggregations).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const builder = new FacetedAggregationsBuilder({
        maxBuckets: 50,
        maxAuthorBuckets: 100,
      });
      const aggregations = builder.build(['subjects']);

      expect(aggregations).toBeDefined();
    });
  });

  describe('build', () => {
    it('should return empty object for empty facet list', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build([]);

      expect(aggregations).toEqual({});
    });

    it('should build PMEST facet aggregations', () => {
      const builder = new FacetedAggregationsBuilder();
      const pmestFacets = ['matter', 'energy', 'space', 'time', 'personality'];
      const aggregations = builder.build(pmestFacets);

      expect(Object.keys(aggregations)).toHaveLength(5);
      expect(aggregations.matter).toBeDefined();
      expect(aggregations.energy).toBeDefined();
      expect(aggregations.space).toBeDefined();
      expect(aggregations.time).toBeDefined();
      expect(aggregations.personality).toBeDefined();
    });

    it('should build FAST entity facet aggregations', () => {
      const builder = new FacetedAggregationsBuilder();
      const fastFacets = ['person', 'organization', 'event', 'work', 'form_genre'];
      const aggregations = builder.build(fastFacets);

      expect(Object.keys(aggregations)).toHaveLength(5);
      expect(aggregations.person).toBeDefined();
      expect(aggregations.organization).toBeDefined();
      expect(aggregations.event).toBeDefined();
      expect(aggregations.work).toBeDefined();
      expect(aggregations.form_genre).toBeDefined();
    });

    it('should build terms aggregation for matter facet', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['matter']);

      expect(aggregations.matter).toBeDefined();
      expect(aggregations.matter).toHaveProperty('terms');
      if (aggregations.matter && 'terms' in aggregations.matter) {
        const terms = aggregations.matter.terms;
        expect(terms).toHaveProperty('field', 'facets.matter');
        expect(terms).toHaveProperty('size', DEFAULT_AGGREGATION_CONFIG.maxBuckets);
        expect(terms).toHaveProperty('min_doc_count', DEFAULT_AGGREGATION_CONFIG.minDocCount);
      }
    });

    it('should build terms aggregation for subjects', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['subjects']);

      expect(aggregations.subjects).toBeDefined();
      expect(aggregations.subjects).toHaveProperty('terms');
      if (aggregations.subjects && 'terms' in aggregations.subjects) {
        const terms = aggregations.subjects.terms;
        expect(terms).toHaveProperty('field', 'field_nodes');
      }
    });

    it('should build nested aggregation for authors', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['author']);

      expect(aggregations.author).toBeDefined();
      expect(aggregations.author).toHaveProperty('nested');
      if (aggregations.author && 'nested' in aggregations.author) {
        const nested = aggregations.author.nested;
        expect(nested).toHaveProperty('path', 'authors');
      }

      expect(aggregations.author).toHaveProperty('aggs');
      if (aggregations.author && 'aggs' in aggregations.author) {
        const aggs = aggregations.author.aggs;
        expect(aggs).toHaveProperty('author_terms');
      }
    });

    it('should build date histogram aggregation for year', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['year']);

      expect(aggregations.year).toBeDefined();
      expect(aggregations.year).toHaveProperty('date_histogram');
      if (aggregations.year && 'date_histogram' in aggregations.year) {
        const dateHistogram = aggregations.year.date_histogram;
        expect(dateHistogram).toHaveProperty('field', 'created_at');
        expect(dateHistogram).toHaveProperty('calendar_interval', 'year');
        expect(dateHistogram).toHaveProperty('format', 'yyyy');
      }
    });

    it('should build terms aggregation for language', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['language']);

      expect(aggregations.language).toBeDefined();
      expect(aggregations.language).toHaveProperty('terms');
      if (aggregations.language && 'terms' in aggregations.language) {
        const terms = aggregations.language.terms;
        expect(terms).toHaveProperty('field', 'language');
      }
    });

    it('should build terms aggregation for license', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['license']);

      expect(aggregations.license).toBeDefined();
      expect(aggregations.license).toHaveProperty('terms');
      if (aggregations.license && 'terms' in aggregations.license) {
        const terms = aggregations.license.terms;
        expect(terms).toHaveProperty('field', 'license');
      }
    });

    it('should skip unknown facet names', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['matter', 'unknown_facet', 'energy']);

      expect(Object.keys(aggregations)).toHaveLength(2);
      expect(aggregations.matter).toBeDefined();
      expect(aggregations.energy).toBeDefined();
      expect(aggregations).not.toHaveProperty('unknown_facet');
    });

    it('should build all 10 facet dimensions', () => {
      const builder = new FacetedAggregationsBuilder();
      const allFacets = [
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
      ];
      const aggregations = builder.build(allFacets);

      expect(Object.keys(aggregations)).toHaveLength(10);
      allFacets.forEach((facet) => {
        expect(aggregations[facet]).toBeDefined();
      });
    });

    it('should build combination of PMEST, FAST, and common facets', () => {
      const builder = new FacetedAggregationsBuilder();
      const facets = ['matter', 'person', 'subjects', 'author', 'year', 'language'];
      const aggregations = builder.build(facets);

      expect(Object.keys(aggregations)).toHaveLength(6);
      expect(aggregations.matter).toBeDefined();
      expect(aggregations.person).toBeDefined();
      expect(aggregations.subjects).toBeDefined();
      expect(aggregations.author).toBeDefined();
      expect(aggregations.year).toBeDefined();
      expect(aggregations.language).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should use custom max buckets', () => {
      const builder = new FacetedAggregationsBuilder({ maxBuckets: 50 });
      const aggregations = builder.build(['matter']);

      if (aggregations.matter && 'terms' in aggregations.matter) {
        const terms = aggregations.matter.terms;
        expect(terms).toHaveProperty('size', 50);
      }
    });

    it('should use custom max author buckets', () => {
      const builder = new FacetedAggregationsBuilder({ maxAuthorBuckets: 100 });
      const aggregations = builder.build(['author']);

      if (aggregations.author && 'aggs' in aggregations.author) {
        const aggs = aggregations.author.aggs;
        const authorTerms = aggs?.author_terms;
        if (authorTerms && 'terms' in authorTerms) {
          const terms = authorTerms.terms;
          expect(terms).toHaveProperty('size', 100);
        }
      }
    });

    it('should use custom year interval', () => {
      const builder = new FacetedAggregationsBuilder({ yearInterval: 'month' });
      const aggregations = builder.build(['year']);

      if (aggregations.year && 'date_histogram' in aggregations.year) {
        const dateHistogram = aggregations.year.date_histogram;
        expect(dateHistogram).toHaveProperty('calendar_interval', 'month');
      }
    });

    it('should use custom min doc count', () => {
      const builder = new FacetedAggregationsBuilder({ minDocCount: 5 });
      const aggregations = builder.build(['matter']);

      if (aggregations.matter && 'terms' in aggregations.matter) {
        const terms = aggregations.matter.terms;
        expect(terms).toHaveProperty('min_doc_count', 5);
      }
    });

    it('should apply all custom configuration options', () => {
      const builder = new FacetedAggregationsBuilder({
        maxBuckets: 30,
        maxAuthorBuckets: 75,
        yearInterval: 'quarter',
        minDocCount: 2,
      });

      const aggregations = builder.build(['matter', 'author', 'year']);

      if (aggregations.matter && 'terms' in aggregations.matter) {
        const matterTerms = aggregations.matter.terms;
        expect(matterTerms?.size).toBe(30);
        expect(matterTerms?.min_doc_count).toBe(2);
      }

      if (aggregations.author && 'aggs' in aggregations.author) {
        const aggs = aggregations.author.aggs;
        const authorTerms = aggs?.author_terms;
        if (authorTerms && 'terms' in authorTerms) {
          const authorTermsConfig = authorTerms.terms;
          expect(authorTermsConfig?.size).toBe(75);
        }
      }

      if (aggregations.year && 'date_histogram' in aggregations.year) {
        const dateHistogram = aggregations.year.date_histogram;
        expect(dateHistogram?.calendar_interval).toBe('quarter');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle duplicate facet names', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['matter', 'matter', 'energy']);

      expect(Object.keys(aggregations)).toHaveLength(2);
      expect(aggregations.matter).toBeDefined();
      expect(aggregations.energy).toBeDefined();
    });

    it('should handle mixed valid and invalid facet names', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['matter', 'invalid1', 'energy', 'invalid2', 'subjects']);

      expect(Object.keys(aggregations)).toHaveLength(3);
      expect(aggregations.matter).toBeDefined();
      expect(aggregations.energy).toBeDefined();
      expect(aggregations.subjects).toBeDefined();
    });

    it('should return empty object for only invalid facet names', () => {
      const builder = new FacetedAggregationsBuilder();
      const aggregations = builder.build(['invalid1', 'invalid2', 'invalid3']);

      expect(aggregations).toEqual({});
    });
  });
});
