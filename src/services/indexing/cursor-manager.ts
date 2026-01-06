/**
 * Cursor persistence manager for firehose consumption.
 *
 * @remarks
 * Manages cursor position tracking for reliable firehose consumption.
 * Uses write-through caching (PostgreSQL primary, Redis backup) with
 * batching to reduce database load.
 *
 * **Cursor Semantics:**
 * - Cursor is a monotonically increasing sequence number
 * - Represents last successfully processed event
 * - Enables resumption after restart or failure
 * - Critical for ATProto compliance (rebuilding from firehose)
 *
 * **Persistence Strategy:**
 * - PostgreSQL: Durable storage (survives restarts)
 * - Redis: Fast cache (reduces PostgreSQL reads)
 * - Batching: Updates every N events OR N seconds (reduces writes)
 *
 * @example
 * ```typescript
 * const manager = new CursorManager({
 *   db,
 *   redis,
 *   serviceName: 'firehose-consumer',
 *   batchSize: 100,
 *   flushInterval: 5000
 * });
 *
 * // On startup: get last cursor
 * const cursor = await manager.getCurrentCursor();
 *
 * // During processing: update cursor
 * for await (const event of events) {
 *   await processEvent(event);
 *   await manager.updateCursor(event.seq);
 * }
 *
 * // On shutdown: flush pending cursor
 * await manager.close();
 * ```
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';
import type { Pool } from 'pg';

/**
 * Cursor manager configuration.
 *
 * @public
 */
export interface CursorManagerOptions {
  /**
   * PostgreSQL connection pool.
   */
  readonly db: Pool;

  /**
   * Redis client.
   */
  readonly redis: Redis;

  /**
   * Service name for cursor tracking.
   *
   * @remarks
   * Multiple services can track separate cursors by using different names.
   *
   * @example "firehose-consumer", "backfill-worker"
   */
  readonly serviceName: string;

  /**
   * Number of events before flushing cursor.
   *
   * @remarks
   * Batching reduces database writes. Higher values = fewer writes but
   * larger replay window on restart.
   *
   * @defaultValue 100
   */
  readonly batchSize?: number;

  /**
   * Time interval (ms) before flushing cursor.
   *
   * @remarks
   * Ensures cursor is persisted even during low event rates.
   *
   * @defaultValue 5000 (5 seconds)
   */
  readonly flushInterval?: number;

  /**
   * Redis key prefix for cursor cache.
   *
   * @defaultValue "cursor:"
   */
  readonly redisKeyPrefix?: string;

  /**
   * Redis TTL for cursor cache (seconds).
   *
   * @remarks
   * Cache is refreshed on writes. Shorter TTL = more PostgreSQL reads
   * on restart, longer TTL = stale cache risk.
   *
   * @defaultValue 3600 (1 hour)
   */
  readonly redisTTL?: number;
}

/**
 * Cursor information.
 *
 * @public
 */
export interface CursorInfo {
  /**
   * Cursor sequence number.
   */
  readonly seq: number;

  /**
   * Service name.
   */
  readonly serviceName: string;

  /**
   * Last update timestamp.
   */
  readonly lastUpdated: Date;

  /**
   * Whether cursor was loaded from cache.
   */
  readonly fromCache: boolean;
}

/**
 * Manages firehose cursor persistence with batching.
 *
 * @remarks
 * Implements write-through caching with PostgreSQL as primary storage
 * and Redis as cache. Batches cursor updates to reduce database load.
 *
 * **Batch Flush Triggers:**
 * - Event count reaches `batchSize`
 * - Time since last flush exceeds `flushInterval`
 * - `flush()` called explicitly
 * - `close()` called (final flush)
 *
 * **Thread Safety:**
 * Not thread-safe. Single consumer per instance.
 *
 * @public
 */
export class CursorManager {
  private readonly db: Pool;
  private readonly redis: Redis;
  private readonly serviceName: string;
  private readonly batchSize: number;
  private readonly flushInterval: number;
  private readonly redisKeyPrefix: string;
  private readonly redisTTL: number;

  private pendingCursor: number | null = null;
  private lastSavedCursor: number | null = null;
  private eventCount = 0;
  private flushTimer: NodeJS.Timeout | null = null;

  /**
   * Creates a cursor manager.
   *
   * @param options - Configuration options
   */
  constructor(options: CursorManagerOptions) {
    this.db = options.db;
    this.redis = options.redis;
    this.serviceName = options.serviceName;
    this.batchSize = options.batchSize ?? 100;
    this.flushInterval = options.flushInterval ?? 5000;
    this.redisKeyPrefix = options.redisKeyPrefix ?? 'cursor:';
    this.redisTTL = options.redisTTL ?? 3600;

    // Start periodic flush timer
    this.startFlushTimer();
  }

  /**
   * Gets current cursor position.
   *
   * @returns Cursor info or null if never set
   *
   * @remarks
   * Read strategy:
   * 1. Try Redis cache (fast)
   * 2. Fallback to PostgreSQL (authoritative)
   * 3. Cache PostgreSQL result in Redis
   *
   * Returns null if cursor has never been set (first run).
   *
   * @throws {Error}
   * Thrown if database query fails.
   *
   * @example
   * ```typescript
   * const cursor = await manager.getCurrentCursor();
   * if (cursor) {
   *   console.log('Resuming from sequence:', cursor.seq);
   *   console.log('From cache:', cursor.fromCache);
   * } else {
   *   console.log('Starting from beginning');
   * }
   * ```
   */
  async getCurrentCursor(): Promise<CursorInfo | null> {
    // Try Redis cache first (fast path)
    const cacheKey = this.getCacheKey();
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const seq = parseInt(cached, 10);
      if (!isNaN(seq)) {
        return {
          seq,
          serviceName: this.serviceName,
          lastUpdated: new Date(), // Cache doesn't store timestamp
          fromCache: true,
        };
      }
    }

    // Fallback to PostgreSQL (authoritative)
    const result = await this.db.query<{
      cursor_seq: number;
      last_updated: Date;
    }>('SELECT cursor_seq, last_updated FROM firehose_cursor WHERE service_name = $1', [
      this.serviceName,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const seq = row.cursor_seq;

    // Cache in Redis for future reads
    await this.redis.setex(cacheKey, this.redisTTL, seq.toString());

    return {
      seq,
      serviceName: this.serviceName,
      lastUpdated: row.last_updated,
      fromCache: false,
    };
  }

  /**
   * Updates cursor position.
   *
   * @param seq - New sequence number
   * @returns Promise resolving when update is queued
   *
   * @remarks
   * Updates are batched for performance. The cursor is not immediately
   * persisted unless:
   * - Event count reaches `batchSize`
   * - Time since last flush exceeds `flushInterval`
   * - `flush()` or `close()` is called
   *
   * **Important:** Call `flush()` or `close()` before shutdown to
   * persist pending cursor.
   *
   * @example
   * ```typescript
   * for await (const event of events) {
   *   await processEvent(event);
   *
   *   // Queue cursor update (batched)
   *   await manager.updateCursor(event.seq);
   * }
   * ```
   */
  async updateCursor(seq: number): Promise<void> {
    this.pendingCursor = seq;
    this.eventCount++;

    // Flush if batch size reached
    if (this.eventCount >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flushes pending cursor to storage.
   *
   * @returns Promise resolving when cursor is persisted
   *
   * @remarks
   * Writes cursor to both PostgreSQL and Redis.
   *
   * **PostgreSQL Write:**
   * Uses UPSERT (INSERT ... ON CONFLICT DO UPDATE) for idempotency.
   *
   * **Redis Write:**
   * Sets key with TTL for cache invalidation.
   *
   * If no pending cursor or cursor unchanged, returns immediately.
   *
   * @throws {Error}
   * Thrown if database write fails.
   *
   * @example
   * ```typescript
   * // Manual flush (e.g., before long-running task)
   * await manager.flush();
   * console.log('Cursor persisted');
   * ```
   */
  async flush(): Promise<void> {
    if (this.pendingCursor === null) {
      return;
    }

    if (this.pendingCursor === this.lastSavedCursor) {
      return;
    }

    const cursor = this.pendingCursor;

    // Write to PostgreSQL (UPSERT for idempotency)
    await this.db.query(
      `INSERT INTO firehose_cursor (service_name, cursor_seq, last_updated)
       VALUES ($1, $2, NOW())
       ON CONFLICT (service_name)
       DO UPDATE SET cursor_seq = EXCLUDED.cursor_seq, last_updated = NOW()`,
      [this.serviceName, cursor]
    );

    // Update Redis cache
    const cacheKey = this.getCacheKey();
    await this.redis.setex(cacheKey, this.redisTTL, cursor.toString());

    this.lastSavedCursor = cursor;
    this.eventCount = 0;
  }

  /**
   * Closes cursor manager and flushes pending cursor.
   *
   * @returns Promise resolving when cleanup is complete
   *
   * @remarks
   * Performs final flush and stops periodic flush timer.
   *
   * **Important:** Always call before shutdown to avoid losing
   * cursor position.
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await manager.close();
   *   process.exit(0);
   * });
   * ```
   */
  async close(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  /**
   * Gets pending cursor (not yet flushed).
   *
   * @returns Pending cursor or null
   *
   * @remarks
   * Returns cursor that is queued but not yet persisted.
   * Useful for monitoring flush lag.
   *
   * @example
   * ```typescript
   * const pending = manager.getPendingCursor();
   * const saved = await manager.getCurrentCursor();
   * const lag = pending && saved ? pending - saved.seq : 0;
   * console.log('Flush lag:', lag, 'events');
   * ```
   */
  getPendingCursor(): number | null {
    return this.pendingCursor;
  }

  /**
   * Gets number of events since last flush.
   *
   * @returns Event count
   *
   * @remarks
   * Useful for monitoring batch size effectiveness.
   */
  getEventCount(): number {
    return this.eventCount;
  }

  /**
   * Gets Redis cache key for this service.
   *
   * @returns Cache key
   *
   * @internal
   */
  private getCacheKey(): string {
    return `${this.redisKeyPrefix}${this.serviceName}`;
  }

  /**
   * Starts periodic flush timer.
   *
   * @internal
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void (async () => {
        try {
          await this.flush();
        } catch (error) {
          // Log error but don't crash timer
          console.error('Cursor flush failed:', error);
        }
      })();
    }, this.flushInterval);

    // Allow process to exit even if timer is active
    this.flushTimer.unref();
  }

  /**
   * Stops periodic flush timer.
   *
   * @internal
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
