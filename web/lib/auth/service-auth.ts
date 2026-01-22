/**
 * ATProto Service Auth JWT management for Chive.
 *
 * @remarks
 * Implements the industry standard ATProto service authentication pattern.
 * After OAuth authentication, the frontend requests a service auth JWT from
 * the user's PDS for Chive. This JWT is signed with the user's ATProto
 * signing key (same key that signs repo commits) and is verified by the
 * Chive backend against the user's DID document.
 *
 * Flow:
 * 1. User completes ATProto OAuth in browser (handled by BrowserOAuthClient)
 * 2. Frontend calls com.atproto.server.getServiceAuth on user's PDS
 * 3. PDS issues a service auth JWT with:
 *    - iss: user's DID
 *    - aud: Chive's service DID (did:web:chive.pub)
 *    - lxm: optional lexicon method for method-level authorization
 *    - exp: short expiration (typically 60 seconds)
 * 4. Frontend sends JWT in Authorization header for Chive API calls
 * 5. Chive verifies JWT by resolving user's DID document and checking signature
 *
 * @see {@link https://docs.bsky.app/docs/advanced-guides/service-auth | ATProto Service Auth}
 * @packageDocumentation
 */

import type { Agent } from '@atproto/api';

import { logger } from '@/lib/observability';

const serviceAuthLogger = logger.child({ component: 'service-auth' });

/**
 * Chive's service DID for service auth JWT audience claim.
 *
 * @remarks
 * This must match the SERVICE_DID environment variable on the backend.
 * For development, use a test DID. For production, use did:web:chive.pub.
 */
const CHIVE_SERVICE_DID = process.env.NEXT_PUBLIC_CHIVE_SERVICE_DID ?? 'did:web:chive.pub';

/**
 * Service auth JWT response from PDS.
 */
interface ServiceAuthResponse {
  /** The service auth JWT */
  token: string;
}

/**
 * Cached service auth token with expiration.
 */
interface CachedServiceAuthToken {
  /** The JWT string */
  token: string;
  /** Expiration timestamp (ms since epoch) */
  expiresAt: number;
  /** Lexicon method the token is authorized for */
  lxm?: string;
}

/**
 * Token cache keyed by lexicon method (or empty string for general tokens).
 */
const tokenCache = new Map<string, CachedServiceAuthToken>();

/**
 * Minimum remaining validity (ms) before refreshing token.
 * Service auth tokens are short-lived (typically 60s), so we refresh early.
 */
const TOKEN_REFRESH_MARGIN_MS = 10_000; // 10 seconds

/**
 * Request a service auth JWT from the user's PDS for Chive.
 *
 * @remarks
 * Uses com.atproto.server.getServiceAuth to request a JWT from the user's PDS.
 * The JWT is signed with the user's ATProto signing key and includes:
 * - iss: user's DID
 * - aud: Chive's service DID
 * - lxm: optional lexicon method (for method-level authorization)
 * - exp: short expiration (typically 60 seconds)
 *
 * @param agent - Authenticated ATProto Agent from OAuth session
 * @param lxm - Optional lexicon method for method-level authorization
 * @returns Service auth JWT string
 * @throws Error if the PDS rejects the request
 *
 * @example
 * ```typescript
 * const agent = getCurrentAgent();
 * const jwt = await getServiceAuthToken(agent, 'pub.chive.claiming.startClaim');
 *
 * fetch('/xrpc/pub.chive.claiming.startClaim', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${jwt}`,
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({ importId: 123 }),
 * });
 * ```
 */
export async function getServiceAuthToken(agent: Agent, lxm?: string): Promise<string> {
  // Check cache first
  const cacheKey = lxm ?? '';
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return cached.token;
  }

  // Request new service auth token from PDS
  const response = await agent.com.atproto.server.getServiceAuth({
    aud: CHIVE_SERVICE_DID,
    lxm,
  });

  const { token } = response.data as ServiceAuthResponse;

  // Decode JWT to get expiration (service auth JWTs are short-lived)
  const payload = decodeJwtPayload(token);
  const expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + 60_000;

  // Cache the token
  tokenCache.set(cacheKey, { token, expiresAt, lxm });

  return token;
}

/**
 * Clear all cached service auth tokens.
 *
 * @remarks
 * Call this on logout to ensure stale tokens are not used.
 */
export function clearServiceAuthTokens(): void {
  tokenCache.clear();
}

/**
 * Check if a service auth token is available and valid.
 *
 * @param lxm - Optional lexicon method
 * @returns True if a valid cached token exists
 */
export function hasValidServiceAuthToken(lxm?: string): boolean {
  const cacheKey = lxm ?? '';
  const cached = tokenCache.get(cacheKey);

  if (!cached) return false;

  return cached.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS;
}

/**
 * Decode JWT payload without verification.
 *
 * @remarks
 * This is safe because we're only using it to read the expiration time
 * for caching purposes. The backend will verify the signature.
 *
 * @param token - JWT string
 * @returns Decoded payload
 */
function decodeJwtPayload(token: string): { exp?: number; iss?: string; aud?: string } {
  try {
    const [, payload] = token.split('.');
    if (!payload) return {};

    // Base64url decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);

    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

/**
 * Create a fetch wrapper that automatically adds service auth JWT.
 *
 * @remarks
 * This wraps fetch to automatically request a service auth JWT from the
 * user's PDS and include it in the Authorization header. If the agent is
 * not available, the request is made without authentication.
 *
 * @param agent - Authenticated ATProto Agent from OAuth session
 * @returns Fetch function with automatic service auth
 *
 * @example
 * ```typescript
 * const agent = getCurrentAgent();
 * const fetchWithAuth = createServiceAuthFetch(agent);
 *
 * const response = await fetchWithAuth('/xrpc/pub.chive.claiming.startClaim', {
 *   method: 'POST',
 *   body: JSON.stringify({ importId: 123 }),
 * });
 * ```
 */
export function createServiceAuthFetch(
  agent: Agent | null
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // If no agent, make unauthenticated request
    if (!agent) {
      return fetch(input, init);
    }

    // Determine the lexicon method from the URL path
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const lxm = extractLxmFromUrl(url);

    try {
      // Get service auth token for this request
      const token = await getServiceAuthToken(agent, lxm);

      // Add Authorization header
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${token}`);

      return fetch(input, {
        ...init,
        headers,
      });
    } catch (error) {
      serviceAuthLogger.error('Failed to get service auth token', error, { lxm });
      // Fall back to unauthenticated request
      return fetch(input, init);
    }
  };
}

/**
 * Extract lexicon method from URL.
 *
 * @remarks
 * XRPC URLs follow the pattern /xrpc/{nsid}
 *
 * @param url - Request URL
 * @returns Lexicon method or undefined
 */
function extractLxmFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url, window.location.origin);
    const pathname = parsed.pathname;

    // XRPC pattern: /xrpc/pub.chive.claiming.startClaim
    if (pathname.startsWith('/xrpc/')) {
      return pathname.slice(6); // Remove '/xrpc/'
    }

    // API v1 proxy pattern: /api/v1/xrpc/pub.chive.claiming.startClaim
    if (pathname.includes('/xrpc/')) {
      const match = pathname.match(/\/xrpc\/([a-zA-Z0-9.]+)/);
      return match?.[1];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export { CHIVE_SERVICE_DID };
