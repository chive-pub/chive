/**
 * Centralized error handling middleware.
 *
 * @remarks
 * Maps ChiveError types to HTTP responses with ATProto-compliant flat format.
 *
 * Response format:
 * ```json
 * {
 *   "error": "NotFound",
 *   "message": "Eprint not found: at://did:plc:abc/..."
 * }
 * ```
 *
 * @packageDocumentation
 * @public
 */

import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

import {
  ChiveError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ComplianceError,
  DatabaseError,
} from '../../types/errors.js';
import type { ChiveEnv } from '../types/context.js';

/**
 * Error response structure.
 *
 * @remarks
 * ATProto-compliant flat error format.
 *
 * @public
 */
export interface ErrorResponse {
  /**
   * Machine-readable error type.
   */
  readonly error: string;

  /**
   * Human-readable error message.
   */
  readonly message: string;
}

/**
 * HTTP status code type for type safety.
 */
type HTTPStatusCode = 400 | 401 | 403 | 404 | 429 | 500 | 503;

/**
 * Maps error type to HTTP status code.
 *
 * @param error - Error instance
 * @returns Appropriate HTTP status code
 */
function getStatusCode(error: Error): HTTPStatusCode {
  if (error instanceof ValidationError) return 400;
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof AuthorizationError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof RateLimitError) return 429;
  if (error instanceof ComplianceError) return 500;
  if (error instanceof DatabaseError) return 500;
  if (error instanceof HTTPException) {
    return error.status as HTTPStatusCode;
  }
  return 500;
}

/**
 * Maps ChiveError to ATProto error name.
 *
 * @param error - Error instance
 * @returns ATProto error name
 */
function getErrorName(error: Error): string {
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
 * Error handler for Hono application.
 *
 * @remarks
 * Handles all errors thrown in route handlers and middleware:
 * - ChiveError subclasses are mapped to appropriate HTTP status codes
 * - Returns ATProto-compliant flat error format
 *
 * @example
 * ```typescript
 * const app = new Hono<ChiveEnv>();
 * app.onError(errorHandler);
 * ```
 *
 * @public
 */
export const errorHandler: ErrorHandler<ChiveEnv> = (err, c) => {
  const logger = c.get('logger');

  // Log error with appropriate severity
  if (err instanceof ChiveError) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      // Client errors (debug level)
      logger.debug('Client error', {
        code: err.code,
        message: err.message,
      });
    } else if (err instanceof RateLimitError) {
      // Rate limits (warn level)
      logger.warn('Rate limit exceeded', {
        retryAfter: err.retryAfter,
      });
    } else if (err instanceof AuthenticationError || err instanceof AuthorizationError) {
      // Auth errors (info level)
      logger.info('Auth error', {
        code: err.code,
        message: err.message,
      });
    } else {
      // Server errors (error level)
      logger.error('Server error', err, {
        code: err.code,
      });
    }
  } else if (err instanceof HTTPException) {
    logger.warn('HTTP exception', {
      status: err.status,
      message: err.message,
    });
  } else {
    // Unexpected errors: always log at error level
    logger.error('Unexpected error', err instanceof Error ? err : undefined, {
      errorType: err?.constructor?.name ?? 'Unknown',
    });
  }

  const statusCode = getStatusCode(err);

  // Build ATProto-compliant flat error response
  const response: ErrorResponse = {
    error: getErrorName(err),
    message:
      err instanceof ChiveError
        ? err.message
        : statusCode === 500
          ? 'An unexpected error occurred'
          : err instanceof Error
            ? err.message
            : 'Unknown error',
  };

  // Add retry-after for rate limit errors
  if (err instanceof RateLimitError) {
    c.header('Retry-After', String(err.retryAfter));
  }

  return c.json(response, statusCode);
};

/**
 * Creates an ATProto-compliant error response object.
 *
 * @remarks
 * Utility function for creating standardized flat error responses.
 *
 * @param error - Error type
 * @param message - Error message
 * @returns Error response object
 *
 * @public
 */
export function createErrorResponse(error: string, message: string): ErrorResponse {
  return { error, message };
}
