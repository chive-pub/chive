/**
 * Redis caching layer for graph algorithm results.
 *
 * @remarks
 * Provides caching for expensive graph algorithm computations:
 * - Community detection (Louvain, Label Propagation)
 * - PageRank scores
 * - Trending papers
 * - Recommendations
 *
 * Results are cached in Redis with configurable TTL to reduce
 * Neo4j load for repeated queries.
 *
 * @packageDocumentation
 */

import type { Redis } from 'ioredis';
import { singleton } from 'tsyringe';

import type { AtUri, DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

import type {
  Community,
  PageRankResult,
  BetweennessCentrality,
  Recommendation,
} from './graph-algorithms.js';

/**
 * Trending paper result.
 */
export interface TrendingPaper {
  uri: AtUri;
  title: string;
  authors: string[];
  score: number;
  viewCount: number;
  citationCount: number;
  trendWindow: string;
}

/**
 * Cache key prefixes.
 */
const CACHE_KEYS = {
  COMMUNITIES_LOUVAIN: 'chive:graph:communities:louvain',
  COMMUNITIES_LP: 'chive:graph:communities:lp',
  PAGERANK: 'chive:graph:pagerank',
  BETWEENNESS: 'chive:graph:betweenness',
  TRENDING: 'chive:graph:trending',
  RECOMMENDATIONS: 'chive:graph:recommendations',
  PAPER_SIMILARITY: 'chive:graph:paper-similarity',
} as const;

/**
 * Default TTL values in seconds.
 */
const DEFAULT_TTL = {
  COMMUNITIES: 3600 * 24, // 24 hours - community structure changes slowly
  PAGERANK: 3600 * 6, // 6 hours
  BETWEENNESS: 3600 * 6, // 6 hours
  TRENDING: 300, // 5 minutes - changes frequently
  RECOMMENDATIONS: 1800, // 30 minutes
  PAPER_SIMILARITY: 3600, // 1 hour
} as const;

/**
 * Graph algorithm cache options.
 */
export interface GraphAlgorithmCacheOptions {
  /** Redis client */
  readonly redis: Redis;
  /** Logger instance */
  readonly logger: ILogger;
  /** Custom TTL overrides */
  readonly ttlOverrides?: Partial<typeof DEFAULT_TTL>;
}

/**
 * Graph algorithm cache statistics.
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Redis-based cache for graph algorithm results.
 *
 * @remarks
 * Caches expensive graph computations to Redis. Results are stored
 * with TTL and automatically expire. Use background jobs to
 * pre-warm the cache during off-peak hours.
 *
 * @example
 * ```typescript
 * const cache = new GraphAlgorithmCache({ redis, logger });
 *
 * // Check cache first
 * let communities = await cache.getCommunities('louvain');
 * if (!communities) {
 *   // Compute and cache
 *   communities = await algorithms.louvain(graphName);
 *   await cache.setCommunities('louvain', communities);
 * }
 * ```
 */
@singleton()
export class GraphAlgorithmCache {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly ttl: typeof DEFAULT_TTL;
  private hits = 0;
  private misses = 0;

  constructor(options: GraphAlgorithmCacheOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.ttl = { ...DEFAULT_TTL, ...options.ttlOverrides };
  }

  /**
   * Get cached community detection results.
   *
   * @param algorithm - 'louvain' or 'label-propagation'
   * @returns Cached communities or null
   */
  async getCommunities(algorithm: 'louvain' | 'label-propagation'): Promise<Community[] | null> {
    const key =
      algorithm === 'louvain' ? CACHE_KEYS.COMMUNITIES_LOUVAIN : CACHE_KEYS.COMMUNITIES_LP;

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit();
        return JSON.parse(cached) as Community[];
      }
      this.recordMiss();
      return null;
    } catch (error) {
      this.logger.error(
        'Failed to get communities from cache',
        error instanceof Error ? error : undefined
      );
      return null;
    }
  }

  /**
   * Cache community detection results.
   *
   * @param algorithm - 'louvain' or 'label-propagation'
   * @param communities - Community detection results
   * @param ttlSeconds - Optional custom TTL
   */
  async setCommunities(
    algorithm: 'louvain' | 'label-propagation',
    communities: Community[],
    ttlSeconds?: number
  ): Promise<void> {
    const key =
      algorithm === 'louvain' ? CACHE_KEYS.COMMUNITIES_LOUVAIN : CACHE_KEYS.COMMUNITIES_LP;
    const ttl = ttlSeconds ?? this.ttl.COMMUNITIES;

    try {
      await this.redis.setex(key, ttl, JSON.stringify(communities));
      this.logger.debug('Cached communities', { algorithm, count: communities.length, ttl });
    } catch (error) {
      this.logger.error('Failed to cache communities', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get cached PageRank results.
   *
   * @param graphName - Graph projection name
   * @returns Cached PageRank scores or null
   */
  async getPageRank(graphName: string): Promise<PageRankResult[] | null> {
    const key = `${CACHE_KEYS.PAGERANK}:${graphName}`;

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit();
        return JSON.parse(cached) as PageRankResult[];
      }
      this.recordMiss();
      return null;
    } catch (error) {
      this.logger.error(
        'Failed to get PageRank from cache',
        error instanceof Error ? error : undefined
      );
      return null;
    }
  }

  /**
   * Cache PageRank results.
   *
   * @param graphName - Graph projection name
   * @param results - PageRank scores
   * @param ttlSeconds - Optional custom TTL
   */
  async setPageRank(
    graphName: string,
    results: PageRankResult[],
    ttlSeconds?: number
  ): Promise<void> {
    const key = `${CACHE_KEYS.PAGERANK}:${graphName}`;
    const ttl = ttlSeconds ?? this.ttl.PAGERANK;

    try {
      await this.redis.setex(key, ttl, JSON.stringify(results));
      this.logger.debug('Cached PageRank', { graphName, count: results.length, ttl });
    } catch (error) {
      this.logger.error('Failed to cache PageRank', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get cached betweenness centrality results.
   *
   * @param graphName - Graph projection name
   * @returns Cached betweenness scores or null
   */
  async getBetweenness(graphName: string): Promise<BetweennessCentrality[] | null> {
    const key = `${CACHE_KEYS.BETWEENNESS}:${graphName}`;

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit();
        return JSON.parse(cached) as BetweennessCentrality[];
      }
      this.recordMiss();
      return null;
    } catch (error) {
      this.logger.error(
        'Failed to get betweenness from cache',
        error instanceof Error ? error : undefined
      );
      return null;
    }
  }

  /**
   * Cache betweenness centrality results.
   *
   * @param graphName - Graph projection name
   * @param results - Betweenness scores
   * @param ttlSeconds - Optional custom TTL
   */
  async setBetweenness(
    graphName: string,
    results: BetweennessCentrality[],
    ttlSeconds?: number
  ): Promise<void> {
    const key = `${CACHE_KEYS.BETWEENNESS}:${graphName}`;
    const ttl = ttlSeconds ?? this.ttl.BETWEENNESS;

    try {
      await this.redis.setex(key, ttl, JSON.stringify(results));
      this.logger.debug('Cached betweenness', { graphName, count: results.length, ttl });
    } catch (error) {
      this.logger.error('Failed to cache betweenness', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get cached trending papers.
   *
   * @param window - Time window (e.g., '24h', '7d', '30d')
   * @returns Cached trending papers or null
   */
  async getTrending(window: string): Promise<TrendingPaper[] | null> {
    const key = `${CACHE_KEYS.TRENDING}:${window}`;

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit();
        return JSON.parse(cached) as TrendingPaper[];
      }
      this.recordMiss();
      return null;
    } catch (error) {
      this.logger.error(
        'Failed to get trending from cache',
        error instanceof Error ? error : undefined
      );
      return null;
    }
  }

  /**
   * Cache trending papers.
   *
   * @param window - Time window
   * @param papers - Trending papers
   * @param ttlSeconds - Optional custom TTL
   */
  async setTrending(window: string, papers: TrendingPaper[], ttlSeconds?: number): Promise<void> {
    const key = `${CACHE_KEYS.TRENDING}:${window}`;
    const ttl = ttlSeconds ?? this.ttl.TRENDING;

    try {
      await this.redis.setex(key, ttl, JSON.stringify(papers));
      this.logger.debug('Cached trending papers', { window, count: papers.length, ttl });
    } catch (error) {
      this.logger.error(
        'Failed to cache trending papers',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get cached user recommendations.
   *
   * @param userDid - User DID
   * @returns Cached recommendations or null
   */
  async getRecommendations(userDid: DID): Promise<Recommendation[] | null> {
    const key = `${CACHE_KEYS.RECOMMENDATIONS}:${userDid}`;

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit();
        return JSON.parse(cached) as Recommendation[];
      }
      this.recordMiss();
      return null;
    } catch (error) {
      this.logger.error(
        'Failed to get recommendations from cache',
        error instanceof Error ? error : undefined
      );
      return null;
    }
  }

  /**
   * Cache user recommendations.
   *
   * @param userDid - User DID
   * @param recommendations - Recommendation results
   * @param ttlSeconds - Optional custom TTL
   */
  async setRecommendations(
    userDid: DID,
    recommendations: Recommendation[],
    ttlSeconds?: number
  ): Promise<void> {
    const key = `${CACHE_KEYS.RECOMMENDATIONS}:${userDid}`;
    const ttl = ttlSeconds ?? this.ttl.RECOMMENDATIONS;

    try {
      await this.redis.setex(key, ttl, JSON.stringify(recommendations));
      this.logger.debug('Cached recommendations', { userDid, count: recommendations.length, ttl });
    } catch (error) {
      this.logger.error(
        'Failed to cache recommendations',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidate all caches for a specific graph.
   *
   * @param graphName - Graph projection name
   */
  async invalidateGraph(graphName: string): Promise<void> {
    const keys = [`${CACHE_KEYS.PAGERANK}:${graphName}`, `${CACHE_KEYS.BETWEENNESS}:${graphName}`];

    try {
      await this.redis.del(...keys);
      this.logger.debug('Invalidated graph caches', { graphName });
    } catch (error) {
      this.logger.error(
        'Failed to invalidate graph caches',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidate all algorithm caches.
   *
   * @remarks
   * Use sparingly - forces recomputation of all cached results.
   */
  async invalidateAll(): Promise<void> {
    try {
      const keys = await this.redis.keys('chive:graph:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      this.logger.info('Invalidated all graph algorithm caches', { keyCount: keys.length });
    } catch (error) {
      this.logger.error(
        'Failed to invalidate all caches',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache hit/miss statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  private recordHit(): void {
    this.hits++;
  }

  private recordMiss(): void {
    this.misses++;
  }
}
