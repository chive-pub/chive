/**
 * 4-tier rate limiting middleware using Redis sliding window.
 *
 * @remarks
 * Implements tiered rate limits based on user authentication level:
 * - Anonymous: 60 req/min (by IP)
 * - Authenticated: 300 req/min (by DID)
 * - Premium: 1000 req/min (by DID)
 * - Admin: 5000 req/min (by DID)
 *
 * Uses Redis sorted sets for sliding window rate limiting, providing
 * accurate request counting without the burst issues of fixed windows.
 *
 * @packageDocumentation
 * @public
 */

import type { MiddlewareHandler } from 'hono';
import type { Redis } from 'ioredis';

import { RateLimitError } from '../../types/errors.js';
import {
  RATE_LIMITS,
  AUTOCOMPLETE_RATE_LIMITS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_KEY_PREFIX,
  RATE_LIMIT_FAIL_MODE,
} from '../config.js';
import type { ChiveEnv, RateLimitTier } from '../types/context.js';

/**
 * Rate limit check result.
 */
interface RateLimitResult {
  /**
   * Whether the request is allowed.
   */
  readonly allowed: boolean;

  /**
   * Remaining requests in current window.
   */
  readonly remaining: number;

  /**
   * Unix timestamp when window resets.
   */
  readonly resetAt: number;

  /**
   * Seconds to wait if rate limited (only if not allowed).
   */
  readonly retryAfter?: number;
}

/**
 * Builds rate limit Redis key.
 *
 * @param tier - Rate limit tier
 * @param identifier - IP address or DID
 * @returns Redis key for rate limiting
 */
function buildRateLimitKey(tier: RateLimitTier, identifier: string): string {
  return `${RATE_LIMIT_KEY_PREFIX}${tier}:${identifier}`;
}

/**
 * Extracts client IP from request headers.
 *
 * @remarks
 * Checks common proxy headers in order of priority:
 * 1. X-Forwarded-For (first entry)
 * 2. X-Real-IP
 * 3. CF-Connecting-IP (Cloudflare)
 * 4. Fallback to 127.0.0.1
 *
 * @param c - Hono context
 * @returns Client IP address
 */
function getClientIP(c: { req: { header: (name: string) => string | undefined } }): string {
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0]?.trim();
    if (firstIP) return firstIP;
  }

  return c.req.header('x-real-ip') ?? c.req.header('cf-connecting-ip') ?? '127.0.0.1';
}

/**
 * Checks rate limit using Redis sliding window.
 *
 * @remarks
 * Algorithm:
 * 1. Remove entries older than window start
 * 2. Count entries in window
 * 3. If under limit, add current request
 * 4. Set key TTL to window duration + buffer
 *
 * Uses Redis pipeline for atomicity and performance.
 *
 * @param redis - Redis client
 * @param key - Rate limit key
 * @param limit - Max requests per window
 * @param windowMs - Window size in milliseconds
 * @returns Rate limit check result
 */
async function checkRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetAt = Math.ceil((now + windowMs) / 1000);

  // Use pipeline for atomic operation
  const pipeline = redis.pipeline();

  // Remove expired entries
  pipeline.zremrangebyscore(key, 0, windowStart);

  // Count requests in window
  pipeline.zcard(key);

  // Add current request with timestamp as score
  const requestId = `${now}:${Math.random().toString(36).slice(2, 8)}`;
  pipeline.zadd(key, now, requestId);

  // Set TTL to window duration + 1 second buffer
  pipeline.expire(key, Math.ceil(windowMs / 1000) + 1);

  const results = await pipeline.exec();

  if (!results) {
    // Redis error: behavior depends on RATE_LIMIT_FAIL_MODE configuration
    if (RATE_LIMIT_FAIL_MODE === 'open') {
      // Fail open: allow requests through when Redis is down (availability over security)
      return { allowed: true, remaining: limit, resetAt };
    } else {
      // Fail closed: reject requests when Redis is down (Zero Trust principle)
      return { allowed: false, remaining: 0, resetAt, retryAfter: 60 };
    }
  }

  // zcard result is at index 1 (after zremrangebyscore)
  const count = (results[1]?.[1] as number) ?? 0;
  const remaining = Math.max(0, limit - count - 1);

  if (count >= limit) {
    // Rate limited: calculate retry after
    const oldestResult = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const oldestTime = oldestResult?.[1] ? parseInt(oldestResult[1], 10) : now;
    const retryAfter = Math.max(1, Math.ceil((oldestTime + windowMs - now) / 1000));

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  return { allowed: true, remaining, resetAt };
}

/**
 * Rate limiting middleware factory.
 *
 * @remarks
 * Creates middleware that enforces tiered rate limits:
 * - Determines tier from authenticated user or falls back to anonymous
 * - Uses IP for anonymous, DID for authenticated users
 * - Sets standard rate limit headers on all responses
 * - Throws RateLimitError when limit exceeded
 *
 * @example
 * ```typescript
 * // Apply to all routes
 * app.use('*', rateLimiter());
 *
 * // Custom limits for specific routes
 * app.use('/api/heavy', rateLimiter({ anonymous: 10, authenticated: 50 }));
 * ```
 *
 * @param customLimits - Optional custom limits per tier
 * @returns Hono middleware handler
 *
 * @public
 */
export function rateLimiter(
  customLimits?: Partial<Record<RateLimitTier, number>>
): MiddlewareHandler<ChiveEnv> {
  const limits = { ...RATE_LIMITS, ...customLimits };

  return async (c, next) => {
    const redis = c.get('redis');
    const user = c.get('user');
    const logger = c.get('logger');

    // Determine tier and identifier
    let tier: RateLimitTier;
    let identifier: string;

    if (!user) {
      tier = 'anonymous';
      identifier = getClientIP(c);
    } else if (user.isAdmin) {
      tier = 'admin';
      identifier = user.did;
    } else if (user.isPremium) {
      tier = 'premium';
      identifier = user.did;
    } else {
      tier = 'authenticated';
      identifier = user.did;
    }

    // Store tier for potential use in handlers
    c.set('rateLimitTier', tier);

    const limit = limits[tier];
    const key = buildRateLimitKey(tier, identifier);

    const result = await checkRateLimit(redis, key, limit);

    // Set rate limit headers (following GitHub/Stripe convention)
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.resetAt));

    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter));

      logger.warn('Rate limit exceeded', {
        tier,
        identifier: tier === 'anonymous' ? identifier : '[redacted]',
        limit,
        retryAfter: result.retryAfter,
      });

      throw new RateLimitError(result.retryAfter ?? 60);
    }

    await next();
  };
}

/**
 * Skip rate limiting for specific conditions.
 *
 * @remarks
 * Useful for health checks, internal requests, or testing.
 *
 * @param shouldSkip - Function that returns true to skip rate limiting
 * @returns Middleware that conditionally applies rate limiting
 *
 * @example
 * ```typescript
 * app.use('*', conditionalRateLimiter(
 *   (c) => c.req.path === '/health'
 * ));
 * ```
 *
 * @public
 */
export function conditionalRateLimiter(
  shouldSkip: (c: {
    req: { path: string; header: (name: string) => string | undefined };
  }) => boolean
): MiddlewareHandler<ChiveEnv> {
  const limiter = rateLimiter();

  return async (c, next) => {
    if (shouldSkip(c)) {
      // Set defaults for skipped requests
      c.set('rateLimitTier', 'admin');
      await next();
      return;
    }

    await limiter(c, next);
  };
}

/**
 * Autocomplete-specific rate limiter with higher limits.
 *
 * @remarks
 * Uses AUTOCOMPLETE_RATE_LIMITS instead of RATE_LIMITS for higher throughput.
 * Designed for search autocomplete/typeahead endpoints that fire on every keystroke.
 *
 * Industry standard: Autocomplete endpoints typically have 3-5x higher rate limits
 * than standard API endpoints because:
 * - They fire on every keystroke (even with debouncing)
 * - Users expect near-instant feedback
 * - They are lightweight read-only operations
 *
 * @example
 * ```typescript
 * // Apply to autocomplete endpoints
 * app.get('/xrpc/pub.chive.search.searchSubmissions', autocompleteRateLimiter(), handler);
 * app.get('/xrpc/pub.chive.search.autocomplete', autocompleteRateLimiter(), handler);
 * ```
 *
 * @returns Hono middleware handler with elevated rate limits
 *
 * @public
 */
export function autocompleteRateLimiter(): MiddlewareHandler<ChiveEnv> {
  return rateLimiter(AUTOCOMPLETE_RATE_LIMITS);
}
