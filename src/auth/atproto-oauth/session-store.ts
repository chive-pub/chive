/**
 * Redis-backed session store for ATProto OAuth.
 *
 * @remarks
 * Implements the SessionStore interface required by @atproto/oauth-client-node.
 * Sessions are stored in Redis with encryption for sensitive token data.
 *
 * @packageDocumentation
 * @public
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { NodeSavedSession, NodeSavedSessionStore } from '@atproto/oauth-client-node';
import type { Redis } from 'ioredis';

import { ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Configuration for the Redis session store.
 *
 * @public
 */
export interface RedisSessionStoreConfig {
  /**
   * Redis key prefix for session data.
   *
   * @defaultValue 'chive:atproto:session:'
   */
  readonly keyPrefix?: string;

  /**
   * Session TTL in seconds.
   *
   * @remarks
   * Sessions expire after this duration. Should be longer than refresh
   * token lifetime to allow for token refresh.
   *
   * @defaultValue 604800 (7 days)
   */
  readonly ttlSeconds?: number;

  /**
   * Encryption key for sensitive session data (32 bytes, hex-encoded).
   *
   * @remarks
   * Required for production. If not provided, sessions are stored without
   * encryption (development only).
   */
  readonly encryptionKey?: string;
}

/**
 * Options for creating a Redis session store.
 *
 * @public
 */
export interface RedisSessionStoreOptions {
  /**
   * Redis client instance.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config?: RedisSessionStoreConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<Omit<RedisSessionStoreConfig, 'encryptionKey'>> = {
  keyPrefix: 'chive:atproto:session:',
  ttlSeconds: 604800, // 7 days
};

/**
 * Redis-backed session store for ATProto OAuth.
 *
 * @remarks
 * Stores OAuth sessions (including access/refresh tokens and DPoP keys)
 * in Redis with optional AES-256-GCM encryption.
 *
 * @example
 * ```typescript
 * const sessionStore = new RedisSessionStore({
 *   redis,
 *   logger,
 *   config: {
 *     encryptionKey: process.env.SESSION_ENCRYPTION_KEY,
 *   },
 * });
 *
 * const client = new NodeOAuthClient({
 *   sessionStore,
 *   // ... other options
 * });
 * ```
 *
 * @public
 */
export class RedisSessionStore implements NodeSavedSessionStore {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly keyPrefix: string;
  private readonly ttlSeconds: number;
  private readonly encryptionKey?: Buffer;

  /**
   * Creates a new RedisSessionStore.
   *
   * @param options - Store options
   */
  constructor(options: RedisSessionStoreOptions) {
    this.redis = options.redis;
    this.logger = options.logger.child({ component: 'RedisSessionStore' });
    this.keyPrefix = options.config?.keyPrefix ?? DEFAULT_CONFIG.keyPrefix;
    this.ttlSeconds = options.config?.ttlSeconds ?? DEFAULT_CONFIG.ttlSeconds;

    if (options.config?.encryptionKey) {
      this.encryptionKey = Buffer.from(options.config.encryptionKey, 'hex');
      if (this.encryptionKey.length !== 32) {
        throw new ValidationError(
          'Encryption key must be 32 bytes (64 hex characters)',
          'encryptionKey',
          'length'
        );
      }
    }
  }

  /**
   * Gets a session by DID.
   *
   * @param key - User DID
   * @returns Session data or undefined if not found
   */
  async get(key: string): Promise<NodeSavedSession | undefined> {
    const redisKey = this.getRedisKey(key);
    const data = await this.redis.get(redisKey);

    if (!data) {
      return undefined;
    }

    try {
      const decrypted = this.decrypt(data);
      return JSON.parse(decrypted) as NodeSavedSession;
    } catch (error) {
      this.logger.error(
        'Failed to deserialize session',
        error instanceof Error ? error : undefined,
        { key }
      );
      // Remove corrupted session
      await this.redis.del(redisKey);
      return undefined;
    }
  }

  /**
   * Stores a session.
   *
   * @param key - User DID
   * @param value - Session data
   */
  async set(key: string, value: NodeSavedSession): Promise<void> {
    const redisKey = this.getRedisKey(key);
    const serialized = JSON.stringify(value);
    const encrypted = this.encrypt(serialized);

    await this.redis.setex(redisKey, this.ttlSeconds, encrypted);

    this.logger.debug('Session stored', { key });
  }

  /**
   * Deletes a session.
   *
   * @param key - User DID
   */
  async del(key: string): Promise<void> {
    const redisKey = this.getRedisKey(key);
    await this.redis.del(redisKey);

    this.logger.debug('Session deleted', { key });
  }

  /**
   * Gets the Redis key for a session.
   *
   * @param key - User DID
   * @returns Redis key
   */
  private getRedisKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Encrypts data using AES-256-GCM.
   *
   * @param data - Data to encrypt
   * @returns Encrypted data (base64)
   */
  private encrypt(data: string): string {
    if (!this.encryptionKey) {
      // No encryption in development
      return data;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv (12 bytes) + authTag (16 bytes) + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypts data using AES-256-GCM.
   *
   * @param data - Encrypted data (base64)
   * @returns Decrypted data
   */
  private decrypt(data: string): string {
    if (!this.encryptionKey) {
      // No encryption in development
      return data;
    }

    const combined = Buffer.from(data, 'base64');

    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28);
    const ciphertext = combined.subarray(28);

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
