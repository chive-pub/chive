/**
 * Redis-based per-PDS rate limiter.
 *
 * @remarks
 * Implements per-PDS rate limiting for freshness checks to prevent overwhelming
 * individual PDSes with too many requests. Uses Redis sliding window algorithm.
 *
 * **Features:**
 * - Per-PDS URL rate limiting
 * - Configurable limits (requests/minute)
 * - Returns wait time if rate limited
 * - Atomic operations via Redis pipeline
 *
 * **ATProto Compliance:**
 * - Respects PDS server resources
 * - Prevents denial-of-service to user PDSes
 * - Enables graceful degradation under load
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * PDS rate limiter configuration.
 *
 * @public
 */
export interface PDSRateLimiterOptions {
  /**
   * Redis client for rate limiting state.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Maximum requests per PDS per window.
   *
   * @defaultValue 10
   */
  readonly maxRequestsPerWindow?: number;

  /**
   * Window duration in milliseconds.
   *
   * @defaultValue 60000 (1 minute)
   */
  readonly windowMs?: number;

  /**
   * Redis key prefix.
   *
   * @defaultValue 'chive:pds-rate:'
   */
  readonly keyPrefix?: string;
}

/**
 * Rate limit check result.
 *
 * @public
 */
export interface PDSRateLimitResult {
  /**
   * Whether the request is allowed.
   */
  readonly allowed: boolean;

  /**
   * Remaining requests in current window.
   */
  readonly remaining: number;

  /**
   * Milliseconds to wait before retrying (if rate limited).
   */
  readonly waitMs: number;

  /**
   * PDS URL that was checked.
   */
  readonly pdsUrl: string;
}

/**
 * Rate limiter statistics.
 *
 * @public
 */
export interface PDSRateLimiterStats {
  /**
   * Total rate limit checks performed.
   */
  readonly checksPerformed: number;

  /**
   * Requests allowed.
   */
  readonly allowed: number;

  /**
   * Requests rate-limited.
   */
  readonly rateLimited: number;

  /**
   * Unique PDSes tracked.
   */
  readonly uniquePdsCount: number;
}

/**
 * Redis-based per-PDS rate limiter.
 *
 * @remarks
 * Uses sliding window algorithm for accurate rate limiting without burst issues.
 * Each PDS URL gets its own rate limit bucket.
 *
 * @example
 * ```typescript
 * const rateLimiter = new PDSRateLimiter({
 *   redis,
 *   logger,
 *   maxRequestsPerWindow: 10,
 *   windowMs: 60000, // 1 minute
 * });
 *
 * const result = await rateLimiter.checkLimit('https://bsky.social');
 *
 * if (result.allowed) {
 *   // Make request to PDS
 *   await fetchFromPDS(uri);
 * } else {
 *   // Wait and retry
 *   await sleep(result.waitMs);
 * }
 * ```
 *
 * @public
 */
export class PDSRateLimiter {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly maxRequestsPerWindow: number;
  private readonly windowMs: number;
  private readonly keyPrefix: string;

  private checksPerformed = 0;
  private allowedCount = 0;
  private rateLimitedCount = 0;
  private readonly trackedPdses = new Set<string>();

  constructor(options: PDSRateLimiterOptions) {
    this.redis = options.redis;
    this.logger = options.logger.child({ service: 'pds-rate-limiter' });
    this.maxRequestsPerWindow = options.maxRequestsPerWindow ?? 10;
    this.windowMs = options.windowMs ?? 60_000;
    this.keyPrefix = options.keyPrefix ?? 'chive:pds-rate:';
  }

  /**
   * Checks if a request to the given PDS is allowed.
   *
   * @param pdsUrl - PDS URL to check rate limit for
   * @returns Rate limit check result
   *
   * @remarks
   * Uses Redis sorted set with timestamps for sliding window.
   * If allowed, the request is automatically recorded.
   *
   * @public
   */
  async checkLimit(pdsUrl: string): Promise<PDSRateLimitResult> {
    this.checksPerformed++;
    this.trackedPdses.add(pdsUrl);

    const key = this.buildKey(pdsUrl);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      // Use pipeline for atomic operation
      const pipeline = this.redis.pipeline();

      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count requests in window
      pipeline.zcard(key);

      const results = await pipeline.exec();

      if (!results) {
        // Redis error: fail open (allow request)
        this.logger.warn('Redis error during rate limit check, failing open', { pdsUrl });
        this.allowedCount++;
        return {
          allowed: true,
          remaining: this.maxRequestsPerWindow,
          waitMs: 0,
          pdsUrl,
        };
      }

      const count = (results[1]?.[1] as number) ?? 0;

      if (count >= this.maxRequestsPerWindow) {
        // Rate limited
        this.rateLimitedCount++;

        // Calculate wait time from oldest entry
        const oldestResult = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTime = oldestResult?.[1] ? parseInt(oldestResult[1], 10) : now;
        const waitMs = Math.max(1, oldestTime + this.windowMs - now);

        this.logger.debug('PDS rate limited', {
          pdsUrl,
          count,
          limit: this.maxRequestsPerWindow,
          waitMs,
        });

        return {
          allowed: false,
          remaining: 0,
          waitMs,
          pdsUrl,
        };
      }

      // Allowed: record the request
      const requestId = `${now}:${Math.random().toString(36).slice(2, 8)}`;
      await this.redis.zadd(key, now, requestId);
      await this.redis.expire(key, Math.ceil(this.windowMs / 1000) + 1);

      this.allowedCount++;
      const remaining = this.maxRequestsPerWindow - count - 1;

      return {
        allowed: true,
        remaining: Math.max(0, remaining),
        waitMs: 0,
        pdsUrl,
      };
    } catch (error) {
      // Redis error: fail open
      this.logger.error(
        'Error checking PDS rate limit',
        error instanceof Error ? error : undefined,
        { pdsUrl }
      );
      this.allowedCount++;
      return {
        allowed: true,
        remaining: this.maxRequestsPerWindow,
        waitMs: 0,
        pdsUrl,
      };
    }
  }

  /**
   * Waits for rate limit to reset, then returns.
   *
   * @param pdsUrl - PDS URL to wait for
   * @param maxWaitMs - Maximum time to wait
   * @returns Rate limit result after waiting
   *
   * @remarks
   * Blocks until rate limit allows a request or maxWaitMs is exceeded.
   *
   * @public
   */
  async waitForLimit(pdsUrl: string, maxWaitMs = 120_000): Promise<PDSRateLimitResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.checkLimit(pdsUrl);

      if (result.allowed) {
        return result;
      }

      // Wait for the minimum of waitMs and remaining maxWaitMs
      const remainingWait = maxWaitMs - (Date.now() - startTime);
      const waitTime = Math.min(result.waitMs, remainingWait);

      if (waitTime <= 0) {
        break;
      }

      this.logger.debug('Waiting for PDS rate limit', {
        pdsUrl,
        waitMs: waitTime,
      });

      await this.sleep(waitTime);
    }

    // Timed out
    return {
      allowed: false,
      remaining: 0,
      waitMs: maxWaitMs,
      pdsUrl,
    };
  }

  /**
   * Gets the current request count for a PDS.
   *
   * @param pdsUrl - PDS URL
   * @returns Current request count in window
   *
   * @public
   */
  async getCurrentCount(pdsUrl: string): Promise<number> {
    const key = this.buildKey(pdsUrl);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove expired and count
    await this.redis.zremrangebyscore(key, 0, windowStart);
    return await this.redis.zcard(key);
  }

  /**
   * Resets rate limit for a specific PDS.
   *
   * @param pdsUrl - PDS URL to reset
   *
   * @remarks
   * Useful for testing or admin operations.
   *
   * @public
   */
  async reset(pdsUrl: string): Promise<void> {
    const key = this.buildKey(pdsUrl);
    await this.redis.del(key);
    this.logger.debug('PDS rate limit reset', { pdsUrl });
  }

  /**
   * Resets all rate limits.
   *
   * @public
   */
  async resetAll(): Promise<void> {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    this.logger.info('All PDS rate limits reset', { count: keys.length });
  }

  /**
   * Gets rate limiter statistics.
   *
   * @returns Current statistics
   *
   * @public
   */
  getStats(): PDSRateLimiterStats {
    return {
      checksPerformed: this.checksPerformed,
      allowed: this.allowedCount,
      rateLimited: this.rateLimitedCount,
      uniquePdsCount: this.trackedPdses.size,
    };
  }

  /**
   * Builds Redis key for a PDS URL.
   */
  private buildKey(pdsUrl: string): string {
    // Normalize URL for consistent keying
    const normalized = pdsUrl.toLowerCase().replace(/\/$/, '');
    return `${this.keyPrefix}${normalized}`;
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
