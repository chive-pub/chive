/**
 * Centralized error handling middleware.
 *
 * @remarks
 * Maps ChiveError types to HTTP responses with consistent JSON structure
 * following industry-standard API patterns (Stripe, GitHub).
 *
 * Response format:
 * ```json
 * {
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "Preprint not found: at://did:plc:abc/...",
 *     "field": "uri",
 *     "requestId": "req_abc123"
 *   }
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
 * Matches Stripe/GitHub API error response patterns for client consistency.
 *
 * @public
 */
export interface ErrorResponse {
  readonly error: {
    /**
     * Machine-readable error code.
     */
    readonly code: string;

    /**
     * Human-readable error message.
     */
    readonly message: string;

    /**
     * Field that caused the error (validation errors only).
     */
    readonly field?: string;

    /**
     * Seconds to wait before retrying (rate limit errors only).
     */
    readonly retryAfter?: number;

    /**
     * Request ID for correlation.
     */
    readonly requestId: string;
  };
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
 * Error handler for Hono application.
 *
 * @remarks
 * Handles all errors thrown in route handlers and middleware:
 * - ChiveError subclasses are mapped to appropriate HTTP status codes
 * - Error details are logged with request context
 * - Response includes request ID for support correlation
 * - Internal error details are not exposed in production
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
  const requestId = c.get('requestId') ?? 'unknown';

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

  // Build error response
  let response: ErrorResponse = {
    error: {
      code: err instanceof ChiveError ? err.code : 'INTERNAL_ERROR',
      message:
        err instanceof ChiveError
          ? err.message
          : statusCode === 500
            ? 'An unexpected error occurred'
            : err instanceof Error
              ? err.message
              : 'Unknown error',
      requestId,
    },
  };

  // Add field for validation errors
  if (err instanceof ValidationError && err.field) {
    response = { error: { ...response.error, field: err.field } };
  }

  // Add retry-after for rate limit errors
  if (err instanceof RateLimitError) {
    response = { error: { ...response.error, retryAfter: err.retryAfter } };
    c.header('Retry-After', String(err.retryAfter));
  }

  return c.json(response, statusCode);
};

/**
 * Creates an error response object.
 *
 * @remarks
 * Utility function for creating standardized error responses in handlers.
 *
 * @param code - Error code
 * @param message - Error message
 * @param requestId - Request ID for correlation
 * @param options - Additional error fields
 * @returns Error response object
 *
 * @public
 */
export function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  options?: { field?: string; retryAfter?: number }
): ErrorResponse {
  return {
    error: {
      code,
      message,
      requestId,
      ...options,
    },
  };
}
