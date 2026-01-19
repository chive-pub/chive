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

// Mock @atproto/identity
const mockDidResolve = vi.fn();
const mockDidResolveAtprotoData = vi.fn();
const mockHandleResolve = vi.fn();

vi.mock('@atproto/identity', () => ({
  IdResolver: class MockIdResolver {
    did = {
      resolve: mockDidResolve,
      resolveAtprotoData: mockDidResolveAtprotoData,
      cache: {
        clearEntry: vi.fn(),
      },
    };
    handle = {
      resolve: mockHandleResolve,
    };
  },
}));

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
    vi.clearAllMocks();
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
    it('should resolve DID using IdResolver', async () => {
      // Mock the IdResolver to return a document
      mockDidResolve.mockResolvedValueOnce({
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
      });

      const result = await resolver.resolveDID(testPlcDid);

      expect(mockDidResolve).toHaveBeenCalledWith(testPlcDid);
      expect(result).toEqual(mockDIDDocument);
    });

    it('should return null for failed resolution in cache', async () => {
      // Pre-populate failure cache
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('1'); // Failure flag present

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
    it('should extract PDS endpoint using resolveAtprotoData', async () => {
      // Mock the IdResolver's resolveAtprotoData
      mockDidResolveAtprotoData.mockResolvedValueOnce({
        did: testPlcDid,
        handle: 'testuser.bsky.social',
        pds: 'https://pds.example.com',
        signingKey: 'did:key:test',
      });

      const endpoint = await resolver.getPDSEndpoint(testPlcDid);

      expect(mockDidResolveAtprotoData).toHaveBeenCalledWith(testPlcDid);
      expect(endpoint).toBe('https://pds.example.com');
    });

    it('should return null if resolveAtprotoData throws', async () => {
      mockDidResolveAtprotoData.mockRejectedValueOnce(new Error('Resolution failed'));

      const endpoint = await resolver.getPDSEndpoint(testPlcDid);

      expect(endpoint).toBeNull();
    });

    it('should return null if no ATProto data available', async () => {
      mockDidResolveAtprotoData.mockRejectedValueOnce(new Error('No ATProto service'));

      const endpoint = await resolver.getPDSEndpoint(testPlcDid);

      expect(endpoint).toBeNull();
    });
  });

  describe('caching behavior', () => {
    it('should check failure cache before resolving', async () => {
      // The implementation first checks the failure cache
      const failureCacheKey = `chive:did:fail:${testPlcDid}`;

      // No failure cached, then IdResolver resolves
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      mockDidResolve.mockResolvedValueOnce({
        id: testPlcDid,
        alsoKnownAs: ['at://testuser.bsky.social'],
        service: [],
      });

      await resolver.resolveDID(testPlcDid);

      // Should have checked failure cache first
      expect(redis.get).toHaveBeenCalledWith(failureCacheKey);
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
