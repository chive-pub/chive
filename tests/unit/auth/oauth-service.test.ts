/**
 * Unit tests for OAuthService.
 *
 * @remarks
 * Tests OAuth 2.0 authorization code flow with PKCE.
 */

import type { Redis } from 'ioredis';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { JWTService, IssuedToken } from '@/auth/jwt/jwt-service.js';
import type { OAuthClientManager, OAuthClient } from '@/auth/oauth/oauth-client.js';
import { OAuthService } from '@/auth/oauth/oauth-service.js';
import type { RefreshTokenManager } from '@/auth/session/refresh-token-manager.js';
import type { SessionManager } from '@/auth/session/session-manager.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { Session } from '@/types/interfaces/session.interface.js';

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

const createMockJWTService = (): JWTService => {
  return {
    issueToken: vi.fn().mockResolvedValue({
      token: 'mock_access_token',
      jti: 'jti_123',
      expiresAt: new Date(Date.now() + 3600000),
      issuedAt: new Date(),
    } as IssuedToken),
    verifyToken: vi.fn().mockResolvedValue({
      claims: {
        sub: 'did:plc:test123',
        sessionId: 'sess_123',
        scope: 'read:preprints',
        jti: 'jti_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      payload: {},
      protectedHeader: { alg: 'ES256' },
    }),
    revokeToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as JWTService;
};

interface SessionMetadata {
  ipAddress: string;
  userAgent: string;
  scope?: string[];
}

const createMockSessionManager = (): SessionManager => {
  const sessions = new Map<string, Session>();

  return {
    createSession: vi.fn().mockImplementation((did: DID, metadata: SessionMetadata) => {
      const session: Session = {
        id: `sess_${Date.now()}`,
        did,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        lastActivity: new Date(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
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
  } as unknown as SessionManager;
};

const createMockRefreshTokenManager = (): RefreshTokenManager => {
  return {
    createToken: vi.fn().mockResolvedValue({
      token: 'mock_refresh_token',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

const createMockClientManager = (): OAuthClientManager => {
  const testClient: OAuthClient = {
    clientId: 'test_client_id',
    clientType: 'public',
    clientName: 'Test App',
    redirectUris: ['https://app.example.com/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    allowedScopes: ['read:preprints', 'write:reviews'],
    active: true,
    createdAt: new Date(),
  };

  return {
    getClient: vi.fn().mockResolvedValue(testClient),
    registerClient: vi.fn().mockResolvedValue({ client: testClient }),
    deactivateClient: vi.fn().mockResolvedValue(undefined),
    validateClient: vi.fn().mockResolvedValue(true),
    validateRedirectUri: vi.fn().mockResolvedValue(true),
    validateScopes: vi.fn().mockResolvedValue(['read:preprints']),
    rotateClientSecret: vi.fn().mockResolvedValue('new_secret'),
  } as unknown as OAuthClientManager;
};

describe('OAuthService', () => {
  let service: OAuthService;
  let logger: MockLogger;
  let redis: Redis;
  let jwtService: JWTService;
  let sessionManager: SessionManager;
  let refreshTokenManager: RefreshTokenManager;
  let clientManager: OAuthClientManager;

  const testDid = 'did:plc:test123' as DID;

  beforeEach(() => {
    logger = createMockLogger();
    redis = createMockRedis();
    jwtService = createMockJWTService();
    sessionManager = createMockSessionManager();
    refreshTokenManager = createMockRefreshTokenManager();
    clientManager = createMockClientManager();

    service = new OAuthService({
      redis,
      logger,
      jwtService,
      sessionManager,
      refreshTokenManager,
      clientManager,
      config: {
        codeExpirationSeconds: 600,
        accessTokenExpirationSeconds: 3600,
      },
    });
  });

  describe('createAuthorizationCode', () => {
    it('should create authorization code for valid request', async () => {
      const code = await service.createAuthorizationCode(
        {
          clientId: 'test_client_id',
          redirectUri: 'https://app.example.com/callback',
          responseType: 'code',
          scope: 'read:preprints',
          codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          codeChallengeMethod: 'S256',
        },
        testDid
      );

      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should reject invalid client', async () => {
      (clientManager.getClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(
        service.createAuthorizationCode(
          {
            clientId: 'invalid_client',
            redirectUri: 'https://evil.com/callback',
            responseType: 'code',
            codeChallenge: 'challenge',
            codeChallengeMethod: 'S256',
          },
          testDid
        )
      ).rejects.toThrow();
    });

    it('should reject invalid redirect URI', async () => {
      (clientManager.validateRedirectUri as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

      await expect(
        service.createAuthorizationCode(
          {
            clientId: 'test_client_id',
            redirectUri: 'https://evil.com/callback',
            responseType: 'code',
            codeChallenge: 'challenge',
            codeChallengeMethod: 'S256',
          },
          testDid
        )
      ).rejects.toThrow();
    });
  });

  describe('exchangeCode', () => {
    it('should exchange valid code for tokens', async () => {
      // Pre-store authorization code
      const storedCode = {
        code: 'test_auth_code',
        clientId: 'test_client_id',
        redirectUri: 'https://app.example.com/callback',
        did: testDid,
        scope: ['read:preprints'],
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        codeChallengeMethod: 'S256',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(storedCode));

      const tokens = await service.exchangeCode({
        grantType: 'authorization_code',
        clientId: 'test_client_id',
        code: 'test_auth_code',
        redirectUri: 'https://app.example.com/callback',
        codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.expiresIn).toBeGreaterThan(0);
    });

    it('should reject expired code', async () => {
      const expiredCode = {
        code: 'expired_code',
        clientId: 'test_client_id',
        redirectUri: 'https://app.example.com/callback',
        did: testDid,
        scope: ['read:preprints'],
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        createdAt: new Date(Date.now() - 700000).toISOString(),
        expiresAt: new Date(Date.now() - 100000).toISOString(),
        used: true,
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(expiredCode));

      await expect(
        service.exchangeCode({
          grantType: 'authorization_code',
          clientId: 'test_client_id',
          code: 'expired_code',
          redirectUri: 'https://app.example.com/callback',
          codeVerifier: 'verifier',
        })
      ).rejects.toThrow();
    });

    it('should reject code with wrong client', async () => {
      const storedCode = {
        code: 'test_code',
        clientId: 'original_client',
        redirectUri: 'https://app.example.com/callback',
        did: testDid,
        scope: ['read:preprints'],
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(storedCode));

      await expect(
        service.exchangeCode({
          grantType: 'authorization_code',
          clientId: 'different_client',
          code: 'test_code',
          redirectUri: 'https://app.example.com/callback',
          codeVerifier: 'verifier',
        })
      ).rejects.toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    it('should exchange refresh token for new access token', async () => {
      const tokens = await service.refreshAccessToken({
        grantType: 'refresh_token',
        clientId: 'test_client_id',
        refreshToken: 'valid_refresh_token',
      });

      expect(tokens.accessToken).toBeDefined();
      expect(refreshTokenManager.rotateToken).toHaveBeenCalledWith('valid_refresh_token');
    });

    it('should reject invalid refresh token', async () => {
      (refreshTokenManager.rotateToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Invalid token')
      );

      await expect(
        service.refreshAccessToken({
          grantType: 'refresh_token',
          clientId: 'test_client_id',
          refreshToken: 'invalid_token',
        })
      ).rejects.toThrow();
    });
  });

  describe('PKCE validation', () => {
    it('should validate S256 code challenge', async () => {
      // code_verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
      // code_challenge (S256): E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
      const storedCode = {
        code: 'pkce_test_code',
        clientId: 'test_client_id',
        redirectUri: 'https://app.example.com/callback',
        did: testDid,
        scope: ['read:preprints'],
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        codeChallengeMethod: 'S256',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(storedCode));

      const tokens = await service.exchangeCode({
        grantType: 'authorization_code',
        clientId: 'test_client_id',
        code: 'pkce_test_code',
        redirectUri: 'https://app.example.com/callback',
        codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      });

      expect(tokens.accessToken).toBeDefined();
    });

    it('should reject wrong code verifier', async () => {
      const storedCode = {
        code: 'pkce_test_code',
        clientId: 'test_client_id',
        redirectUri: 'https://app.example.com/callback',
        did: testDid,
        scope: ['read:preprints'],
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        codeChallengeMethod: 'S256',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      };

      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(storedCode));

      await expect(
        service.exchangeCode({
          grantType: 'authorization_code',
          clientId: 'test_client_id',
          code: 'pkce_test_code',
          redirectUri: 'https://app.example.com/callback',
          codeVerifier: 'wrong_verifier_value',
        })
      ).rejects.toThrow();
    });
  });

  describe('revokeToken', () => {
    it('should revoke refresh token', async () => {
      await service.revokeToken('some_refresh_token', 'refresh_token');

      expect(refreshTokenManager.revokeToken).toHaveBeenCalledWith('some_refresh_token');
    });

    it('should revoke access token', async () => {
      await service.revokeToken('some_access_token', 'access_token');

      expect(jwtService.verifyToken).toHaveBeenCalled();
      expect(jwtService.revokeToken).toHaveBeenCalled();
    });
  });
});
