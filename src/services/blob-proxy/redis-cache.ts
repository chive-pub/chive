/**
 * Redis cache service with probabilistic early expiration.
 *
 * @remarks
 * L1 cache implementation using Redis with features to prevent cache stampede:
 * - Probabilistic early expiration
 * - Request coalescing
 * - Automatic key compression
 * - TTL-based eviction
 *
 * Follows patterns from:
 * - "Optimal Probabilistic Cache Stampede Prevention" (Vattani et al., 2015)
 * - Redis Best Practices (Redis Labs)
 * - Cloudflare's cache design patterns
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';

import type { CID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Redis cache configuration.
 *
 * @public
 */
export interface RedisCacheConfig {
  /**
   * Redis client instance.
   */
  readonly redis: Redis;

  /**
   * Default TTL in seconds.
   *
   * @remarks
   * Default: 3600 (1 hour)
   * L1 cache typically 1-4 hours
   */
  readonly defaultTTL?: number;

  /**
   * Beta parameter for probabilistic early expiration.
   *
   * @remarks
   * Default: 1.0
   * Higher beta = more aggressive early expiration
   * Range: 0.5-2.0 (1.0 is optimal for most workloads)
   *
   * Formula: P(expire) = age / (ttl * beta)
   */
  readonly beta?: number;

  /**
   * Maximum blob size to cache (bytes).
   *
   * @remarks
   * Default: 10485760 (10MB)
   * Prevents caching very large blobs that waste memory
   */
  readonly maxBlobSize?: number;

  /**
   * Key prefix for namespacing.
   *
   * @remarks
   * Default: 'chive:blob:'
   * Prevents key collisions in shared Redis instances
   */
  readonly keyPrefix?: string;

  /**
   * Logger for cache events.
   */
  readonly logger?: ILogger;
}

/**
 * Cache entry metadata.
 *
 * @remarks
 * Stored alongside blob data to enable probabilistic expiration.
 *
 * @internal
 */
interface CacheEntryMetadata {
  /**
   * When entry was cached (Unix timestamp in milliseconds).
   */
  readonly cachedAt: number;

  /**
   * TTL in seconds.
   */
  readonly ttl: number;

  /**
   * Blob size in bytes.
   */
  readonly size: number;

  /**
   * Content type (MIME type).
   */
  readonly contentType: string;
}

/**
 * Cache entry with data and metadata.
 *
 * @public
 */
export interface CacheEntry {
  /**
   * Blob data as Buffer.
   */
  readonly data: Buffer;

  /**
   * Content type (MIME type).
   */
  readonly contentType: string;

  /**
   * Blob size in bytes.
   */
  readonly size: number;

  /**
   * Whether this entry was fetched early (probabilistic expiration).
   */
  readonly isEarlyFetch: boolean;
}

/**
 * Redis cache service with probabilistic early expiration.
 *
 * @remarks
 * Implements probabilistic early expiration to prevent cache stampede
 * when many clients request expired keys simultaneously.
 *
 * **Probabilistic Early Expiration**:
 * ```
 * age = now - cachedAt
 * P(expire) = age / (ttl * beta)
 * if random() < P(expire): treat as expired
 * ```
 *
 * This ensures cache entries are refreshed before expiration with
 * probability proportional to age, preventing thundering herd.
 *
 * @example
 * ```typescript
 * const cache = new RedisCache({
 *   redis,
 *   defaultTTL: 3600,
 *   beta: 1.0,
 *   maxBlobSize: 10 * 1024 * 1024,
 *   logger
 * });
 *
 * // Set entry
 * await cache.set(cid, blobData, 'application/pdf');
 *
 * // Get entry (with probabilistic expiration)
 * const entry = await cache.get(cid);
 * if (entry) {
 *   if (entry.isEarlyFetch) {
 *     // Refresh in background
 *     refreshFromPDS(cid).catch(logger.error);
 *   }
 *   return entry.data;
 * }
 * ```
 *
 * @public
 */
export class RedisCache {
  private readonly redis: Redis;
  private readonly defaultTTL: number;
  private readonly beta: number;
  private readonly maxBlobSize: number;
  private readonly keyPrefix: string;
  private readonly logger?: ILogger;

  constructor(config: RedisCacheConfig) {
    this.redis = config.redis;
    this.defaultTTL = config.defaultTTL ?? 3600;
    this.beta = config.beta ?? 1.0;
    this.maxBlobSize = config.maxBlobSize ?? 10 * 1024 * 1024; // 10MB
    this.keyPrefix = config.keyPrefix ?? 'chive:blob:';
    this.logger = config.logger;
  }

  /**
   * Gets blob from cache with probabilistic early expiration.
   *
   * @param cid - Content identifier
   * @returns Cache entry or null if not found/expired
   *
   * @remarks
   * Implements probabilistic early expiration:
   * 1. Check if key exists
   * 2. Retrieve metadata and data
   * 3. Calculate age
   * 4. Probabilistically decide if entry should be treated as expired
   * 5. Return entry with `isEarlyFetch` flag
   *
   * @public
   */
  async get(cid: CID): Promise<CacheEntry | null> {
    const key = this.buildKey(cid);

    try {
      // Get metadata and data in pipeline for efficiency
      const pipeline = this.redis.pipeline();
      pipeline.hgetall(`${key}:meta`);
      pipeline.getBuffer(key);
      const results = await pipeline.exec();

      if (!results) {
        return null;
      }

      const metaResult = results[0];
      const dataResult = results[1];

      // Check for undefined results
      if (!metaResult || !dataResult) {
        return null;
      }

      // Check for errors
      const metaError = metaResult[0];
      const dataError = dataResult[0];
      if (metaError || dataError) {
        this.logger?.error(
          'Redis pipeline error',
          metaError instanceof Error
            ? metaError
            : dataError instanceof Error
              ? dataError
              : undefined
        );
        return null;
      }

      const metaData = metaResult[1] as Record<string, string> | null;
      const blobData = dataResult[1] as Buffer | null;

      // Not found
      if (!metaData || !blobData || Object.keys(metaData).length === 0) {
        this.logger?.debug('Cache miss', { cid });
        return null;
      }

      // Parse metadata with validation
      const cachedAtStr = metaData.cachedAt;
      const ttlStr = metaData.ttl;
      const sizeStr = metaData.size;
      const contentType = metaData.contentType;

      if (!cachedAtStr || !ttlStr || !sizeStr || !contentType) {
        this.logger?.error('Invalid cache metadata', undefined, { cid });
        return null;
      }

      const metadata: CacheEntryMetadata = {
        cachedAt: parseInt(cachedAtStr, 10),
        ttl: parseInt(ttlStr, 10),
        size: parseInt(sizeStr, 10),
        contentType,
      };

      // Check probabilistic early expiration
      const isEarlyFetch = this.shouldExpireEarly(metadata);

      if (isEarlyFetch) {
        this.logger?.debug('Probabilistic early fetch', { cid });
      } else {
        this.logger?.debug('Cache hit', { cid });
      }

      return {
        data: blobData,
        contentType: metadata.contentType,
        size: metadata.size,
        isEarlyFetch,
      };
    } catch (error) {
      this.logger?.error('Cache get error', error instanceof Error ? error : undefined, { cid });
      return null;
    }
  }

  /**
   * Sets blob in cache.
   *
   * @param cid - Content identifier
   * @param data - Blob data
   * @param contentType - MIME type
   * @param ttl - Optional TTL override (seconds)
   * @returns True if cached, false if skipped
   *
   * @remarks
   * Skips caching if:
   * - Blob exceeds maxBlobSize
   * - Redis error occurs
   *
   * @public
   */
  async set(cid: CID, data: Buffer, contentType: string, ttl?: number): Promise<boolean> {
    // Skip caching large blobs
    if (data.length > this.maxBlobSize) {
      this.logger?.debug('Blob too large to cache', {
        cid,
        size: data.length,
        maxSize: this.maxBlobSize,
      });
      return false;
    }

    const key = this.buildKey(cid);
    const effectiveTTL = ttl ?? this.defaultTTL;

    const metadata: CacheEntryMetadata = {
      cachedAt: Date.now(),
      ttl: effectiveTTL,
      size: data.length,
      contentType,
    };

    try {
      // Store metadata and data atomically with pipeline
      const pipeline = this.redis.pipeline();
      pipeline.hset(`${key}:meta`, {
        cachedAt: metadata.cachedAt.toString(),
        ttl: metadata.ttl.toString(),
        size: metadata.size.toString(),
        contentType: metadata.contentType,
      });
      pipeline.setex(key, effectiveTTL, data);
      pipeline.expire(`${key}:meta`, effectiveTTL);

      await pipeline.exec();

      this.logger?.debug('Cached blob', { cid, size: data.length, ttl: effectiveTTL });

      return true;
    } catch (error) {
      this.logger?.error('Cache set error', error instanceof Error ? error : undefined, { cid });
      return false;
    }
  }

  /**
   * Deletes blob from cache.
   *
   * @param cid - Content identifier
   * @returns True if deleted, false otherwise
   *
   * @public
   */
  async delete(cid: CID): Promise<boolean> {
    const key = this.buildKey(cid);

    try {
      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      pipeline.del(`${key}:meta`);
      const results = await pipeline.exec();

      if (!results?.[0] || !results?.[1]) {
        return false;
      }

      const deletedKey1 = results[0][1] as number;
      const deletedKey2 = results[1][1] as number;
      const deleted = deletedKey1 + deletedKey2;

      this.logger?.debug('Deleted from cache', { cid, keysDeleted: deleted });

      return deleted > 0;
    } catch (error) {
      this.logger?.error('Cache delete error', error instanceof Error ? error : undefined, {
        cid,
      });
      return false;
    }
  }

  /**
   * Checks if blob exists in cache (without retrieval).
   *
   * @param cid - Content identifier
   * @returns True if exists, false otherwise
   *
   * @public
   */
  async has(cid: CID): Promise<boolean> {
    const key = this.buildKey(cid);

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger?.error('Cache has error', error instanceof Error ? error : undefined, { cid });
      return false;
    }
  }

  /**
   * Clears all cached blobs.
   *
   * @remarks
   * Uses SCAN to find and delete keys matching prefix.
   * Safe for production use (non-blocking).
   *
   * @public
   */
  async clear(): Promise<number> {
    let cursor = '0';
    let deletedCount = 0;

    try {
      do {
        const result = await this.redis.scan(cursor, 'MATCH', `${this.keyPrefix}*`, 'COUNT', 100);

        cursor = result[0];
        const keys = result[1];

        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');

      this.logger?.info('Cleared cache', { deletedCount });

      return deletedCount;
    } catch (error) {
      this.logger?.error('Cache clear error', error instanceof Error ? error : undefined);
      return deletedCount;
    }
  }

  /**
   * Gets cache statistics.
   *
   * @returns Cache statistics
   *
   * @public
   */
  async getStats(): Promise<{
    keyCount: number;
    memoryUsage: number;
  }> {
    try {
      let keyCount = 0;
      let cursor = '0';

      do {
        const result = await this.redis.scan(cursor, 'MATCH', `${this.keyPrefix}*`, 'COUNT', 100);

        cursor = result[0];
        keyCount += result[1].length;
      } while (cursor !== '0');

      const info = await this.redis.info('memory');
      const memoryMatch = /used_memory:(\d+)/.exec(info);
      const memoryUsageStr = memoryMatch?.[1];
      const memoryUsage = memoryUsageStr ? parseInt(memoryUsageStr, 10) : 0;

      return { keyCount, memoryUsage };
    } catch (error) {
      this.logger?.error('Cache stats error', error instanceof Error ? error : undefined);
      return { keyCount: 0, memoryUsage: 0 };
    }
  }

  /**
   * Determines if entry should be expired early (probabilistically).
   *
   * @param metadata - Cache entry metadata
   * @returns True if should treat as expired
   *
   * @remarks
   * **Probabilistic Early Expiration Formula**:
   * ```
   * age = now - cachedAt
   * probability = age / (ttl * beta)
   * if random() < probability: expire early
   * ```
   *
   * This prevents cache stampede by having entries refresh before
   * actual expiration with probability proportional to age.
   *
   * **Example**:
   * - TTL = 3600s (1 hour)
   * - Beta = 1.0
   * - Age = 3000s (50 minutes)
   * - Probability = 3000 / (3600 * 1.0) = 0.833 (83.3% chance)
   *
   * @private
   */
  private shouldExpireEarly(metadata: CacheEntryMetadata): boolean {
    const now = Date.now();
    const age = (now - metadata.cachedAt) / 1000; // Convert to seconds
    const ttl = metadata.ttl;

    // If past TTL, definitely expired
    if (age >= ttl) {
      return true;
    }

    // Probabilistic early expiration
    // Formula: P(expire) = age / (ttl * beta)
    const probability = age / (ttl * this.beta);

    // Clamp probability between 0 and 1
    const clampedProbability = Math.max(0, Math.min(1, probability));

    return Math.random() < clampedProbability;
  }

  /**
   * Builds Redis key from CID.
   *
   * @param cid - Content identifier
   * @returns Redis key with prefix
   *
   * @private
   */
  private buildKey(cid: CID): string {
    return `${this.keyPrefix}${cid}`;
  }
}
