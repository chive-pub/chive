import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema.generated';
import { APIError } from '@/lib/errors';
import { getServiceAuthToken } from '@/lib/auth/service-auth';
import { getCurrentAgent } from '@/lib/auth/oauth-client';

// =============================================================================
// ERROR MIDDLEWARE
// =============================================================================

/**
 * Parsed error response from the API.
 */
interface ParsedErrorResponse {
  code: string;
  message: string;
  status?: number;
  details?: {
    resourceType?: string;
    resourceId?: string;
    field?: string;
    constraint?: string;
    retryAfter?: number;
  };
}

/**
 * Parses error response body from API into structured format.
 *
 * @param body - Raw response body
 * @returns Normalized error response
 */
function parseErrorResponse(body: unknown): ParsedErrorResponse {
  if (body && typeof body === 'object') {
    const e = body as Record<string, unknown>;
    return {
      code:
        typeof e.code === 'string' ? e.code : typeof e.error === 'string' ? e.error : 'API_ERROR',
      message: typeof e.message === 'string' ? e.message : 'An unknown error occurred',
      status: typeof e.status === 'number' ? e.status : undefined,
      details:
        typeof e.details === 'object' && e.details !== null
          ? (e.details as ParsedErrorResponse['details'])
          : undefined,
    };
  }
  return { code: 'API_ERROR', message: 'An unknown error occurred' };
}

/**
 * Global error handling middleware for openapi-fetch.
 *
 * @remarks
 * Intercepts all non-2xx responses and transforms them into typed APIError instances.
 * This provides consistent error handling across all API calls without requiring
 * error handling code at each call site.
 *
 * The middleware throws APIError which can be caught by:
 * - TanStack Query's error handling
 * - try/catch blocks in query functions
 * - React Error Boundaries
 */
const errorMiddleware: Middleware = {
  async onResponse({ request, response }) {
    if (!response.ok) {
      const body = await response
        .clone()
        .json()
        .catch(() => ({}));
      const errorResponse = parseErrorResponse(body);
      throw new APIError(errorResponse.message, response.status, new URL(request.url).pathname);
    }
    return response;
  },
};

// =============================================================================
// API CLIENTS
// =============================================================================

/**
 * Check if we're running in tunnel mode.
 *
 * @remarks
 * Tunnel mode is set by the dev scripts when using ngrok/localtunnel.
 */
const isTunnelMode =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEV_MODE === 'tunnel';

/**
 * Get the API base URL based on environment.
 *
 * @remarks
 * In tunnel mode (browser), use relative URL so requests go through Next.js proxy.
 * This avoids mixed content (HTTPS to HTTP) and ad blocker issues.
 * In server context or loopback mode, use the direct backend URL.
 */
export function getApiBaseUrl(): string {
  const isServer = typeof window === 'undefined';

  // Server-side always uses direct URL (no browser restrictions)
  if (isServer) {
    return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
  }

  // Browser in tunnel mode: use relative URL (proxied by Next.js rewrites)
  if (isTunnelMode) {
    return ''; // Empty string = relative to current origin
  }

  // Browser in loopback mode: use direct URL
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
}

/**
 * Type-safe API client generated from OpenAPI specification.
 * Uses openapi-fetch for runtime fetching with full TypeScript inference.
 *
 * @remarks
 * The schema types are generated from `/openapi.json` endpoint.
 * Run `pnpm openapi:generate` to update types after API changes.
 *
 * Error handling is automatic via middleware. All non-2xx responses
 * throw APIError without needing manual error checking at call sites.
 *
 * This client is for PUBLIC (unauthenticated) endpoints only.
 * For authenticated endpoints, use `authApi` instead.
 */
export const api = createClient<paths>({
  baseUrl: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Register error middleware for public API
api.use(errorMiddleware);

/**
 * Extract lexicon method from URL path.
 *
 * @param url - Request URL string
 * @returns Lexicon method (NSID) or undefined
 */
function extractLxmFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url, 'http://localhost').pathname;

    // XRPC pattern: /xrpc/pub.chive.claiming.startClaim
    if (pathname.startsWith('/xrpc/')) {
      return pathname.slice(6);
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Check if running in E2E test mode.
 *
 * @remarks
 * E2E test mode is detected when:
 * - NEXT_PUBLIC_E2E_TEST=true environment variable is set
 * - OR localStorage has 'chive_session_metadata' without a real OAuth session
 */
function isE2ETestMode(): boolean {
  if (typeof window === 'undefined') return false;
  // Check environment flag
  if (process.env.NEXT_PUBLIC_E2E_TEST === 'true') return true;
  // Also check for E2E marker in localStorage
  return localStorage.getItem('chive_e2e_skip_oauth') === 'true';
}

/**
 * Get E2E test user DID from localStorage session metadata.
 */
function getE2ETestUserDid(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const metadata = localStorage.getItem('chive_session_metadata');
    if (!metadata) return null;
    const parsed = JSON.parse(metadata);
    return parsed?.did ?? null;
  } catch {
    return null;
  }
}

/**
 * Get E2E test user handle from localStorage session metadata.
 */
function getE2ETestUserHandle(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const metadata = localStorage.getItem('chive_session_metadata');
    if (!metadata) return null;
    const parsed = JSON.parse(metadata);
    return parsed?.handle ?? null;
  } catch {
    return null;
  }
}

/**
 * Service auth middleware for openapi-fetch.
 *
 * @remarks
 * Implements the industry standard ATProto service authentication pattern:
 * 1. Gets the authenticated Agent from OAuth session
 * 2. Calls com.atproto.server.getServiceAuth on user's PDS to get a JWT
 * 3. JWT is signed with user's ATProto signing key (same as repo commits)
 * 4. Adds JWT to Authorization header
 * 5. Chive backend verifies JWT against user's DID document
 *
 * **E2E Testing Support:**
 * When in E2E test mode (no real OAuth), sends X-E2E-Auth-Did header instead
 * of a real JWT. The backend accepts this when ENABLE_E2E_AUTH_BYPASS=true.
 *
 * @see {@link https://docs.bsky.app/docs/advanced-guides/service-auth | ATProto Service Auth}
 */
const serviceAuthMiddleware: Middleware = {
  async onRequest({ request }) {
    // Only add auth in browser context
    if (typeof window === 'undefined') {
      return request;
    }

    // E2E test mode: use X-E2E-Auth-Did header instead of real OAuth
    if (isE2ETestMode()) {
      const e2eDid = getE2ETestUserDid();
      const e2eHandle = getE2ETestUserHandle();

      if (e2eDid) {
        const headers = new Headers(request.headers);
        headers.set('X-E2E-Auth-Did', e2eDid);
        if (e2eHandle) {
          headers.set('X-E2E-Auth-Handle', e2eHandle);
        }

        const requestInit: RequestInit & { duplex?: 'half' } = {
          method: request.method,
          headers,
          body: request.body,
          mode: request.mode,
          credentials: request.credentials,
          cache: request.cache,
          redirect: request.redirect,
          referrer: request.referrer,
          integrity: request.integrity,
        };

        if (request.body) {
          requestInit.duplex = 'half';
        }

        return new Request(request.url, requestInit);
      }
    }

    const agent = getCurrentAgent();
    if (!agent) {
      // Not authenticated; proceed without auth header.
      return request;
    }

    try {
      // Extract lexicon method for method-level authorization
      const lxm = extractLxmFromUrl(request.url);

      // Request service auth JWT from user's PDS
      const token = await getServiceAuthToken(agent, lxm);

      // Clone request and add Authorization header
      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${token}`);

      // Need to specify duplex for streaming body requests
      const requestInit: RequestInit & { duplex?: 'half' } = {
        method: request.method,
        headers,
        body: request.body,
        mode: request.mode,
        credentials: request.credentials,
        cache: request.cache,
        redirect: request.redirect,
        referrer: request.referrer,
        integrity: request.integrity,
      };

      // Add duplex for requests with a body (required for streaming bodies)
      if (request.body) {
        requestInit.duplex = 'half';
      }

      return new Request(request.url, requestInit);
    } catch (error) {
      console.error('Failed to get service auth token:', error);
      // Proceed without auth; let backend return 401.
      return request;
    }
  },
};

/**
 * Authenticated API client for endpoints requiring user authentication.
 *
 * @remarks
 * Implements the industry standard ATProto service authentication pattern:
 * 1. User completes ATProto OAuth in browser (via BrowserOAuthClient)
 * 2. For authenticated API calls, middleware calls com.atproto.server.getServiceAuth
 * 3. User's PDS issues a service auth JWT signed with user's ATProto signing key
 * 4. JWT is sent in Authorization header to Chive backend
 * 5. Chive verifies JWT by resolving user's DID document and checking signature
 *
 * This approach:
 * - Uses the same signing key that signs ATProto repo commits
 * - Requires no custom session management or cookie-based auth
 * - Is stateless and verifiable against the DID document
 * - Supports method-level authorization via lxm claim
 *
 * @see {@link https://docs.bsky.app/docs/advanced-guides/service-auth | ATProto Service Auth}
 * @see /lib/auth/service-auth.ts for service auth token management
 */
export const authApi = createClient<paths>({
  baseUrl: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Register service auth middleware (adds Authorization header with service auth JWT)
authApi.use(serviceAuthMiddleware);

// Register error middleware for authenticated API
authApi.use(errorMiddleware);

/**
 * Server-side API client with custom fetch for Server Components.
 * Includes Next.js cache configuration for data fetching.
 *
 * @remarks
 * Uses the same error middleware as the browser client for consistent
 * error handling across client and server.
 *
 * @param options - Additional fetch options
 * @returns Configured API client for server-side use
 */
export function createServerClient(options?: { revalidate?: number }) {
  const client = createClient<paths>({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001',
    headers: {
      'Content-Type': 'application/json',
      // Only include tunnel header when using localtunnel (avoids CORS issues in local mode)
      ...(isTunnelMode && { 'Bypass-Tunnel-Reminder': 'true' }),
    },
    fetch: async (input: Request) => {
      const response = await fetch(input, {
        next: { revalidate: options?.revalidate ?? 60 },
      });
      return response;
    },
  });
  client.use(errorMiddleware);
  return client;
}

/**
 * Type helper for extracting response data from API endpoints.
 */
export type ApiResponse<T> = T extends { data: infer D } ? D : never;
