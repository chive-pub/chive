/**
 * OAuth 2.0 authorization service.
 *
 * @remarks
 * Implements OAuth 2.0 authorization code flow with PKCE per RFC 6749 and RFC 7636.
 * Supports token issuance, refresh, and revocation.
 *
 * @packageDocumentation
 * @public
 */

import { randomBytes } from 'node:crypto';

import type { Redis } from 'ioredis';

import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { OAuthError, PKCEError } from '../errors.js';
import type { JWTService } from '../jwt/jwt-service.js';
import type { RefreshTokenManager } from '../session/refresh-token-manager.js';
import type { SessionManager } from '../session/session-manager.js';

import type { OAuthClientManager, OAuthClient } from './oauth-client.js';
import { verifyCodeChallenge, type CodeChallengeMethod } from './pkce.js';

/**
 * OAuth authorization request parameters.
 *
 * @public
 */
export interface AuthorizationRequest {
  /**
   * Client identifier.
   */
  readonly clientId: string;

  /**
   * Redirect URI for callback.
   */
  readonly redirectUri: string;

  /**
   * Response type (must be "code").
   */
  readonly responseType: 'code';

  /**
   * Requested scopes (space-separated).
   */
  readonly scope?: string;

  /**
   * State parameter for CSRF protection.
   */
  readonly state?: string;

  /**
   * PKCE code challenge.
   */
  readonly codeChallenge: string;

  /**
   * PKCE challenge method (must be S256).
   */
  readonly codeChallengeMethod: CodeChallengeMethod;
}

/**
 * Stored authorization code data.
 */
interface AuthorizationCode {
  readonly code: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly did: DID;
  readonly scope: readonly string[];
  readonly codeChallenge: string;
  readonly codeChallengeMethod: CodeChallengeMethod;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly used?: boolean;
}

/**
 * Token request parameters.
 *
 * @public
 */
export interface TokenRequest {
  /**
   * Grant type.
   */
  readonly grantType: 'authorization_code' | 'refresh_token' | 'client_credentials';

  /**
   * Client identifier.
   */
  readonly clientId: string;

  /**
   * Client secret (confidential clients).
   */
  readonly clientSecret?: string;

  /**
   * Authorization code (authorization_code grant).
   */
  readonly code?: string;

  /**
   * Redirect URI (authorization_code grant).
   */
  readonly redirectUri?: string;

  /**
   * PKCE code verifier.
   */
  readonly codeVerifier?: string;

  /**
   * Refresh token (refresh_token grant).
   */
  readonly refreshToken?: string;

  /**
   * Requested scopes.
   */
  readonly scope?: string;
}

/**
 * Token response.
 *
 * @public
 */
export interface TokenResponse {
  /**
   * Access token.
   */
  readonly accessToken: string;

  /**
   * Token type (always "Bearer").
   */
  readonly tokenType: 'Bearer';

  /**
   * Token expiration in seconds.
   */
  readonly expiresIn: number;

  /**
   * Refresh token (if granted).
   */
  readonly refreshToken?: string;

  /**
   * Granted scopes (space-separated).
   */
  readonly scope: string;
}

/**
 * OAuth service configuration.
 *
 * @public
 */
export interface OAuthServiceConfig {
  /**
   * Authorization code prefix.
   *
   * @defaultValue 'chive:oauth:code:'
   */
  readonly codePrefix?: string;

  /**
   * Authorization code expiration in seconds.
   *
   * @defaultValue 600 (10 minutes)
   */
  readonly codeExpirationSeconds?: number;

  /**
   * Access token expiration in seconds.
   *
   * @defaultValue 3600 (1 hour)
   */
  readonly accessTokenExpirationSeconds?: number;
}

/**
 * OAuth service options.
 *
 * @public
 */
export interface OAuthServiceOptions {
  /**
   * Redis client.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * JWT service for token issuance.
   */
  readonly jwtService: JWTService;

  /**
   * Session manager.
   */
  readonly sessionManager: SessionManager;

  /**
   * Refresh token manager.
   */
  readonly refreshTokenManager: RefreshTokenManager;

  /**
   * OAuth client manager.
   */
  readonly clientManager: OAuthClientManager;

  /**
   * Configuration options.
   */
  readonly config?: OAuthServiceConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<OAuthServiceConfig> = {
  codePrefix: 'chive:oauth:code:',
  codeExpirationSeconds: 600,
  accessTokenExpirationSeconds: 3600,
};

/**
 * OAuth 2.0 authorization service.
 *
 * @remarks
 * Implements the OAuth 2.0 authorization code flow with PKCE.
 * All public clients must use PKCE for security.
 *
 * @example
 * ```typescript
 * const oauthService = new OAuthService({
 *   redis,
 *   logger,
 *   jwtService,
 *   sessionManager,
 *   refreshTokenManager,
 *   clientManager,
 * });
 *
 * // Start authorization
 * const code = await oauthService.createAuthorizationCode(
 *   authRequest,
 *   userDid
 * );
 *
 * // Exchange code for tokens
 * const tokens = await oauthService.exchangeCode(tokenRequest);
 * ```
 *
 * @public
 */
export class OAuthService {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly jwtService: JWTService;
  private readonly sessionManager: SessionManager;
  private readonly refreshTokenManager: RefreshTokenManager;
  private readonly clientManager: OAuthClientManager;
  private readonly config: Required<OAuthServiceConfig>;

  /**
   * Creates a new OAuthService.
   *
   * @param options - Service options
   */
  constructor(options: OAuthServiceOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.jwtService = options.jwtService;
    this.sessionManager = options.sessionManager;
    this.refreshTokenManager = options.refreshTokenManager;
    this.clientManager = options.clientManager;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Validates an authorization request.
   *
   * @param request - Authorization request
   * @returns Validated client
   * @throws OAuthError if request is invalid
   */
  async validateAuthorizationRequest(request: AuthorizationRequest): Promise<OAuthClient> {
    // Validate response type
    if (request.responseType !== 'code') {
      throw new OAuthError('unsupported_grant_type', 'Only authorization_code flow is supported');
    }

    // Validate client
    const client = await this.clientManager.getClient(request.clientId);
    if (!client?.active) {
      throw new OAuthError('invalid_client', 'Client not found or inactive');
    }

    // Validate redirect URI
    const redirectValid = await this.clientManager.validateRedirectUri(
      request.clientId,
      request.redirectUri
    );
    if (!redirectValid) {
      throw new OAuthError('invalid_request', 'Invalid redirect_uri');
    }

    // Validate PKCE (required for public clients)
    if (client.clientType === 'public') {
      if (!request.codeChallenge) {
        throw new PKCEError('missing_challenge', 'PKCE is required for public clients');
      }
      if (request.codeChallengeMethod !== 'S256') {
        throw new PKCEError('method_not_supported', 'Only S256 challenge method is supported');
      }
    }

    // Validate grant type
    if (!client.grantTypes.includes('authorization_code')) {
      throw new OAuthError(
        'unauthorized_client',
        'Client not authorized for authorization_code grant'
      );
    }

    return client;
  }

  /**
   * Creates an authorization code.
   *
   * @remarks
   * Called after user authenticates and consents to the authorization request.
   *
   * @param request - Authorization request
   * @param did - Authenticated user's DID
   * @returns Authorization code
   */
  async createAuthorizationCode(request: AuthorizationRequest, did: DID): Promise<string> {
    // Validate request first
    await this.validateAuthorizationRequest(request);

    // Validate and filter scopes
    const requestedScopes = request.scope?.split(' ').filter(Boolean) ?? [];
    const grantedScopes = await this.clientManager.validateScopes(
      request.clientId,
      requestedScopes
    );

    const code = this.generateCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.codeExpirationSeconds * 1000);

    const authCode: AuthorizationCode = {
      code,
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      did,
      scope: grantedScopes,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod,
      createdAt: now,
      expiresAt,
    };

    // Store code
    const codeKey = `${this.config.codePrefix}${code}`;
    await this.redis.setex(
      codeKey,
      this.config.codeExpirationSeconds,
      JSON.stringify({
        ...authCode,
        createdAt: authCode.createdAt.toISOString(),
        expiresAt: authCode.expiresAt.toISOString(),
      })
    );

    this.logger.info('Authorization code created', {
      clientId: request.clientId,
      did,
      scopes: grantedScopes,
    });

    return code;
  }

  /**
   * Exchanges an authorization code for tokens.
   *
   * @param request - Token request
   * @returns Token response
   * @throws OAuthError if exchange fails
   */
  async exchangeCode(request: TokenRequest): Promise<TokenResponse> {
    if (request.grantType !== 'authorization_code') {
      throw new OAuthError('unsupported_grant_type', 'Expected authorization_code grant');
    }

    if (!request.code || !request.redirectUri) {
      throw new OAuthError('invalid_request', 'Missing code or redirect_uri');
    }

    // Validate client
    const clientValid = await this.clientManager.validateClient(
      request.clientId,
      request.clientSecret
    );
    if (!clientValid) {
      throw new OAuthError('invalid_client', 'Invalid client credentials');
    }

    // Get and validate code
    const codeKey = `${this.config.codePrefix}${request.code}`;
    const codeData = await this.redis.get(codeKey);

    if (!codeData) {
      throw new OAuthError('invalid_grant', 'Authorization code not found or expired');
    }

    const stored = JSON.parse(codeData) as AuthorizationCode & {
      createdAt: string;
      expiresAt: string;
    };

    // Validate code hasn't been used
    if (stored.used) {
      // Code reuse detected; revoke all tokens for this authorization
      this.logger.warn('Authorization code reuse detected', {
        clientId: stored.clientId,
        did: stored.did,
      });
      await this.redis.del(codeKey);
      throw new OAuthError('invalid_grant', 'Authorization code has already been used');
    }

    // Mark code as used immediately
    await this.redis.setex(
      codeKey,
      60, // Keep for 1 minute to detect replay
      JSON.stringify({ ...stored, used: true })
    );

    // Validate redirect URI matches
    if (stored.redirectUri !== request.redirectUri) {
      throw new OAuthError('invalid_grant', 'redirect_uri mismatch');
    }

    // Validate client ID matches
    if (stored.clientId !== request.clientId) {
      throw new OAuthError('invalid_grant', 'Client ID mismatch');
    }

    // Validate PKCE
    if (!request.codeVerifier) {
      throw new PKCEError('invalid_verifier', 'Missing code_verifier');
    }

    const pkceValid = verifyCodeChallenge(
      request.codeVerifier,
      stored.codeChallenge,
      stored.codeChallengeMethod
    );

    if (!pkceValid) {
      throw new PKCEError('invalid_verifier', 'PKCE verification failed');
    }

    // Create session and tokens
    return this.issueTokens(stored.did, stored.scope, request.clientId);
  }

  /**
   * Refreshes an access token.
   *
   * @param request - Token request with refresh token
   * @returns New token response
   */
  async refreshAccessToken(request: TokenRequest): Promise<TokenResponse> {
    if (request.grantType !== 'refresh_token') {
      throw new OAuthError('unsupported_grant_type', 'Expected refresh_token grant');
    }

    if (!request.refreshToken) {
      throw new OAuthError('invalid_request', 'Missing refresh_token');
    }

    // Validate client
    const clientValid = await this.clientManager.validateClient(
      request.clientId,
      request.clientSecret
    );
    if (!clientValid) {
      throw new OAuthError('invalid_client', 'Invalid client credentials');
    }

    // Rotate refresh token
    const { data, newToken } = await this.refreshTokenManager.rotateToken(request.refreshToken);

    // Issue new access token
    const { token: accessToken } = await this.jwtService.issueToken({
      subject: data.did,
      sessionId: data.sessionId,
      expirationSeconds: this.config.accessTokenExpirationSeconds,
    });

    this.logger.info('Access token refreshed', {
      clientId: request.clientId,
      did: data.did,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenExpirationSeconds,
      refreshToken: newToken.token,
      scope: '', // Scopes remain unchanged
    };
  }

  /**
   * Revokes a token.
   *
   * @param token - Token to revoke (access or refresh)
   * @param tokenTypeHint - Token type hint
   */
  async revokeToken(
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token'
  ): Promise<void> {
    if (tokenTypeHint === 'refresh_token' || !tokenTypeHint) {
      try {
        await this.refreshTokenManager.revokeToken(token);
        return;
      } catch {
        // Token might be access token
      }
    }

    if (tokenTypeHint === 'access_token' || !tokenTypeHint) {
      try {
        const { claims } = await this.jwtService.verifyToken(token);
        await this.jwtService.revokeToken(claims.jti, new Date(claims.exp * 1000));
      } catch {
        // Token might already be revoked or invalid
      }
    }
  }

  /**
   * Issues tokens for an authenticated user.
   *
   * @param did - User's DID
   * @param scopes - Granted scopes
   * @param clientId - Client identifier
   * @returns Token response
   */
  private async issueTokens(
    did: DID,
    scopes: readonly string[],
    clientId: string
  ): Promise<TokenResponse> {
    // Create session
    const session = await this.sessionManager.createSession(did, {
      ipAddress: 'oauth', // Set by middleware
      userAgent: `OAuth client: ${clientId}`,
      scope: scopes,
    });

    // Issue access token
    const { token: accessToken } = await this.jwtService.issueToken({
      subject: did,
      sessionId: session.id,
      scopes,
      expirationSeconds: this.config.accessTokenExpirationSeconds,
    });

    // Issue refresh token
    const { token: refreshToken } = await this.refreshTokenManager.createToken(session.id, did);

    this.logger.info('OAuth tokens issued', {
      clientId,
      did,
      sessionId: session.id,
      scopes,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenExpirationSeconds,
      refreshToken,
      scope: scopes.join(' '),
    };
  }

  /**
   * Generates a cryptographically secure authorization code.
   *
   * @returns Authorization code string
   */
  private generateCode(): string {
    return randomBytes(32).toString('base64url');
  }
}
