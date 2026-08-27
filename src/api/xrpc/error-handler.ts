/**
 * XRPC error handling middleware for Hono.
 *
 * @remarks
 * Converts errors to ATProto-compliant error responses with flat structure:
 * ```json
 * {
 *   "error": "InvalidRequest",
 *   "message": "Missing required field: uri"
 * }
 * ```
 *
 * This differs from the Stripe/GitHub nested format used elsewhere in the app.
 * XRPC endpoints use the ATProto standard format.
 *
 * @packageDocumentation
 * @public
 */

import { XRPCError } from '@atproto/xrpc-server';
import type { ErrorHandler } from 'hono';

import {
  ChiveError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
} from '../../types/errors.js';
import type { ChiveEnv } from '../types/context.js';

import type { XRPCErrorResponse, XRPCStatusCode } from './types.js';

/**
 * Maps ChiveError to XRPC error name.
 *
 * @param error - Error instance
 * @returns XRPC error name
 */
function getXRPCErrorName(error: Error): string {
  if (error instanceof XRPCError) {
    return error.payload.error ?? 'InternalServerError';
  }
  if (error instanceof ValidationError) {
    return 'InvalidRequest';
  }
  if (error instanceof AuthenticationError) {
    return 'AuthenticationRequired';
  }
  if (error instanceof AuthorizationError) {
    return 'Forbidden';
  }
  if (error instanceof NotFoundError) {
    return 'NotFound';
  }
  if (error instanceof RateLimitError) {
    return 'RateLimitExceeded';
  }
  if (error instanceof ChiveError) {
    return error.code;
  }
  return 'InternalServerError';
}

/**
 * Maps error to HTTP status code.
 *
 * @param error - Error instance
 * @returns HTTP status code
 */
function getStatusCode(error: Error): XRPCStatusCode {
  if (error instanceof XRPCError) {
    return error.statusCode as XRPCStatusCode;
  }
  if (error instanceof ValidationError) {
    return 400;
  }
  if (error instanceof AuthenticationError) {
    return 401;
  }
  if (error instanceof AuthorizationError) {
    return 403;
  }
  if (error instanceof NotFoundError) {
    return 404;
  }
  if (error instanceof RateLimitError) {
    return 429;
  }
  return 500;
}

/**
 * Gets error message, potentially with field info for validation errors.
 *
 * @param error - Error instance
 * @returns Error message
 */
function getErrorMessage(error: Error): string {
  if (error instanceof XRPCError) {
    return error.payload.message ?? 'An error occurred';
  }
  if (error instanceof ValidationError) {
    if (error.field) {
      return `${error.message} (field: ${error.field})`;
    }
    return error.message;
  }
  if (error instanceof ChiveError) {
    return error.message;
  }
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production') {
    return 'An internal error occurred';
  }
  return error.message;
}

/**
 * XRPC error handler for Hono.
 *
 * @remarks
 * Returns ATProto-compliant flat error responses. Use this handler
 * specifically for `/xrpc/*` routes.
 *
 * @example
 * ```typescript
 * const app = new Hono<ChiveEnv>();
 * app.onError(xrpcErrorHandler);
 * ```
 *
 * @public
 */
export const xrpcErrorHandler: ErrorHandler<ChiveEnv> = (err, c) => {
  const logger = c.get('logger');

  // Log by the status the client will actually receive, not by error class.
  //
  // The chain this replaces branched on type, and two classes fell through it
  // badly: `ValidationError` matched no branch at all, so every 400 went
  // unlogged; and `NotFoundError` matched the `ChiveError` branch, so every 404
  // was recorded at error severity and filled the error dashboards with routine
  // misses. Deciding from the resolved status cannot develop that kind of gap
  // when a new error class is added.
  const status = getStatusCode(err);

  if (status >= 500) {
    logger.error('XRPC server error', err instanceof Error ? err : undefined, {
      status,
      errorType: err?.constructor?.name ?? 'Unknown',
      ...(err instanceof ChiveError ? { code: err.code } : {}),
    });
  } else {
    logger.debug('XRPC client error', {
      status,
      error: getXRPCErrorName(err),
      message: getErrorMessage(err),
      errorType: err?.constructor?.name ?? 'Unknown',
    });
  }

  const response: XRPCErrorResponse = {
    error: getXRPCErrorName(err),
    message: getErrorMessage(err),
  };

  // Add Retry-After header for rate limit errors
  if (err instanceof RateLimitError) {
    c.header('Retry-After', String(err.retryAfter));
  }

  return c.json(response, status);
};
