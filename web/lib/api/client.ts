/**
 * Chive API Client using ATProto XRPC.
 *
 * @remarks
 * Uses the lexicon-generated typed client for full type safety.
 * This is the industry standard approach for ATProto applications.
 *
 * @packageDocumentation
 */

import { AtpBaseClient } from './generated/index';
import { APIError } from '@/lib/errors';
import { getServiceAuthToken } from '@/lib/auth/service-auth';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { logger } from '@/lib/observability';
import { getFaro } from '@/lib/observability/faro/initialize';

// =============================================================================
// TELEMETRY HELPER
// =============================================================================

/**
 * Reports an error to Faro telemetry.
 */
function reportErrorToFaro(error: Error, context: Record<string, string>): void {
  try {
    const faro = getFaro();
    if (!faro) return;

    faro.api.pushError(error, {
      context,
      type: 'api-error',
    });
  } catch {
    // Silently fail - don't let telemetry errors affect the app
  }
}

// Re-export types from generated client
export * from './generated/index';

// =============================================================================
// REQUEST CORRELATION
// =============================================================================

/**
 * Generates a unique request ID for correlation.
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Generates a W3C Trace Context traceparent header.
 *
 * @remarks
 * Format: 00-trace_id-span_id-trace_flags
 * - version: 00 (current version)
 * - trace_id: 32 hex chars (128-bit random)
 * - span_id: 16 hex chars (64-bit random)
 * - trace_flags: 01 (sampled)
 *
 * @see https://www.w3.org/TR/trace-context/
 */
function generateTraceparent(): { traceparent: string; traceId: string; spanId: string } {
  // Generate random trace ID (128-bit / 32 hex chars)
  const traceIdArray = new Uint8Array(16);
  crypto.getRandomValues(traceIdArray);
  const traceId = Array.from(traceIdArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Generate random span ID (64-bit / 16 hex chars)
  const spanIdArray = new Uint8Array(8);
  crypto.getRandomValues(spanIdArray);
  const spanId = Array.from(spanIdArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // trace_flags: 01 = sampled
  const traceparent = `00-${traceId}-${spanId}-01`;

  return { traceparent, traceId, spanId };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Check if we're running in tunnel mode.
 */
const isTunnelMode =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEV_MODE === 'tunnel';

/**
 * Get the API base URL based on environment.
 */
export function getApiBaseUrl(): string {
  const isServer = typeof window === 'undefined';

  if (isServer) {
    return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
  }

  if (isTunnelMode) {
    return '';
  }

  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
}

// =============================================================================
// E2E TEST SUPPORT
// =============================================================================

function isE2ETestMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_E2E_TEST === 'true') return true;
  return localStorage.getItem('chive_e2e_skip_oauth') === 'true';
}

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

// =============================================================================
// CUSTOM FETCH HANDLER
// =============================================================================

/**
 * Creates headers for authenticated requests.
 */
async function getAuthHeaders(headers: Headers, url: string): Promise<Headers> {
  // E2E test mode
  if (isE2ETestMode()) {
    const e2eDid = getE2ETestUserDid();
    const e2eHandle = getE2ETestUserHandle();
    if (e2eDid) {
      headers.set('X-E2E-Auth-Did', e2eDid);
      if (e2eHandle) {
        headers.set('X-E2E-Auth-Handle', e2eHandle);
      }
    }
    return headers;
  }

  // Real OAuth
  const agent = getCurrentAgent();
  if (agent) {
    try {
      // Extract lexicon method for method-level authorization
      const parsedUrl = new URL(url, 'http://localhost');
      const lxm = parsedUrl.pathname.startsWith('/xrpc/') ? parsedUrl.pathname.slice(6) : undefined;

      const token = await getServiceAuthToken(agent, lxm);
      headers.set('Authorization', `Bearer ${token}`);
    } catch (error) {
      logger.error('Failed to get service auth token', error as Error, {
        component: 'api-client',
        endpoint: new URL(url, 'http://localhost').pathname,
      });
    }
  }

  return headers;
}

/**
 * Creates a fetch handler with authentication support and observability.
 *
 * @remarks
 * Returns a function matching the standard fetch signature expected by @atproto/xrpc:
 * `(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>`
 *
 * Features:
 * - Structured logging of all requests and responses
 * - W3C Trace Context propagation for distributed tracing
 * - Request ID generation for correlation
 * - Performance timing
 */
function createFetchHandler(options: { authenticated: boolean }): typeof globalThis.fetch {
  return async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const parsedUrl = new URL(url, 'http://localhost');
    const endpoint = parsedUrl.pathname;

    // Generate correlation IDs
    const requestId = generateRequestId();
    const trace = generateTraceparent();

    // Add correlation headers
    headers.set('X-Request-ID', requestId);
    headers.set('traceparent', trace.traceparent);

    // Add tunnel bypass header if needed
    if (isTunnelMode) {
      headers.set('Bypass-Tunnel-Reminder', 'true');
    }

    // Add authentication if requested
    if (options.authenticated && typeof window !== 'undefined') {
      await getAuthHeaders(headers, url);
    }

    // Create request-scoped logger
    const requestLogger = logger.child({
      requestId,
      traceId: trace.traceId,
      spanId: trace.spanId,
      endpoint,
      method,
    });

    requestLogger.debug('API request started');

    const startTime = performance.now();

    try {
      const response = await fetch(input, {
        ...init,
        headers,
      });

      const durationMs = Math.round(performance.now() - startTime);
      const status = response.status;

      // Check for errors and throw APIError for non-ok responses
      if (!response.ok) {
        const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const errorMessage =
          typeof responseBody.message === 'string'
            ? responseBody.message
            : 'An unknown error occurred';

        // 404 is often expected (e.g., user hasn't endorsed yet, resource doesn't exist)
        // Only log as debug, not as warning, and don't report to Faro
        if (status === 404) {
          requestLogger.debug('Resource not found', {
            status,
            durationMs,
          });
        } else {
          requestLogger.warn('API request failed', {
            status,
            durationMs,
            error: errorMessage,
          });

          // Report to Faro telemetry (skip 404s as they're often expected)
          const apiError = new APIError(errorMessage, status, endpoint);
          reportErrorToFaro(apiError, {
            endpoint,
            method,
            status: String(status),
            requestId,
            traceId: trace.traceId,
          });
        }

        throw new APIError(errorMessage, status, endpoint);
      }

      requestLogger.debug('API request completed', {
        status,
        durationMs,
      });

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);

      // Only log if not already logged (APIError case)
      if (!(error instanceof APIError)) {
        requestLogger.error('API request error', error as Error, {
          durationMs,
        });

        // Report non-API errors to Faro (network errors, XRPC validation errors, etc.)
        const errorObj = error instanceof Error ? error : new Error(String(error));
        reportErrorToFaro(errorObj, {
          endpoint,
          method,
          requestId,
          traceId: trace.traceId,
          errorType: errorObj.name || 'UnknownError',
          durationMs: String(durationMs),
        });
      }

      throw error;
    }
  };
}

// =============================================================================
// API CLIENTS
// =============================================================================

/**
 * Public API client for unauthenticated requests.
 *
 * @example
 * ```typescript
 * const result = await api.pub.chive.eprint.getSubmission({ uri: '...' });
 * console.log(result.data.value.title);
 * ```
 */
export const api = new AtpBaseClient({
  service: getApiBaseUrl(),
  fetch: createFetchHandler({ authenticated: false }),
});

/**
 * Authenticated API client for requests requiring user authentication.
 *
 * @remarks
 * Implements ATProto service authentication pattern:
 * 1. Gets authenticated Agent from OAuth session
 * 2. Calls com.atproto.server.getServiceAuth on user's PDS
 * 3. Adds JWT to Authorization header
 * 4. Chive backend verifies JWT against user's DID document
 *
 * @example
 * ```typescript
 * const result = await authApi.pub.chive.claiming.startClaim({ importId: 123 });
 * ```
 */
export const authApi = new AtpBaseClient({
  service: getApiBaseUrl(),
  fetch: createFetchHandler({ authenticated: true }),
});

/**
 * Create a server-side API client with Next.js caching.
 *
 * @remarks
 * Includes observability features:
 * - Request ID generation for correlation
 * - W3C Trace Context propagation
 * - Structured logging
 */
export function createServerClient(options?: { revalidate?: number }) {
  const serverFetch: typeof globalThis.fetch = async (
    input: URL | RequestInfo,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const parsedUrl = new URL(url, 'http://localhost');
    const endpoint = parsedUrl.pathname;

    // Generate correlation IDs
    const requestId = generateRequestId();
    const trace = generateTraceparent();

    // Add correlation headers
    headers.set('X-Request-ID', requestId);
    headers.set('traceparent', trace.traceparent);

    if (isTunnelMode) {
      headers.set('Bypass-Tunnel-Reminder', 'true');
    }

    // Create request-scoped logger
    const requestLogger = logger.child({
      requestId,
      traceId: trace.traceId,
      spanId: trace.spanId,
      endpoint,
      method,
      server: true,
    });

    requestLogger.debug('Server API request started');

    const startTime = performance.now();

    try {
      const response = await fetch(input, {
        ...init,
        headers,
        next: { revalidate: options?.revalidate ?? 60 },
      } as RequestInit);

      const durationMs = Math.round(performance.now() - startTime);
      const status = response.status;

      if (!response.ok) {
        const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const errorMessage =
          typeof responseBody.message === 'string'
            ? responseBody.message
            : 'An unknown error occurred';

        // 404 is often expected, don't log as warning
        if (status === 404) {
          requestLogger.debug('Server resource not found', {
            status,
            durationMs,
          });
        } else {
          requestLogger.warn('Server API request failed', {
            status,
            durationMs,
            error: errorMessage,
          });
        }

        throw new APIError(errorMessage, status, endpoint);
      }

      requestLogger.debug('Server API request completed', {
        status,
        durationMs,
      });

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);

      if (!(error instanceof APIError)) {
        requestLogger.error('Server API request error', error as Error, {
          durationMs,
        });
      }

      throw error;
    }
  };

  return new AtpBaseClient({
    service: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001',
    fetch: serverFetch,
  });
}
