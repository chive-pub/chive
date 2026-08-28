/**
 * Rate limiter atomicity tests against a real Redis.
 *
 * @remarks
 * The sliding window used `redis.pipeline()`, which batches commands over the
 * connection without making them atomic, and added the current request to the
 * window *before* checking the count. Two properties follow from that, and
 * neither can be observed without a real Redis and real concurrency:
 *
 * 1. Concurrent requests could each read a count below the limit and each be
 *    admitted, so the cap was exceeded by however many arrived together.
 * 2. A client already over its limit kept writing entries, so its window never
 *    drained, its `Retry-After` kept moving out, and the sorted set grew for as
 *    long as it kept knocking.
 *
 * Requires the Docker test stack.
 *
 * @packageDocumentation
 */

import { Redis } from 'ioredis';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { checkRateLimit } from '@/api/middleware/rate-limit.js';

const KEY = 'test:ratelimit:atomicity';
const WINDOW_MS = 60_000;

describe('rate limiter atomicity', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
  });

  afterAll(async () => {
    await redis.del(KEY);
    redis.disconnect();
  });

  beforeEach(async () => {
    await redis.del(KEY);
  });

  it('admits exactly the limit when requests arrive together', async () => {
    const limit = 10;
    const results = await Promise.all(
      Array.from({ length: 50 }, () => checkRateLimit(redis, KEY, limit, WINDOW_MS))
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(limit);
    expect(results.filter((r) => !r.allowed)).toHaveLength(40);
  });

  it('records admitted requests and only those', async () => {
    const limit = 3;
    for (let i = 0; i < 10; i += 1) {
      await checkRateLimit(redis, KEY, limit, WINDOW_MS);
    }

    // Seven rejections must leave no trace: a rejected request that writes an
    // entry extends its own lockout and grows the set without bound.
    expect(await redis.zcard(KEY)).toBe(limit);
  });

  it('does not push its own reset further out on each rejected attempt', async () => {
    const limit = 2;
    await checkRateLimit(redis, KEY, limit, WINDOW_MS);
    await checkRateLimit(redis, KEY, limit, WINDOW_MS);

    const first = await checkRateLimit(redis, KEY, limit, WINDOW_MS);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = await checkRateLimit(redis, KEY, limit, WINDOW_MS);

    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
    // Time passing must bring the reset nearer, never push it away.
    expect(second.retryAfter ?? 0).toBeLessThanOrEqual(first.retryAfter ?? 0);
  });

  it('reports remaining capacity that counts down to zero', async () => {
    const limit = 3;
    const first = await checkRateLimit(redis, KEY, limit, WINDOW_MS);
    const second = await checkRateLimit(redis, KEY, limit, WINDOW_MS);
    const third = await checkRateLimit(redis, KEY, limit, WINDOW_MS);

    expect([first.remaining, second.remaining, third.remaining]).toEqual([2, 1, 0]);
  });

  it('drops entries that have aged out of the window', async () => {
    const limit = 2;
    const shortWindow = 1000;

    await checkRateLimit(redis, KEY, limit, shortWindow);
    await checkRateLimit(redis, KEY, limit, shortWindow);
    expect((await checkRateLimit(redis, KEY, limit, shortWindow)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await checkRateLimit(redis, KEY, limit, shortWindow)).allowed).toBe(true);
  });

  it('gives the key a TTL so an abandoned window cannot leak', async () => {
    await checkRateLimit(redis, KEY, 5, WINDOW_MS);
    const ttl = await redis.ttl(KEY);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(Math.ceil(WINDOW_MS / 1000) + 1);
  });

  it('sets a TTL even when the request is rejected', async () => {
    const limit = 1;
    await checkRateLimit(redis, KEY, limit, WINDOW_MS);
    await checkRateLimit(redis, KEY, limit, WINDOW_MS);

    // Without this the key of a client that is permanently over its limit would
    // never expire.
    expect(await redis.ttl(KEY)).toBeGreaterThan(0);
  });
});
