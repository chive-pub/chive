/**
 * Query result caching layer for Elasticsearch.
 *
 * @remarks
 * Provides in-memory caching for search query results with:
 * - LRU eviction (least recently used)
 * - TTL expiration (time to live)
 * - Configurable cache size
 * - Cache statistics tracking
 * - Thread-safe operations
 *
 * @packageDocumentation
 */

import type {
  FacetedSearchQuery,
  FacetedSearchResults,
  SearchQuery,
  SearchResults,
} from '../../types/interfaces/search.interface.js';

/**
 * Cache entry with metadata.
 *
 * @internal
 */
interface CacheEntry<T> {
  /**
   * Cached value.
   */
  readonly value: T;

  /**
   * Cache entry creation timestamp.
   */
  readonly timestamp: number;

  /**
   * Number of times this entry has been accessed.
   */
  accessCount: number;

  /**
   * Last access timestamp.
   */
  lastAccess: number;
}

/**
 * Cache statistics.
 *
 * @public
 */
export interface CacheStatistics {
  /**
   * Total number of cache lookups.
   */
  readonly hits: number;

  /**
   * Total number of cache misses.
   */
  readonly misses: number;

  /**
   * Cache hit rate (0-1).
   */
  readonly hitRate: number;

  /**
   * Current number of entries in cache.
   */
  readonly size: number;

  /**
   * Maximum cache capacity.
   */
  readonly capacity: number;

  /**
   * Total number of evictions.
   */
  readonly evictions: number;
}

/**
 * Query cache configuration.
 *
 * @public
 */
export interface QueryCacheConfig {
  /**
   * Maximum number of cached entries.
   *
   * @remarks
   * When limit is reached, least recently used entries are evicted.
   *
   * @defaultValue 1000
   */
  readonly maxSize?: number;

  /**
   * Cache entry TTL in milliseconds.
   *
   * @remarks
   * Entries older than TTL are automatically evicted.
   * Set to 0 to disable TTL.
   *
   * @defaultValue 300000 (5 minutes)
   */
  readonly ttlMs?: number;

  /**
   * Enable cache statistics tracking.
   *
   * @defaultValue true
   */
  readonly enableStats?: boolean;

  /**
   * Cache cleanup interval in milliseconds.
   *
   * @remarks
   * How often to run eviction of expired entries.
   * Set to 0 to disable automatic cleanup.
   *
   * @defaultValue 60000 (1 minute)
   */
  readonly cleanupIntervalMs?: number;
}

/**
 * Default query cache configuration.
 *
 * @public
 */
export const DEFAULT_CACHE_CONFIG: Required<QueryCacheConfig> = {
  maxSize: 1000,
  ttlMs: 300000, // 5 minutes
  enableStats: true,
  cleanupIntervalMs: 60000, // 1 minute
};

/**
 * In-memory LRU cache for search query results.
 *
 * @remarks
 * Caches search results to reduce Elasticsearch load and improve
 * response times for repeated queries.
 *
 * **Features:**
 * - LRU eviction when cache is full
 * - TTL-based expiration
 * - Automatic cleanup of expired entries
 * - Cache statistics (hits, misses, evictions)
 * - Memory-efficient key hashing
 *
 * **Cache Key Strategy:**
 * - Query text + filters + pagination → unique cache key
 * - Uses JSON serialization for stable key generation
 * - Ignores result ordering for better hit rate
 *
 * **When to Use:**
 * - High query volume with repeated patterns
 * - Query results don't change frequently
 * - Acceptable staleness window (5 minutes default)
 *
 * **When NOT to Use:**
 * - Real-time requirements (use Elasticsearch request cache instead)
 * - Unique query patterns (poor hit rate)
 * - Memory constraints (consider Redis instead)
 *
 * @example
 * ```typescript
 * const cache = new QueryCache();
 *
 * // Cache miss: execute query
 * let results = cache.get(query);
 * if (!results) {
 *   results = await executeSearch(query);
 *   cache.set(query, results);
 * }
 *
 * // Cache hit: return cached results
 * results = cache.get(query);
 *
 * // View statistics
 * const stats = cache.getStatistics();
 * console.log(`Hit rate: ${stats.hitRate * 100}%`);
 * ```
 *
 * @public
 */
export class QueryCache {
  private readonly cache: Map<string, CacheEntry<SearchResults | FacetedSearchResults>>;
  private readonly config: Required<QueryCacheConfig>;
  private hits: number;
  private misses: number;
  private evictions: number;
  private cleanupTimer: NodeJS.Timeout | undefined;

  constructor(config: QueryCacheConfig = {}) {
    this.cache = new Map();
    this.config = {
      maxSize: config.maxSize ?? DEFAULT_CACHE_CONFIG.maxSize,
      ttlMs: config.ttlMs ?? DEFAULT_CACHE_CONFIG.ttlMs,
      enableStats: config.enableStats ?? DEFAULT_CACHE_CONFIG.enableStats,
      cleanupIntervalMs: config.cleanupIntervalMs ?? DEFAULT_CACHE_CONFIG.cleanupIntervalMs,
    };
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;

    if (this.config.cleanupIntervalMs > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Gets cached search results.
   *
   * @param query - Search query
   * @returns Cached results or undefined if not found/expired
   *
   * @public
   */
  get(query: SearchQuery): SearchResults | undefined {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.recordMiss();
      return undefined;
    }

    this.recordHit(entry);
    return entry.value as SearchResults;
  }

  /**
   * Gets cached faceted search results.
   *
   * @param query - Faceted search query
   * @returns Cached results or undefined if not found/expired
   *
   * @public
   */
  getFaceted(query: FacetedSearchQuery): FacetedSearchResults | undefined {
    const key = this.generateFacetedKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.recordMiss();
      return undefined;
    }

    this.recordHit(entry);
    return entry.value as FacetedSearchResults;
  }

  /**
   * Caches search results.
   *
   * @param query - Search query
   * @param results - Search results
   *
   * @public
   */
  set(query: SearchQuery, results: SearchResults): void {
    const key = this.generateKey(query);
    this.setEntry(key, results);
  }

  /**
   * Caches faceted search results.
   *
   * @param query - Faceted search query
   * @param results - Faceted search results
   *
   * @public
   */
  setFaceted(query: FacetedSearchQuery, results: FacetedSearchResults): void {
    const key = this.generateFacetedKey(query);
    this.setEntry(key, results);
  }

  /**
   * Invalidates cache entry.
   *
   * @param query - Query to invalidate
   *
   * @public
   */
  invalidate(query: SearchQuery | FacetedSearchQuery): void {
    const key = this.isFacetedQuery(query)
      ? this.generateFacetedKey(query)
      : this.generateKey(query);

    this.cache.delete(key);
  }

  /**
   * Clears entire cache.
   *
   * @public
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Gets cache statistics.
   *
   * @returns Cache statistics
   *
   * @public
   */
  getStatistics(): CacheStatistics {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      size: this.cache.size,
      capacity: this.config.maxSize,
      evictions: this.evictions,
    };
  }

  /**
   * Stops automatic cleanup timer.
   *
   * @remarks
   * Call this when shutting down to prevent memory leaks.
   *
   * @public
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Sets cache entry with LRU eviction.
   *
   * @param key - Cache key
   * @param value - Value to cache
   */
  private setEntry(key: string, value: SearchResults | FacetedSearchResults): void {
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<SearchResults | FacetedSearchResults> = {
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccess: Date.now(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Evicts least recently used entry.
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.evictions++;
    }
  }

  /**
   * Checks if entry is expired.
   *
   * @param entry - Cache entry
   * @returns True if expired
   */
  private isExpired(entry: CacheEntry<SearchResults | FacetedSearchResults>): boolean {
    if (this.config.ttlMs === 0) {
      return false;
    }

    const age = Date.now() - entry.timestamp;
    return age > this.config.ttlMs;
  }

  /**
   * Records cache hit.
   *
   * @param entry - Cache entry
   */
  private recordHit(entry: CacheEntry<SearchResults | FacetedSearchResults>): void {
    if (this.config.enableStats) {
      this.hits++;
      entry.accessCount++;
      entry.lastAccess = Date.now();
    }
  }

  /**
   * Records cache miss.
   */
  private recordMiss(): void {
    if (this.config.enableStats) {
      this.misses++;
    }
  }

  /**
   * Starts automatic cleanup timer.
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Removes expired entries from cache.
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.config.ttlMs > 0 && now - entry.timestamp > this.config.ttlMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Generates cache key for search query.
   *
   * @param query - Search query
   * @returns Cache key
   */
  private generateKey(query: SearchQuery): string {
    return JSON.stringify({
      q: query.q,
      filters: query.filters,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * Generates cache key for faceted search query.
   *
   * @param query - Faceted search query
   * @returns Cache key
   */
  private generateFacetedKey(query: FacetedSearchQuery): string {
    return JSON.stringify({
      q: query.q,
      filters: query.filters,
      facets: query.facets,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * Type guard for faceted query.
   *
   * @param query - Query to check
   * @returns True if faceted query
   */
  private isFacetedQuery(query: SearchQuery | FacetedSearchQuery): query is FacetedSearchQuery {
    return 'facets' in query;
  }
}
