/**
 * Unit tests for SearchQueryBuilder.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import type { DID } from '../../../types/atproto.js';
import type { SearchQuery } from '../../../types/interfaces/search.interface.js';
import { DEFAULT_FIELD_BOOSTS, SearchQueryBuilder } from '../search-query-builder.js';

describe('SearchQueryBuilder', () => {
  describe('constructor', () => {
    it('should use default configuration', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({ q: 'test' });

      expect(query).toBeDefined();
    });

    it('should accept custom field boosts', () => {
      const customBoosts = {
        ...DEFAULT_FIELD_BOOSTS,
        title: 5.0,
      };

      const builder = new SearchQueryBuilder({ fieldBoosts: customBoosts });
      const query = builder.build({ q: 'test' });

      expect(query).toHaveProperty('bool');
      expect(query.bool).toHaveProperty('must');
    });

    it('should accept custom fuzziness', () => {
      const builder = new SearchQueryBuilder({ fuzziness: 2 });
      const query = builder.build({ q: 'test' });

      expect(query).toHaveProperty('bool');
      expect(query.bool).toHaveProperty('must');
    });
  });

  describe('build', () => {
    it('should build match_all query when no criteria provided', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({ q: '' });

      expect(query).toEqual({ match_all: {} });
    });

    it('should build multi_match query for text search', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({ q: 'machine learning' });

      expect(query).toHaveProperty('bool');
      expect(query.bool).toHaveProperty('must');
      expect(query.bool?.must).toHaveLength(1);

      const mustClause = Array.isArray(query.bool?.must) ? query.bool.must[0] : query.bool?.must;
      expect(mustClause).toHaveProperty('multi_match');

      const multiMatch = mustClause && 'multi_match' in mustClause ? mustClause.multi_match : null;
      expect(multiMatch).toBeDefined();
      expect(multiMatch?.query).toBe('machine learning');
      expect(multiMatch?.type).toBe('best_fields');
      expect(multiMatch?.operator).toBe('or');
      expect(multiMatch?.fuzziness).toBe('AUTO');
    });

    it('should include boosted fields in multi_match query', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({ q: 'test' });

      const mustClause = Array.isArray(query.bool?.must) ? query.bool.must[0] : query.bool?.must;
      const multiMatch = mustClause && 'multi_match' in mustClause ? mustClause.multi_match : null;
      const fields = multiMatch?.fields;

      expect(fields).toBeDefined();
      expect(fields).toContain('title^3');
      expect(fields).toContain('abstract^2');
      expect(fields).toContain('full_text^1');
      expect(fields).toContain('authors.name^2');
      expect(fields).toContain('keywords^1.5');
    });

    it('should ignore empty query text', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({ q: '   ' });

      expect(query).toEqual({ match_all: {} });
    });

    it('should build author filter', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({
        q: '',
        filters: {
          author: 'did:plc:abc123' as DID,
        },
      });

      expect(query).toHaveProperty('bool');
      expect(query.bool).toHaveProperty('filter');
      expect(query.bool?.filter).toHaveLength(1);

      const filterClause = Array.isArray(query.bool?.filter)
        ? query.bool.filter[0]
        : query.bool?.filter;
      expect(filterClause).toHaveProperty('nested');

      const nested = filterClause && 'nested' in filterClause ? filterClause.nested : null;
      expect(nested?.path).toBe('authors');
      expect(nested?.query).toHaveProperty('term');
    });

    it('should build subjects filter', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({
        q: '',
        filters: {
          subjects: ['Computer Science', 'Machine Learning'],
        },
      });

      expect(query).toHaveProperty('bool');
      expect(query.bool).toHaveProperty('filter');
      expect(query.bool?.filter).toHaveLength(1);

      const filterClause = Array.isArray(query.bool?.filter)
        ? query.bool.filter[0]
        : query.bool?.filter;
      // field_nodes is now nested, so we use a nested query
      expect(filterClause).toHaveProperty('nested');

      const nested = filterClause && 'nested' in filterClause ? filterClause.nested : null;
      expect(nested).toHaveProperty('path', 'field_nodes');
      expect(nested).toHaveProperty('query');
    });

    it('should ignore empty subjects array', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({
        q: '',
        filters: {
          subjects: [],
        },
      });

      expect(query).toEqual({ match_all: {} });
    });

    it('should build date range filter with start date', () => {
      const builder = new SearchQueryBuilder();
      const dateFrom = new Date('2023-01-01');
      const query = builder.build({
        q: '',
        filters: {
          dateFrom,
        },
      });

      expect(query).toHaveProperty('bool');
      expect(query.bool).toHaveProperty('filter');
      expect(query.bool?.filter).toHaveLength(1);

      const filterClause = Array.isArray(query.bool?.filter)
        ? query.bool.filter[0]
        : query.bool?.filter;
      expect(filterClause).toHaveProperty('range');

      const range = filterClause && 'range' in filterClause ? filterClause.range : null;
      expect(range).toHaveProperty('created_at');
      expect(range?.created_at).toHaveProperty('gte');
    });

    it('should build date range filter with end date', () => {
      const builder = new SearchQueryBuilder();
      const dateTo = new Date('2023-12-31');
      const query = builder.build({
        q: '',
        filters: {
          dateTo,
        },
      });

      expect(query).toHaveProperty('bool');
      expect(query.bool).toHaveProperty('filter');

      const filterClause = Array.isArray(query.bool?.filter)
        ? query.bool.filter[0]
        : query.bool?.filter;
      const range = filterClause && 'range' in filterClause ? filterClause.range : null;
      expect(range?.created_at).toHaveProperty('lte');
    });

    it('should build date range filter with both dates', () => {
      const builder = new SearchQueryBuilder();
      const dateFrom = new Date('2023-01-01');
      const dateTo = new Date('2023-12-31');
      const query = builder.build({
        q: '',
        filters: {
          dateFrom,
          dateTo,
        },
      });

      const filterClause = Array.isArray(query.bool?.filter)
        ? query.bool.filter[0]
        : query.bool?.filter;
      const range = filterClause && 'range' in filterClause ? filterClause.range : null;
      expect(range?.created_at).toHaveProperty('gte');
      expect(range?.created_at).toHaveProperty('lte');
    });

    it('should combine text query with filters', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({
        q: 'machine learning',
        filters: {
          author: 'did:plc:abc123' as DID,
          subjects: ['Computer Science'],
          dateFrom: new Date('2023-01-01'),
        },
      });

      expect(query).toHaveProperty('bool');
      expect(query.bool).toHaveProperty('must');
      expect(query.bool).toHaveProperty('filter');
      expect(query.bool?.must).toHaveLength(1);
      expect(query.bool?.filter).toHaveLength(3);
    });

    it('should use custom multi-match type', () => {
      const builder = new SearchQueryBuilder({ multiMatchType: 'most_fields' });
      const query = builder.build({ q: 'test' });

      const mustClause = Array.isArray(query.bool?.must) ? query.bool.must[0] : query.bool?.must;
      const multiMatch = mustClause && 'multi_match' in mustClause ? mustClause.multi_match : null;
      expect(multiMatch?.type).toBe('most_fields');
    });

    it('should use custom operator', () => {
      const builder = new SearchQueryBuilder({ operator: 'and' });
      const query = builder.build({ q: 'test' });

      const mustClause = Array.isArray(query.bool?.must) ? query.bool.must[0] : query.bool?.must;
      const multiMatch = mustClause && 'multi_match' in mustClause ? mustClause.multi_match : null;
      expect(multiMatch?.operator).toBe('and');
    });

    it('should use custom prefix length', () => {
      const builder = new SearchQueryBuilder({ prefixLength: 3 });
      const query = builder.build({ q: 'test' });

      const mustClause = Array.isArray(query.bool?.must) ? query.bool.must[0] : query.bool?.must;
      const multiMatch = mustClause && 'multi_match' in mustClause ? mustClause.multi_match : null;
      expect(multiMatch?.prefix_length).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined filters', () => {
      const builder = new SearchQueryBuilder();
      const query: SearchQuery = { q: 'test' };

      const result = builder.build(query);
      expect(result).toHaveProperty('bool');
      expect(result.bool).toHaveProperty('must');
    });

    it('should handle filters with all undefined values', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({
        q: '',
        filters: {
          author: undefined,
          subjects: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        },
      });

      expect(query).toEqual({ match_all: {} });
    });

    it('should build complex query with all features', () => {
      const builder = new SearchQueryBuilder();
      const query = builder.build({
        q: 'neural networks deep learning',
        filters: {
          author: 'did:plc:xyz789' as DID,
          subjects: ['Computer Science', 'Artificial Intelligence'],
          dateFrom: new Date('2020-01-01'),
          dateTo: new Date('2023-12-31'),
        },
        limit: 20,
        offset: 0,
      });

      expect(query).toHaveProperty('bool');
      expect(query.bool?.must).toHaveLength(1);
      expect(query.bool?.filter).toHaveLength(3);
    });
  });
});
