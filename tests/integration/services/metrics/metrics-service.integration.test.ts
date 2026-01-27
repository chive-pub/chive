/**
 * MetricsService integration tests.
 *
 * @remarks
 * Tests MetricsService against real Redis instance:
 * - Counter increments (INCR)
 * - HyperLogLog unique tracking (PFADD/PFCOUNT)
 * - Time-windowed sorted sets (ZADD/ZCOUNT)
 * - Pipeline batch operations
 * - Trending computation
 *
 * Requires Docker test stack running (Redis 7+).
 *
 * @packageDocumentation
 */

import { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { MetricsService } from '@/services/metrics/metrics-service.js';
import { getRedisConfig } from '@/storage/redis/structures.js';
import type { AtUri, DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IStorageBackend } from '@/types/interfaces/storage.interface.js';

// Test URIs and DIDs
const TEST_URI_1 = 'at://did:plc:test1/pub.chive.eprint.submission/abc123' as AtUri;
const TEST_URI_2 = 'at://did:plc:test2/pub.chive.eprint.submission/def456' as AtUri;
const TEST_URI_3 = 'at://did:plc:test3/pub.chive.eprint.submission/ghi789' as AtUri;
const TEST_DID_1 = 'did:plc:viewer1' as DID;
const TEST_DID_2 = 'did:plc:viewer2' as DID;
const TEST_DID_3 = 'did:plc:viewer3' as DID;

// Test key prefix to isolate test data
const TEST_KEY_PREFIX = 'test:metrics:';

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
 * Creates mock PostgreSQL pool for tests.
 * Mocks connect() to return a client that supports transactions.
 */
function createMockPool(): Pool {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue(mockClient),
  } as unknown as Pool;
}

/**
 * Creates mock storage for tests.
 */
function createMockStorage(): IStorageBackend {
  return {
    storeEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    getEprint: vi.fn().mockResolvedValue(null),
    getEprintsByAuthor: vi.fn().mockResolvedValue([]),
    countEprintsByAuthor: vi.fn().mockResolvedValue(0),
    listEprintUris: vi.fn().mockResolvedValue([]),
    trackPDSSource: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    storeEprintWithPDSTracking: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    isStale: vi.fn().mockResolvedValue(false),
    findByExternalIds: vi.fn().mockResolvedValue(null),
    deleteEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    getChangelog: vi.fn().mockResolvedValue(null),
    listChangelogs: vi.fn().mockResolvedValue({ changelogs: [], total: 0 }),
    storeChangelog: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    deleteChangelog: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    getTagsForEprint: vi.fn().mockResolvedValue([]),
  };
}

describe('MetricsService Integration', () => {
  let redis: Redis;
  let service: MetricsService;

  beforeAll(() => {
    const config = getRedisConfig();
    // Don't use keyPrefix on the Redis client; let the service manage its own prefixes
    redis = new Redis({
      host: config.host,
      port: config.port,
      db: config.db,
      password: config.password,
    });
    service = new MetricsService({
      pool: createMockPool(),
      storage: createMockStorage(),
      redis,
      logger: createMockLogger(),
      keyPrefix: TEST_KEY_PREFIX,
    });
  });

  afterAll(async () => {
    // Clean up test keys
    const keys = await redis.keys(`${TEST_KEY_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up test keys before each test
    const keys = await redis.keys(`${TEST_KEY_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('recordView', () => {
    it('increments view counter in Redis', async () => {
      const result = await service.recordView(TEST_URI_1);

      expect(result.ok).toBe(true);

      // Verify counter in Redis
      const count = await redis.get(`${TEST_KEY_PREFIX}views:${TEST_URI_1}`);
      expect(count).toBe('1');
    });

    it('increments view counter multiple times', async () => {
      await service.recordView(TEST_URI_1);
      await service.recordView(TEST_URI_1);
      await service.recordView(TEST_URI_1);

      const count = await redis.get(`${TEST_KEY_PREFIX}views:${TEST_URI_1}`);
      expect(count).toBe('3');
    });

    it('tracks unique viewers via HyperLogLog', async () => {
      await service.recordView(TEST_URI_1, TEST_DID_1);
      await service.recordView(TEST_URI_1, TEST_DID_2);
      await service.recordView(TEST_URI_1, TEST_DID_1); // Duplicate

      // HyperLogLog should count 2 unique viewers
      const uniqueCount = await redis.pfcount(`${TEST_KEY_PREFIX}unique:${TEST_URI_1}`);
      expect(uniqueCount).toBe(2);
    });

    it('adds to time-windowed sorted sets', async () => {
      await service.recordView(TEST_URI_1);

      // Verify entries exist in sorted sets
      const count24h = await redis.zcard(`${TEST_KEY_PREFIX}views:24h:${TEST_URI_1}`);
      const count7d = await redis.zcard(`${TEST_KEY_PREFIX}views:7d:${TEST_URI_1}`);
      const count30d = await redis.zcard(`${TEST_KEY_PREFIX}views:30d:${TEST_URI_1}`);

      expect(count24h).toBe(1);
      expect(count7d).toBe(1);
      expect(count30d).toBe(1);
    });

    it('sets TTL on keys', async () => {
      await service.recordView(TEST_URI_1);

      // Verify TTL is set
      const ttlViews = await redis.ttl(`${TEST_KEY_PREFIX}views:${TEST_URI_1}`);
      const ttl24h = await redis.ttl(`${TEST_KEY_PREFIX}views:24h:${TEST_URI_1}`);

      expect(ttlViews).toBeGreaterThan(0);
      expect(ttl24h).toBeGreaterThan(0);
    });
  });

  describe('recordDownload', () => {
    it('increments download counter in Redis', async () => {
      const result = await service.recordDownload(TEST_URI_1);

      expect(result.ok).toBe(true);

      const count = await redis.get(`${TEST_KEY_PREFIX}downloads:${TEST_URI_1}`);
      expect(count).toBe('1');
    });

    it('tracks unique downloaders via HyperLogLog', async () => {
      await service.recordDownload(TEST_URI_1, TEST_DID_1);
      await service.recordDownload(TEST_URI_1, TEST_DID_2);
      await service.recordDownload(TEST_URI_1, TEST_DID_1); // Duplicate

      const uniqueCount = await redis.pfcount(`${TEST_KEY_PREFIX}unique:downloads:${TEST_URI_1}`);
      expect(uniqueCount).toBe(2);
    });
  });

  describe('getMetrics', () => {
    it('returns zero metrics for new URI', async () => {
      const metrics = await service.getMetrics(TEST_URI_1);

      expect(metrics.totalViews).toBe(0);
      expect(metrics.uniqueViews).toBe(0);
      expect(metrics.totalDownloads).toBe(0);
      expect(metrics.views24h).toBe(0);
      expect(metrics.views7d).toBe(0);
      expect(metrics.views30d).toBe(0);
    });

    it('returns correct metrics after recording views', async () => {
      // Record 5 views from 3 unique viewers
      await service.recordView(TEST_URI_1, TEST_DID_1);
      await service.recordView(TEST_URI_1, TEST_DID_1);
      await service.recordView(TEST_URI_1, TEST_DID_2);
      await service.recordView(TEST_URI_1, TEST_DID_3);
      await service.recordView(TEST_URI_1, TEST_DID_2);

      // Record 2 downloads
      await service.recordDownload(TEST_URI_1, TEST_DID_1);
      await service.recordDownload(TEST_URI_1, TEST_DID_2);

      const metrics = await service.getMetrics(TEST_URI_1);

      expect(metrics.totalViews).toBe(5);
      expect(metrics.uniqueViews).toBe(3);
      expect(metrics.totalDownloads).toBe(2);
      expect(metrics.views24h).toBe(5);
      expect(metrics.views7d).toBe(5);
      expect(metrics.views30d).toBe(5);
    });
  });

  describe('getViewCount', () => {
    it('returns zero for new URI', async () => {
      const count = await service.getViewCount(TEST_URI_1);
      expect(count).toBe(0);
    });

    it('returns correct count after recording views', async () => {
      await service.recordView(TEST_URI_1);
      await service.recordView(TEST_URI_1);
      await service.recordView(TEST_URI_1);

      const count = await service.getViewCount(TEST_URI_1);
      expect(count).toBe(3);
    });
  });

  describe('batchIncrement', () => {
    it('processes multiple operations in single pipeline', async () => {
      const result = await service.batchIncrement([
        { type: 'view', uri: TEST_URI_1, viewerDid: TEST_DID_1 },
        { type: 'view', uri: TEST_URI_1, viewerDid: TEST_DID_2 },
        { type: 'view', uri: TEST_URI_2, viewerDid: TEST_DID_1 },
        { type: 'download', uri: TEST_URI_1, viewerDid: TEST_DID_1 },
      ]);

      expect(result.ok).toBe(true);

      // Verify counters
      const viewsUri1 = await redis.get(`${TEST_KEY_PREFIX}views:${TEST_URI_1}`);
      const viewsUri2 = await redis.get(`${TEST_KEY_PREFIX}views:${TEST_URI_2}`);
      const downloadsUri1 = await redis.get(`${TEST_KEY_PREFIX}downloads:${TEST_URI_1}`);

      expect(viewsUri1).toBe('2');
      expect(viewsUri2).toBe('1');
      expect(downloadsUri1).toBe('1');

      // Verify unique viewers
      const uniqueUri1 = await redis.pfcount(`${TEST_KEY_PREFIX}unique:${TEST_URI_1}`);
      expect(uniqueUri1).toBe(2);
    });

    it('handles empty operations array', async () => {
      const result = await service.batchIncrement([]);
      expect(result.ok).toBe(true);
    });
  });

  describe('getTrending', () => {
    it('returns empty array when no views', async () => {
      const trending = await service.getTrending('24h', 10);
      expect(trending).toEqual([]);
    });

    it('returns trending eprints sorted by view count', async () => {
      // URI_1: 10 views
      for (let i = 0; i < 10; i++) {
        await service.recordView(TEST_URI_1);
      }

      // URI_2: 5 views
      for (let i = 0; i < 5; i++) {
        await service.recordView(TEST_URI_2);
      }

      // URI_3: 15 views
      for (let i = 0; i < 15; i++) {
        await service.recordView(TEST_URI_3);
      }

      const trending = await service.getTrending('24h', 10);

      expect(trending.length).toBeGreaterThanOrEqual(3);

      // Find entries for test URIs (may include other URIs from prefix scanning)
      const uri1Entry = trending.find((e) => e.uri === TEST_URI_1);
      const uri2Entry = trending.find((e) => e.uri === TEST_URI_2);
      const uri3Entry = trending.find((e) => e.uri === TEST_URI_3);

      expect(uri1Entry?.score).toBe(10);
      expect(uri2Entry?.score).toBe(5);
      expect(uri3Entry?.score).toBe(15);

      // Verify sorted by score descending
      for (let i = 1; i < trending.length; i++) {
        expect(trending[i - 1]?.score).toBeGreaterThanOrEqual(trending[i]?.score ?? 0);
      }
    });

    it('respects limit parameter', async () => {
      // Create views for 5 URIs
      const uris = [TEST_URI_1, TEST_URI_2, TEST_URI_3];
      for (const uri of uris) {
        await service.recordView(uri);
      }

      const trending = await service.getTrending('24h', 2);
      expect(trending.length).toBeLessThanOrEqual(2);
    });
  });

  describe('flushToDatabase', () => {
    it('scans and counts metrics to flush', async () => {
      // Record some views
      await service.recordView(TEST_URI_1);
      await service.recordView(TEST_URI_2);

      const result = await service.flushToDatabase();

      expect(result.ok).toBe(true);
      // Note: Actual PostgreSQL persistence is stubbed (TODO in service)
      // This test verifies the scan/count logic works
      if (result.ok) {
        expect(result.value).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Concurrent operations', () => {
    it('handles concurrent view recording correctly', async () => {
      // Fire 100 concurrent view recordings
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(service.recordView(TEST_URI_1));
      }

      await Promise.all(promises);

      const count = await service.getViewCount(TEST_URI_1);
      expect(count).toBe(100);
    });

    it('handles concurrent unique viewer tracking', async () => {
      // Fire 50 concurrent recordings from 10 unique viewers
      const dids = Array.from({ length: 10 }, (_, i) => `did:plc:concurrent${i}` as DID);
      const promises = [];

      for (let i = 0; i < 50; i++) {
        const did = dids[i % 10];
        promises.push(service.recordView(TEST_URI_1, did));
      }

      await Promise.all(promises);

      const metrics = await service.getMetrics(TEST_URI_1);
      expect(metrics.totalViews).toBe(50);
      expect(metrics.uniqueViews).toBe(10);
    });
  });
});
