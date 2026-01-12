/**
 * API configuration constants.
 *
 * @remarks
 * Centralized configuration for the Chive API layer including rate limits,
 * CORS settings, pagination defaults, and security headers.
 *
 * @packageDocumentation
 * @public
 */

import type { RateLimitTier } from './types/context.js';

/**
 * Whether rate limiting is disabled (for E2E testing).
 *
 * @remarks
 * Set DISABLE_RATE_LIMITING=true to disable rate limiting entirely.
 * This should ONLY be used for testing, never in production.
 *
 * @public
 */
export const RATE_LIMITING_DISABLED = process.env.DISABLE_RATE_LIMITING === 'true';

/**
 * Rate limit configuration per tier (requests per minute).
 *
 * @remarks
 * Tiers are determined by authentication status:
 * - Anonymous: IP-based limiting for unauthenticated requests
 * - Authenticated: Standard authenticated user limits
 * - Premium: Enhanced limits for premium subscribers
 * - Admin: Elevated limits for administrative access
 *
 * When DISABLE_RATE_LIMITING=true, all tiers are set to effectively unlimited.
 *
 * @public
 */
export const RATE_LIMITS: Readonly<Record<RateLimitTier, number>> = RATE_LIMITING_DISABLED
  ? {
      anonymous: 999999,
      authenticated: 999999,
      premium: 999999,
      admin: 999999,
    }
  : {
      anonymous: 60,
      authenticated: 300,
      premium: 1000,
      admin: 5000,
    };

/**
 * Rate limit window in milliseconds.
 *
 * @public
 */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Redis key prefix for rate limiting.
 *
 * @public
 */
export const RATE_LIMIT_KEY_PREFIX = 'chive:ratelimit:';

/**
 * Rate limiter behavior when Redis is unavailable.
 *
 * @remarks
 * - `open`: Allow requests through when Redis is down (availability over security)
 * - `closed`: Reject requests when Redis is down (security over availability)
 *
 * For production environments following Zero Trust principles, `closed` is recommended.
 *
 * @public
 */
export const RATE_LIMIT_FAIL_MODE: 'open' | 'closed' =
  (process.env.RATE_LIMIT_FAIL_MODE as 'open' | 'closed') ?? 'closed';

/**
 * Staleness threshold for PDS sync in milliseconds.
 *
 * @remarks
 * Records not synced from their source PDS within this threshold are marked as stale.
 * Default is 7 days (604,800,000 ms) per ATProto compliance requirements.
 *
 * @public
 */
export const STALENESS_THRESHOLD_MS =
  Number(process.env.STALENESS_THRESHOLD_MS) || 7 * 24 * 60 * 60 * 1000;

/**
 * CORS configuration.
 *
 * @public
 */
/**
 * Parse additional CORS origins from environment variable.
 * CORS_ORIGINS should be a comma-separated list of origins.
 */
function getAdditionalOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;
  if (!envOrigins) return [];
  return envOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export const CORS_CONFIG = {
  /**
   * Allowed origins for CORS requests.
   */
  origins: [
    'https://chive.pub',
    'https://www.chive.pub',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...getAdditionalOrigins(),
  ],

  /**
   * Allowed HTTP methods.
   */
  allowMethods: ['GET', 'POST', 'OPTIONS'] as const,

  /**
   * Allowed request headers.
   */
  allowHeaders: [
    'Authorization',
    'Content-Type',
    'X-Request-ID',
    'Accept',
    'Accept-Language',
    'Bypass-Tunnel-Reminder',
    // E2E test auth bypass headers (only processed when ENABLE_E2E_AUTH_BYPASS=true)
    'X-E2E-Auth-Did',
    'X-E2E-Auth-Handle',
    'X-E2E-Auth-Admin',
  ],

  /**
   * Headers exposed to client.
   */
  exposeHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After',
  ],

  /**
   * Preflight cache duration in seconds.
   */
  maxAge: 86400,

  /**
   * Allow credentials (cookies, authorization headers).
   */
  credentials: true,
} as const;

/**
 * Pagination defaults.
 *
 * @public
 */
export const PAGINATION = {
  /**
   * Default page size.
   */
  defaultLimit: 50,

  /**
   * Maximum page size.
   */
  maxLimit: 100,

  /**
   * Minimum page size.
   */
  minLimit: 1,
} as const;

/**
 * Request timeout in milliseconds.
 *
 * @public
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * API version.
 *
 * @public
 */
export const API_VERSION = '0.1.0';

/**
 * XRPC endpoint path prefix.
 *
 * @public
 */
export const XRPC_PATH_PREFIX = '/xrpc';

/**
 * REST API path prefix.
 *
 * @public
 */
export const REST_PATH_PREFIX = '/api/v1';

/**
 * OpenAPI documentation paths.
 *
 * @public
 */
export const OPENAPI_PATHS = {
  spec: '/openapi.json',
  docs: '/docs',
} as const;

/**
 * Health check paths.
 *
 * @public
 */
export const HEALTH_PATHS = {
  liveness: '/health',
  readiness: '/ready',
} as const;

/**
 * Security headers configuration.
 *
 * @public
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
} as const;

/**
 * Server metadata for OpenAPI spec.
 *
 * @public
 */
export const SERVER_INFO = {
  title: 'Chive API',
  description: 'AT Protocol AppView for scholarly preprints',
  version: API_VERSION,
  contact: {
    name: 'Chive',
    url: 'https://chive.pub',
    email: 'contact@chive.pub',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
} as const;

/**
 * OpenAPI servers configuration.
 *
 * @public
 */
export const OPENAPI_SERVERS = [
  { url: 'https://api.chive.pub', description: 'Production' },
  { url: 'http://localhost:3000', description: 'Development' },
] as const;
