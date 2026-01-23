/**
 * Session management for Faro observability.
 *
 * @remarks
 * Manages user session context for correlation across events.
 * Provides methods to set and clear user identity while respecting privacy.
 *
 * @packageDocumentation
 */

import type { Faro } from '@grafana/faro-web-sdk';

/**
 * User context for observability.
 */
export interface UserContext {
  /** User identifier (DID) - will be hashed for privacy */
  id?: string;
  /** User display name (handle) - will be redacted */
  username?: string;
  /** User email - will be redacted */
  email?: string;
  /** Additional attributes */
  attributes?: Record<string, string>;
}

/**
 * Session attributes.
 */
export interface SessionAttributes {
  /** Route/page name */
  route?: string;
  /** Feature flags */
  features?: string[];
  /** User role */
  role?: string;
  /** Tenant/organization */
  tenant?: string;
}

/**
 * Hash a string for privacy (simple hash, not cryptographic).
 * Used to correlate events without storing raw identifiers.
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `h_${Math.abs(hash).toString(16)}`;
}

/**
 * Create session management functions.
 *
 * @param faro - Faro instance
 * @returns Session management functions
 */
export function createSessionManager(faro: Faro | null) {
  return {
    /**
     * Set user context after authentication.
     *
     * @param user - User context
     */
    setUser(user: UserContext): void {
      if (!faro) return;

      faro.api.setUser({
        // Hash the ID for privacy while maintaining correlation
        id: user.id ? hashString(user.id) : undefined,
        // Don't send actual username/email - just indicate presence
        username: user.username ? 'authenticated' : undefined,
        email: user.email ? 'provided' : undefined,
        attributes: user.attributes,
      });
    },

    /**
     * Clear user context on logout.
     */
    clearUser(): void {
      if (!faro) return;

      faro.api.resetUser();
    },

    /**
     * Set session attributes.
     *
     * @param attributes - Session attributes
     */
    setSessionAttributes(attributes: SessionAttributes): void {
      if (!faro) return;

      const faroAttributes: Record<string, string> = {};

      if (attributes.route) {
        faroAttributes['route'] = attributes.route;
      }
      if (attributes.features) {
        faroAttributes['features'] = attributes.features.join(',');
      }
      if (attributes.role) {
        faroAttributes['role'] = attributes.role;
      }
      if (attributes.tenant) {
        faroAttributes['tenant'] = attributes.tenant;
      }

      faro.api.setSession({
        attributes: faroAttributes,
      });
    },

    /**
     * Get current session ID.
     */
    getSessionId(): string | undefined {
      if (!faro) return undefined;
      return faro.api.getSession()?.id;
    },

    /**
     * Push a view/navigation event.
     *
     * @param name - View name (usually route path)
     * @param attributes - Additional attributes
     */
    pushView(name: string, attributes?: Record<string, string>): void {
      if (!faro) return;

      faro.api.pushEvent('view', {
        name,
        ...attributes,
      });
    },
  };
}

/**
 * Storage key for session ID persistence.
 */
const SESSION_ID_KEY = 'chive:faro:sessionId';

/**
 * Get or create a persistent session ID.
 * This allows correlation across page reloads within the same browser session.
 */
export function getPersistedSessionId(): string {
  if (typeof sessionStorage === 'undefined') {
    return generateSessionId();
  }

  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;

    const newId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, newId);
    return newId;
  } catch {
    return generateSessionId();
  }
}

/**
 * Generate a new session ID.
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Clear persisted session ID.
 */
export function clearPersistedSessionId(): void {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_ID_KEY);
    } catch {
      // Ignore
    }
  }
}
