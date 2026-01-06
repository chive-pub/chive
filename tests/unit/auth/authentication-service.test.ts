/**
 * Unit tests for AuthenticationService.
 *
 * @remarks
 * Tests authentication flows, session management, and MFA handling.
 */

import type { Redis } from 'ioredis';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuthenticationService } from '@/auth/authentication-service.js';
import type { DIDResolver } from '@/auth/did/did-resolver.js';
import type { JWTService, IssuedToken } from '@/auth/jwt/jwt-service.js';
import type { RefreshTokenManager } from '@/auth/session/refresh-token-manager.js';
import type { DID } from '@/types/atproto.js';
import type { DIDDocument } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { ISessionManager, Session } from '@/types/interfaces/session.interface.js';

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
  const sets = new Map<string, Set<string>>();

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
    exists: vi.fn((key: string) => Promise.resolve(store.has(key) ? 1 : 0)),
    smembers: vi.fn((key: string) => {
      const set = sets.get(key);
      return Promise.resolve(set ? Array.from(set) : []);
    }),
    srem: vi.fn((key: string, ...members: string[]) => {
      const set = sets.get(key);
      if (!set) return Promise.resolve(0);
      let count = 0;
      for (const member of members) {
        if (set.delete(member)) count++;
      }
      return Promise.resolve(count);
    }),
  } as unknown as Redis;
};

const createMockDIDResolver = (testDid: DID): DIDResolver => {
  const mockDocument: DIDDocument = {
    id: testDid,
    alsoKnownAs: ['at://testuser.bsky.social'],
    verificationMethod: [
      {
        id: `${testDid}#atproto`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: testDid,
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

  return {
    resolveDID: vi.fn().mockResolvedValue(mockDocument),
    resolveHandle: vi.fn().mockResolvedValue(testDid),
    getPDSEndpoint: vi.fn().mockResolvedValue('https://pds.example.com'),
  } as unknown as DIDResolver;
};

const createMockJWTService = (): JWTService => {
  return {
    issueToken: vi.fn().mockResolvedValue({
      token: 'mock_access_token_xyz',
      jti: 'jti_auth_123',
      expiresAt: new Date(Date.now() + 3600000),
      issuedAt: new Date(),
    } as IssuedToken),
    verifyToken: vi.fn().mockResolvedValue({
      claims: {
        sub: 'did:plc:test123',
        sessionId: 'sess_123',
        scope: 'read:preprints',
        jti: 'jti_auth_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      payload: {},
      protectedHeader: { alg: 'ES256' },
    }),
    revokeToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as JWTService;
};

interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  scope?: string[];
}

const createMockSessionManager = (): ISessionManager => {
  const sessions = new Map<string, Session>();

  return {
    createSession: vi.fn().mockImplementation((did: DID, metadata: SessionMetadata) => {
      const session: Session = {
        id: `sess_${Date.now()}`,
        did,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        lastActivity: new Date(),
        ipAddress: metadata.ipAddress ?? 'unknown',
        userAgent: metadata.userAgent ?? 'unknown',
        scope: metadata.scope ?? [],
      };
      sessions.set(session.id, session);
      return Promise.resolve(session);
    }),
    getSession: vi.fn().mockImplementation((sessionId: string) => {
      return Promise.resolve(sessions.get(sessionId) ?? null);
    }),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    updateSession: vi.fn().mockResolvedValue(undefined),
    revokeAllSessions: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([]),
    isTokenRevoked: vi.fn().mockResolvedValue(false),
    revokeToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as ISessionManager;
};

const createMockRefreshTokenManager = (): RefreshTokenManager => {
  return {
    createToken: vi.fn().mockResolvedValue({
      token: 'mock_refresh_token_abc',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }),
    verifyToken: vi.fn().mockResolvedValue({
      did: 'did:plc:test123' as DID,
      sessionId: 'sess_123',
      scope: ['read:preprints'],
    }),
    revokeToken: vi.fn().mockResolvedValue(undefined),
    rotateToken: vi.fn().mockResolvedValue({
      data: {
        did: 'did:plc:test123' as DID,
        sessionId: 'sess_123',
        scope: ['read:preprints'],
      },
      newToken: {
        token: 'mock_new_refresh_token',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
  } as unknown as RefreshTokenManager;
};

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let logger: MockLogger;
  let redis: Redis;
  let didResolver: DIDResolver;
  let jwtService: JWTService;
  let sessionManager: ISessionManager;
  let refreshTokenManager: RefreshTokenManager;

  const testDid = 'did:plc:authtest123' as DID;

  beforeEach(() => {
    logger = createMockLogger();
    redis = createMockRedis();
    didResolver = createMockDIDResolver(testDid);
    jwtService = createMockJWTService();
    sessionManager = createMockSessionManager();
    refreshTokenManager = createMockRefreshTokenManager();

    service = new AuthenticationService({
      redis,
      logger,
      didResolver,
      jwtService,
      sessionManager,
      refreshTokenManager,
    });
  });

  describe('authenticateWithDID', () => {
    it('should resolve DID before authentication', async () => {
      const result = await service.authenticateWithDID(testDid, {
        type: 'pds_token',
        value: 'mock_pds_token',
      });

      expect(didResolver.resolveDID).toHaveBeenCalledWith(testDid);
      expect(result).toBeDefined();
    });

    it('should return failure when DID resolution fails', async () => {
      (didResolver.resolveDID as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const result = await service.authenticateWithDID(testDid, {
        type: 'pds_token',
        value: 'mock_pds_token',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('DID resolution failed');
    });

    it('should return failure for invalid credentials', async () => {
      const result = await service.authenticateWithDID(testDid, {
        type: 'password',
        value: 'invalid_password',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid credentials');
    });
  });

  describe('issueSessionToken', () => {
    it('should issue access and refresh tokens', async () => {
      const token = await service.issueSessionToken(testDid);

      expect(token).toBeDefined();
      expect(token.accessToken).toBeDefined();
      expect(token.refreshToken).toBeDefined();
      expect(token.tokenType).toBe('Bearer');
      expect(sessionManager.createSession).toHaveBeenCalled();
      expect(jwtService.issueToken).toHaveBeenCalled();
    });

    it('should use provided session ID when given', async () => {
      const existingSessionId = 'sess_existing_123';

      const token = await service.issueSessionToken(testDid, {
        sessionId: existingSessionId,
      });

      expect(token).toBeDefined();
      expect(sessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should respect scope in token options', async () => {
      const scopes = ['read:preprints', 'write:reviews'];

      const token = await service.issueSessionToken(testDid, {
        scope: scopes,
      });

      expect(token.scope).toEqual(scopes);
      expect(jwtService.issueToken).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes,
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should issue new access token with valid refresh token', async () => {
      // Setup session for the refresh
      const mockSession: Session = {
        id: 'sess_123',
        did: testDid,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        lastActivity: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        scope: ['read:preprints'],
      };
      (sessionManager.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSession);

      const result = await service.refreshToken('valid_refresh_token');

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(refreshTokenManager.rotateToken).toHaveBeenCalled();
    });

    it('should throw when session no longer exists', async () => {
      (sessionManager.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(service.refreshToken('valid_refresh_token')).rejects.toThrow();
    });

    it('should throw for invalid refresh token', async () => {
      (refreshTokenManager.rotateToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Invalid token')
      );

      await expect(service.refreshToken('invalid_token')).rejects.toThrow();
    });
  });

  describe('revokeToken', () => {
    it('should attempt to revoke as refresh token first', async () => {
      await service.revokeToken('some_token');

      expect(refreshTokenManager.revokeToken).toHaveBeenCalledWith('some_token');
    });

    it('should attempt access token revocation when refresh fails', async () => {
      (refreshTokenManager.revokeToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Not a refresh token')
      );

      await service.revokeToken('access_token');

      expect(jwtService.verifyToken).toHaveBeenCalled();
      expect(jwtService.revokeToken).toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid access token', async () => {
      const claims = await service.verifyToken('valid_access_token');

      expect(claims).toBeDefined();
      expect(claims.sub).toBe('did:plc:test123');
      expect(jwtService.verifyToken).toHaveBeenCalled();
    });

    it('should throw for invalid token', async () => {
      (jwtService.verifyToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Invalid token')
      );

      await expect(service.verifyToken('invalid_token')).rejects.toThrow();
    });
  });

  describe('completeMFAChallenge', () => {
    it('should throw when challenge not found', async () => {
      await expect(
        service.completeMFAChallenge('nonexistent_challenge', 'totp', '123456')
      ).rejects.toThrow('Challenge expired or not found');
    });

    it('should throw when method not available', async () => {
      // Store a challenge without TOTP
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          did: testDid,
          methods: ['webauthn'],
          createdAt: new Date().toISOString(),
        })
      );

      await expect(
        service.completeMFAChallenge('test_challenge', 'totp', '123456')
      ).rejects.toThrow('MFA method not available');
    });
  });
});
