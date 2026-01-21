/**
 * XRPC module exports.
 *
 * @remarks
 * Provides ATProto-compliant XRPC handling for Hono applications.
 * This module includes:
 * - Type definitions for handlers and responses
 * - Error classes from @atproto/xrpc-server
 * - Hono adapter for XRPC routing
 * - Validation utilities using @atproto/lexicon
 * - Error handling middleware
 *
 * @packageDocumentation
 * @public
 */

// Types
export type {
  AuthContext,
  XRPCContext,
  XRPCResponse,
  XRPCMethod,
  XRPCErrorResponse,
  XRPCStatusCode,
  RateLimitTier,
  XRPCMethodWithMeta,
} from './types.js';

// Errors (re-exported from @atproto/xrpc-server + custom)
export {
  XRPCError,
  InvalidRequestError,
  AuthRequiredError,
  ForbiddenError,
  InternalServerError,
  UpstreamFailureError,
  UpstreamTimeoutError,
  NotEnoughResourcesError,
  MethodNotImplementedError,
  RateLimitExceededError,
  NotFoundError,
} from './errors.js';

// Hono adapter
export {
  createXRPCRouter,
  createSimpleXRPCRouter,
  registerMethods,
  type CreateXRPCRouterOptions,
  type XRPCRouter,
} from './hono-adapter.js';

// Validation
export {
  validateXrpcParams,
  validateXrpcInput,
  validateXrpcOutput,
  safeValidateParams,
  hasMethod,
  getMethodType,
} from './validation.js';

// Utilities
export { decodeQueryParam, decodeQueryParams, nsidToPath, pathToNsid, isQuery } from './util.js';

// Error handler
export { xrpcErrorHandler } from './error-handler.js';
