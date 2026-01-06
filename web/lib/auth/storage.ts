/**
 * Secure session storage utilities for authentication.
 *
 * @remarks
 * Storage strategy:
 * - Access tokens: in-memory only (security)
 * - Refresh tokens: httpOnly cookie (set by server)
 * - Session metadata: localStorage (non-sensitive, for UI)
 *
 * @see https://atproto.com/specs/oauth
 */

import type { ChiveUser } from './types';

/** localStorage key for session metadata */
const SESSION_METADATA_KEY = 'chive_session_metadata';

/**
 * Non-sensitive session metadata stored in localStorage.
 *
 * @remarks
 * This data is used for UI purposes only (showing user info, etc.)
 * and should not contain sensitive tokens.
 */
export interface SessionMetadata {
  /** User DID */
  did: string;

  /** User handle */
  handle: string;

  /** Display name */
  displayName?: string;

  /** Avatar URL */
  avatar?: string;

  /** PDS endpoint */
  pdsEndpoint: string;

  /** Session creation timestamp */
  createdAt: number;

  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Save session metadata to localStorage.
 *
 * @param user - User information to store
 */
export function saveSessionMetadata(user: ChiveUser): void {
  if (typeof window === 'undefined') return;

  const metadata: SessionMetadata = {
    did: user.did,
    handle: user.handle,
    displayName: user.displayName,
    avatar: user.avatar,
    pdsEndpoint: user.pdsEndpoint,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  try {
    localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Failed to save session metadata:', error);
  }
}

/**
 * Load session metadata from localStorage.
 *
 * @returns Session metadata or null if not found
 */
export function loadSessionMetadata(): SessionMetadata | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(SESSION_METADATA_KEY);
    if (!stored) return null;

    const metadata = JSON.parse(stored) as SessionMetadata;

    // Update last activity
    metadata.lastActivity = Date.now();
    localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(metadata));

    return metadata;
  } catch (error) {
    console.error('Failed to load session metadata:', error);
    return null;
  }
}

/**
 * Clear session metadata from localStorage.
 */
export function clearSessionMetadata(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(SESSION_METADATA_KEY);
  } catch (error) {
    console.error('Failed to clear session metadata:', error);
  }
}

/**
 * Check if there's an existing session (from metadata).
 *
 * @remarks
 * This is a quick check for UI purposes. Actual session validity
 * must be verified with the server.
 *
 * @returns True if session metadata exists
 */
export function hasStoredSession(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return localStorage.getItem(SESSION_METADATA_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * In-memory token storage.
 *
 * @remarks
 * Tokens are stored only in memory for security.
 * Access tokens and refresh tokens are never persisted to localStorage.
 * The refresh token is stored in memory for client-side refresh capability.
 * For production deployments with higher security requirements,
 * refresh tokens should be stored in httpOnly cookies via a server endpoint.
 */
class TokenStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number = 0;
  private pdsEndpoint: string | null = null;

  /**
   * Store tokens after successful authentication.
   *
   * @param accessToken - JWT access token
   * @param refreshToken - Refresh token for obtaining new access tokens
   * @param expiresIn - Access token expiry in seconds
   * @param pdsEndpoint - PDS endpoint for refresh requests
   */
  setTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    pdsEndpoint: string
  ): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.pdsEndpoint = pdsEndpoint;
    // Expire 1 minute early to account for clock skew
    this.expiresAt = Date.now() + (expiresIn - 60) * 1000;
  }

  /**
   * Store access token (backwards compatibility).
   *
   * @param token - JWT access token
   * @param expiresIn - Expiry in seconds
   */
  setAccessToken(token: string, expiresIn: number): void {
    this.accessToken = token;
    // Expire 1 minute early to account for clock skew
    this.expiresAt = Date.now() + (expiresIn - 60) * 1000;
  }

  /**
   * Get access token if valid.
   *
   * @returns Access token or null if expired/missing
   */
  getAccessToken(): string | null {
    if (!this.accessToken) return null;
    if (Date.now() >= this.expiresAt) {
      // Do not clear here; allow refresh attempt.
      return null;
    }
    return this.accessToken;
  }

  /**
   * Get refresh token.
   *
   * @returns Refresh token or null if not available
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Get PDS endpoint for refresh requests.
   *
   * @returns PDS endpoint or null
   */
  getPdsEndpoint(): string | null {
    return this.pdsEndpoint;
  }

  /**
   * Check if token is expired or will expire soon.
   *
   * @param bufferMs - Buffer time in ms (default 5 min)
   * @returns True if token needs refresh
   */
  needsRefresh(bufferMs: number = 5 * 60 * 1000): boolean {
    if (!this.accessToken) return true;
    return Date.now() >= this.expiresAt - bufferMs;
  }

  /**
   * Check if refresh is possible (has refresh token).
   *
   * @returns True if refresh token is available
   */
  canRefresh(): boolean {
    return this.refreshToken !== null && this.pdsEndpoint !== null;
  }

  /**
   * Get expiry timestamp.
   */
  getExpiresAt(): number {
    return this.expiresAt;
  }

  /**
   * Clear stored tokens.
   */
  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.pdsEndpoint = null;
  }
}

/** Singleton token store instance */
export const tokenStore = new TokenStore();

/**
 * Generate a cryptographically random state parameter.
 *
 * @remarks
 * Used for CSRF protection in OAuth flow.
 *
 * @returns Random hex string
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Store OAuth state for verification.
 *
 * @param state - State parameter
 * @param data - Associated data (redirect URL, etc.)
 */
export function storeOAuthState(
  state: string,
  data: { redirectUrl?: string; pdsUrl?: string }
): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(
      `oauth_state_${state}`,
      JSON.stringify({ ...data, createdAt: Date.now() })
    );
  } catch (error) {
    console.error('Failed to store OAuth state:', error);
  }
}

/**
 * Retrieve and remove OAuth state.
 *
 * @param state - State parameter to verify
 * @returns Stored data or null if invalid/expired
 */
export function verifyOAuthState(state: string): { redirectUrl?: string; pdsUrl?: string } | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = `oauth_state_${state}`;
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;

    sessionStorage.removeItem(key);

    const data = JSON.parse(stored) as {
      redirectUrl?: string;
      pdsUrl?: string;
      createdAt: number;
    };

    // State expires after 10 minutes
    if (Date.now() - data.createdAt > 10 * 60 * 1000) {
      return null;
    }

    return { redirectUrl: data.redirectUrl, pdsUrl: data.pdsUrl };
  } catch (error) {
    console.error('Failed to verify OAuth state:', error);
    return null;
  }
}

/**
 * Clear all OAuth-related storage.
 *
 * @remarks
 * Call on logout to ensure complete cleanup.
 */
export function clearAllAuthStorage(): void {
  clearSessionMetadata();
  tokenStore.clear();

  if (typeof window === 'undefined') return;

  // Clear any OAuth states from sessionStorage
  try {
    const keys = Object.keys(sessionStorage);
    for (const key of keys) {
      if (key.startsWith('oauth_state_')) {
        sessionStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Failed to clear OAuth states:', error);
  }
}
