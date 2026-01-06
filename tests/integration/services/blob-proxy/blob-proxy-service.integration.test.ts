/**
 * BlobProxyService integration tests.
 *
 * @remarks
 * Tests the Redis cache layer (L1) of the BlobProxyService against real Redis:
 * - Cache set/get operations
 * - Probabilistic early expiration
 * - Cache statistics
 * - TTL behavior
 *
 * Note: CDN (L2) and PDS (L3) layers are mocked since they require
 * external infrastructure.
 *
 * Requires Docker test stack running (Redis 7+).
 *
 * @packageDocumentation
 */

import { Redis } from 'ioredis';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { RedisCache } from '@/services/blob-proxy/redis-cache.js';
import { getRedisConfig } from '@/storage/redis/structures.js';
import type { CID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// Test constants
const TEST_CID_1 = 'bafyreib123testcid1' as CID;
const TEST_CID_2 = 'bafyreib456testcid2' as CID;
const TEST_CID_3 = 'bafyreib789testcid3' as CID;

// Test key prefix to isolate test data
const TEST_KEY_PREFIX = 'test:blob:';

/**
 * Creates mock logger for tests.
 */
function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => createMockLogger(),
  };
}

/**
 * Creates test blob data.
 */
function createTestBlob(size = 1024): Buffer {
  const buffer = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    buffer[i] = i % 256;
  }
  return buffer;
}

describe('BlobProxyService Redis Cache Integration', () => {
  let redis: Redis;
  let cache: RedisCache;

  beforeAll(() => {
    const config = getRedisConfig();
    // Don't use keyPrefix on the Redis client; let the cache manage its own prefixes
    redis = new Redis({
      host: config.host,
      port: config.port,
      db: config.db,
      password: config.password,
    });
    cache = new RedisCache({
      redis,
      defaultTTL: 60, // Short TTL for testing
      beta: 1.0,
      maxBlobSize: 5 * 1024 * 1024, // 5MB
      keyPrefix: TEST_KEY_PREFIX,
      logger: createMockLogger(),
    });
  });

  afterAll(async () => {
    // Clean up test keys
    await cache.clear();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up test keys before each test
    await cache.clear();
  });

  describe('set and get', () => {
    it('stores and retrieves blob from Redis', async () => {
      const blob = createTestBlob(2048);

      const setResult = await cache.set(TEST_CID_1, blob, 'application/pdf');
      expect(setResult).toBe(true);

      const getResult = await cache.get(TEST_CID_1);
      expect(getResult).not.toBeNull();
      expect(getResult?.data).toEqual(blob);
      expect(getResult?.contentType).toBe('application/pdf');
      expect(getResult?.size).toBe(2048);
    });

    it('returns null for non-existent CID', async () => {
      const result = await cache.get('bafynonexistent' as CID);
      expect(result).toBeNull();
    });

    it('stores metadata alongside blob data', async () => {
      const blob = createTestBlob(1024);

      await cache.set(TEST_CID_1, blob, 'image/png', 120);

      // Verify metadata in Redis
      const metaKey = `${TEST_KEY_PREFIX}${TEST_CID_1}:meta`;
      const metadata = await redis.hgetall(metaKey);

      expect(metadata.contentType).toBe('image/png');
      expect(metadata.size).toBe('1024');
      expect(metadata.ttl).toBeDefined();
      expect(parseInt(metadata.ttl ?? '0', 10)).toBe(120);
      expect(metadata.cachedAt).toBeDefined();
      expect(parseInt(metadata.cachedAt ?? '0', 10)).toBeGreaterThan(0);
    });

    it('respects custom TTL', async () => {
      const blob = createTestBlob(512);
      const customTTL = 30;

      await cache.set(TEST_CID_1, blob, 'text/plain', customTTL);

      // Verify TTL is set
      const ttl = await redis.ttl(`${TEST_KEY_PREFIX}${TEST_CID_1}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(customTTL);
    });
  });

  describe('maxBlobSize limit', () => {
    it('rejects blobs exceeding max size', async () => {
      // Create cache with small maxBlobSize
      const smallCache = new RedisCache({
        redis,
        maxBlobSize: 1024, // 1KB limit
        keyPrefix: `${TEST_KEY_PREFIX}small:`,
        logger: createMockLogger(),
      });

      const largeBlob = createTestBlob(2048); // 2KB blob

      const result = await smallCache.set(TEST_CID_1, largeBlob, 'application/pdf');
      expect(result).toBe(false);

      // Verify not stored
      const getResult = await smallCache.get(TEST_CID_1);
      expect(getResult).toBeNull();
    });

    it('accepts blobs within max size', async () => {
      const smallCache = new RedisCache({
        redis,
        maxBlobSize: 2048,
        keyPrefix: `${TEST_KEY_PREFIX}small2:`,
        logger: createMockLogger(),
      });

      const blob = createTestBlob(1024); // 1KB blob

      const result = await smallCache.set(TEST_CID_1, blob, 'application/pdf');
      expect(result).toBe(true);

      // Clean up
      await smallCache.delete(TEST_CID_1);
    });
  });

  describe('delete', () => {
    it('removes blob from cache', async () => {
      const blob = createTestBlob(1024);

      await cache.set(TEST_CID_1, blob, 'application/pdf');

      // Verify exists
      expect(await cache.has(TEST_CID_1)).toBe(true);

      // Delete
      const deleteResult = await cache.delete(TEST_CID_1);
      expect(deleteResult).toBe(true);

      // Verify removed
      expect(await cache.has(TEST_CID_1)).toBe(false);
      expect(await cache.get(TEST_CID_1)).toBeNull();
    });

    it('returns false for non-existent CID', async () => {
      const result = await cache.delete('bafynonexistent' as CID);
      expect(result).toBe(false);
    });

    it('deletes both data and metadata keys', async () => {
      const blob = createTestBlob(1024);

      await cache.set(TEST_CID_1, blob, 'application/pdf');

      // Verify both keys exist
      const dataExists = await redis.exists(`${TEST_KEY_PREFIX}${TEST_CID_1}`);
      const metaExists = await redis.exists(`${TEST_KEY_PREFIX}${TEST_CID_1}:meta`);
      expect(dataExists).toBe(1);
      expect(metaExists).toBe(1);

      // Delete
      await cache.delete(TEST_CID_1);

      // Verify both keys removed
      const dataExistsAfter = await redis.exists(`${TEST_KEY_PREFIX}${TEST_CID_1}`);
      const metaExistsAfter = await redis.exists(`${TEST_KEY_PREFIX}${TEST_CID_1}:meta`);
      expect(dataExistsAfter).toBe(0);
      expect(metaExistsAfter).toBe(0);
    });
  });

  describe('has', () => {
    it('returns true for cached blob', async () => {
      const blob = createTestBlob(1024);

      await cache.set(TEST_CID_1, blob, 'application/pdf');

      const result = await cache.has(TEST_CID_1);
      expect(result).toBe(true);
    });

    it('returns false for non-existent CID', async () => {
      const result = await cache.has('bafynonexistent' as CID);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all cached blobs', async () => {
      const blob = createTestBlob(1024);

      // Cache multiple blobs
      await cache.set(TEST_CID_1, blob, 'application/pdf');
      await cache.set(TEST_CID_2, blob, 'application/pdf');
      await cache.set(TEST_CID_3, blob, 'application/pdf');

      // Verify all exist
      expect(await cache.has(TEST_CID_1)).toBe(true);
      expect(await cache.has(TEST_CID_2)).toBe(true);
      expect(await cache.has(TEST_CID_3)).toBe(true);

      // Clear
      const deletedCount = await cache.clear();
      expect(deletedCount).toBeGreaterThanOrEqual(6); // 3 data + 3 meta keys

      // Verify all removed
      expect(await cache.has(TEST_CID_1)).toBe(false);
      expect(await cache.has(TEST_CID_2)).toBe(false);
      expect(await cache.has(TEST_CID_3)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('returns cache statistics', async () => {
      const blob = createTestBlob(1024);

      // Cache some blobs
      await cache.set(TEST_CID_1, blob, 'application/pdf');
      await cache.set(TEST_CID_2, blob, 'application/pdf');

      const stats = await cache.getStats();

      // Should have at least 4 keys (2 data + 2 meta)
      expect(stats.keyCount).toBeGreaterThanOrEqual(4);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('probabilistic early expiration', () => {
    it('includes isEarlyFetch flag in response', async () => {
      const blob = createTestBlob(1024);

      await cache.set(TEST_CID_1, blob, 'application/pdf', 3600);

      const result = await cache.get(TEST_CID_1);
      expect(result).not.toBeNull();
      expect(typeof result?.isEarlyFetch).toBe('boolean');
    });

    it('fresh entries typically return isEarlyFetch false', async () => {
      const blob = createTestBlob(1024);

      // Use long TTL so entry is very fresh
      await cache.set(TEST_CID_1, blob, 'application/pdf', 36000);

      // Check multiple times; fresh entries should rarely trigger early fetch
      let earlyFetchCount = 0;
      for (let i = 0; i < 10; i++) {
        const result = await cache.get(TEST_CID_1);
        if (result?.isEarlyFetch) {
          earlyFetchCount++;
        }
      }

      // Fresh entries should have low early fetch rate
      // With 36000s TTL and ~0s age, probability should be very low
      expect(earlyFetchCount).toBeLessThanOrEqual(3);
    });
  });

  describe('concurrent operations', () => {
    it('handles concurrent set operations', async () => {
      const blobs = Array.from({ length: 20 }, (_, i) => createTestBlob(1024 + i * 100));

      const cids = blobs.map((_, i) => `bafyconcurrent${i}` as CID);

      // Concurrent sets
      const setPromises = blobs.map((blob, i) => {
        const cid = cids[i];
        if (!cid) throw new Error(`Missing CID at index ${i}`);
        return cache.set(cid, blob, 'application/pdf');
      });

      const results = await Promise.all(setPromises);
      expect(results.every((r) => r === true)).toBe(true);

      // Verify all stored
      const getPromises = cids.map((cid) => cache.has(cid));
      const hasResults = await Promise.all(getPromises);
      expect(hasResults.every((r) => r === true)).toBe(true);

      // Clean up
      await Promise.all(cids.map((cid) => cache.delete(cid)));
    });

    it('handles concurrent get operations', async () => {
      const blob = createTestBlob(2048);

      await cache.set(TEST_CID_1, blob, 'application/pdf');

      // Concurrent gets
      const getPromises = Array.from({ length: 50 }, () => cache.get(TEST_CID_1));

      const results = await Promise.all(getPromises);

      // All should succeed
      expect(results.every((r) => r !== null)).toBe(true);
      expect(results.every((r) => r?.size === 2048)).toBe(true);
    });
  });

  describe('different content types', () => {
    it('stores and retrieves PDF', async () => {
      const blob = createTestBlob(1024);

      await cache.set(TEST_CID_1, blob, 'application/pdf');
      const result = await cache.get(TEST_CID_1);

      expect(result?.contentType).toBe('application/pdf');
    });

    it('stores and retrieves images', async () => {
      const blob = createTestBlob(2048);

      await cache.set(TEST_CID_1, blob, 'image/png');
      const result = await cache.get(TEST_CID_1);

      expect(result?.contentType).toBe('image/png');
    });

    it('stores and retrieves text files', async () => {
      const blob = Buffer.from('Test content for text file');

      await cache.set(TEST_CID_1, blob, 'text/plain');
      const result = await cache.get(TEST_CID_1);

      expect(result?.contentType).toBe('text/plain');
      expect(result?.data.toString()).toBe('Test content for text file');
    });
  });

  describe('ATProto compliance', () => {
    it('cache is ephemeral (has TTL)', async () => {
      const blob = createTestBlob(1024);

      await cache.set(TEST_CID_1, blob, 'application/pdf', 60);

      const ttl = await redis.ttl(`${TEST_KEY_PREFIX}${TEST_CID_1}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('stores data by CID (content-addressed)', async () => {
      const blob = createTestBlob(1024);

      await cache.set(TEST_CID_1, blob, 'application/pdf');

      // Key should contain CID
      const key = `${TEST_KEY_PREFIX}${TEST_CID_1}`;
      const exists = await redis.exists(key);
      expect(exists).toBe(1);
    });
  });
});
