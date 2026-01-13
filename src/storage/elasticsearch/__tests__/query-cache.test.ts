/**
 * Unit tests for QueryCache.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AtUri, DID } from '../../../types/atproto.js';
import type {
  FacetedSearchQuery,
  SearchQuery,
} from '../../../types/interfaces/search.interface.js';
import { DEFAULT_CACHE_CONFIG, QueryCache } from '../query-cache.js';

describe('QueryCache', () => {
  let cache: QueryCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new QueryCache({
      maxSize: 10,
      ttlMs: 5000,
      enableStats: true,
      cleanupIntervalMs: 0,
    });
  });

  afterEach(() => {
    cache.dispose();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      const defaultCache = new QueryCache();
      const stats = defaultCache.getStatistics();

      expect(stats.capacity).toBe(DEFAULT_CACHE_CONFIG.maxSize);
      defaultCache.dispose();
    });

    it('should accept custom configuration', () => {
      const customCache = new QueryCache({ maxSize: 500, ttlMs: 10000 });
      const stats = customCache.getStatistics();

      expect(stats.capacity).toBe(500);
      customCache.dispose();
    });
  });

  describe('get and set', () => {
    it('should store and retrieve search results', () => {
      const query: SearchQuery = { q: 'test' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query, results);
      const retrieved = cache.get(query);

      expect(retrieved).toEqual(results);
    });

    it('should return undefined for cache miss', () => {
      const query: SearchQuery = { q: 'test' };
      const result = cache.get(query);

      expect(result).toBeUndefined();
    });

    it('should distinguish between different queries', () => {
      const query1: SearchQuery = { q: 'test1' };
      const query2: SearchQuery = { q: 'test2' };
      const results1 = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };
      const results2 = {
        hits: [{ uri: 'at://did:plc:def/pub.chive.eprint/456' as AtUri, score: 0.9 }],
        total: 1,
        took: 12,
      };

      cache.set(query1, results1);
      cache.set(query2, results2);

      expect(cache.get(query1)).toEqual(results1);
      expect(cache.get(query2)).toEqual(results2);
    });

    it('should consider filters in cache key', () => {
      const query1: SearchQuery = { q: 'test' };
      const query2: SearchQuery = {
        q: 'test',
        filters: { author: 'did:plc:abc' as DID },
      };
      const results1 = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };
      const results2 = {
        hits: [{ uri: 'at://did:plc:def/pub.chive.eprint/456' as AtUri, score: 0.9 }],
        total: 1,
        took: 12,
      };

      cache.set(query1, results1);
      cache.set(query2, results2);

      expect(cache.get(query1)).toEqual(results1);
      expect(cache.get(query2)).toEqual(results2);
    });
  });

  describe('getFaceted and setFaceted', () => {
    it('should store and retrieve faceted search results', () => {
      const query: FacetedSearchQuery = { q: 'test', facets: ['matter', 'author'] };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
        facets: {
          matter: [{ value: 'Computer Science', count: 10 }],
          author: [{ value: 'John Doe', count: 5 }],
        },
      };

      cache.setFaceted(query, results);
      const retrieved = cache.getFaceted(query);

      expect(retrieved).toEqual(results);
    });

    it('should distinguish faceted from non-faceted queries', () => {
      const simpleQuery: SearchQuery = { q: 'test' };
      const facetedQuery: FacetedSearchQuery = { q: 'test', facets: ['matter'] };
      const simpleResults = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };
      const facetedResults = {
        hits: [{ uri: 'at://did:plc:def/pub.chive.eprint/456' as AtUri, score: 0.9 }],
        total: 1,
        took: 12,
        facets: { matter: [{ value: 'CS', count: 5 }] },
      };

      cache.set(simpleQuery, simpleResults);
      cache.setFaceted(facetedQuery, facetedResults);

      expect(cache.get(simpleQuery)).toEqual(simpleResults);
      expect(cache.getFaceted(facetedQuery)).toEqual(facetedResults);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      const query: SearchQuery = { q: 'test' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query, results);
      expect(cache.get(query)).toEqual(results);

      vi.advanceTimersByTime(6000);

      expect(cache.get(query)).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      const query: SearchQuery = { q: 'test' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query, results);
      vi.advanceTimersByTime(4000);

      expect(cache.get(query)).toEqual(results);
    });

    it('should not expire when TTL is 0', () => {
      const noTtlCache = new QueryCache({ ttlMs: 0, cleanupIntervalMs: 0 });
      const query: SearchQuery = { q: 'test' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      noTtlCache.set(query, results);
      vi.advanceTimersByTime(100000);

      expect(noTtlCache.get(query)).toEqual(results);
      noTtlCache.dispose();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when cache is full', () => {
      const queries: SearchQuery[] = [];
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      for (let i = 0; i < 10; i++) {
        const query = { q: `test${i}` };
        queries.push(query);
        cache.set(query, results);
      }

      const firstQuery = queries[0];
      if (firstQuery) {
        expect(cache.get(firstQuery)).toEqual(results);
        cache.set({ q: 'test-new' }, results);
        expect(cache.get(firstQuery)).toBeUndefined();
      }
    });

    it('should update LRU on cache hit', () => {
      const queries: SearchQuery[] = [];
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      for (let i = 0; i < 10; i++) {
        const query = { q: `test${i}` };
        queries.push(query);
        cache.set(query, results);
        vi.advanceTimersByTime(1);
      }

      const firstQuery = queries[0];
      const secondQuery = queries[1];
      if (firstQuery && secondQuery) {
        vi.advanceTimersByTime(100);
        cache.get(firstQuery);

        vi.advanceTimersByTime(100);
        cache.set({ q: 'test-new' }, results);

        expect(cache.get(firstQuery)).toEqual(results);
        expect(cache.get(secondQuery)).toBeUndefined();
      }
    });
  });

  describe('invalidate', () => {
    it('should remove entry from cache', () => {
      const query: SearchQuery = { q: 'test' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query, results);
      expect(cache.get(query)).toEqual(results);

      cache.invalidate(query);
      expect(cache.get(query)).toBeUndefined();
    });

    it('should handle invalidating non-existent entry', () => {
      const query: SearchQuery = { q: 'test' };

      expect(() => cache.invalidate(query)).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all entries from cache', () => {
      const query1: SearchQuery = { q: 'test1' };
      const query2: SearchQuery = { q: 'test2' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query1, results);
      cache.set(query2, results);

      cache.clear();

      expect(cache.get(query1)).toBeUndefined();
      expect(cache.get(query2)).toBeUndefined();

      const stats = cache.getStatistics();
      expect(stats.size).toBe(0);
    });

    it('should reset statistics', () => {
      const query: SearchQuery = { q: 'test' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query, results);
      cache.get(query);
      cache.get({ q: 'miss' });

      cache.clear();

      const stats = cache.getStatistics();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should track cache hits', () => {
      const query: SearchQuery = { q: 'test' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query, results);
      cache.get(query);
      cache.get(query);

      const stats = cache.getStatistics();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.get({ q: 'miss1' });
      cache.get({ q: 'miss2' });
      cache.get({ q: 'miss3' });

      const stats = cache.getStatistics();
      expect(stats.misses).toBe(3);
    });

    it('should calculate hit rate', () => {
      const query: SearchQuery = { q: 'test' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query, results);
      cache.get(query);
      cache.get({ q: 'miss' });

      const stats = cache.getStatistics();
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track cache size', () => {
      const query1: SearchQuery = { q: 'test1' };
      const query2: SearchQuery = { q: 'test2' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query1, results);
      cache.set(query2, results);

      const stats = cache.getStatistics();
      expect(stats.size).toBe(2);
    });

    it('should track evictions', () => {
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      for (let i = 0; i < 11; i++) {
        cache.set({ q: `test${i}` }, results);
      }

      const stats = cache.getStatistics();
      expect(stats.evictions).toBe(1);
    });

    it('should return zero hit rate when no requests', () => {
      const stats = cache.getStatistics();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should stop cleanup timer', () => {
      const cacheWithCleanup = new QueryCache({ cleanupIntervalMs: 1000 });
      cacheWithCleanup.dispose();

      expect(() => vi.runOnlyPendingTimers()).not.toThrow();
      cacheWithCleanup.dispose();
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        cache.dispose();
        cache.dispose();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined filters', () => {
      const query1: SearchQuery = { q: 'test' };
      const query2: SearchQuery = { q: 'test', filters: undefined };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query1, results);

      expect(cache.get(query2)).toEqual(results);
    });

    it('should handle pagination in cache key', () => {
      const query1: SearchQuery = { q: 'test', limit: 10, offset: 0 };
      const query2: SearchQuery = { q: 'test', limit: 10, offset: 10 };
      const results1 = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 20,
        took: 10,
      };
      const results2 = {
        hits: [{ uri: 'at://did:plc:def/pub.chive.eprint/456' as AtUri, score: 0.9 }],
        total: 20,
        took: 12,
      };

      cache.set(query1, results1);
      cache.set(query2, results2);

      expect(cache.get(query1)).toEqual(results1);
      expect(cache.get(query2)).toEqual(results2);
    });

    it('should handle empty query string', () => {
      const query: SearchQuery = { q: '' };
      const results = {
        hits: [{ uri: 'at://did:plc:abc/pub.chive.eprint/123' as AtUri, score: 1.0 }],
        total: 1,
        took: 10,
      };

      cache.set(query, results);
      expect(cache.get(query)).toEqual(results);
    });
  });
});
