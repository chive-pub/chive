/**
 * JWT service for token issuance and verification.
 *
 * @remarks
 * Implements ES256 JWT operations using the jose library.
 * Supports access tokens with configurable claims and expiration.
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';
import * as jose from 'jose';

import type { DID } from '../../types/atproto.js';
import type { TokenClaims } from '../../types/interfaces/auth.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { TokenValidationError, TokenExpiredError } from '../errors.js';

import type { KeyManager } from './key-manager.js';

/**
 * JWT service configuration.
 *
 * @public
 */
export interface JWTServiceConfig {
  /**
   * Token issuer (iss claim).
   *
   * @defaultValue 'https://chive.pub'
   */
  readonly issuer?: string;

  /**
   * Token audience (aud claim).
   *
   * @defaultValue 'https://chive.pub'
   */
  readonly audience?: string;

  /**
   * Access token expiration in seconds.
   *
   * @defaultValue 3600 (1 hour)
   */
  readonly accessTokenExpirationSeconds?: number;

  /**
   * Clock tolerance for verification in seconds.
   *
   * @defaultValue 30
   */
  readonly clockToleranceSeconds?: number;

  /**
   * Redis key prefix for revoked tokens.
   *
   * @defaultValue 'chive:jwt:revoked:'
   */
  readonly revokedTokenPrefix?: string;
}

/**
 * JWT service options.
 *
 * @public
 */
export interface JWTServiceOptions {
  /**
   * Key manager for signing keys.
   */
  readonly keyManager: KeyManager;

  /**
   * Redis client for token revocation.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config?: JWTServiceConfig;
}

/**
 * Token issuance options.
 *
 * @public
 */
export interface IssueTokenOptions {
  /**
   * Subject (user DID).
   */
  readonly subject: DID;

  /**
   * Session ID to associate with token.
   */
  readonly sessionId: string;

  /**
   * Scopes to include in token.
   */
  readonly scopes?: readonly string[];

  /**
   * Custom claims to include.
   */
  readonly customClaims?: Readonly<Record<string, unknown>>;

  /**
   * Custom expiration in seconds (overrides config).
   */
  readonly expirationSeconds?: number;
}

/**
 * Issued token result.
 *
 * @public
 */
export interface IssuedToken {
  /**
   * The signed JWT string.
   */
  readonly token: string;

  /**
   * Token ID (jti claim).
   */
  readonly jti: string;

  /**
   * Token expiration timestamp.
   */
  readonly expiresAt: Date;

  /**
   * Token issuance timestamp.
   */
  readonly issuedAt: Date;
}

/**
 * Verified token result.
 *
 * @public
 */
export interface VerifiedToken {
  /**
   * Parsed token claims.
   */
  readonly claims: TokenClaims;

  /**
   * Raw JWT payload.
   */
  readonly payload: jose.JWTPayload;

  /**
   * Protected header with algorithm and key ID.
   */
  readonly protectedHeader: {
    readonly alg: string;
    readonly kid?: string;
  };
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<JWTServiceConfig> = {
  issuer: 'https://chive.pub',
  audience: 'https://chive.pub',
  accessTokenExpirationSeconds: 3600, // 1 hour
  clockToleranceSeconds: 30,
  revokedTokenPrefix: 'chive:jwt:revoked:',
};

/**
 * JWT service for token operations.
 *
 * @remarks
 * Provides secure JWT issuance and verification using ES256 algorithm.
 * Supports token revocation via Redis blacklist.
 *
 * @example
 * ```typescript
 * const jwtService = new JWTService({
 *   keyManager,
 *   redis,
 *   logger,
 * });
 *
 * // Issue a token
 * const { token } = await jwtService.issueToken({
 *   subject: 'did:plc:abc123',
 *   sessionId: 'sess_xyz',
 *   scopes: ['read', 'write'],
 * });
 *
 * // Verify a token
 * const { claims } = await jwtService.verifyToken(token);
 * ```
 *
 * @public
 */
export class JWTService {
  private readonly keyManager: KeyManager;
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<JWTServiceConfig>;

  /**
   * Creates a new JWTService.
   *
   * @param options - Service options
   */
  constructor(options: JWTServiceOptions) {
    this.keyManager = options.keyManager;
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Issues a new access token.
   *
   * @param options - Token issuance options
   * @returns Issued token with metadata
   */
  async issueToken(options: IssueTokenOptions): Promise<IssuedToken> {
    const key = await this.keyManager.getCurrentKey();
    const jti = this.generateTokenId();
    const now = new Date();
    const expirationSeconds = options.expirationSeconds ?? this.config.accessTokenExpirationSeconds;
    const expiresAt = new Date(now.getTime() + expirationSeconds * 1000);

    const payload: jose.JWTPayload = {
      sub: options.subject,
      iss: this.config.issuer,
      aud: this.config.audience,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      jti,
      sessionId: options.sessionId,
      scope: options.scopes?.join(' '),
      ...options.customClaims,
    };

    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'ES256', kid: key.kid })
      .sign(key.privateKey);

    this.logger.debug('JWT issued', {
      jti,
      subject: options.subject,
      sessionId: options.sessionId,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      token,
      jti,
      expiresAt,
      issuedAt: now,
    };
  }

  /**
   * Verifies a token and returns its claims.
   *
   * @param token - JWT string to verify
   * @returns Verified token with claims
   * @throws TokenValidationError if token is invalid
   * @throws TokenExpiredError if token has expired
   */
  async verifyToken(token: string): Promise<VerifiedToken> {
    // Decode header to get kid
    const protectedHeader = jose.decodeProtectedHeader(token);

    if (protectedHeader.alg !== 'ES256') {
      throw new TokenValidationError(
        'invalid_signature',
        `Unsupported algorithm: ${protectedHeader.alg}`
      );
    }

    if (!protectedHeader.kid) {
      throw new TokenValidationError('invalid_signature', 'Missing kid in token header');
    }

    // Get the key for verification
    const key = await this.keyManager.getKey(protectedHeader.kid);
    if (!key) {
      throw new TokenValidationError('invalid_signature', `Unknown key ID: ${protectedHeader.kid}`);
    }

    try {
      const { payload } = await jose.jwtVerify(token, key.publicKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        clockTolerance: this.config.clockToleranceSeconds,
      });

      // Check if token is revoked
      if (payload.jti) {
        const isRevoked = await this.isTokenRevoked(payload.jti);
        if (isRevoked) {
          throw new TokenValidationError('revoked', 'Token has been revoked');
        }
      }

      const claims = this.extractClaims(payload);

      return {
        claims,
        payload,
        protectedHeader: {
          alg: protectedHeader.alg ?? 'ES256',
          kid: protectedHeader.kid,
        },
      };
    } catch (error) {
      if (error instanceof TokenValidationError) {
        throw error;
      }

      if (error instanceof jose.errors.JWTExpired) {
        const expiredAt = error.claim ? new Date(Number(error.claim) * 1000) : new Date();
        throw new TokenExpiredError(expiredAt);
      }

      if (error instanceof jose.errors.JWTClaimValidationFailed) {
        throw new TokenValidationError(
          'invalid_claims',
          `Claim validation failed: ${error.message}`
        );
      }

      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        throw new TokenValidationError('invalid_signature', 'Signature verification failed');
      }

      throw new TokenValidationError(
        'invalid_token',
        error instanceof Error ? error.message : 'Token verification failed'
      );
    }
  }

  /**
   * Revokes a token by its JTI.
   *
   * @param jti - Token ID to revoke
   * @param expiresAt - Token expiration (for TTL calculation)
   */
  async revokeToken(jti: string, expiresAt: Date): Promise<void> {
    const ttl = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    await this.redis.setex(`${this.config.revokedTokenPrefix}${jti}`, ttl, '1');

    this.logger.info('Token revoked', { jti });
  }

  /**
   * Checks if a token is revoked.
   *
   * @param jti - Token ID to check
   * @returns True if token is revoked
   */
  async isTokenRevoked(jti: string): Promise<boolean> {
    const result = await this.redis.get(`${this.config.revokedTokenPrefix}${jti}`);
    return result !== null;
  }

  /**
   * Gets the JWKS for public key distribution.
   *
   * @returns JWKS containing all valid public keys
   */
  async getJWKS(): Promise<jose.JSONWebKeySet> {
    return this.keyManager.getJWKS();
  }

  /**
   * Extracts typed claims from JWT payload.
   *
   * @param payload - Raw JWT payload
   * @returns Typed token claims
   */
  private extractClaims(payload: jose.JWTPayload): TokenClaims {
    if (!payload.sub) {
      throw new TokenValidationError('invalid_claims', 'Missing subject claim');
    }

    if (!payload.jti) {
      throw new TokenValidationError('invalid_claims', 'Missing jti claim');
    }

    const sessionId = payload.sessionId;
    if (typeof sessionId !== 'string') {
      throw new TokenValidationError('invalid_claims', 'Missing or invalid sessionId claim');
    }

    const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];

    return {
      sub: payload.sub as DID,
      iss: payload.iss ?? this.config.issuer,
      aud:
        typeof payload.aud === 'string' ? payload.aud : (payload.aud?.[0] ?? this.config.audience),
      exp: payload.exp ?? 0,
      iat: payload.iat ?? 0,
      jti: payload.jti,
      sessionId,
      scope: scopes,
    };
  }

  /**
   * Generates a unique token ID.
   *
   * @returns Token ID string
   */
  private generateTokenId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
