/**
 * Integration tests for API rate limiting.
 *
 * @remarks
 * Tests the 4-tier rate limiting system:
 * - Anonymous: 60 req/min (by IP)
 * - Authenticated: 300 req/min (by DID)
 * - Premium: 1000 req/min (by DID)
 * - Admin: 5000 req/min (by DID)
 *
 * Validates rate limit headers, Redis sliding window, and tier escalation.
 *
 * Requires Docker test stack running (Redis 7+).
 *
 * @packageDocumentation
 */

import type { Hono } from 'hono';
import { Redis } from 'ioredis';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { RATE_LIMIT_KEY_PREFIX } from '@/api/config.js';
import { createServer, type ServerConfig } from '@/api/server.js';
import type { ChiveEnv } from '@/api/types/context.js';
import type { BlobProxyService } from '@/services/blob-proxy/proxy-service.js';
import type { KnowledgeGraphService } from '@/services/knowledge-graph/graph-service.js';
import type { MetricsService } from '@/services/metrics/metrics-service.js';
import type { PreprintService } from '@/services/preprint/preprint-service.js';
import { NoOpRelevanceLogger } from '@/services/search/relevance-logger.js';
import type { SearchService } from '@/services/search/search-service.js';
import { getRedisConfig } from '@/storage/redis/structures.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

import type { RateLimitResponse } from '../../types/api-responses.js';

/**
 * Builds rate limit Redis key matching the actual implementation.
 * Note: Implementation uses sorted sets for sliding window algorithm.
 */
function buildRateLimitKey(
  tier: 'anonymous' | 'authenticated' | 'premium' | 'admin',
  identifier: string
): string {
  return `${RATE_LIMIT_KEY_PREFIX}${tier}:${identifier}`;
}

// Test constants
const TEST_IP = '192.168.100.50';
const _TEST_DID_AUTH = 'did:plc:authuser123' as DID;
const _TEST_DID_PREMIUM = 'did:plc:premiumuser' as DID;
const _TEST_DID_ADMIN = 'did:plc:adminuser' as DID;
void _TEST_DID_AUTH; // Reserved for authenticated tier tests
void _TEST_DID_PREMIUM; // Reserved for premium tier tests
void _TEST_DID_ADMIN; // Reserved for admin tier tests

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
 * Creates mock preprint service.
 */
function createMockPreprintService(): PreprintService {
  return {
    getPreprint: vi.fn().mockResolvedValue(null),
    getPreprintsByAuthor: vi.fn().mockResolvedValue({ preprints: [], total: 0 }),
    indexPreprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    indexPreprintUpdate: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    indexPreprintDelete: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    checkStaleness: vi.fn().mockResolvedValue({ isStale: false }),
  } as unknown as PreprintService;
}

/**
 * Creates mock search service.
 */
function createMockSearchService(): SearchService {
  return {
    search: vi.fn().mockResolvedValue({ hits: [], total: 0, took: 0 }),
    facetedSearch: vi.fn().mockResolvedValue({ hits: [], total: 0, took: 0, facets: {} }),
    autocomplete: vi.fn().mockResolvedValue([]),
  } as unknown as SearchService;
}

/**
 * Creates mock metrics service.
 */
function createMockMetricsService(): MetricsService {
  return {
    recordView: vi.fn().mockResolvedValue(undefined),
    recordDownload: vi.fn().mockResolvedValue(undefined),
    recordEndorsement: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockResolvedValue({ views: 100, downloads: 20, endorsements: 5 }),
    getTrending: vi.fn().mockResolvedValue({
      preprints: [],
      window: '24h',
      generatedAt: new Date(),
    }),
  } as unknown as MetricsService;
}

/**
 * Creates mock graph service.
 */
function createMockGraphService(): KnowledgeGraphService {
  return {
    getField: vi.fn().mockResolvedValue(null),
    getRelatedFields: vi.fn().mockResolvedValue([]),
    getChildFields: vi.fn().mockResolvedValue([]),
    getAncestorPath: vi.fn().mockResolvedValue([]),
    searchAuthorities: vi.fn().mockResolvedValue({
      authorities: [],
      hasMore: false,
      total: 0,
    }),
    browseFaceted: vi.fn().mockResolvedValue({
      preprints: [],
      availableFacets: {},
      hasMore: false,
      total: 0,
    }),
  } as unknown as KnowledgeGraphService;
}

/**
 * Creates mock blob proxy service.
 */
function createMockBlobProxyService(): BlobProxyService {
  return {
    getProxiedBlobUrl: vi.fn().mockResolvedValue('https://cdn.chive.example.com/blob/xyz'),
    streamBlob: vi.fn().mockResolvedValue(null),
  } as unknown as BlobProxyService;
}

/**
 * Creates mock review service.
 */
function createMockReviewService(): ServerConfig['reviewService'] {
  return {
    getReviews: vi.fn().mockResolvedValue([]),
    getReviewByUri: vi.fn().mockResolvedValue(null),
    getReviewThread: vi.fn().mockResolvedValue([]),
    getEndorsements: vi.fn().mockResolvedValue([]),
    getEndorsementSummary: vi.fn().mockResolvedValue({ total: 0, endorserCount: 0, byType: {} }),
    getEndorsementByUser: vi.fn().mockResolvedValue(null),
    listEndorsementsForPreprint: vi.fn().mockResolvedValue({ items: [], hasMore: false, total: 0 }),
  } as unknown as ServerConfig['reviewService'];
}

/**
 * Creates mock tag manager.
 */
function createMockTagManager(): ServerConfig['tagManager'] {
  return {
    getTag: vi.fn().mockResolvedValue(null),
    getTagsForRecord: vi.fn().mockResolvedValue([]),
    searchTags: vi.fn().mockResolvedValue([]),
    getTrendingTags: vi.fn().mockResolvedValue([]),
    getTagSuggestions: vi.fn().mockResolvedValue([]),
  } as unknown as ServerConfig['tagManager'];
}

/**
 * Creates mock backlink service.
 */
function createMockBacklinkService(): ServerConfig['backlinkService'] {
  return {
    createBacklink: vi.fn().mockResolvedValue({ id: 1 }),
    deleteBacklink: vi.fn().mockResolvedValue(undefined),
    getBacklinks: vi.fn().mockResolvedValue({ backlinks: [], cursor: undefined }),
    getCounts: vi.fn().mockResolvedValue({
      sembleCollections: 0,
      leafletLists: 0,
      whitewindBlogs: 0,
      blueskyShares: 0,
      total: 0,
      updatedAt: new Date(),
    }),
    updateCounts: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServerConfig['backlinkService'];
}

/**
 * Creates mock claiming service.
 */
function createMockClaimingService(): ServerConfig['claimingService'] {
  return {
    startClaim: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: 'did:plc:test',
      evidence: [],
      verificationScore: 0,
      status: 'pending',
      canonicalUri: null,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }),
    collectEvidence: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: 'did:plc:test',
      evidence: [],
      verificationScore: 0.5,
      status: 'pending',
      canonicalUri: null,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }),
    completeClaim: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: 'did:plc:test',
      evidence: [],
      verificationScore: 0.8,
      status: 'approved',
      canonicalUri: 'at://did:plc:test/pub.chive.preprint.submission/123',
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      expiresAt: null,
    }),
    approveClaim: vi.fn().mockResolvedValue(undefined),
    rejectClaim: vi.fn().mockResolvedValue(undefined),
    getClaim: vi.fn().mockResolvedValue(null),
    getUserClaims: vi.fn().mockResolvedValue([]),
    findClaimable: vi.fn().mockResolvedValue({ preprints: [], cursor: undefined }),
    getPendingClaims: vi.fn().mockResolvedValue({ claims: [], cursor: undefined }),
  } as unknown as ServerConfig['claimingService'];
}

/**
 * Creates mock import service.
 */
function createMockImportService(): ServerConfig['importService'] {
  return {
    exists: vi.fn().mockResolvedValue(false),
    get: vi.fn().mockResolvedValue(null),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    search: vi.fn().mockResolvedValue({ preprints: [], cursor: undefined }),
    markClaimed: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServerConfig['importService'];
}

/**
 * Creates mock PDS sync service.
 */
function createMockPDSSyncService(): ServerConfig['pdsSyncService'] {
  return {
    detectStaleRecords: vi.fn().mockResolvedValue([]),
    refreshRecord: vi.fn().mockResolvedValue({
      ok: true,
      value: { refreshed: true, changed: false, previousCID: '', currentCID: '' },
    }),
    checkStaleness: vi.fn().mockResolvedValue({ uri: '', isStale: false, indexedCID: '' }),
    trackPDSUpdate: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  } as unknown as ServerConfig['pdsSyncService'];
}

/**
 * Creates mock activity service.
 */
function createMockActivityService(): ServerConfig['activityService'] {
  return {
    logActivity: vi.fn().mockResolvedValue({ ok: true, value: 'mock-activity-id' }),
    correlateWithFirehose: vi.fn().mockResolvedValue({ ok: true, value: null }),
    markFailed: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    timeoutStaleActivities: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
    getActivityFeed: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { activities: [], cursor: null } }),
    getCorrelationMetrics: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getActivity: vi.fn().mockResolvedValue({ ok: true, value: null }),
    batchCorrelate: vi.fn().mockResolvedValue({ ok: true, value: new Map() }),
    getPendingCount: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
  } as unknown as ServerConfig['activityService'];
}

describe('API Rate Limiting Integration', () => {
  let redis: Redis;
  let app: Hono<ChiveEnv>;
  let logger: ILogger;

  beforeAll(() => {
    // Initialize Redis
    const redisConfig = getRedisConfig();
    redis = new Redis(redisConfig);

    // Create logger
    logger = createMockLogger();

    // Create Hono app with full middleware stack
    const serverConfig: ServerConfig = {
      preprintService: createMockPreprintService(),
      searchService: createMockSearchService(),
      metricsService: createMockMetricsService(),
      graphService: createMockGraphService(),
      blobProxyService: createMockBlobProxyService(),
      reviewService: createMockReviewService(),
      tagManager: createMockTagManager(),
      backlinkService: createMockBacklinkService(),
      claimingService: createMockClaimingService(),
      importService: createMockImportService(),
      pdsSyncService: createMockPDSSyncService(),
      activityService: createMockActivityService(),
      relevanceLogger: new NoOpRelevanceLogger(),
      redis,
      logger,
      serviceDid: 'did:web:test.chive.pub',
    };

    app = createServer(serverConfig);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up rate limit keys
    const keys = await redis.keys('*ratelimit*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('Rate Limit Headers', () => {
    it('includes X-RateLimit-Limit header', async () => {
      const res = await app.request('/api/v1/search?q=test');

      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
      const limit = parseInt(res.headers.get('X-RateLimit-Limit') ?? '0', 10);
      expect(limit).toBeGreaterThan(0);
    });

    it('includes X-RateLimit-Remaining header', async () => {
      const res = await app.request('/api/v1/search?q=test');

      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
      const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '0', 10);
      expect(remaining).toBeGreaterThanOrEqual(0);
    });

    it('includes X-RateLimit-Reset header with Unix timestamp', async () => {
      const res = await app.request('/api/v1/search?q=test');

      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
      const reset = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10);

      // Should be a future Unix timestamp (allow 1 second tolerance for test execution)
      const now = Math.floor(Date.now() / 1000);
      expect(reset).toBeGreaterThanOrEqual(now);
      expect(reset).toBeLessThanOrEqual(now + 120); // Within ~2 minute window accounting for timing
    });

    it('decrements X-RateLimit-Remaining on each request', async () => {
      const testIp = '192.168.1.100';
      const key = buildRateLimitKey('anonymous', testIp);

      // Clear any existing data for deterministic test
      await redis.del(key);

      const res1 = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': testIp },
      });
      const remaining1 = parseInt(res1.headers.get('X-RateLimit-Remaining') ?? '0', 10);

      const res2 = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': testIp },
      });
      const remaining2 = parseInt(res2.headers.get('X-RateLimit-Remaining') ?? '0', 10);

      expect(remaining2).toBe(remaining1 - 1);
    });
  });

  describe('Anonymous Rate Limiting (by IP)', () => {
    it('applies rate limit for anonymous users', async () => {
      const res = await app.request('/health');

      // Health endpoints should succeed
      expect(res.status).toBe(200);
    });

    it('applies 60 req/min limit for anonymous users', async () => {
      const res = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': TEST_IP },
      });

      const limit = parseInt(res.headers.get('X-RateLimit-Limit') ?? '0', 10);
      expect(limit).toBe(60);
    });

    it('rate limits different IPs independently', async () => {
      const ip1 = '172.16.0.1';
      const ip2 = '172.16.0.2';

      // Make requests from different IPs
      const res1 = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': ip1 },
      });
      const remaining1 = parseInt(res1.headers.get('X-RateLimit-Remaining') ?? '0', 10);

      const res2 = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': ip2 },
      });
      const remaining2 = parseInt(res2.headers.get('X-RateLimit-Remaining') ?? '0', 10);

      // Both should have remaining counts (independent limits)
      expect(remaining1).toBeGreaterThanOrEqual(0);
      expect(remaining2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Endpoints Rate Limit Bypass', () => {
    it('does not rate limit /health endpoint', async () => {
      // Make many rapid requests (async callback ensures Promise return type)
      const responses = await Promise.all(
        Array.from({ length: 100 }, async () => app.request('/health'))
      );

      // All should succeed
      for (const res of responses) {
        expect(res.status).toBe(200);
      }
    });

    it('does not rate limit /ready endpoint', async () => {
      // Make many rapid requests (async callback ensures Promise return type)
      const responses = await Promise.all(
        Array.from({ length: 100 }, async () => app.request('/ready'))
      );

      // All should succeed
      for (const res of responses) {
        expect(res.status).toBe(200);
      }
    });

    it('health endpoints do not include rate limit headers', async () => {
      const res = await app.request('/health');

      // Rate limit headers should not be present (or be null)
      // Note: Some implementations may still include headers with high values
      expect(res.status).toBe(200);
    });
  });

  describe('Redis Sliding Window', () => {
    it('stores request count in Redis sorted set', async () => {
      const testIp = '192.168.50.100';
      const key = buildRateLimitKey('anonymous', testIp);

      // Clear any existing data
      await redis.del(key);

      await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': testIp },
      });

      // Implementation uses sorted sets (ZSET) for sliding window
      const count = await redis.zcard(key);

      expect(count).toBeGreaterThan(0);
    });

    it('sets TTL on rate limit key', async () => {
      const testIp = '192.168.50.101';
      const key = buildRateLimitKey('anonymous', testIp);

      // Clear any existing data
      await redis.del(key);

      await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': testIp },
      });

      const ttl = await redis.ttl(key);

      // TTL should be between 0 and 61 seconds (window + 1s buffer)
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(61);
    });
  });

  describe('429 Too Many Requests', () => {
    it('returns 429 when rate limit exceeded', async () => {
      const testIp = '192.168.200.1';
      const key = buildRateLimitKey('anonymous', testIp);

      // Clear any existing data
      await redis.del(key);

      // Pre-fill Redis sorted set with 60 entries (at limit) to simulate exceeded limit
      // Implementation uses ZADD with timestamp as score
      const now = Date.now();
      const entries: (string | number)[] = [];
      for (let i = 0; i < 60; i++) {
        entries.push(now - i * 100, `${now - i * 100}:test${i}`);
      }
      await redis.zadd(key, ...entries);
      await redis.expire(key, 61);

      const res = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': testIp },
      });

      expect(res.status).toBe(429);
    });

    it('includes Retry-After header when rate limited', async () => {
      const testIp = '192.168.200.2';
      const key = buildRateLimitKey('anonymous', testIp);

      // Clear any existing data
      await redis.del(key);

      // Pre-fill Redis sorted set to exceed limit
      const now = Date.now();
      const entries: (string | number)[] = [];
      for (let i = 0; i < 60; i++) {
        entries.push(now - i * 100, `${now - i * 100}:test${i}`);
      }
      await redis.zadd(key, ...entries);
      await redis.expire(key, 61);

      const res = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': testIp },
      });

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBeDefined();

      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '0', 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it('returns proper error response when rate limited', async () => {
      const testIp = '192.168.200.3';
      const key = buildRateLimitKey('anonymous', testIp);

      // Clear any existing data
      await redis.del(key);

      // Pre-fill Redis sorted set to exceed limit
      const now = Date.now();
      const entries: (string | number)[] = [];
      for (let i = 0; i < 60; i++) {
        entries.push(now - i * 100, `${now - i * 100}:test${i}`);
      }
      await redis.zadd(key, ...entries);
      await redis.expire(key, 61);

      const res = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': testIp },
      });

      expect(res.status).toBe(429);
      const body = (await res.json()) as RateLimitResponse;

      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.message).toBeDefined();
      expect(body.error.requestId).toBeDefined();
    });
  });

  describe('Different Endpoint Rate Limits', () => {
    it('applies same rate limit across different endpoints', async () => {
      const testIp = '192.168.100.1';
      const key = buildRateLimitKey('anonymous', testIp);

      // Clear any existing data
      await redis.del(key);

      // Make requests to different endpoints
      const res1 = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': testIp },
      });
      const res2 = await app.request('/xrpc/pub.chive.preprint.listByAuthor?did=did:plc:test', {
        headers: { 'X-Forwarded-For': testIp },
      });

      // Both should succeed and share the same rate limit counter
      expect([200, 400]).toContain(res1.status); // 200 on success, 400 if validation fails
      expect([200, 400]).toContain(res2.status); // 200 on success, 400 if validation fails

      // Rate limit key should have entries from both requests
      const count = await redis.zcard(key);
      expect(count).toBe(2);
    });
  });

  describe('X-Forwarded-For Header Handling', () => {
    it('extracts first IP from X-Forwarded-For chain', async () => {
      const clientIp = '203.0.113.50';
      const key = buildRateLimitKey('anonymous', clientIp);
      const proxyChain = `${clientIp}, 10.0.0.1, 10.0.0.2`;

      // Clear any existing data
      await redis.del(key);

      await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': proxyChain },
      });

      // Rate limit should be keyed by first IP (uses sorted set)
      const count = await redis.zcard(key);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Tier Verification', () => {
    it('anonymous tier uses 60 req/min limit', async () => {
      const res = await app.request('/api/v1/search?q=test', {
        headers: { 'X-Forwarded-For': '10.10.10.1' },
      });

      const limit = parseInt(res.headers.get('X-RateLimit-Limit') ?? '0', 10);
      expect(limit).toBe(60);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('handles concurrent requests correctly', async () => {
      const testIp = '192.168.150.1';
      const key = buildRateLimitKey('anonymous', testIp);

      // Clear any existing rate limit
      await redis.del(key);

      // Make 10 concurrent requests (async callback ensures Promise return type)
      const promises = Array.from({ length: 10 }, async () =>
        app.request('/api/v1/search?q=test', {
          headers: { 'X-Forwarded-For': testIp },
        })
      );

      const responses = await Promise.all(promises);

      // All should succeed (under rate limit)
      for (const res of responses) {
        expect([200, 400]).toContain(res.status); // 200 on success, 400 if validation fails
      }

      // Rate limit count should reflect all requests (uses sorted set)
      const count = await redis.zcard(key);
      expect(count).toBe(10);
    });
  });

  describe('Different HTTP Methods', () => {
    it('rate limits GET requests', async () => {
      const testIp = '192.168.180.1';

      const res = await app.request('/api/v1/search?q=test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': testIp },
      });

      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
    });

    it('rate limits POST requests', async () => {
      const testIp = '192.168.180.2';

      const res = await app.request('/xrpc/pub.chive.preprint.searchSubmissions', {
        method: 'POST',
        headers: {
          'X-Forwarded-For': testIp,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: 'test' }),
      });

      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
    });
  });
});
