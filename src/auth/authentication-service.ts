/**
 * Main authentication service orchestrating all auth components.
 *
 * @remarks
 * Provides a unified interface for authentication operations:
 * - DID-based authentication
 * - Session management
 * - Token refresh and revocation
 * - MFA verification (when enabled)
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';
import { authenticator } from 'otplib';

import type { DID } from '../types/atproto.js';
import type {
  IAuthenticationService,
  AuthCredential,
  SessionToken,
  TokenOptions,
  TokenClaims,
  AuthenticationResult,
  MFAChallenge,
  MFAMethod,
} from '../types/interfaces/auth.interface.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';
import type { ISessionManager, SessionMetadata } from '../types/interfaces/session.interface.js';

import type { DIDResolver } from './did/did-resolver.js';
import { RefreshTokenError, MFAVerificationError } from './errors.js';
import type { JWTService } from './jwt/jwt-service.js';
import type { RefreshTokenManager } from './session/refresh-token-manager.js';

/**
 * Authentication service configuration.
 *
 * @public
 */
export interface AuthenticationServiceConfig {
  /**
   * Whether MFA is required for all authentications.
   *
   * @defaultValue false
   */
  readonly mfaRequired?: boolean;

  /**
   * Access token expiration in seconds.
   *
   * @defaultValue 3600
   */
  readonly accessTokenExpirationSeconds?: number;

  /**
   * Maximum sessions per user.
   *
   * @defaultValue 10
   */
  readonly maxSessionsPerUser?: number;
}

/**
 * Authentication service options.
 *
 * @public
 */
export interface AuthenticationServiceOptions {
  /**
   * Redis client.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * DID resolver.
   */
  readonly didResolver: DIDResolver;

  /**
   * JWT service.
   */
  readonly jwtService: JWTService;

  /**
   * Session manager.
   */
  readonly sessionManager: ISessionManager;

  /**
   * Refresh token manager.
   */
  readonly refreshTokenManager: RefreshTokenManager;

  /**
   * Configuration options.
   */
  readonly config?: AuthenticationServiceConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<AuthenticationServiceConfig> = {
  mfaRequired: false,
  accessTokenExpirationSeconds: 3600,
  maxSessionsPerUser: 10,
};

/**
 * Main authentication service.
 *
 * @remarks
 * Orchestrates DID resolution, verification, session management,
 * and token issuance for a complete authentication flow.
 *
 * @example
 * ```typescript
 * const authService = new AuthenticationService({
 *   redis,
 *   logger,
 *   didResolver,
 *   jwtService,
 *   sessionManager,
 *   refreshTokenManager,
 * });
 *
 * // Authenticate with PDS token
 * const result = await authService.authenticateWithDID(
 *   'did:plc:abc123',
 *   { type: 'pds_token', value: pdsToken }
 * );
 *
 * if (result.success) {
 *   // Use result.sessionToken
 * } else if (result.mfaRequired) {
 *   // Handle MFA challenge
 * }
 * ```
 *
 * @public
 */
export class AuthenticationService implements IAuthenticationService {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly didResolver: DIDResolver;
  private readonly jwtService: JWTService;
  private readonly sessionManager: ISessionManager;
  private readonly refreshTokenManager: RefreshTokenManager;
  private readonly config: Required<AuthenticationServiceConfig>;

  /**
   * Creates a new AuthenticationService.
   *
   * @param options - Service options
   */
  constructor(options: AuthenticationServiceOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.didResolver = options.didResolver;
    this.jwtService = options.jwtService;
    this.sessionManager = options.sessionManager;
    this.refreshTokenManager = options.refreshTokenManager;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Authenticates a user via DID and credential verification.
   *
   * @param did - User's DID
   * @param credential - Authentication credential
   * @returns Authentication result
   */
  async authenticateWithDID(did: DID, credential: AuthCredential): Promise<AuthenticationResult> {
    this.logger.info('Authentication attempt', { did, credentialType: credential.type });

    // Resolve DID document
    const didDocument = await this.didResolver.resolveDID(did);
    if (!didDocument) {
      this.logger.warn('DID resolution failed', { did });
      return {
        success: false,
        errors: ['DID resolution failed'],
      };
    }

    // Verify credential based on type
    const verified = await this.verifyCredential(did, credential, didDocument);

    if (!verified) {
      this.logger.warn('Authentication failed', { did, credentialType: credential.type });
      return {
        success: false,
        errors: ['Invalid credentials'],
      };
    }

    // Check if MFA is required
    const mfaRequired = await this.checkMFARequired(did);

    if (mfaRequired) {
      const challenge = await this.createMFAChallenge(did);

      this.logger.info('MFA required', { did, challengeId: challenge.challengeId });

      return {
        success: false,
        did,
        mfaRequired: true,
        mfaChallenge: challenge,
      };
    }

    // Create session and tokens
    const sessionToken = await this.issueSessionToken(did);

    this.logger.info('Authentication successful', { did });

    return {
      success: true,
      did,
      sessionToken,
    };
  }

  /**
   * Issues a session token for an authenticated user.
   *
   * @param did - User's DID
   * @param options - Token options
   * @returns Session token
   */
  async issueSessionToken(did: DID, options?: TokenOptions): Promise<SessionToken> {
    const sessionMetadata: SessionMetadata = {
      ipAddress: 'unknown', // Set by middleware
      userAgent: 'unknown', // Set by middleware
      scope: options?.scope ? [...options.scope] : undefined,
    };

    // Use existing session or create new one
    let sessionId = options?.sessionId;
    if (!sessionId) {
      const session = await this.sessionManager.createSession(did, sessionMetadata);
      sessionId = session.id;
    }

    const scopes = options?.scope ? [...options.scope] : [];
    const expiresIn = options?.expiresIn ?? this.config.accessTokenExpirationSeconds;

    // Issue access token
    const { token: accessToken } = await this.jwtService.issueToken({
      subject: did,
      sessionId,
      scopes,
      expirationSeconds: expiresIn,
    });

    // Issue refresh token (if requested)
    let refreshToken: string | undefined;
    if (options?.includeRefreshToken !== false) {
      const { token } = await this.refreshTokenManager.createToken(sessionId, did);
      refreshToken = token;
    }

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      scope: scopes,
    };
  }

  /**
   * Refreshes an access token using a refresh token.
   *
   * @param refreshToken - Refresh token
   * @returns New session token
   */
  async refreshToken(refreshToken: string): Promise<SessionToken> {
    // Rotate refresh token
    const { data, newToken } = await this.refreshTokenManager.rotateToken(refreshToken);

    // Verify session still exists
    const session = await this.sessionManager.getSession(data.sessionId);
    if (!session) {
      throw new RefreshTokenError('invalid', 'Session no longer exists');
    }

    // Issue new access token
    const { token: accessToken } = await this.jwtService.issueToken({
      subject: data.did,
      sessionId: data.sessionId,
      scopes: session.scope,
      expirationSeconds: this.config.accessTokenExpirationSeconds,
    });

    this.logger.info('Token refreshed', {
      did: data.did,
      sessionId: data.sessionId,
    });

    return {
      accessToken,
      refreshToken: newToken.token,
      expiresIn: this.config.accessTokenExpirationSeconds,
      tokenType: 'Bearer',
      scope: session.scope,
    };
  }

  /**
   * Revokes a token.
   *
   * @param token - Access or refresh token to revoke
   */
  async revokeToken(token: string): Promise<void> {
    // Try to revoke as refresh token first
    try {
      await this.refreshTokenManager.revokeToken(token);
      this.logger.info('Refresh token revoked');
      return;
    } catch {
      // Not a refresh token, try as access token
    }

    // Try to revoke as access token
    try {
      const { claims } = await this.jwtService.verifyToken(token);
      await this.jwtService.revokeToken(claims.jti, new Date(claims.exp * 1000));
      this.logger.info('Access token revoked', { jti: claims.jti });
    } catch {
      // Token might already be revoked or invalid (that's OK)
      this.logger.debug('Token revocation: token may already be invalid');
    }
  }

  /**
   * Verifies a token and returns its claims.
   *
   * @param token - JWT access token
   * @returns Token claims
   */
  async verifyToken(token: string): Promise<TokenClaims> {
    const { claims } = await this.jwtService.verifyToken(token);
    return claims;
  }

  /**
   * Completes an MFA challenge.
   *
   * @param challengeId - Challenge ID
   * @param method - MFA method used
   * @param value - MFA code or credential
   * @returns Authentication result
   */
  async completeMFAChallenge(
    challengeId: string,
    method: 'totp' | 'webauthn' | 'backup_code',
    value: string
  ): Promise<AuthenticationResult> {
    const challengeKey = `chive:mfa:challenge:${challengeId}`;
    const challengeData = await this.redis.get(challengeKey);

    if (!challengeData) {
      throw new MFAVerificationError(method, 'Challenge expired or not found');
    }

    const { did, methods } = JSON.parse(challengeData) as {
      did: DID;
      methods: string[];
    };

    if (!methods.includes(method)) {
      throw new MFAVerificationError(method, 'MFA method not available for this user');
    }

    // Verify MFA based on method
    const verified = await this.verifyMFA(did, method, value);

    if (!verified) {
      throw new MFAVerificationError(method, 'Invalid MFA code');
    }

    // Delete challenge (single use)
    await this.redis.del(challengeKey);

    // Issue session token
    const sessionToken = await this.issueSessionToken(did);

    this.logger.info('MFA verification successful', { did, method });

    return {
      success: true,
      did,
      sessionToken,
    };
  }

  /**
   * Verifies credentials against DID document.
   *
   * @param did - User's DID
   * @param credential - Credential to verify
   * @param didDocument - DID document
   * @returns True if credential is valid
   */
  private async verifyCredential(
    did: DID,
    credential: AuthCredential,
    didDocument: unknown
  ): Promise<boolean> {
    switch (credential.type) {
      case 'pds_token':
        return this.verifyPDSToken(did, credential.value, didDocument);

      case 'webauthn':
        // WebAuthn verification handled separately via MFA
        return false;

      case 'password':
      case 'app_password':
        // Password authentication not recommended; verify with PDS
        this.logger.warn('Password authentication attempted (not recommended)', { did });
        return false;

      default:
        return false;
    }
  }

  /**
   * Verifies a PDS session token.
   *
   * @param did - User's DID
   * @param token - PDS token
   * @param didDocument - DID document
   * @returns True if token is valid
   */
  private async verifyPDSToken(did: DID, token: string, didDocument: unknown): Promise<boolean> {
    try {
      // Get PDS endpoint from DID document
      const pdsService = this.extractPDSService(didDocument);
      if (!pdsService) {
        return false;
      }

      // Verify token with PDS
      const response = await fetch(`${pdsService}/xrpc/com.atproto.server.getSession`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return false;
      }

      const session = (await response.json()) as { did: string };
      return session.did === did;
    } catch (error) {
      this.logger.warn('PDS token verification failed', {
        did,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Extracts PDS service endpoint from DID document.
   *
   * @param didDocument - DID document
   * @returns PDS endpoint URL or null
   */
  private extractPDSService(didDocument: unknown): string | null {
    if (!didDocument || typeof didDocument !== 'object') {
      return null;
    }

    const doc = didDocument as { service?: { id: string; serviceEndpoint: string }[] };
    const service = doc.service?.find(
      (s) => s.id === '#atproto_pds' || s.id.endsWith('#atproto_pds')
    );

    return service?.serviceEndpoint ?? null;
  }

  /**
   * Checks if MFA is required for a user.
   *
   * @param did - User's DID
   * @returns True if MFA is required
   */
  private async checkMFARequired(did: DID): Promise<boolean> {
    if (!this.config.mfaRequired) {
      return false;
    }

    // Check if user has MFA enrolled
    const mfaKey = `chive:mfa:enrolled:${did}`;
    const enrolled = await this.redis.get(mfaKey);

    return enrolled === '1';
  }

  /**
   * Creates an MFA challenge for a user.
   *
   * @param did - User's DID
   * @returns MFA challenge
   */
  private async createMFAChallenge(did: DID): Promise<MFAChallenge> {
    const challengeId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes

    // Get available methods for user
    const methods = await this.getMFAMethods(did);

    // Store challenge
    const challengeKey = `chive:mfa:challenge:${challengeId}`;
    await this.redis.setex(
      challengeKey,
      300,
      JSON.stringify({
        did,
        methods: methods.map((m) => m.type),
        createdAt: new Date().toISOString(),
      })
    );

    return {
      challengeId,
      methods,
      expiresAt,
    };
  }

  /**
   * Gets available MFA methods for a user.
   *
   * @param did - User's DID
   * @returns Array of available methods
   */
  private async getMFAMethods(did: DID): Promise<MFAMethod[]> {
    const methods: MFAMethod[] = [];

    // Check TOTP
    const totpKey = `chive:mfa:totp:${did}`;
    if (await this.redis.exists(totpKey)) {
      methods.push({
        type: 'totp',
        id: 'totp_default',
        name: 'Authenticator app',
      });
    }

    // Check WebAuthn credentials
    const webauthnKey = `chive:webauthn:credentials:${did}`;
    const credentials = await this.redis.smembers(webauthnKey);
    for (const credId of credentials) {
      methods.push({
        type: 'webauthn',
        id: credId,
        name: 'Security key',
      });
    }

    // Backup codes always available if any MFA enrolled
    if (methods.length > 0) {
      methods.push({
        type: 'backup_code',
        id: 'backup_codes',
        name: 'Backup code',
      });
    }

    return methods;
  }

  /**
   * Verifies MFA based on method.
   *
   * @param did - User's DID
   * @param method - MFA method
   * @param value - MFA code/credential
   * @returns True if verification succeeds
   */
  private async verifyMFA(
    did: DID,
    method: 'totp' | 'webauthn' | 'backup_code',
    value: string
  ): Promise<boolean> {
    switch (method) {
      case 'totp':
        return this.verifyTOTP(did, value);

      case 'backup_code':
        return this.verifyBackupCode(did, value);

      case 'webauthn':
        // WebAuthn verification requires separate handling with challenge
        return false;

      default:
        return false;
    }
  }

  /**
   * Verifies a TOTP code.
   *
   * @param did - User's DID
   * @param code - TOTP code
   * @returns True if valid
   *
   * @remarks
   * Uses otplib authenticator for RFC 6238 TOTP verification.
   * The verification allows for a 30-second time window by default.
   */
  private async verifyTOTP(did: DID, code: string): Promise<boolean> {
    const totpKey = `chive:mfa:totp:${did}`;
    const totpData = await this.redis.get(totpKey);

    if (!totpData) {
      this.logger.warn('TOTP secret not found for DID', { did });
      return false;
    }

    // Parse the stored TOTP data (stored by MFA service as JSON)
    const parsed = JSON.parse(totpData) as { secret: string; enrolledAt?: string };
    const secret = parsed.secret;

    if (!secret) {
      this.logger.warn('TOTP secret is empty for DID', { did });
      return false;
    }

    // Normalize the code (remove spaces/dashes)
    const normalizedCode = code.replace(/[\s-]/g, '');

    // Verify using otplib authenticator (RFC 6238 compliant)
    // Uses 30-second time step by default
    const isValid = authenticator.verify({ token: normalizedCode, secret });

    if (isValid) {
      // Track successful verification for rate limiting
      const successKey = `chive:mfa:success:${did}`;
      await this.redis.incr(successKey);
      await this.redis.expire(successKey, 3600);

      this.logger.debug('TOTP verification successful', { did });
    } else {
      this.logger.debug('TOTP verification failed', { did });
    }

    return isValid;
  }

  /**
   * Verifies a backup code.
   *
   * @param did - User's DID
   * @param code - Backup code
   * @returns True if valid
   */
  private async verifyBackupCode(did: DID, code: string): Promise<boolean> {
    const backupKey = `chive:mfa:backup:${did}`;
    const codes = await this.redis.smembers(backupKey);

    const normalizedCode = code.replace(/\s/g, '').toLowerCase();

    if (codes.includes(normalizedCode)) {
      // Remove used code
      await this.redis.srem(backupKey, normalizedCode);
      this.logger.info('Backup code used', { did });
      return true;
    }

    return false;
  }
}
