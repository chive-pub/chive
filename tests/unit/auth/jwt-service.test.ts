/**
 * Unit tests for JWTService.
 *
 * @remarks
 * Tests JWT issuance, verification, and revocation.
 */

import type { Redis } from 'ioredis';
import * as jose from 'jose';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { JWTService } from '@/auth/jwt/jwt-service.js';
import type { KeyManager, KeyPair } from '@/auth/jwt/key-manager.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

interface MockLogger extends ILogger {
  debugMock: ReturnType<typeof vi.fn>;
  infoMock: ReturnType<typeof vi.fn>;
  warnMock: ReturnType<typeof vi.fn>;
}

const createMockLogger = (): MockLogger => {
  const debugMock = vi.fn();
  const infoMock = vi.fn();
  const warnMock = vi.fn();
  const logger: MockLogger = {
    debug: debugMock,
    info: infoMock,
    warn: warnMock,
    error: vi.fn(),
    child: vi.fn(function (this: void) {
      return logger;
    }),
    debugMock,
    infoMock,
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

// Create a real ES256 key pair for testing
const createMockKeyManager = async (): Promise<{
  keyManager: KeyManager;
  keyPair: KeyPair;
}> => {
  const { privateKey, publicKey } = await jose.generateKeyPair('ES256');
  const publicJWK = await jose.exportJWK(publicKey);

  const keyPair: KeyPair = {
    kid: 'test-key-001',
    privateKey: privateKey,
    publicKey: publicKey,
    publicJWK,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
  };

  const keyManager: KeyManager = {
    getCurrentKey: vi.fn().mockResolvedValue(keyPair),
    getValidKeys: vi.fn().mockResolvedValue([keyPair]),
    getKey: vi.fn().mockImplementation((kid?: string) => {
      if (!kid || kid === 'test-key-001') {
        return Promise.resolve(keyPair);
      }
      return Promise.resolve(null);
    }),
    getPublicJWKS: vi.fn().mockResolvedValue({
      keys: [
        {
          ...publicJWK,
          kid: 'test-key-001',
          use: 'sig',
          alg: 'ES256',
        },
      ],
    }),
    rotateKey: vi.fn().mockResolvedValue(keyPair),
  } as unknown as KeyManager;

  return { keyManager, keyPair };
};

describe('JWTService', () => {
  let service: JWTService;
  let logger: MockLogger;
  let redis: Redis;

  const testDid = 'did:plc:test123' as DID;

  beforeEach(async () => {
    logger = createMockLogger();
    redis = createMockRedis();

    const { keyManager } = await createMockKeyManager();

    service = new JWTService({
      keyManager,
      redis,
      logger,
      config: {
        issuer: 'https://test.chive.pub',
        audience: 'https://api.test.chive.pub',
        accessTokenExpirationSeconds: 3600,
      },
    });
  });

  describe('issueToken', () => {
    it('should issue a valid JWT token', async () => {
      const result = await service.issueToken({
        subject: testDid,
        sessionId: 'session-123',
        scopes: ['read:preprints', 'write:reviews'],
      });

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.jti).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.issuedAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should include custom claims in token', async () => {
      const result = await service.issueToken({
        subject: testDid,
        sessionId: 'session-123',
        scopes: ['read:preprints'],
      });

      expect(result.token).toBeDefined();

      // Verify the token to check claims
      const verified = await service.verifyToken(result.token);
      expect(verified.claims.sessionId).toBe('session-123');
      expect(verified.claims.scope).toContain('read:preprints');
    });

    it('should use custom expiration when provided', async () => {
      const customExpiry = 1800; // 30 minutes
      const result = await service.issueToken({
        subject: testDid,
        sessionId: 'session-456',
        expirationSeconds: customExpiry,
      });

      const expiryTime = result.expiresAt.getTime();
      const expectedExpiry = Date.now() + customExpiry * 1000;

      // Allow 1 second tolerance
      expect(expiryTime).toBeGreaterThan(expectedExpiry - 1000);
      expect(expiryTime).toBeLessThan(expectedExpiry + 1000);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const issued = await service.issueToken({
        subject: testDid,
        sessionId: 'session-789',
        scopes: ['read:preprints'],
      });

      const verified = await service.verifyToken(issued.token);

      expect(verified.claims.sub).toBe(testDid);
      expect(verified.claims.scope).toContain('read:preprints');
    });

    it('should reject an invalid token', async () => {
      await expect(service.verifyToken('invalid.token.here')).rejects.toThrow();
    });

    it('should reject a revoked token', async () => {
      const issued = await service.issueToken({
        subject: testDid,
        sessionId: 'session-revoked',
      });

      // Revoke the token
      await service.revokeToken(issued.jti, issued.expiresAt);

      await expect(service.verifyToken(issued.token)).rejects.toThrow('Token has been revoked');
    });
  });

  describe('revokeToken', () => {
    it('should add token to revocation list', async () => {
      const issued = await service.issueToken({
        subject: testDid,
        sessionId: 'session-to-revoke',
      });

      await service.revokeToken(issued.jti, issued.expiresAt);

      // Verify token is revoked
      await expect(service.verifyToken(issued.token)).rejects.toThrow();
    });

    it('should log token revocation', async () => {
      const issued = await service.issueToken({
        subject: testDid,
        sessionId: 'session-log-test',
      });

      await service.revokeToken(issued.jti, issued.expiresAt);

      expect(logger.infoMock).toHaveBeenCalledWith(
        'Token revoked',
        expect.objectContaining({ jti: issued.jti })
      );
    });
  });
});
