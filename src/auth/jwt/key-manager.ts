/**
 * ES256 key management for JWT signing.
 *
 * @remarks
 * Manages cryptographic keys for JWT signing and verification.
 * Supports key rotation with overlap period.
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';
import * as jose from 'jose';

import { ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Key pair with metadata.
 *
 * @public
 */
export interface KeyPair {
  /**
   * Key ID for JWT header.
   */
  readonly kid: string;

  /**
   * Private key for signing.
   */
  readonly privateKey: jose.CryptoKey;

  /**
   * Public key for verification.
   */
  readonly publicKey: jose.CryptoKey;

  /**
   * JWK representation of public key.
   */
  readonly publicJWK: jose.JWK;

  /**
   * Key creation timestamp.
   */
  readonly createdAt: Date;

  /**
   * Key expiration timestamp (for rotation).
   */
  readonly expiresAt: Date;
}

/**
 * Key manager configuration.
 *
 * @public
 */
export interface KeyManagerConfig {
  /**
   * Key rotation interval in seconds.
   *
   * @defaultValue 7776000 (90 days)
   */
  readonly rotationIntervalSeconds?: number;

  /**
   * Key overlap period in seconds.
   *
   * @remarks
   * Old keys remain valid for verification during this period.
   *
   * @defaultValue 86400 (24 hours)
   */
  readonly overlapPeriodSeconds?: number;

  /**
   * Redis key prefix for stored keys.
   *
   * @defaultValue 'chive:jwt:keys:'
   */
  readonly redisKeyPrefix?: string;
}

/**
 * Key manager options.
 *
 * @public
 */
export interface KeyManagerOptions {
  /**
   * Redis client for key storage.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config?: KeyManagerConfig;
}

/**
 * Serialized key for storage.
 */
interface SerializedKeyPair {
  readonly kid: string;
  readonly privateKey: jose.JWK;
  readonly publicKey: jose.JWK;
  readonly createdAt: string;
  readonly expiresAt: string;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<KeyManagerConfig> = {
  rotationIntervalSeconds: 7776000, // 90 days
  overlapPeriodSeconds: 86400, // 24 hours
  redisKeyPrefix: 'chive:jwt:keys:',
};

/**
 * ES256 key manager.
 *
 * @remarks
 * Manages ES256 (ECDSA P-256) key pairs for JWT signing.
 * Keys are stored in Redis and support rotation with overlap.
 *
 * @example
 * ```typescript
 * const keyManager = new KeyManager({ redis, logger });
 *
 * // Get current signing key
 * const key = await keyManager.getCurrentKey();
 *
 * // Get all valid keys for verification
 * const allKeys = await keyManager.getValidKeys();
 *
 * // Rotate keys
 * await keyManager.rotateKeys();
 * ```
 *
 * @public
 */
export class KeyManager {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<KeyManagerConfig>;

  // In-memory cache
  private currentKey: KeyPair | null = null;
  private allKeys = new Map<string, KeyPair>();
  private lastRefresh = 0;

  /**
   * Cache refresh interval in milliseconds.
   */
  private readonly cacheRefreshMs = 60000; // 1 minute

  /**
   * Creates a new KeyManager.
   *
   * @param options - Key manager options
   */
  constructor(options: KeyManagerOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Gets the current signing key.
   *
   * @remarks
   * Creates a new key if none exists.
   *
   * @returns Current key pair for signing
   */
  async getCurrentKey(): Promise<KeyPair> {
    await this.refreshKeysIfNeeded();

    if (!this.currentKey) {
      this.currentKey = await this.createNewKey();
      await this.storeKey(this.currentKey);
    }

    return this.currentKey;
  }

  /**
   * Gets all valid keys for verification.
   *
   * @remarks
   * Includes current key and any keys in overlap period.
   *
   * @returns Map of kid to KeyPair
   */
  async getValidKeys(): Promise<ReadonlyMap<string, KeyPair>> {
    await this.refreshKeysIfNeeded();

    if (this.allKeys.size === 0) {
      const current = await this.getCurrentKey();
      this.allKeys.set(current.kid, current);
    }

    return this.allKeys;
  }

  /**
   * Gets a specific key by ID.
   *
   * @param kid - Key ID
   * @returns Key pair or null if not found
   */
  async getKey(kid: string): Promise<KeyPair | null> {
    await this.refreshKeysIfNeeded();
    return this.allKeys.get(kid) ?? null;
  }

  /**
   * Rotates keys.
   *
   * @remarks
   * Creates a new key and moves old key to overlap period.
   */
  async rotateKeys(): Promise<void> {
    const newKey = await this.createNewKey();
    await this.storeKey(newKey);

    this.currentKey = newKey;
    this.allKeys.set(newKey.kid, newKey);

    // Clean up expired keys
    await this.cleanupExpiredKeys();

    this.logger.info('JWT signing keys rotated', { kid: newKey.kid });
  }

  /**
   * Gets JWKS (JSON Web Key Set) for public key distribution.
   *
   * @returns JWKS containing all valid public keys
   */
  async getJWKS(): Promise<jose.JSONWebKeySet> {
    const keys = await this.getValidKeys();
    const jwks: jose.JWK[] = [];

    for (const key of keys.values()) {
      jwks.push({
        ...key.publicJWK,
        kid: key.kid,
        use: 'sig',
        alg: 'ES256',
      });
    }

    return { keys: jwks };
  }

  /**
   * Creates a new ES256 key pair.
   *
   * @returns New key pair
   */
  private async createNewKey(): Promise<KeyPair> {
    const { publicKey, privateKey } = await jose.generateKeyPair('ES256', {
      extractable: true,
    });

    const kid = `chive-${Date.now()}-${this.generateRandomId()}`;
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        (this.config.rotationIntervalSeconds + this.config.overlapPeriodSeconds) * 1000
    );

    const publicJWK = await jose.exportJWK(publicKey);

    return {
      kid,
      privateKey,
      publicKey,
      publicJWK,
      createdAt: now,
      expiresAt,
    };
  }

  /**
   * Generates a random ID for key identification.
   */
  private generateRandomId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Stores a key in Redis.
   *
   * @param key - Key pair to store
   */
  private async storeKey(key: KeyPair): Promise<void> {
    const privateJWK = await jose.exportJWK(key.privateKey);

    const serialized: SerializedKeyPair = {
      kid: key.kid,
      privateKey: privateJWK,
      publicKey: key.publicJWK,
      createdAt: key.createdAt.toISOString(),
      expiresAt: key.expiresAt.toISOString(),
    };

    const ttl = Math.ceil((key.expiresAt.getTime() - Date.now()) / 1000);
    await this.redis.setex(
      `${this.config.redisKeyPrefix}${key.kid}`,
      ttl,
      JSON.stringify(serialized)
    );

    // Also store as current key
    await this.redis.set(`${this.config.redisKeyPrefix}current`, key.kid);
  }

  /**
   * Loads a key from Redis.
   *
   * @param kid - Key ID to load
   * @returns Key pair or null
   */
  private async loadKey(kid: string): Promise<KeyPair | null> {
    const data = await this.redis.get(`${this.config.redisKeyPrefix}${kid}`);
    if (!data) {
      return null;
    }

    try {
      const serialized = JSON.parse(data) as SerializedKeyPair;
      return this.deserializeKey(serialized);
    } catch (error) {
      this.logger.warn('Failed to deserialize key', {
        kid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Deserializes a key from storage format.
   *
   * @param serialized - Serialized key data
   * @returns Key pair
   */
  private async deserializeKey(serialized: SerializedKeyPair): Promise<KeyPair> {
    const privateKey = await jose.importJWK(serialized.privateKey, 'ES256');
    const publicKey = await jose.importJWK(serialized.publicKey, 'ES256');

    if (privateKey instanceof Uint8Array || publicKey instanceof Uint8Array) {
      throw new ValidationError('Unexpected key type', 'key', 'invalid_type');
    }

    return {
      kid: serialized.kid,
      privateKey,
      publicKey,
      publicJWK: serialized.publicKey,
      createdAt: new Date(serialized.createdAt),
      expiresAt: new Date(serialized.expiresAt),
    };
  }

  /**
   * Refreshes key cache if needed.
   */
  private async refreshKeysIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefresh < this.cacheRefreshMs) {
      return;
    }

    await this.refreshKeys();
    this.lastRefresh = now;
  }

  /**
   * Refreshes keys from Redis.
   */
  private async refreshKeys(): Promise<void> {
    // Get current key ID
    const currentKid = await this.redis.get(`${this.config.redisKeyPrefix}current`);

    // Get all key IDs
    const keyPattern = `${this.config.redisKeyPrefix}*`;
    const allKeyIds: string[] = [];

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', keyPattern, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        if (!key.endsWith(':current')) {
          const kid = key.slice(this.config.redisKeyPrefix.length);
          allKeyIds.push(kid);
        }
      }
    } while (cursor !== '0');

    // Load all keys
    const newKeys = new Map<string, KeyPair>();
    const now = new Date();

    for (const kid of allKeyIds) {
      const key = await this.loadKey(kid);
      if (key && key.expiresAt > now) {
        newKeys.set(kid, key);
      }
    }

    this.allKeys = newKeys;

    // Update current key
    if (currentKid && newKeys.has(currentKid)) {
      this.currentKey = newKeys.get(currentKid) ?? null;
    } else if (newKeys.size > 0) {
      // Use most recent key as current
      let newest: KeyPair | null = null;
      for (const key of newKeys.values()) {
        if (!newest || key.createdAt > newest.createdAt) {
          newest = key;
        }
      }
      this.currentKey = newest;
    }
  }

  /**
   * Cleans up expired keys from Redis.
   */
  private async cleanupExpiredKeys(): Promise<void> {
    const keyPattern = `${this.config.redisKeyPrefix}*`;
    const keysToDelete: string[] = [];
    const now = new Date();

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', keyPattern, 'COUNT', 100);
      cursor = nextCursor;

      for (const redisKey of keys) {
        if (redisKey.endsWith(':current')) {
          continue;
        }

        const kid = redisKey.slice(this.config.redisKeyPrefix.length);
        const key = await this.loadKey(kid);

        if (key && key.expiresAt <= now) {
          keysToDelete.push(redisKey);
          this.allKeys.delete(kid);
        }
      }
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      await this.redis.del(...keysToDelete);
      this.logger.info('Cleaned up expired JWT keys', { count: keysToDelete.length });
    }
  }
}
