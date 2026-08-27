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
 * Number of reverse proxies between the client and this process.
 *
 * @remarks
 * Read at call time rather than module load so tests can vary it.
 */
function trustedProxyCount(): number {
  const raw = process.env.TRUSTED_PROXY_COUNT;
  if (raw === undefined) return DEFAULT_TRUSTED_PROXY_COUNT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_TRUSTED_PROXY_COUNT;
}

/**
 * Chive runs behind one reverse proxy (Traefik) in every deployed environment.
 */
const DEFAULT_TRUSTED_PROXY_COUNT = 1;

/**
 * Extract the client IP used to key anonymous rate limits.
 *
 * @param c - Hono context
 * @returns The client IP, or `'unknown'` when no trustworthy value exists
 *
 * @remarks
 * `X-Forwarded-For` is append-only: each proxy appends the address it saw, so
 * the entries a client sent arrive *first* and the ones proxies added arrive
 * last. Reading the first entry therefore reads a value the client wrote, and
 * anonymous rate limits keyed on it were defeated by sending a different
 * `X-Forwarded-For` on every request — which nullified the limits on search and
 * on the endpoints that spend real money answering.
 *
 * The trustworthy entry is the one *our* proxy appended: counting back
 * `TRUSTED_PROXY_COUNT` from the right. Anything further left was written by
 * something we do not control.
 *
 * When there are fewer entries than trusted proxies the header did not come
 * through the expected path, so it is discarded rather than guessed at. The
 * same reasoning rules out `X-Real-IP` and `CF-Connecting-IP` as fallbacks:
 * both are single-value headers a client can set outright, and Chive sits
 * behind neither Cloudflare nor an nginx that sets `X-Real-IP`.
 *
 * The old `127.0.0.1` fallback made every unattributable request share one
 * bucket with genuine loopback traffic. `'unknown'` still shares a bucket, but
 * an honestly named one that cannot be confused for a real address.
 *
 * @public
 */
export function getClientIP(c: { req: { header: (name: string) => string | undefined } }): string {
  const proxies = trustedProxyCount();
  if (proxies === 0) return 'unknown';

  const forwardedFor = c.req.header('x-forwarded-for');
  if (!forwardedFor) return 'unknown';

  const entries = forwardedFor
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length < proxies) return 'unknown';

  return entries[entries.length - proxies] ?? 'unknown';
}

/**
 * Sliding-window check-and-admit, evaluated atomically inside Redis.
 *
 * @remarks
 * KEYS[1] is the window key. ARGV is (now, windowStart, limit, ttlSeconds,
 * requestId). Returns (admitted, countBefore, oldestScore).
 *
 * This has to be one script rather than a pipeline. `pipeline()` in ioredis
 * only batches commands over the connection — it does not make them atomic, and
 * even `MULTI` would not help, because the decision to admit depends on the
 * count that the same sequence reads. Two concurrent requests could therefore
 * both observe a count below the limit and both be admitted, letting the cap be
 * exceeded by however many requests arrive together — which is precisely the
 * situation a rate limit exists to handle.
 *
 * The `zadd` is inside the branch. Previously it ran unconditionally, before
 * the check, so a client already over its limit kept writing entries: its
 * window never drained, its `Retry-After` kept moving, and the sorted set grew
 * for as long as the client kept knocking. Admitted requests are recorded;
 * rejected ones are not.
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local requestId = ARGV[5]

redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
local count = redis.call('ZCARD', key)

if count < limit then
  redis.call('ZADD', key, now, requestId)
  redis.call('EXPIRE', key, ttl)
  return {1, count, 0}
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
redis.call('EXPIRE', key, ttl)
return {0, count, tonumber(oldest[2]) or now}
`;

/**
 * Checks rate limit using a Redis sliding window.
 *
 * @param redis - Redis client
 * @param key - Rate limit key
 * @param limit - Max requests per window
 * @param windowMs - Window size in milliseconds
 * @returns Rate limit check result
 *
 * @public
 */
export async function checkRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetAt = Math.ceil((now + windowMs) / 1000);
  const ttlSeconds = Math.ceil(windowMs / 1000) + 1;
  const requestId = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  let raw: unknown;
  try {
    raw = await redis.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      key,
      String(now),
      String(windowStart),
      String(limit),
      String(ttlSeconds),
      requestId
    );
  } catch {
    // Redis unreachable: behaviour depends on RATE_LIMIT_FAIL_MODE.
    return RATE_LIMIT_FAIL_MODE === 'open'
      ? { allowed: true, remaining: limit, resetAt }
      : { allowed: false, remaining: 0, resetAt, retryAfter: 60 };
  }

  if (!Array.isArray(raw)) {
    // A script that returns something unexpected is a bug, not a decision.
    // Treat it the same as an unreachable Redis rather than admitting blindly.
    return RATE_LIMIT_FAIL_MODE === 'open'
      ? { allowed: true, remaining: limit, resetAt }
      : { allowed: false, remaining: 0, resetAt, retryAfter: 60 };
  }

  const [admitted, countBefore, oldestScore] = raw as [number, number, number];

  if (admitted === 1) {
    return { allowed: true, remaining: Math.max(0, limit - countBefore - 1), resetAt };
  }

  const oldest = oldestScore > 0 ? oldestScore : now;
  const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

  return { allowed: false, remaining: 0, resetAt, retryAfter };
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
 * app.get('/xrpc/pub.chive.eprint.searchSubmissions', autocompleteRateLimiter(), handler);
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
