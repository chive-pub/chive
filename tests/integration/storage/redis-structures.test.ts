/**
 * Redis data structures integration tests.
 *
 * @remarks
 * Verifies Redis configuration and key patterns:
 * - Connection successful
 * - Key patterns generate correctly
 * - TTL values are sensible
 *
 * @packageDocumentation
 */

import { Redis } from 'ioredis';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { getRedisConfig, RedisKeys, RedisTTL } from '@/storage/redis/structures.js';
import { toDID, toAtUri } from '@/types/atproto-validators.js';

describe('Redis Structures', () => {
  let redis: Redis;

  beforeAll(() => {
    const config = getRedisConfig();
    redis = new Redis(config);
  });

  afterAll(async () => {
    await redis.quit();
  });

  describe('Connection', () => {
    it('connects to Redis successfully', async () => {
      const pong = await redis.ping();
      expect(pong).toBe('PONG');
    });

    it('can set and get values', async () => {
      await redis.set('test:key', 'test value');
      const value = await redis.get('test:key');
      expect(value).toBe('test value');
      await redis.del('test:key');
    });
  });

  describe('Key Patterns', () => {
    it('generates session key with correct format', () => {
      const key = RedisKeys.SESSION('abc123');
      expect(key).toBe('session:abc123');
    });

    it('generates user sessions key with correct format', () => {
      const did = toDID('did:plc:test123');
      expect(did).toBeDefined();
      if (did) {
        const key = RedisKeys.USER_SESSIONS(did);
        expect(key).toBe('user_sessions:did:plc:test123');
      }
    });

    it('generates rate limit keys with correct format', () => {
      const did = toDID('did:plc:test');
      expect(did).toBeDefined();

      if (did) {
        expect(RedisKeys.RATE_LIMIT_ANON('192.168.1.1')).toBe('ratelimit:anon:192.168.1.1');
        expect(RedisKeys.RATE_LIMIT_AUTH(did)).toBe('ratelimit:auth:did:plc:test');
        expect(RedisKeys.RATE_LIMIT_PREMIUM(did)).toBe('ratelimit:premium:did:plc:test');
        expect(RedisKeys.RATE_LIMIT_ADMIN(did)).toBe('ratelimit:admin:did:plc:test');
      }
    });

    it('generates cache keys with correct format', () => {
      const uri = toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz');
      const did = toDID('did:plc:abc');
      expect(uri).toBeDefined();
      expect(did).toBeDefined();

      if (uri && did) {
        expect(RedisKeys.CACHE_EPRINT(uri)).toBe(
          'cache:eprint:at://did:plc:abc/pub.chive.eprint.submission/xyz'
        );
        expect(RedisKeys.CACHE_AUTHOR(did)).toBe('cache:author:did:plc:abc');
        expect(RedisKeys.CACHE_SEARCH('hash123')).toBe('cache:search:hash123');
      }
    });

    it('generates firehose cursor key', () => {
      expect(RedisKeys.FIREHOSE_CURSOR).toBe('firehose:cursor');
    });

    it('generates PDS health key with correct format', () => {
      const key = RedisKeys.PDS_HEALTH('https://pds.example.com');
      expect(key).toBe('pds:health:https://pds.example.com');
    });

    it('generates queue keys with correct format', () => {
      expect(RedisKeys.QUEUE_INDEXING).toBe('queue:indexing');
      expect(RedisKeys.QUEUE_PDF_EXTRACTION).toBe('queue:pdf_extraction');
      expect(RedisKeys.QUEUE_NOTIFICATION).toBe('queue:notification');
    });
  });

  describe('TTL Values', () => {
    it('session TTL is 7 days', () => {
      expect(RedisTTL.SESSION).toBe(86400 * 7);
    });

    it('rate limit window is 1 minute', () => {
      expect(RedisTTL.RATE_LIMIT_WINDOW).toBe(60);
    });

    it('cache TTLs are reasonable', () => {
      expect(RedisTTL.CACHE_EPRINT).toBe(300); // 5 minutes
      expect(RedisTTL.CACHE_AUTHOR).toBe(600); // 10 minutes
      expect(RedisTTL.CACHE_SEARCH).toBe(180); // 3 minutes
    });

    it('PDS health TTL is 5 minutes', () => {
      expect(RedisTTL.PDS_HEALTH).toBe(300);
    });
  });

  describe('Key Prefix', () => {
    it('applies key prefix from config', async () => {
      const config = getRedisConfig();
      expect(config.keyPrefix).toBeDefined();
      expect(config.keyPrefix).toBe('chive:');

      // Use a unique key name to avoid matching other systems' keys
      const uniqueKey = 'integration_test_prefix_check';
      await redis.set(uniqueKey, 'value');

      // When ioredis keyPrefix is set, 'unique_key' becomes 'chive:unique_key'
      // Search for the exact prefixed key pattern
      const prefixedPattern = `${config.keyPrefix}${uniqueKey}`;
      const keys = await redis.keys(prefixedPattern);

      expect(keys.length).toBe(1);
      expect(keys[0]).toBe(prefixedPattern);

      await redis.del(uniqueKey);
    });
  });
});
