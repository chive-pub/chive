/**
 * Redis key patterns and TTL values for Chive.
 *
 * @remarks
 * Defines type-safe key builders and TTL constants for Redis data structures.
 *
 * Redis is used for:
 * - Session management (L1 cache, fast lookup)
 * - Rate limiting (4-tier: anonymous, authenticated, premium, admin)
 * - L2 cache (eprints, authors, search results)
 * - Firehose cursor backup (redundancy with PostgreSQL)
 * - PDS health status (transient)
 * - Job queues (BullMQ backing store)
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, DID } from '../../types/atproto.js';

/**
 * Redis key patterns for Chive.
 *
 * @remarks
 * All keys are namespaced with category prefix (e.g., `session:`, `cache:`).
 * This enables:
 * - Easy identification of key purpose
 * - Selective deletion by pattern
 * - Redis cluster sharding hints
 *
 * @example
 * ```typescript
 * import { RedisKeys } from './structures.js';
 *
 * const sessionKey = RedisKeys.SESSION('abc123');
 * // Returns: 'session:abc123'
 *
 * const rateLimitKey = RedisKeys.RATE_LIMIT_AUTH(toDID('did:plc:xyz')!);
 * // Returns: 'ratelimit:auth:did:plc:xyz'
 * ```
 *
 * @public
 */
export const RedisKeys = {
  /**
   * Session storage key.
   *
   * @param sessionId - Unique session identifier (UUID)
   * @returns Redis key for session data
   *
   * @remarks
   * Stores session metadata (user DID, scopes, device info).
   * Backed by PostgreSQL for persistence across restarts.
   */
  SESSION: (sessionId: string): string => `session:${sessionId}`,

  /**
   * User sessions index key.
   *
   * @param did - User DID
   * @returns Redis key for set of user's active sessions
   *
   * @remarks
   * Stores set of session IDs for a user.
   * Enables multi-device session management.
   */
  USER_SESSIONS: (did: DID): string => `user_sessions:${did}`,

  /**
   * Rate limit key for anonymous users (by IP).
   *
   * @param ip - Client IP address
   * @returns Redis key for anonymous rate limit counter
   *
   * @remarks
   * Tier 1: 60 requests per minute (lowest tier).
   */
  RATE_LIMIT_ANON: (ip: string): string => `ratelimit:anon:${ip}`,

  /**
   * Rate limit key for authenticated users.
   *
   * @param did - User DID
   * @returns Redis key for authenticated rate limit counter
   *
   * @remarks
   * Tier 2: 300 requests per minute.
   */
  RATE_LIMIT_AUTH: (did: DID): string => `ratelimit:auth:${did}`,

  /**
   * Rate limit key for premium users.
   *
   * @param did - User DID
   * @returns Redis key for premium rate limit counter
   *
   * @remarks
   * Tier 3: 1000 requests per minute.
   */
  RATE_LIMIT_PREMIUM: (did: DID): string => `ratelimit:premium:${did}`,

  /**
   * Rate limit key for admin users.
   *
   * @param did - User DID
   * @returns Redis key for admin rate limit counter
   *
   * @remarks
   * Tier 4: 5000 requests per minute (highest tier).
   */
  RATE_LIMIT_ADMIN: (did: DID): string => `ratelimit:admin:${did}`,

  /**
   * L2 cache key for eprint metadata.
   *
   * @param uri - Eprint AT URI
   * @returns Redis key for cached eprint
   *
   * @remarks
   * Caches eprint index records from PostgreSQL.
   * Reduces database load for frequently accessed eprints.
   */
  CACHE_EPRINT: (uri: AtUri): string => `cache:eprint:${uri}`,

  /**
   * L2 cache key for author profile.
   *
   * @param did - Author DID
   * @returns Redis key for cached author profile
   *
   * @remarks
   * Caches author index records from PostgreSQL.
   */
  CACHE_AUTHOR: (did: DID): string => `cache:author:${did}`,

  /**
   * L2 cache key for search results.
   *
   * @param queryHash - Hash of search query parameters
   * @returns Redis key for cached search results
   *
   * @remarks
   * Caches Elasticsearch search results.
   * Query hash includes filters, sort order, pagination.
   */
  CACHE_SEARCH: (queryHash: string): string => `cache:search:${queryHash}`,

  /**
   * Firehose cursor persistence key.
   *
   * @returns Redis key for firehose cursor
   *
   * @remarks
   * Stores current firehose cursor (sequence number).
   * Backed by PostgreSQL `firehose_cursor` table.
   * Redis provides fast reads for high-throughput indexing.
   */
  FIREHOSE_CURSOR: 'firehose:cursor',

  /**
   * PDS health status key.
   *
   * @param pdsUrl - PDS URL
   * @returns Redis key for PDS health data
   *
   * @remarks
   * Stores PDS health metrics (last sync, error count).
   * Transient data with short TTL.
   */
  PDS_HEALTH: (pdsUrl: string): string => `pds:health:${pdsUrl}`,

  /**
   * BullMQ indexing queue key.
   *
   * @returns Redis key for indexing job queue
   *
   * @remarks
   * BullMQ uses this as base key for queue metadata.
   */
  QUEUE_INDEXING: 'queue:indexing',

  /**
   * BullMQ PDF extraction queue key.
   *
   * @returns Redis key for PDF extraction job queue
   */
  QUEUE_PDF_EXTRACTION: 'queue:pdf_extraction',

  /**
   * BullMQ notification queue key.
   *
   * @returns Redis key for notification job queue
   */
  QUEUE_NOTIFICATION: 'queue:notification',
} as const;

/**
 * Redis TTL values in seconds.
 *
 * @remarks
 * TTL (time-to-live) values control cache expiration.
 *
 * Design considerations:
 * - Short TTLs for frequently changing data (sessions, rate limits)
 * - Longer TTLs for stable data (eprints, authors)
 * - Very short TTLs for transient data (PDS health)
 *
 * @public
 */
export const RedisTTL = {
  /**
   * Session TTL: 7 days.
   *
   * @remarks
   * Sessions expire after 7 days of inactivity.
   * Users must re-authenticate after expiration.
   */
  SESSION: 86400 * 7,

  /**
   * Rate limit window: 1 minute.
   *
   * @remarks
   * Rate limit counters reset every minute.
   * Sliding window implemented with sorted sets.
   */
  RATE_LIMIT_WINDOW: 60,

  /**
   * Eprint cache TTL: 5 minutes.
   *
   * @remarks
   * Short TTL ensures index updates propagate quickly.
   */
  CACHE_EPRINT: 300,

  /**
   * Author cache TTL: 10 minutes.
   *
   * @remarks
   * Author profiles change less frequently than eprints.
   */
  CACHE_AUTHOR: 600,

  /**
   * Search results cache TTL: 3 minutes.
   *
   * @remarks
   * Search results change as new eprints are indexed.
   */
  CACHE_SEARCH: 180,

  /**
   * PDS health TTL: 5 minutes.
   *
   * @remarks
   * Health status refreshed periodically by background job.
   */
  PDS_HEALTH: 300,
} as const;

/**
 * Redis connection configuration.
 *
 * @public
 */
export interface RedisConfig {
  /**
   * Redis host.
   *
   * @defaultValue 'localhost'
   */
  host: string;

  /**
   * Redis port.
   *
   * @defaultValue 6379
   */
  port: number;

  /**
   * Database number (0-15).
   *
   * @defaultValue 0
   */
  db?: number;

  /**
   * Password (if required).
   */
  password?: string;

  /**
   * Key prefix for all keys.
   *
   * @remarks
   * Useful for multi-tenant deployments or testing.
   *
   * @defaultValue 'chive:'
   */
  keyPrefix?: string;
}

/**
 * Loads Redis configuration from environment.
 *
 * @returns Redis client configuration
 *
 * @remarks
 * Environment variables:
 * - `REDIS_HOST` - Redis host (default: localhost)
 * - `REDIS_PORT` - Redis port (default: 6379)
 * - `REDIS_DB` - Database number (default: 0)
 * - `REDIS_PASSWORD` - Password (optional)
 * - `REDIS_KEY_PREFIX` - Key prefix (default: chive:)
 *
 * @public
 */
export function getRedisConfig(): RedisConfig {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'chive:',
  };
}
