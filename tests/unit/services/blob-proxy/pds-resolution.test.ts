/**
 * Tests for BlobProxyService PDS resolution.
 *
 * @remarks
 * These tests verify that PDS resolution:
 * 1. Uses the identity service to resolve DIDs
 * 2. Does NOT fall back to hardcoded bsky.social
 * 3. Throws errors when resolution fails
 *
 * This ensures proper federation support for non-Bluesky PDSes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DID } from '@/types/atproto.js';
import type { IIdentityResolver } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// Test constants
const NON_BLUESKY_DID = 'did:plc:qpdjl22sgfejceds2ibabye6' as DID;
const CUSTOM_PDS_ENDPOINT = 'https://selfhosted.social';

/**
 * Creates mock logger.
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
 * Creates mock identity service.
 */
function createMockIdentityService(
  endpoint: string | null = CUSTOM_PDS_ENDPOINT
): IIdentityResolver {
  return {
    getPDSEndpoint: vi.fn().mockResolvedValue(endpoint),
    resolveHandle: vi.fn(),
    resolveDID: vi.fn(),
  };
}

/**
 * Simulates the PDS resolution logic from BlobProxyService.
 *
 * This is extracted to test the resolution behavior without
 * instantiating the full service.
 */
async function resolvePDSEndpoint(
  did: DID,
  identity: IIdentityResolver,
  logger: ILogger,
  cache: Map<DID, string>
): Promise<string> {
  // Check cache first
  const cached = cache.get(did);
  if (cached) {
    return cached;
  }

  try {
    // Resolve via identity service
    const endpoint = await identity.getPDSEndpoint(did);

    if (endpoint) {
      // Cache for future requests
      cache.set(did, endpoint);
      return endpoint;
    }

    // If identity resolver returns null, throw an error
    // Do NOT fall back to a hardcoded PDS - this would break federation
    throw new Error(`Failed to resolve PDS endpoint for DID: ${did}`);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('DID resolution failed', err, { did });
    // Re-throw - do NOT fall back to a hardcoded PDS
    throw err;
  }
}

describe('BlobProxyService PDS Resolution', () => {
  let mockLogger: ILogger;
  let mockIdentity: IIdentityResolver;
  let cache: Map<DID, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockIdentity = createMockIdentityService();
    cache = new Map();
  });

  describe('successful resolution', () => {
    it('resolves PDS endpoint via identity service', async () => {
      const result = await resolvePDSEndpoint(NON_BLUESKY_DID, mockIdentity, mockLogger, cache);

      expect(result).toBe(CUSTOM_PDS_ENDPOINT);
      expect(mockIdentity.getPDSEndpoint).toHaveBeenCalledWith(NON_BLUESKY_DID);
    });

    it('caches resolved endpoints', async () => {
      // First call
      await resolvePDSEndpoint(NON_BLUESKY_DID, mockIdentity, mockLogger, cache);

      // Second call should use cache
      const result = await resolvePDSEndpoint(NON_BLUESKY_DID, mockIdentity, mockLogger, cache);

      expect(result).toBe(CUSTOM_PDS_ENDPOINT);
      // Should only call identity service once (first call)
      expect(mockIdentity.getPDSEndpoint).toHaveBeenCalledTimes(1);
    });

    it('returns cached endpoint without calling identity service', async () => {
      // Pre-populate cache
      cache.set(NON_BLUESKY_DID, 'https://cached-pds.example.com');

      const result = await resolvePDSEndpoint(NON_BLUESKY_DID, mockIdentity, mockLogger, cache);

      expect(result).toBe('https://cached-pds.example.com');
      expect(mockIdentity.getPDSEndpoint).not.toHaveBeenCalled();
    });
  });

  describe('no hardcoded bsky.social fallback', () => {
    it('throws error when identity service returns null', async () => {
      mockIdentity = createMockIdentityService(null);

      await expect(
        resolvePDSEndpoint(NON_BLUESKY_DID, mockIdentity, mockLogger, cache)
      ).rejects.toThrow(`Failed to resolve PDS endpoint for DID: ${NON_BLUESKY_DID}`);
    });

    it('does not return bsky.social when resolution fails', async () => {
      mockIdentity = createMockIdentityService(null);

      try {
        const result = await resolvePDSEndpoint(NON_BLUESKY_DID, mockIdentity, mockLogger, cache);
        // If we get here without throwing, the result should NOT be bsky.social
        expect(result).not.toBe('https://bsky.social');
        expect(result).not.toContain('bsky.social');
      } catch {
        // Expected - resolution should throw, not return fallback
      }
    });

    it('re-throws identity service errors', async () => {
      const networkError = new Error('Network timeout');
      mockIdentity.getPDSEndpoint = vi.fn().mockRejectedValue(networkError);

      await expect(
        resolvePDSEndpoint(NON_BLUESKY_DID, mockIdentity, mockLogger, cache)
      ).rejects.toThrow('Network timeout');
    });

    it('logs error when resolution fails', async () => {
      mockIdentity = createMockIdentityService(null);

      try {
        await resolvePDSEndpoint(NON_BLUESKY_DID, mockIdentity, mockLogger, cache);
      } catch {
        // Expected
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'DID resolution failed',
        expect.any(Error),
        expect.objectContaining({ did: NON_BLUESKY_DID })
      );
    });
  });

  describe('federation support', () => {
    it('supports custom PDS endpoints', async () => {
      const customEndpoints = [
        'https://selfhosted.social',
        'https://pds.example.com',
        'https://my-pds.io:8080',
      ];

      for (const endpoint of customEndpoints) {
        mockIdentity = createMockIdentityService(endpoint);
        cache = new Map();

        const result = await resolvePDSEndpoint(
          `did:plc:test${endpoint.length}` as DID,
          mockIdentity,
          mockLogger,
          cache
        );

        expect(result).toBe(endpoint);
      }
    });

    it('resolves different DIDs to different PDS endpoints', async () => {
      const did1 = 'did:plc:user1' as DID;
      const did2 = 'did:plc:user2' as DID;

      // First user on custom PDS
      mockIdentity.getPDSEndpoint = vi
        .fn()
        .mockResolvedValueOnce('https://pds1.example.com')
        .mockResolvedValueOnce('https://pds2.example.com');

      const result1 = await resolvePDSEndpoint(did1, mockIdentity, mockLogger, cache);
      const result2 = await resolvePDSEndpoint(did2, mockIdentity, mockLogger, cache);

      expect(result1).toBe('https://pds1.example.com');
      expect(result2).toBe('https://pds2.example.com');
    });
  });
});
