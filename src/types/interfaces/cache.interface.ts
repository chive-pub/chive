/**
 * Cache provider interface for Redis.
 *
 * @remarks
 * This interface provides key-value caching capabilities for Chive,
 * enabling fast data retrieval and reducing database load.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Cache provider interface for Redis.
 *
 * @remarks
 * Provides caching for frequently accessed data.
 *
 * Implementation notes:
 * - Uses Redis 7+
 * - All keys prefixed with "chive:"
 * - JSON serialization for complex values
 * - Automatic TTL management
 *
 * @public
 */
export interface ICacheProvider {
  /**
   * Gets a value from cache.
   *
   * @typeParam T - Value type
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   *
   * @example
   * ```typescript
   * const preprint = await cache.get<StoredPreprint>('preprint:xyz');
   * if (preprint) {
   *   console.log('Cache hit:', preprint.title);
   * }
   * ```
   *
   * @public
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Sets a value in cache.
   *
   * @typeParam T - Value type
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional, default: no expiration)
   * @returns Promise resolving when set
   *
   * @example
   * ```typescript
   * await cache.set('preprint:xyz', preprint, 3600); // 1 hour TTL
   * ```
   *
   * @public
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Deletes a value from cache.
   *
   * @param key - Cache key
   * @returns Promise resolving when deleted
   *
   * @example
   * ```typescript
   * await cache.delete('preprint:xyz');
   * ```
   *
   * @public
   */
  delete(key: string): Promise<void>;

  /**
   * Checks if a key exists in cache.
   *
   * @param key - Cache key
   * @returns True if key exists, false otherwise
   *
   * @example
   * ```typescript
   * if (await cache.exists('preprint:xyz')) {
   *   console.log('Key exists');
   * }
   * ```
   *
   * @public
   */
  exists(key: string): Promise<boolean>;

  /**
   * Sets expiration on existing key.
   *
   * @param key - Cache key
   * @param ttl - Time to live in seconds
   * @returns Promise resolving when TTL set
   *
   * @example
   * ```typescript
   * await cache.expire('preprint:xyz', 1800); // 30 minutes
   * ```
   *
   * @public
   */
  expire(key: string, ttl: number): Promise<void>;
}
