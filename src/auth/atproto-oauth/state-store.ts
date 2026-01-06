/**
 * Redis-backed state store for ATProto OAuth.
 *
 * @remarks
 * Implements the StateStore interface required by @atproto/oauth-client-node.
 * Stores OAuth authorization state (PKCE, nonces) during the auth flow.
 *
 * @packageDocumentation
 * @public
 */

import type { NodeSavedState, NodeSavedStateStore } from '@atproto/oauth-client-node';
import type { Redis } from 'ioredis';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Configuration for the Redis state store.
 *
 * @public
 */
export interface RedisStateStoreConfig {
  /**
   * Redis key prefix for state data.
   *
   * @defaultValue 'chive:atproto:state:'
   */
  readonly keyPrefix?: string;

  /**
   * State TTL in seconds.
   *
   * @remarks
   * OAuth state is short-lived and only needed during the authorization
   * flow. Should be long enough for users to complete auth.
   *
   * @defaultValue 600 (10 minutes)
   */
  readonly ttlSeconds?: number;
}

/**
 * Options for creating a Redis state store.
 *
 * @public
 */
export interface RedisStateStoreOptions {
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
  readonly config?: RedisStateStoreConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<RedisStateStoreConfig> = {
  keyPrefix: 'chive:atproto:state:',
  ttlSeconds: 600, // 10 minutes
};

/**
 * Redis-backed state store for ATProto OAuth.
 *
 * @remarks
 * Stores OAuth authorization state during the authentication flow.
 * State includes PKCE code verifiers, nonces, and redirect URIs.
 *
 * State entries are automatically expired after the TTL to prevent
 * stale state from accumulating.
 *
 * @example
 * ```typescript
 * const stateStore = new RedisStateStore({
 *   redis,
 *   logger,
 * });
 *
 * const client = new NodeOAuthClient({
 *   stateStore,
 *   // ... other options
 * });
 * ```
 *
 * @public
 */
export class RedisStateStore implements NodeSavedStateStore {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly keyPrefix: string;
  private readonly ttlSeconds: number;

  /**
   * Creates a new RedisStateStore.
   *
   * @param options - Store options
   */
  constructor(options: RedisStateStoreOptions) {
    this.redis = options.redis;
    this.logger = options.logger.child({ component: 'RedisStateStore' });
    this.keyPrefix = options.config?.keyPrefix ?? DEFAULT_CONFIG.keyPrefix;
    this.ttlSeconds = options.config?.ttlSeconds ?? DEFAULT_CONFIG.ttlSeconds;
  }

  /**
   * Gets state by key.
   *
   * @param key - State key (usually the state parameter)
   * @returns State data or undefined if not found/expired
   */
  async get(key: string): Promise<NodeSavedState | undefined> {
    const redisKey = this.getRedisKey(key);
    const data = await this.redis.get(redisKey);

    if (!data) {
      return undefined;
    }

    try {
      return JSON.parse(data) as NodeSavedState;
    } catch (error) {
      this.logger.error('Failed to deserialize state', error instanceof Error ? error : undefined, {
        key,
      });
      // Remove corrupted state
      await this.redis.del(redisKey);
      return undefined;
    }
  }

  /**
   * Stores state.
   *
   * @param key - State key
   * @param value - State data
   */
  async set(key: string, value: NodeSavedState): Promise<void> {
    const redisKey = this.getRedisKey(key);
    const serialized = JSON.stringify(value);

    await this.redis.setex(redisKey, this.ttlSeconds, serialized);

    this.logger.debug('State stored', { key });
  }

  /**
   * Deletes state.
   *
   * @param key - State key
   */
  async del(key: string): Promise<void> {
    const redisKey = this.getRedisKey(key);
    await this.redis.del(redisKey);

    this.logger.debug('State deleted', { key });
  }

  /**
   * Gets the Redis key for state.
   *
   * @param key - State key
   * @returns Redis key
   */
  private getRedisKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}
