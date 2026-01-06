/**
 * Session manager for user session lifecycle.
 *
 * @remarks
 * Manages user sessions stored in Redis with support for:
 * - Multi-device sessions
 * - Session revocation
 * - Sliding window expiration
 * - Token blacklisting
 *
 * @packageDocumentation
 * @public
 */

import { randomUUID } from 'node:crypto';

import type { Redis } from 'ioredis';

import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  ISessionManager,
  Session,
  SessionMetadata,
  SessionUpdate,
} from '../../types/interfaces/session.interface.js';
import { SessionRevokedError } from '../errors.js';

/**
 * Session manager configuration.
 *
 * @public
 */
export interface SessionManagerConfig {
  /**
   * Session expiration in seconds.
   *
   * @defaultValue 2592000 (30 days)
   */
  readonly sessionExpirationSeconds?: number;

  /**
   * Redis key prefix for sessions.
   *
   * @defaultValue 'chive:session:'
   */
  readonly sessionPrefix?: string;

  /**
   * Redis key prefix for user session index.
   *
   * @defaultValue 'chive:user:sessions:'
   */
  readonly userSessionPrefix?: string;

  /**
   * Redis key prefix for revoked tokens.
   *
   * @defaultValue 'chive:token:revoked:'
   */
  readonly tokenRevokedPrefix?: string;

  /**
   * Maximum sessions per user.
   *
   * @defaultValue 10
   */
  readonly maxSessionsPerUser?: number;
}

/**
 * Session manager options.
 *
 * @public
 */
export interface SessionManagerOptions {
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
  readonly config?: SessionManagerConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<SessionManagerConfig> = {
  sessionExpirationSeconds: 2592000, // 30 days
  sessionPrefix: 'chive:session:',
  userSessionPrefix: 'chive:user:sessions:',
  tokenRevokedPrefix: 'chive:token:revoked:',
  maxSessionsPerUser: 10,
};

/**
 * Stored session data structure.
 */
interface StoredSession {
  id: string;
  did: string;
  createdAt: string;
  expiresAt: string;
  lastActivity: string;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  scope: string[];
  revoked?: boolean;
}

/**
 * Session manager implementation.
 *
 * @remarks
 * Provides Redis-backed session management with:
 * - Cryptographically secure session IDs (UUID v4)
 * - Per-user session tracking and limits
 * - Sliding window expiration on activity
 * - Token blacklisting for logout
 *
 * @example
 * ```typescript
 * const sessionManager = new SessionManager({
 *   redis,
 *   logger,
 *   config: {
 *     sessionExpirationSeconds: 86400 * 7, // 1 week
 *     maxSessionsPerUser: 5,
 *   },
 * });
 *
 * const session = await sessionManager.createSession(
 *   'did:plc:abc123',
 *   {
 *     ipAddress: '192.168.1.1',
 *     userAgent: 'Mozilla/5.0...',
 *     scope: ['read', 'write'],
 *   }
 * );
 * ```
 *
 * @public
 */
export class SessionManager implements ISessionManager {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<SessionManagerConfig>;

  /**
   * Creates a new SessionManager.
   *
   * @param options - Manager options
   */
  constructor(options: SessionManagerOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Creates a new session for an authenticated user.
   *
   * @param did - User's DID
   * @param metadata - Session metadata
   * @returns Created session
   */
  async createSession(did: DID, metadata: SessionMetadata): Promise<Session> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionExpirationSeconds * 1000);

    const session: Session = {
      id: randomUUID(),
      did,
      createdAt: now,
      expiresAt,
      lastActivity: now,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      deviceId: metadata.deviceId,
      scope: metadata.scope ? [...metadata.scope] : [],
    };

    // Enforce max sessions per user
    await this.enforceMaxSessions(did);

    // Store session
    const storedSession = this.sessionToStored(session);
    const sessionKey = `${this.config.sessionPrefix}${session.id}`;
    const userSessionKey = `${this.config.userSessionPrefix}${did}`;

    const pipeline = this.redis.pipeline();
    pipeline.setex(sessionKey, this.config.sessionExpirationSeconds, JSON.stringify(storedSession));
    pipeline.sadd(userSessionKey, session.id);
    pipeline.expire(userSessionKey, this.config.sessionExpirationSeconds);
    await pipeline.exec();

    this.logger.info('Session created', {
      sessionId: session.id,
      did,
      ipAddress: metadata.ipAddress,
    });

    return session;
  }

  /**
   * Gets a session by ID.
   *
   * @param sessionId - Session identifier
   * @returns Session or null if not found/expired/revoked
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const sessionKey = `${this.config.sessionPrefix}${sessionId}`;
    const data = await this.redis.get(sessionKey);

    if (!data) {
      return null;
    }

    const stored = JSON.parse(data) as StoredSession;

    // Check if revoked
    if (stored.revoked) {
      return null;
    }

    // Check expiration
    const session = this.storedToSession(stored);
    if (session.expiresAt < new Date()) {
      await this.revokeSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Updates a session.
   *
   * @param sessionId - Session identifier
   * @param updates - Fields to update
   */
  async updateSession(sessionId: string, updates: SessionUpdate): Promise<void> {
    const sessionKey = `${this.config.sessionPrefix}${sessionId}`;
    const data = await this.redis.get(sessionKey);

    if (!data) {
      throw new SessionRevokedError(sessionId);
    }

    const stored = JSON.parse(data) as StoredSession;

    if (stored.revoked) {
      throw new SessionRevokedError(sessionId);
    }

    // Apply updates
    if (updates.lastActivity) {
      stored.lastActivity = updates.lastActivity.toISOString();
    }
    if (updates.expiresAt) {
      stored.expiresAt = updates.expiresAt.toISOString();
    }
    if (updates.scope) {
      stored.scope = [...updates.scope];
    }

    // Calculate new TTL based on expiration
    const expiresAt = new Date(stored.expiresAt);
    const ttl = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));

    await this.redis.setex(sessionKey, ttl, JSON.stringify(stored));

    this.logger.debug('Session updated', { sessionId });
  }

  /**
   * Revokes a session.
   *
   * @param sessionId - Session identifier
   */
  async revokeSession(sessionId: string): Promise<void> {
    const sessionKey = `${this.config.sessionPrefix}${sessionId}`;
    const data = await this.redis.get(sessionKey);

    if (data) {
      const stored = JSON.parse(data) as StoredSession;
      stored.revoked = true;

      // Keep the session record for a short time for audit purposes
      await this.redis.setex(sessionKey, 86400, JSON.stringify(stored)); // 24 hours

      // Remove from user's session set
      const userSessionKey = `${this.config.userSessionPrefix}${stored.did}`;
      await this.redis.srem(userSessionKey, sessionId);

      this.logger.info('Session revoked', {
        sessionId,
        did: stored.did,
      });
    }
  }

  /**
   * Revokes all sessions for a user.
   *
   * @param did - User's DID
   */
  async revokeAllSessions(did: DID): Promise<void> {
    const userSessionKey = `${this.config.userSessionPrefix}${did}`;
    const sessionIds = await this.redis.smembers(userSessionKey);

    if (sessionIds.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();

    for (const sessionId of sessionIds) {
      const sessionKey = `${this.config.sessionPrefix}${sessionId}`;
      const data = await this.redis.get(sessionKey);

      if (data) {
        const stored = JSON.parse(data) as StoredSession;
        stored.revoked = true;
        pipeline.setex(sessionKey, 86400, JSON.stringify(stored));
      }
    }

    pipeline.del(userSessionKey);
    await pipeline.exec();

    this.logger.info('All sessions revoked', {
      did,
      count: sessionIds.length,
    });
  }

  /**
   * Lists all active sessions for a user.
   *
   * @param did - User's DID
   * @returns Array of active sessions, newest first
   */
  async listSessions(did: DID): Promise<readonly Session[]> {
    const userSessionKey = `${this.config.userSessionPrefix}${did}`;
    const sessionIds = await this.redis.smembers(userSessionKey);

    if (sessionIds.length === 0) {
      return [];
    }

    const sessions: Session[] = [];
    const expiredIds: string[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      } else {
        expiredIds.push(sessionId);
      }
    }

    // Clean up expired session references
    if (expiredIds.length > 0) {
      await this.redis.srem(userSessionKey, ...expiredIds);
    }

    // Sort by creation date, newest first
    sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return sessions;
  }

  /**
   * Checks if a token has been revoked.
   *
   * @param jti - JWT ID
   * @returns True if token is revoked
   */
  async isTokenRevoked(jti: string): Promise<boolean> {
    const key = `${this.config.tokenRevokedPrefix}${jti}`;
    const result = await this.redis.get(key);
    return result !== null;
  }

  /**
   * Adds a token to the revocation blacklist.
   *
   * @param jti - JWT ID
   * @param expiresAt - Token expiration timestamp
   */
  async revokeToken(jti: string, expiresAt: Date): Promise<void> {
    const key = `${this.config.tokenRevokedPrefix}${jti}`;
    const ttl = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));

    await this.redis.setex(key, ttl, '1');

    this.logger.debug('Token revoked', { jti });
  }

  /**
   * Enforces maximum sessions per user.
   *
   * @remarks
   * Removes oldest sessions when limit is exceeded.
   *
   * @param did - User's DID
   */
  private async enforceMaxSessions(did: DID): Promise<void> {
    const sessions = await this.listSessions(did);

    if (sessions.length >= this.config.maxSessionsPerUser) {
      // Remove oldest sessions to make room
      const sessionsToRemove = sessions.slice(this.config.maxSessionsPerUser - 1);

      for (const session of sessionsToRemove) {
        await this.revokeSession(session.id);
      }

      this.logger.info('Removed old sessions due to limit', {
        did,
        removed: sessionsToRemove.length,
      });
    }
  }

  /**
   * Converts a Session to stored format.
   *
   * @param session - Session object
   * @returns Stored session data
   */
  private sessionToStored(session: Session): StoredSession {
    return {
      id: session.id,
      did: session.did,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceId: session.deviceId,
      scope: [...session.scope],
      revoked: session.revoked,
    };
  }

  /**
   * Converts stored format to Session.
   *
   * @param stored - Stored session data
   * @returns Session object
   */
  private storedToSession(stored: StoredSession): Session {
    return {
      id: stored.id,
      did: stored.did as DID,
      createdAt: new Date(stored.createdAt),
      expiresAt: new Date(stored.expiresAt),
      lastActivity: new Date(stored.lastActivity),
      ipAddress: stored.ipAddress,
      userAgent: stored.userAgent,
      deviceId: stored.deviceId,
      scope: stored.scope,
      revoked: stored.revoked,
    };
  }
}
