/**
 * Refresh token manager for token rotation.
 *
 * @remarks
 * Implements secure refresh token handling with:
 * - One-time use tokens (rotation on each refresh)
 * - Token family tracking for replay detection
 * - Automatic revocation on reuse detection
 *
 * @packageDocumentation
 * @public
 */

import { randomBytes, createHash } from 'node:crypto';

import type { Redis } from 'ioredis';

import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { RefreshTokenError } from '../errors.js';

/**
 * Refresh token manager configuration.
 *
 * @public
 */
export interface RefreshTokenManagerConfig {
  /**
   * Refresh token expiration in seconds.
   *
   * @defaultValue 2592000 (30 days)
   */
  readonly refreshTokenExpirationSeconds?: number;

  /**
   * Redis key prefix for refresh tokens.
   *
   * @defaultValue 'chive:refresh:'
   */
  readonly refreshTokenPrefix?: string;

  /**
   * Redis key prefix for token families.
   *
   * @defaultValue 'chive:refresh:family:'
   */
  readonly tokenFamilyPrefix?: string;

  /**
   * Grace period in seconds for token rotation.
   *
   * @remarks
   * Allows previous token to remain valid briefly during rotation
   * to handle network issues.
   *
   * @defaultValue 5
   */
  readonly rotationGraceSeconds?: number;
}

/**
 * Refresh token manager options.
 *
 * @public
 */
export interface RefreshTokenManagerOptions {
  /**
   * Redis client.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config?: RefreshTokenManagerConfig;
}

/**
 * Refresh token metadata.
 *
 * @public
 */
export interface RefreshToken {
  /**
   * The opaque token string.
   */
  readonly token: string;

  /**
   * Token hash (used as storage key).
   */
  readonly hash: string;

  /**
   * Token expiration timestamp.
   */
  readonly expiresAt: Date;
}

/**
 * Refresh token data structure.
 *
 * @public
 */
export interface RefreshTokenData {
  /**
   * Associated session ID.
   */
  readonly sessionId: string;

  /**
   * User's DID.
   */
  readonly did: DID;

  /**
   * Token family ID for rotation tracking.
   */
  readonly familyId: string;

  /**
   * Token generation number in family.
   */
  readonly generation: number;

  /**
   * Token creation timestamp.
   */
  readonly createdAt: Date;

  /**
   * Token expiration timestamp.
   */
  readonly expiresAt: Date;

  /**
   * Whether this token has been used.
   */
  readonly used?: boolean;

  /**
   * When this token was used.
   */
  readonly usedAt?: Date;
}

/**
 * Stored refresh token data.
 */
interface StoredRefreshToken {
  sessionId: string;
  did: string;
  familyId: string;
  generation: number;
  createdAt: string;
  expiresAt: string;
  used?: boolean;
  usedAt?: string;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<RefreshTokenManagerConfig> = {
  refreshTokenExpirationSeconds: 2592000, // 30 days
  refreshTokenPrefix: 'chive:refresh:',
  tokenFamilyPrefix: 'chive:refresh:family:',
  rotationGraceSeconds: 5,
};

/**
 * Refresh token manager implementation.
 *
 * @remarks
 * Provides secure refresh token lifecycle management with:
 * - Cryptographically secure token generation (256-bit)
 * - Token family tracking for rotation
 * - Replay attack detection and mitigation
 *
 * When token reuse is detected (replay attack), the entire token
 * family is revoked to prevent further abuse.
 *
 * @example
 * ```typescript
 * const refreshManager = new RefreshTokenManager({
 *   redis,
 *   logger,
 * });
 *
 * // Create initial refresh token
 * const { token, hash } = await refreshManager.createToken(
 *   sessionId,
 *   'did:plc:abc123'
 * );
 *
 * // Rotate on refresh
 * const { data, newToken } = await refreshManager.rotateToken(token);
 * ```
 *
 * @public
 */
export class RefreshTokenManager {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<RefreshTokenManagerConfig>;

  /**
   * Creates a new RefreshTokenManager.
   *
   * @param options - Manager options
   */
  constructor(options: RefreshTokenManagerOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Creates a new refresh token for a session.
   *
   * @param sessionId - Associated session ID
   * @param did - User's DID
   * @param familyId - Optional family ID (creates new family if not provided)
   * @param generation - Token generation number (default 1)
   * @returns Created refresh token with metadata
   */
  async createToken(
    sessionId: string,
    did: DID,
    familyId?: string,
    generation = 1
  ): Promise<RefreshToken> {
    const token = this.generateToken();
    const hash = this.hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.refreshTokenExpirationSeconds * 1000);
    const tokenFamilyId = familyId ?? this.generateFamilyId();

    const data: StoredRefreshToken = {
      sessionId,
      did,
      familyId: tokenFamilyId,
      generation,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const tokenKey = `${this.config.refreshTokenPrefix}${hash}`;
    const familyKey = `${this.config.tokenFamilyPrefix}${tokenFamilyId}`;

    const pipeline = this.redis.pipeline();
    pipeline.setex(tokenKey, this.config.refreshTokenExpirationSeconds, JSON.stringify(data));
    pipeline.sadd(familyKey, hash);
    pipeline.expire(familyKey, this.config.refreshTokenExpirationSeconds);
    await pipeline.exec();

    this.logger.debug('Refresh token created', {
      sessionId,
      did,
      familyId: tokenFamilyId,
      generation,
    });

    return {
      token,
      hash,
      expiresAt,
    };
  }

  /**
   * Validates a refresh token.
   *
   * @param token - The refresh token string
   * @returns Token data if valid
   * @throws RefreshTokenError if token is invalid, expired, or reused
   */
  async validateToken(token: string): Promise<RefreshTokenData> {
    const hash = this.hashToken(token);
    const tokenKey = `${this.config.refreshTokenPrefix}${hash}`;
    const data = await this.redis.get(tokenKey);

    if (!data) {
      throw new RefreshTokenError('invalid', 'Refresh token not found or expired');
    }

    const stored = JSON.parse(data) as StoredRefreshToken;

    // Check expiration
    const expiresAt = new Date(stored.expiresAt);
    if (expiresAt < new Date()) {
      await this.redis.del(tokenKey);
      throw new RefreshTokenError('expired', 'Refresh token has expired');
    }

    // Check if already used (replay detection)
    if (stored.used) {
      const usedAt = stored.usedAt ? new Date(stored.usedAt) : new Date();
      const gracePeriodExpired =
        Date.now() - usedAt.getTime() > this.config.rotationGraceSeconds * 1000;

      if (gracePeriodExpired) {
        // Potential replay attack; revoke entire family
        this.logger.warn('Refresh token reuse detected, revoking family', {
          familyId: stored.familyId,
          sessionId: stored.sessionId,
        });

        await this.revokeFamilyTokens(stored.familyId);
        throw new RefreshTokenError('reused', 'Refresh token has already been used');
      }

      // Within grace period, return data without error
    }

    return {
      sessionId: stored.sessionId,
      did: stored.did as DID,
      familyId: stored.familyId,
      generation: stored.generation,
      createdAt: new Date(stored.createdAt),
      expiresAt: new Date(stored.expiresAt),
      used: stored.used,
      usedAt: stored.usedAt ? new Date(stored.usedAt) : undefined,
    };
  }

  /**
   * Rotates a refresh token.
   *
   * @remarks
   * Marks the current token as used and creates a new token
   * in the same family with incremented generation.
   *
   * @param token - The current refresh token
   * @returns Token data and new token
   * @throws RefreshTokenError if rotation fails
   */
  async rotateToken(token: string): Promise<{
    data: RefreshTokenData;
    newToken: RefreshToken;
  }> {
    const data = await this.validateToken(token);
    const hash = this.hashToken(token);
    const tokenKey = `${this.config.refreshTokenPrefix}${hash}`;

    // Mark current token as used
    const stored: StoredRefreshToken = {
      sessionId: data.sessionId,
      did: data.did,
      familyId: data.familyId,
      generation: data.generation,
      createdAt: data.createdAt.toISOString(),
      expiresAt: data.expiresAt.toISOString(),
      used: true,
      usedAt: new Date().toISOString(),
    };

    // Keep the old token for grace period
    const graceTtl = Math.min(
      this.config.rotationGraceSeconds + 60, // Extra buffer
      Math.ceil((data.expiresAt.getTime() - Date.now()) / 1000)
    );

    await this.redis.setex(tokenKey, graceTtl, JSON.stringify(stored));

    // Create new token in same family
    const newToken = await this.createToken(
      data.sessionId,
      data.did,
      data.familyId,
      data.generation + 1
    );

    this.logger.debug('Refresh token rotated', {
      sessionId: data.sessionId,
      familyId: data.familyId,
      oldGeneration: data.generation,
      newGeneration: data.generation + 1,
    });

    return {
      data,
      newToken,
    };
  }

  /**
   * Revokes a specific refresh token.
   *
   * @param token - The refresh token to revoke
   */
  async revokeToken(token: string): Promise<void> {
    const hash = this.hashToken(token);
    const tokenKey = `${this.config.refreshTokenPrefix}${hash}`;

    const data = await this.redis.get(tokenKey);
    if (data) {
      const stored = JSON.parse(data) as StoredRefreshToken;
      const familyKey = `${this.config.tokenFamilyPrefix}${stored.familyId}`;

      await this.redis.pipeline().del(tokenKey).srem(familyKey, hash).exec();

      this.logger.debug('Refresh token revoked', {
        familyId: stored.familyId,
        sessionId: stored.sessionId,
      });
    }
  }

  /**
   * Revokes all tokens in a family.
   *
   * @remarks
   * Used when token reuse is detected to prevent further abuse.
   *
   * @param familyId - Token family ID
   */
  async revokeFamilyTokens(familyId: string): Promise<void> {
    const familyKey = `${this.config.tokenFamilyPrefix}${familyId}`;
    const tokenHashes = await this.redis.smembers(familyKey);

    if (tokenHashes.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();

    for (const hash of tokenHashes) {
      pipeline.del(`${this.config.refreshTokenPrefix}${hash}`);
    }

    pipeline.del(familyKey);
    await pipeline.exec();

    this.logger.info('Token family revoked', {
      familyId,
      tokenCount: tokenHashes.length,
    });
  }

  /**
   * Revokes all refresh tokens for a session.
   *
   * @param sessionId - Session ID
   */
  async revokeSessionTokens(sessionId: string): Promise<void> {
    // This requires scanning keys. In production, consider maintaining
    // a session-to-family index for efficiency
    const pattern = `${this.config.refreshTokenPrefix}*`;
    let cursor = '0';
    const families = new Set<string>();

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const stored = JSON.parse(data) as StoredRefreshToken;
          if (stored.sessionId === sessionId) {
            families.add(stored.familyId);
          }
        }
      }
    } while (cursor !== '0');

    // Revoke all found families
    for (const familyId of families) {
      await this.revokeFamilyTokens(familyId);
    }

    this.logger.info('Session refresh tokens revoked', {
      sessionId,
      familyCount: families.size,
    });
  }

  /**
   * Generates a cryptographically secure token.
   *
   * @returns Base64url-encoded token string
   */
  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generates a token family ID.
   *
   * @returns UUID-like family identifier
   */
  private generateFamilyId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Hashes a token for storage.
   *
   * @remarks
   * Uses SHA-256 to create a one-way hash.
   * Tokens are never stored in plaintext.
   *
   * @param token - Raw token string
   * @returns Hex-encoded hash
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
