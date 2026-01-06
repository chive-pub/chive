/**
 * Metrics service for AppView-specific analytics with Redis counters.
 *
 * @remarks
 * Tracks views, downloads, and computes trending metrics using Redis for
 * high-performance real-time counters.
 *
 * **Architecture:**
 * - Redis INCR for atomic counter increments
 * - HyperLogLog (PFADD/PFCOUNT) for unique viewer tracking
 * - Sorted sets (ZADD) for time-windowed trending
 * - Periodic background flush to PostgreSQL for persistence
 *
 * **Industry Standard Approach:**
 * Follows patterns from Twitter (real-time trending), Reddit (upvote counters),
 * GitHub (star counters), and Medium (clap counters).
 *
 * **Key Metrics:**
 * - Total views (all-time counter)
 * - Unique views (HyperLogLog cardinality estimation)
 * - Downloads (all-time counter)
 * - Time-windowed views (24h, 7d, 30d for trending)
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';
import type { Pool } from 'pg';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IStorageBackend } from '../../types/interfaces/storage.interface.js';
import type { Result } from '../../types/result.js';

/**
 * Metrics service configuration.
 *
 * @public
 */
export interface MetricsServiceOptions {
  /**
   * PostgreSQL connection pool for persistence.
   */
  readonly pool: Pool;

  /**
   * Storage backend for persistence.
   */
  readonly storage: IStorageBackend;

  /**
   * Redis client for counters.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Key prefix for Redis keys.
   *
   * @defaultValue "chive:metrics:"
   */
  readonly keyPrefix?: string;
}

/**
 * Preprint metrics.
 *
 * @public
 */
export interface PreprintMetrics {
  /**
   * Total views (all-time).
   */
  readonly totalViews: number;

  /**
   * Unique views (approximate via HyperLogLog).
   */
  readonly uniqueViews: number;

  /**
   * Total downloads (all-time).
   */
  readonly totalDownloads: number;

  /**
   * Views in last 24 hours.
   */
  readonly views24h: number;

  /**
   * Views in last 7 days.
   */
  readonly views7d: number;

  /**
   * Views in last 30 days.
   */
  readonly views30d: number;
}

/**
 * Trending preprint entry.
 *
 * @public
 */
export interface TrendingEntry {
  /**
   * Preprint URI.
   */
  readonly uri: AtUri;

  /**
   * Trending score (views in time window).
   */
  readonly score: number;
}

/**
 * Metrics service implementation with Redis counters.
 *
 * @remarks
 * **Redis Data Structures:**
 *
 * **Counters** (STRING with INCR):
 * - `chive:metrics:views:{uri}` - Total view count
 * - `chive:metrics:downloads:{uri}` - Total download count
 *
 * **Unique Viewers** (HyperLogLog):
 * - `chive:metrics:unique:{uri}` - Approximate unique viewer count
 *
 * **Time-Windowed Views** (Sorted Set per URI):
 * - `chive:metrics:views:24h:{uri}` - View timestamps in last 24h
 * - `chive:metrics:views:7d:{uri}` - View timestamps in last 7d
 * - `chive:metrics:views:30d:{uri}` - View timestamps in last 30d
 *
 * **Performance Characteristics:**
 * - INCR: O(1) - 100k+ ops/sec per core
 * - PFADD: O(1) - ~0.81% standard error
 * - ZADD: O(log N) - Efficient for trending
 * - Pipeline: Batch multiple operations (reduces RTT)
 *
 * **Persistence Strategy:**
 * - Real-time writes go to Redis (fast, in-memory)
 * - Background job flushes to PostgreSQL every 5 minutes
 * - PostgreSQL provides durability and historical queries
 * - Redis provides real-time, high-throughput counters
 *
 * @example
 * ```typescript
 * const service = new MetricsService({ storage, redis, logger });
 *
 * // Record view (increments counters atomically)
 * await service.recordView(preprintUri, viewerDid);
 *
 * // Get metrics
 * const metrics = await service.getMetrics(preprintUri);
 * console.log(`Total views: ${metrics.totalViews}`);
 * console.log(`Unique viewers: ${metrics.uniqueViews}`);
 * console.log(`Trending (24h): ${metrics.views24h}`);
 *
 * // Get trending preprints
 * const trending = await service.getTrending('24h', 10);
 * ```
 *
 * @public
 */
export class MetricsService {
  private readonly pool: Pool;
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly keyPrefix: string;

  constructor(options: MetricsServiceOptions) {
    this.pool = options.pool;
    this.redis = options.redis;
    this.logger = options.logger;
    this.keyPrefix = options.keyPrefix ?? 'chive:metrics:';
  }

  /**
   * Records preprint view.
   *
   * @param uri - Preprint URI
   * @param viewerDid - Optional viewer DID for unique tracking
   * @returns Result indicating success or failure
   *
   * @remarks
   * **Operations (atomic via pipeline):**
   * 1. INCR total view counter
   * 2. PFADD viewer DID to HyperLogLog (if provided)
   * 3. ZADD to time-windowed sorted sets with current timestamp
   *
   * **Pipeline Benefits:**
   * - Single network round-trip
   * - Atomic execution
   * - ~10x faster than individual commands
   *
   * @example
   * ```typescript
   * // Anonymous view
   * await service.recordView(uri);
   *
   * // Authenticated view (tracks unique viewers)
   * await service.recordView(uri, viewerDid);
   * ```
   *
   * @public
   */
  async recordView(uri: AtUri, viewerDid?: DID): Promise<Result<void, DatabaseError>> {
    try {
      const now = Date.now();
      const pipeline = this.redis.pipeline();

      // Increment total view counter
      pipeline.incr(this.buildKey('views', uri));

      // Track unique viewer (if DID provided)
      if (viewerDid) {
        pipeline.pfadd(this.buildKey('unique', uri), viewerDid);
      }

      // Add to time-windowed sorted sets (per-URI for efficient counting)
      // Use unique member to avoid deduplication when multiple views in same ms
      const uniqueMember = `${now}:${Math.random().toString(36).slice(2, 10)}`;
      pipeline.zadd(this.buildKey('views:24h', uri), now, uniqueMember);
      pipeline.zadd(this.buildKey('views:7d', uri), now, uniqueMember);
      pipeline.zadd(this.buildKey('views:30d', uri), now, uniqueMember);

      // Set TTL on keys to prevent unbounded growth
      pipeline.expire(this.buildKey('views', uri), 31536000); // 1 year
      pipeline.expire(this.buildKey('unique', uri), 31536000);
      pipeline.expire(this.buildKey('views:24h', uri), 86400 * 2); // 2 days
      pipeline.expire(this.buildKey('views:7d', uri), 86400 * 14); // 14 days
      pipeline.expire(this.buildKey('views:30d', uri), 86400 * 60); // 60 days

      await pipeline.exec();

      this.logger.debug('Recorded view', { uri, viewerDid });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to record view', error instanceof Error ? error : undefined, {
        uri,
      });

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : `Failed to record view: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Records preprint download.
   *
   * @param uri - Preprint URI
   * @param viewerDid - Optional viewer DID
   * @returns Result indicating success or failure
   *
   * @remarks
   * Increments download counter atomically using Redis INCR.
   *
   * @public
   */
  async recordDownload(uri: AtUri, viewerDid?: DID): Promise<Result<void, DatabaseError>> {
    try {
      const pipeline = this.redis.pipeline();

      // Increment download counter
      pipeline.incr(this.buildKey('downloads', uri));

      // Track unique downloader (if DID provided)
      if (viewerDid) {
        pipeline.pfadd(this.buildKey('unique:downloads', uri), viewerDid);
      }

      // Set TTL
      pipeline.expire(this.buildKey('downloads', uri), 31536000); // 1 year
      if (viewerDid) {
        pipeline.expire(this.buildKey('unique:downloads', uri), 31536000);
      }

      await pipeline.exec();

      this.logger.debug('Recorded download', { uri, viewerDid });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to record download', error instanceof Error ? error : undefined, {
        uri,
      });

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : `Failed to record download: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Gets comprehensive metrics for preprint.
   *
   * @param uri - Preprint URI
   * @returns Preprint metrics
   *
   * @remarks
   * **Operations (batched via pipeline):**
   * 1. GET total view counter
   * 2. PFCOUNT unique viewers (HyperLogLog cardinality)
   * 3. GET total download counter
   * 4. ZCOUNT views in time windows (24h, 7d, 30d)
   *
   * **Complexity:**
   * - Total: O(1)
   * - Unique: O(1) (HyperLogLog estimation)
   * - Downloads: O(1)
   * - Time-windowed: O(log N) per window
   *
   * @public
   */
  async getMetrics(uri: AtUri): Promise<PreprintMetrics> {
    try {
      const now = Date.now();
      const pipeline = this.redis.pipeline();

      // Get counters
      pipeline.get(this.buildKey('views', uri));
      pipeline.pfcount(this.buildKey('unique', uri));
      pipeline.get(this.buildKey('downloads', uri));

      // Count views in time windows (per-URI sorted sets)
      pipeline.zcount(this.buildKey('views:24h', uri), now - 86400 * 1000, now);
      pipeline.zcount(this.buildKey('views:7d', uri), now - 86400 * 7 * 1000, now);
      pipeline.zcount(this.buildKey('views:30d', uri), now - 86400 * 30 * 1000, now);

      const results = await pipeline.exec();

      if (!results) {
        return this.emptyMetrics();
      }

      // Parse results (handle potential errors)
      const totalViewsResult = results[0];
      const uniqueViewsResult = results[1];
      const totalDownloadsResult = results[2];
      const views24hResult = results[3];
      const views7dResult = results[4];
      const views30dResult = results[5];

      const totalViews =
        totalViewsResult?.[0] === null && typeof totalViewsResult?.[1] === 'string'
          ? parseInt(totalViewsResult[1], 10)
          : 0;

      const uniqueViews =
        uniqueViewsResult?.[0] === null && typeof uniqueViewsResult?.[1] === 'number'
          ? uniqueViewsResult[1]
          : 0;

      const totalDownloads =
        totalDownloadsResult?.[0] === null && typeof totalDownloadsResult?.[1] === 'string'
          ? parseInt(totalDownloadsResult[1], 10)
          : 0;

      const views24h =
        views24hResult?.[0] === null && typeof views24hResult?.[1] === 'number'
          ? views24hResult[1]
          : 0;

      const views7d =
        views7dResult?.[0] === null && typeof views7dResult?.[1] === 'number'
          ? views7dResult[1]
          : 0;

      const views30d =
        views30dResult?.[0] === null && typeof views30dResult?.[1] === 'number'
          ? views30dResult[1]
          : 0;

      return {
        totalViews: isNaN(totalViews) ? 0 : totalViews,
        uniqueViews,
        totalDownloads: isNaN(totalDownloads) ? 0 : totalDownloads,
        views24h,
        views7d,
        views30d,
      };
    } catch (error) {
      this.logger.error('Failed to get metrics', error instanceof Error ? error : undefined, {
        uri,
      });

      return this.emptyMetrics();
    }
  }

  /**
   * Gets view count for preprint.
   *
   * @param uri - Preprint URI
   * @returns View count
   *
   * @public
   */
  async getViewCount(uri: AtUri): Promise<number> {
    try {
      const count = await this.redis.get(this.buildKey('views', uri));

      if (count === null) {
        return 0;
      }

      const parsed = parseInt(count, 10);
      return isNaN(parsed) ? 0 : parsed;
    } catch (error) {
      this.logger.error('Failed to get view count', error instanceof Error ? error : undefined, {
        uri,
      });

      return 0;
    }
  }

  /**
   * Gets trending preprints for time window.
   *
   * @param window - Time window ('24h', '7d', '30d')
   * @param limit - Maximum number of results
   * @returns Trending preprints sorted by score
   *
   * @remarks
   * **Algorithm:**
   * 1. SCAN all view counter keys to find URIs with views
   * 2. ZCOUNT each URI's time-windowed sorted set to get view count
   * 3. Sort by view count descending and return top N
   *
   * **Complexity:** O(N * log M) where N is total URIs, M is views per URI
   *
   * **Performance Note:**
   * This scans all metric keys. For production at scale, consider:
   * - Maintaining a global trending sorted set updated on each view
   * - Caching trending results with short TTL (1-5 minutes)
   * - Using Redis Streams for real-time trending computation
   *
   * @example
   * ```typescript
   * // Get top 10 trending preprints in last 24h
   * const trending = await service.getTrending('24h', 10);
   * ```
   *
   * @public
   */
  async getTrending(
    window: '24h' | '7d' | '30d',
    limit: number
  ): Promise<readonly TrendingEntry[]> {
    try {
      const now = Date.now();

      // Calculate time range
      const windowMs = {
        '24h': 86400 * 1000,
        '7d': 86400 * 7 * 1000,
        '30d': 86400 * 30 * 1000,
      }[window];

      const minScore = now - windowMs;

      // Scan for all view counter keys to find URIs
      let cursor = '0';
      const uriScores: { uri: AtUri; score: number }[] = [];

      do {
        const result = await this.redis.scan(
          cursor,
          'MATCH',
          `${this.keyPrefix}views:*`,
          'COUNT',
          100
        );

        cursor = result[0];
        const keys = result[1];

        if (keys.length === 0) {
          continue;
        }

        // For each URI, count views in time window
        const pipeline = this.redis.pipeline();

        for (const key of keys) {
          const uri = key.replace(`${this.keyPrefix}views:`, '');
          pipeline.zcount(this.buildKey(`views:${window}`, uri), minScore, now);
        }

        const counts = await pipeline.exec();

        if (!counts) {
          continue;
        }

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const count = counts[i];

          if (!key || !count || count?.[0] !== null) {
            continue;
          }

          const uri = key.replace(`${this.keyPrefix}views:`, '') as AtUri;
          const score = typeof count[1] === 'number' ? count[1] : 0;

          if (score > 0) {
            uriScores.push({ uri, score });
          }
        }
      } while (cursor !== '0');

      // Sort by score descending and take top N
      const trending = uriScores.sort((a, b) => b.score - a.score).slice(0, limit);

      return trending;
    } catch (error) {
      this.logger.error('Failed to get trending', error instanceof Error ? error : undefined, {
        window,
      });

      return [];
    }
  }

  /**
   * Increments metrics in batch.
   *
   * @param operations - Array of metric operations
   * @returns Result indicating success or failure
   *
   * @remarks
   * Batch operations for efficiency. Use when processing firehose events
   * or bulk imports.
   *
   * **Performance:** Single pipeline reduces network overhead by ~90%.
   *
   * @example
   * ```typescript
   * await service.batchIncrement([
   *   { type: 'view', uri: uri1, viewerDid: did1 },
   *   { type: 'view', uri: uri2, viewerDid: did2 },
   *   { type: 'download', uri: uri1 }
   * ]);
   * ```
   *
   * @public
   */
  async batchIncrement(
    operations: readonly {
      readonly type: 'view' | 'download';
      readonly uri: AtUri;
      readonly viewerDid?: DID;
    }[]
  ): Promise<Result<void, DatabaseError>> {
    try {
      const now = Date.now();
      const pipeline = this.redis.pipeline();

      for (const op of operations) {
        if (op.type === 'view') {
          pipeline.incr(this.buildKey('views', op.uri));

          if (op.viewerDid) {
            pipeline.pfadd(this.buildKey('unique', op.uri), op.viewerDid);
          }

          // Use unique member to avoid deduplication when multiple views in same ms
          const uniqueMember = `${now}:${Math.random().toString(36).slice(2, 10)}`;
          pipeline.zadd(this.buildKey('views:24h', op.uri), now, uniqueMember);
          pipeline.zadd(this.buildKey('views:7d', op.uri), now, uniqueMember);
          pipeline.zadd(this.buildKey('views:30d', op.uri), now, uniqueMember);
        } else if (op.type === 'download') {
          pipeline.incr(this.buildKey('downloads', op.uri));

          if (op.viewerDid) {
            pipeline.pfadd(this.buildKey('unique:downloads', op.uri), op.viewerDid);
          }
        }
      }

      await pipeline.exec();

      this.logger.debug('Batch incremented metrics', { count: operations.length });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to batch increment', error instanceof Error ? error : undefined);

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : `Failed to batch increment: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Flushes metrics from Redis to PostgreSQL.
   *
   * @returns Result indicating success or failure
   *
   * @remarks
   * **Background Job:**
   * Should be called periodically (e.g., every 5 minutes) by a scheduler
   * to persist Redis counters to PostgreSQL for durability.
   *
   * **Process:**
   * 1. Scan all metric keys
   * 2. Read counters
   * 3. Batch upsert to PostgreSQL using upsert_preprint_metrics function
   * 4. Do NOT delete from Redis (keep for real-time queries)
   *
   * **Concurrency:**
   * Safe to run concurrently from multiple instances (idempotent upserts).
   *
   * @public
   */
  async flushToDatabase(): Promise<Result<number, DatabaseError>> {
    try {
      let cursor = '0';
      let flushedCount = 0;

      do {
        // Scan for view counter keys (exclude time-windowed keys)
        const result = await this.redis.scan(
          cursor,
          'MATCH',
          `${this.keyPrefix}views:*`,
          'COUNT',
          100
        );

        cursor = result[0];
        const keys = result[1];

        // Filter out time-windowed keys (24h, 7d, 30d)
        const viewKeys = keys.filter(
          (key) => key && !key.includes(':24h:') && !key.includes(':7d:') && !key.includes(':30d:')
        );

        if (viewKeys.length === 0) {
          continue;
        }

        // Get view counts, download counts, and unique counts for each URI
        const uris: AtUri[] = [];
        const pipeline = this.redis.pipeline();

        for (const key of viewKeys) {
          if (!key) continue;
          const uri = key.replace(`${this.keyPrefix}views:`, '') as AtUri;
          uris.push(uri);

          pipeline.get(key); // view count
          pipeline.get(this.buildKey('downloads', uri)); // download count
          pipeline.pfcount(this.buildKey('unique', uri)); // unique views
          pipeline.pfcount(this.buildKey('unique:downloads', uri)); // unique downloads
        }

        const values = await pipeline.exec();

        if (!values) {
          continue;
        }

        // Build batch of metrics to upsert
        interface MetricBatch {
          uri: AtUri;
          views: number;
          downloads: number;
          uniqueViews: number;
          uniqueDownloads: number;
        }
        const metricsToFlush: MetricBatch[] = [];

        for (let i = 0; i < uris.length; i++) {
          const uri = uris[i];
          if (!uri) continue;

          const baseIndex = i * 4;

          const viewsResult = values[baseIndex];
          const downloadsResult = values[baseIndex + 1];
          const uniqueViewsResult = values[baseIndex + 2];
          const uniqueDownloadsResult = values[baseIndex + 3];

          const views =
            viewsResult?.[0] === null && typeof viewsResult?.[1] === 'string'
              ? parseInt(viewsResult[1], 10)
              : 0;

          const downloads =
            downloadsResult?.[0] === null && typeof downloadsResult?.[1] === 'string'
              ? parseInt(downloadsResult[1], 10)
              : 0;

          const uniqueViews =
            uniqueViewsResult?.[0] === null && typeof uniqueViewsResult?.[1] === 'number'
              ? uniqueViewsResult[1]
              : 0;

          const uniqueDownloads =
            uniqueDownloadsResult?.[0] === null && typeof uniqueDownloadsResult?.[1] === 'number'
              ? uniqueDownloadsResult[1]
              : 0;

          if (!isNaN(views) && (views > 0 || downloads > 0)) {
            metricsToFlush.push({
              uri,
              views: isNaN(views) ? 0 : views,
              downloads: isNaN(downloads) ? 0 : downloads,
              uniqueViews,
              uniqueDownloads,
            });
          }
        }

        // Batch upsert to PostgreSQL using the helper function
        if (metricsToFlush.length > 0) {
          const client = await this.pool.connect();
          try {
            await client.query('BEGIN');

            for (const metric of metricsToFlush) {
              await client.query('SELECT upsert_preprint_metrics($1, $2, $3, $4, $5)', [
                metric.uri,
                metric.views,
                metric.downloads,
                metric.uniqueViews,
                metric.uniqueDownloads,
              ]);
            }

            await client.query('COMMIT');
            flushedCount += metricsToFlush.length;
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        }
      } while (cursor !== '0');

      this.logger.info('Flushed metrics to database', { count: flushedCount });

      return { ok: true, value: flushedCount };
    } catch (error) {
      this.logger.error('Failed to flush metrics', error instanceof Error ? error : undefined);

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : `Failed to flush metrics: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Builds Redis key with prefix.
   *
   * @param parts - Key parts
   * @returns Full Redis key
   *
   * @private
   */
  private buildKey(...parts: readonly string[]): string {
    return `${this.keyPrefix}${parts.join(':')}`;
  }

  /**
   * Returns empty metrics object.
   *
   * @returns Empty metrics
   *
   * @private
   */
  private emptyMetrics(): PreprintMetrics {
    return {
      totalViews: 0,
      uniqueViews: 0,
      totalDownloads: 0,
      views24h: 0,
      views7d: 0,
      views30d: 0,
    };
  }
}
