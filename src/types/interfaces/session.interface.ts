/**
 * Session management interfaces.
 *
 * @remarks
 * Provides type definitions for session management including:
 * - Session creation and retrieval
 * - Session revocation and cleanup
 * - Multi-device session tracking
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../atproto.js';

/**
 * Session metadata for creation.
 *
 * @public
 */
export interface SessionMetadata {
  /**
   * Client IP address.
   *
   * @remarks
   * Used for security logging and anomaly detection.
   */
  readonly ipAddress: string;

  /**
   * Client user agent string.
   *
   * @remarks
   * Used for device identification and session display.
   */
  readonly userAgent: string;

  /**
   * Optional device identifier.
   *
   * @remarks
   * Persistent device fingerprint for multi-device management.
   */
  readonly deviceId?: string;

  /**
   * Granted scopes for this session.
   */
  readonly scope?: readonly string[];
}

/**
 * Session data.
 *
 * @public
 */
export interface Session {
  /**
   * Unique session identifier.
   *
   * @remarks
   * Format: UUID v4.
   */
  readonly id: string;

  /**
   * Session owner's DID.
   */
  readonly did: DID;

  /**
   * Session creation timestamp.
   */
  readonly createdAt: Date;

  /**
   * Session expiration timestamp.
   *
   * @remarks
   * Sessions expire after 30 days of inactivity.
   */
  readonly expiresAt: Date;

  /**
   * Last activity timestamp.
   *
   * @remarks
   * Updated on each authenticated request.
   * Used for sliding window expiration.
   */
  readonly lastActivity: Date;

  /**
   * Client IP address at creation.
   */
  readonly ipAddress: string;

  /**
   * Client user agent at creation.
   */
  readonly userAgent: string;

  /**
   * Device identifier.
   */
  readonly deviceId?: string;

  /**
   * Granted scopes.
   */
  readonly scope: readonly string[];

  /**
   * Whether this session has been revoked.
   */
  readonly revoked?: boolean;
}

/**
 * Session update fields.
 *
 * @public
 */
export interface SessionUpdate {
  /**
   * Update last activity timestamp.
   */
  readonly lastActivity?: Date;

  /**
   * Update expiration timestamp.
   */
  readonly expiresAt?: Date;

  /**
   * Update granted scopes.
   */
  readonly scope?: readonly string[];
}

/**
 * Session manager interface.
 *
 * @remarks
 * Manages user sessions with Redis backend.
 * Supports multi-device sessions and revocation.
 *
 * @example
 * ```typescript
 * const sessionManager = container.resolve<ISessionManager>('ISessionManager');
 *
 * // Create session after authentication
 * const session = await sessionManager.createSession(did, {
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 *   scope: ['read:preprints', 'write:reviews'],
 * });
 *
 * // Get session for validation
 * const retrieved = await sessionManager.getSession(session.id);
 *
 * // Revoke on logout
 * await sessionManager.revokeSession(session.id);
 * ```
 *
 * @public
 */
export interface ISessionManager {
  /**
   * Create new session for authenticated user.
   *
   * @param did - User's DID
   * @param metadata - Session metadata
   * @returns Created session
   *
   * @public
   */
  createSession(did: DID, metadata: SessionMetadata): Promise<Session>;

  /**
   * Get session by ID.
   *
   * @remarks
   * Returns null if session does not exist, has expired,
   * or has been revoked.
   *
   * @param sessionId - Session identifier
   * @returns Session or null
   *
   * @public
   */
  getSession(sessionId: string): Promise<Session | null>;

  /**
   * Update session.
   *
   * @remarks
   * Typically used to extend expiration on activity.
   *
   * @param sessionId - Session identifier
   * @param updates - Fields to update
   *
   * @public
   */
  updateSession(sessionId: string, updates: SessionUpdate): Promise<void>;

  /**
   * Revoke session.
   *
   * @remarks
   * Marks session as revoked. The session will no longer
   * be returned by `getSession`.
   *
   * @param sessionId - Session identifier
   *
   * @public
   */
  revokeSession(sessionId: string): Promise<void>;

  /**
   * Revoke all sessions for user.
   *
   * @remarks
   * Used for "log out everywhere" functionality.
   *
   * @param did - User's DID
   *
   * @public
   */
  revokeAllSessions(did: DID): Promise<void>;

  /**
   * List active sessions for user.
   *
   * @remarks
   * Returns all non-expired, non-revoked sessions.
   * Ordered by creation date, newest first.
   *
   * @param did - User's DID
   * @returns Array of active sessions
   *
   * @public
   */
  listSessions(did: DID): Promise<readonly Session[]>;

  /**
   * Check if token has been revoked.
   *
   * @remarks
   * Checks the token blacklist for revoked tokens.
   *
   * @param jti - JWT ID (jti claim)
   * @returns True if token is revoked
   *
   * @public
   */
  isTokenRevoked(jti: string): Promise<boolean>;

  /**
   * Add token to revocation blacklist.
   *
   * @remarks
   * Token is blacklisted until its natural expiration.
   *
   * @param jti - JWT ID (jti claim)
   * @param expiresAt - Token expiration timestamp
   *
   * @public
   */
  revokeToken(jti: string, expiresAt: Date): Promise<void>;
}
