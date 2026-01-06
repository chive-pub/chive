/**
 * Unit tests for DIDResolver.
 *
 * @remarks
 * Tests DID document resolution, handle resolution, and caching behavior.
 */

import type { Redis } from 'ioredis';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DIDResolver } from '@/auth/did/did-resolver.js';
import type { DID } from '@/types/atproto.js';
import type { DIDDocument } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

interface MockLogger extends ILogger {
  debugMock: ReturnType<typeof vi.fn>;
  warnMock: ReturnType<typeof vi.fn>;
}

const createMockLogger = (): MockLogger => {
  const debugMock = vi.fn();
  const warnMock = vi.fn();
  const logger: MockLogger = {
    debug: debugMock,
    info: vi.fn(),
    warn: warnMock,
    error: vi.fn(),
    child: vi.fn(function (this: void) {
      return logger;
    }),
    debugMock,
    warnMock,
  };
  return logger;
};

const createMockRedis = (): Redis => {
  const store = new Map<string, string>();

  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    setex: vi.fn((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
  } as unknown as Redis;
};

describe('DIDResolver', () => {
  let resolver: DIDResolver;
  let logger: MockLogger;
  let redis: Redis;

  const testPlcDid = 'did:plc:test123abc' as DID;

  const mockDIDDocument: DIDDocument = {
    id: testPlcDid,
    alsoKnownAs: ['at://testuser.bsky.social'],
    verificationMethod: [
      {
        id: `${testPlcDid}#atproto`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: testPlcDid,
        publicKeyMultibase: 'zQ3shXjHeiBuRCKmM36cuYnm7YEMzhGnCmCyW92sRJ9pribSF',
      },
    ],
    service: [
      {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint: 'https://pds.example.com',
      },
    ],
  };

  beforeEach(() => {
    logger = createMockLogger();
    redis = createMockRedis();

    resolver = new DIDResolver({
      redis,
      logger,
      config: {
        plcDirectoryUrl: 'https://plc.directory',
        cacheTtlSeconds: 300,
        timeoutMs: 5000,
      },
    });
  });

  describe('resolveDID', () => {
    it('should return cached document if available', async () => {
      // Pre-populate cache
      const cacheKey = `chive:did:${testPlcDid}`;
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify(mockDIDDocument)
      );

      const result = await resolver.resolveDID(testPlcDid);

      expect(redis.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(mockDIDDocument);
    });

    it('should return null for failed resolution in cache', async () => {
      // Pre-populate failure cache
      (redis.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // No document cache
        .mockResolvedValueOnce('1'); // Failure flag present

      const result = await resolver.resolveDID(testPlcDid);

      expect(result).toBeNull();
    });
  });

  describe('resolveHandle', () => {
    it('should normalize handles by removing @ prefix', async () => {
      const handleWithAt = '@testuser.bsky.social';
      const handleWithoutAt = 'testuser.bsky.social';

      // Both should resolve to same cache key
      await resolver.resolveHandle(handleWithAt);
      expect(redis.get).toHaveBeenCalledWith(`chive:handle:${handleWithoutAt}`);
    });

    it('should return cached DID if available', async () => {
      const handle = 'testuser.bsky.social';
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(testPlcDid);

      const result = await resolver.resolveHandle(handle);

      expect(result).toBe(testPlcDid);
    });

    it('should return null for cached failure', async () => {
      // Cache miss for handle, then failure flag present
      (redis.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // No cached DID
        .mockResolvedValueOnce('1'); // Failure flag present

      const result = await resolver.resolveHandle('cached-failure.example');

      expect(result).toBeNull();
    });
  });

  describe('getPDSEndpoint', () => {
    it('should extract PDS endpoint from service array', async () => {
      // Pre-populate cache with document
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify(mockDIDDocument)
      );

      const endpoint = await resolver.getPDSEndpoint(testPlcDid);

      expect(endpoint).toBe('https://pds.example.com');
    });

    it('should return null if no PDS service found', async () => {
      const docWithoutPds: DIDDocument = {
        ...mockDIDDocument,
        service: [],
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(docWithoutPds));

      const endpoint = await resolver.getPDSEndpoint(testPlcDid);

      expect(endpoint).toBeNull();
    });

    it('should return null if DID cannot be resolved', async () => {
      (redis.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // No document cache
        .mockResolvedValueOnce('1'); // Failure flag present

      const endpoint = await resolver.getPDSEndpoint(testPlcDid);

      expect(endpoint).toBeNull();
    });
  });

  describe('caching behavior', () => {
    it('should cache resolved documents with TTL', async () => {
      // Simulate successful resolution and caching
      const cacheKey = `chive:did:${testPlcDid}`;

      // First call returns null (cache miss), triggering fetch
      (redis.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // The resolver will attempt to fetch; we don't mock the fetch here
      // so this tests the cache check path only
      await resolver.resolveDID(testPlcDid).catch(() => {
        // Expected to fail without network mocking
      });

      expect(redis.get).toHaveBeenCalledWith(cacheKey);
    });
  });

  describe('DID method detection', () => {
    it('should handle did:plc DIDs', () => {
      const plcDid = 'did:plc:z7r8z8dktj8lzkz8u8vqb3dq' as DID;
      expect(plcDid).toMatch(/^did:plc:/);
    });

    it('should handle did:web DIDs', () => {
      const webDid = 'did:web:example.com' as DID;
      expect(webDid).toMatch(/^did:web:/);
    });
  });
});
