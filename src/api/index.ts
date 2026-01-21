/**
 * Chive API Layer.
 *
 * @remarks
 * Hono-based API layer with XRPC endpoints (ATProto standard), REST
 * compatibility, request validation, response formatting with PDS source
 * transparency, and 4-tier rate limiting.
 *
 * @packageDocumentation
 * @public
 */

// Server factory
export { createServer, type ServerConfig } from './server.js';

// Routes
export { registerRoutes } from './routes.js';

// Types
export type {
  ChiveEnv,
  ChiveServices,
  AuthenticatedUser,
  RateLimitTier,
  AuthContext,
  XRPCContext,
  XRPCResponse,
  XRPCMethod,
  XRPCMethodWithMeta,
  XRPCErrorResponse,
  XRPCStatusCode,
} from './types/index.js';

// Middleware
export {
  requestContext,
  errorHandler,
  createErrorResponse,
  validateQuery,
  validateBody,
  validateParams,
  validateAll,
  rateLimiter,
  conditionalRateLimiter,
  authenticateServiceAuth,
  requireAuth,
  requireAdmin,
  type ErrorResponse,
} from './middleware/index.js';

// Configuration
export {
  RATE_LIMITS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_KEY_PREFIX,
  CORS_CONFIG,
  PAGINATION,
  REQUEST_TIMEOUT_MS,
  API_VERSION,
  XRPC_PATH_PREFIX,
  REST_PATH_PREFIX,
  OPENAPI_PATHS,
  HEALTH_PATHS,
  SECURITY_HEADERS,
  SERVER_INFO,
  OPENAPI_SERVERS,
} from './config.js';

// Handlers
export {
  // XRPC handlers
  registerXRPCRoutes,
  allXRPCMethods,
  eprintMethods,
  graphMethods,
  metricsMethods,
  // REST handlers
  registerRESTRoutes,
  registerHealthRoutes,
  livenessHandler,
  readinessHandler,
} from './handlers/index.js';
