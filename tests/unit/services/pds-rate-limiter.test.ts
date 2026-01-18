/**
 * PDS Rate Limiter unit tests.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  PDSRateLimiter,
  type PDSRateLimiterOptions,
} from '@/services/pds-sync/pds-rate-limiter.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

/** Mock Redis client for testing. */
interface MockRedis {
  storage: Map<string, Map<string, number>>;
  pipeline: ReturnType<typeof vi.fn>;
  zadd: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  zrange: ReturnType<typeof vi.fn>;
  zcard: ReturnType<typeof vi.fn>;
  zremrangebyscore: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
}

// Mock Redis client
function createMockRedis(): MockRedis {
  const storage = new Map<string, Map<string, number>>();

  return {
    storage,
    pipeline: vi.fn(() => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0], // zremrangebyscore result
        [null, 0], // zcard result
      ]),
    })),
    zadd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zcard: vi.fn().mockResolvedValue(0),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Creates a mock logger.
 */
function createMockLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

// Test constants
const TEST_PDS_URL = 'https://bsky.social';
const TEST_PDS_URL_2 = 'https://other.pds.social';

describe('PDSRateLimiter', () => {
  let rateLimiter: PDSRateLimiter;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedis = createMockRedis();
    mockLogger = createMockLogger();

    rateLimiter = new PDSRateLimiter({
      redis: mockRedis as unknown as PDSRateLimiterOptions['redis'],
      logger: mockLogger,
      maxRequestsPerWindow: 10,
      windowMs: 60_000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create rate limiter with default options', () => {
      const limiter = new PDSRateLimiter({
        redis: mockRedis as unknown as PDSRateLimiterOptions['redis'],
        logger: mockLogger,
      });
      expect(limiter).toBeDefined();
    });

    it('should create child logger', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ service: 'pds-rate-limiter' });
    });
  });

  describe('checkLimit', () => {
    it('should allow request when under limit', async () => {
      const result = await rateLimiter.checkLimit(TEST_PDS_URL);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(10);
      expect(result.waitMs).toBe(0);
      expect(result.pdsUrl).toBe(TEST_PDS_URL);
    });

    it('should record request in Redis when allowed', async () => {
      await rateLimiter.checkLimit(TEST_PDS_URL);

      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should reject request when at limit', async () => {
      // Mock pipeline to return count at limit
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 10], // At limit
        ]),
      });

      // Mock oldest entry time
      mockRedis.zrange.mockResolvedValue(['entry', String(Date.now() - 30000)]);

      const result = await rateLimiter.checkLimit(TEST_PDS_URL);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.waitMs).toBeGreaterThan(0);
    });

    it('should track different PDSes separately', async () => {
      await rateLimiter.checkLimit(TEST_PDS_URL);
      await rateLimiter.checkLimit(TEST_PDS_URL_2);

      // Pipeline should be called twice for different PDSes
      expect(mockRedis.pipeline).toHaveBeenCalledTimes(2);
    });

    it('should fail open on Redis error', async () => {
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(null),
      });

      const result = await rateLimiter.checkLimit(TEST_PDS_URL);

      expect(result.allowed).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should fail open on exception', async () => {
      mockRedis.pipeline.mockImplementation(() => {
        throw new Error('Redis connection error');
      });

      const result = await rateLimiter.checkLimit(TEST_PDS_URL);

      expect(result.allowed).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should normalize PDS URL for key', async () => {
      await rateLimiter.checkLimit('https://BSKY.SOCIAL/');
      await rateLimiter.checkLimit('https://bsky.social');

      // Both should use same normalized key
      const stats = rateLimiter.getStats();
      expect(stats.uniquePdsCount).toBe(2); // Different inputs still counted
    });
  });

  describe('waitForLimit', () => {
    it('should return immediately when allowed', async () => {
      const result = await rateLimiter.waitForLimit(TEST_PDS_URL);

      expect(result.allowed).toBe(true);
      expect(result.waitMs).toBe(0);
    });

    it('should return allowed=false when max wait exceeded', async () => {
      // Always rate limited
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 10], // At limit
        ]),
      });
      mockRedis.zrange.mockResolvedValue(['entry', String(Date.now())]);

      const result = await rateLimiter.waitForLimit(TEST_PDS_URL, 100);

      expect(result.allowed).toBe(false);
    });
  });

  describe('getCurrentCount', () => {
    it('should return current request count', async () => {
      mockRedis.zcard.mockResolvedValue(5);

      const count = await rateLimiter.getCurrentCount(TEST_PDS_URL);

      expect(count).toBe(5);
      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
      expect(mockRedis.zcard).toHaveBeenCalled();
    });

    it('should return 0 for new PDS', async () => {
      mockRedis.zcard.mockResolvedValue(0);

      const count = await rateLimiter.getCurrentCount(TEST_PDS_URL);

      expect(count).toBe(0);
    });
  });

  describe('reset', () => {
    it('should delete rate limit key for PDS', async () => {
      await rateLimiter.reset(TEST_PDS_URL);

      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PDS rate limit reset',
        expect.objectContaining({ pdsUrl: TEST_PDS_URL })
      );
    });
  });

  describe('resetAll', () => {
    it('should delete all rate limit keys', async () => {
      mockRedis.keys.mockResolvedValue([
        'chive:pds-rate:https://bsky.social',
        'chive:pds-rate:https://other.social',
      ]);

      await rateLimiter.resetAll();

      expect(mockRedis.keys).toHaveBeenCalledWith('chive:pds-rate:*');
      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'All PDS rate limits reset',
        expect.objectContaining({ count: 2 })
      );
    });

    it('should handle no keys to delete', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await rateLimiter.resetAll();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = rateLimiter.getStats();

      expect(stats).toEqual({
        checksPerformed: 0,
        allowed: 0,
        rateLimited: 0,
        uniquePdsCount: 0,
      });
    });

    it('should track allowed requests', async () => {
      await rateLimiter.checkLimit(TEST_PDS_URL);
      await rateLimiter.checkLimit(TEST_PDS_URL);

      const stats = rateLimiter.getStats();

      expect(stats.checksPerformed).toBe(2);
      expect(stats.allowed).toBe(2);
      expect(stats.uniquePdsCount).toBe(1);
    });

    it('should track rate limited requests', async () => {
      // Mock at limit
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 10],
        ]),
      });
      mockRedis.zrange.mockResolvedValue(['entry', String(Date.now())]);

      await rateLimiter.checkLimit(TEST_PDS_URL);

      const stats = rateLimiter.getStats();

      expect(stats.checksPerformed).toBe(1);
      expect(stats.rateLimited).toBe(1);
    });

    it('should track unique PDSes', async () => {
      await rateLimiter.checkLimit(TEST_PDS_URL);
      await rateLimiter.checkLimit(TEST_PDS_URL_2);
      await rateLimiter.checkLimit(TEST_PDS_URL);

      const stats = rateLimiter.getStats();

      expect(stats.uniquePdsCount).toBe(2);
    });
  });
});
