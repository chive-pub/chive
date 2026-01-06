/**
 * Error classification for retry and circuit breaker strategies.
 *
 * @remarks
 * Classifies errors into categories that determine retry behavior:
 * - **TRANSIENT**: Temporary failures that can be retried (network issues, timeouts, 5xx errors)
 * - **PERMANENT**: Failures that won't resolve with retries (validation, not found, auth errors)
 * - **RATE_LIMIT**: Special case requiring backoff before retry
 *
 * Industry standard error classification follows the approach used by AWS SDK,
 * Google Cloud Client Libraries, and Azure SDKs.
 *
 * @packageDocumentation
 * @public
 */

import {
  AuthenticationError,
  AuthorizationError,
  ChiveError,
  ComplianceError,
  DatabaseError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../../types/errors.js';

/**
 * Error classification for retry logic.
 *
 * @public
 */
export enum ErrorType {
  /**
   * Transient errors that may resolve on retry.
   *
   * @remarks
   * Examples: Network timeouts, connection failures, temporary service unavailability,
   * database deadlocks, 500/502/503/504 HTTP errors.
   *
   * Retry strategy: Exponential backoff with jitter, typically 3-5 attempts.
   */
  TRANSIENT = 'TRANSIENT',

  /**
   * Permanent errors that won't resolve with retries.
   *
   * @remarks
   * Examples: Validation errors, not found errors, authentication failures,
   * authorization failures, 400/401/403/404 HTTP errors.
   *
   * Retry strategy: No retry, fail immediately.
   */
  PERMANENT = 'PERMANENT',

  /**
   * Rate limit errors requiring backoff.
   *
   * @remarks
   * Examples: 429 Too Many Requests, API quota exceeded.
   *
   * Retry strategy: Respect Retry-After header, exponential backoff,
   * typically 5-10 attempts with longer delays.
   */
  RATE_LIMIT = 'RATE_LIMIT',
}

/**
 * Network error codes that indicate transient failures.
 *
 * @remarks
 * Node.js network error codes from the `errno` module.
 *
 * @internal
 */
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET', // Connection reset by peer
  'ECONNREFUSED', // Connection refused
  'ETIMEDOUT', // Connection timeout
  'ENOTFOUND', // DNS lookup failed
  'EAI_AGAIN', // Temporary DNS failure
  'ENETUNREACH', // Network unreachable
  'EHOSTUNREACH', // Host unreachable
  'EPIPE', // Broken pipe
]);

/**
 * HTTP status codes that indicate transient failures.
 *
 * @internal
 */
const TRANSIENT_HTTP_CODES = new Set([
  408, // Request Timeout
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * HTTP status codes that indicate permanent failures.
 *
 * @internal
 */
const PERMANENT_HTTP_CODES = new Set([
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  405, // Method Not Allowed
  406, // Not Acceptable
  409, // Conflict
  410, // Gone
  411, // Length Required
  412, // Precondition Failed
  413, // Payload Too Large
  414, // URI Too Long
  415, // Unsupported Media Type
  422, // Unprocessable Entity
]);

/**
 * Database operation patterns that indicate transient failures.
 *
 * @internal
 */
const TRANSIENT_DB_PATTERNS = [
  /connection/i,
  /timeout/i,
  /deadlock/i,
  /lock wait/i,
  /pool exhausted/i,
  /network/i,
  /temporarily unavailable/i,
];

/**
 * Error classifier for determining retry behavior.
 *
 * @remarks
 * Thread-safe, stateless classifier. Can be reused across requests.
 *
 * @example
 * ```typescript
 * const classifier = new ErrorClassifier();
 *
 * try {
 *   await fetchFromPDS(uri);
 * } catch (error) {
 *   const errorType = classifier.classify(error as Error);
 *
 *   if (errorType === ErrorType.TRANSIENT) {
 *     // Retry with backoff
 *   } else if (errorType === ErrorType.PERMANENT) {
 *     // Fail immediately
 *   } else if (errorType === ErrorType.RATE_LIMIT) {
 *     // Retry with longer backoff
 *   }
 * }
 * ```
 *
 * @public
 */
export class ErrorClassifier {
  /**
   * Classifies an error for retry logic.
   *
   * @param error - Error to classify
   * @returns Error type (TRANSIENT, PERMANENT, or RATE_LIMIT)
   *
   * @remarks
   * Classification logic:
   * 1. Check for Chive error types (RateLimitError, NotFoundError, etc.)
   * 2. Check for HTTP status codes in error message or properties
   * 3. Check for network error codes
   * 4. Check for database error patterns
   * 5. Default to PERMANENT (fail-safe: don't retry unless confident)
   *
   * @public
   */
  classify(error: Error): ErrorType {
    // Rate limit errors (highest priority)
    if (error instanceof RateLimitError) {
      return ErrorType.RATE_LIMIT;
    }

    // Permanent Chive errors
    if (
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError ||
      error instanceof ComplianceError
    ) {
      return ErrorType.PERMANENT;
    }

    // Database errors require pattern matching
    if (error instanceof DatabaseError) {
      return this.classifyDatabaseError(error);
    }

    // Generic ChiveError defaults to permanent
    if (error instanceof ChiveError) {
      return ErrorType.PERMANENT;
    }

    // Check for HTTP status codes
    const httpCode = this.extractHttpStatusCode(error);
    if (httpCode !== null) {
      if (httpCode === 429) {
        return ErrorType.RATE_LIMIT;
      }
      if (TRANSIENT_HTTP_CODES.has(httpCode)) {
        return ErrorType.TRANSIENT;
      }
      if (PERMANENT_HTTP_CODES.has(httpCode)) {
        return ErrorType.PERMANENT;
      }
    }

    // Check for network error codes
    const networkCode = this.extractNetworkErrorCode(error);
    if (networkCode && TRANSIENT_NETWORK_CODES.has(networkCode)) {
      return ErrorType.TRANSIENT;
    }

    // Check for timeout indicators
    if (this.isTimeoutError(error)) {
      return ErrorType.TRANSIENT;
    }

    // Default to PERMANENT (conservative: don't retry unless confident)
    return ErrorType.PERMANENT;
  }

  /**
   * Classifies database errors as transient or permanent.
   *
   * @param error - Database error
   * @returns Error type
   *
   * @remarks
   * Transient database errors:
   * - Connection failures
   * - Timeouts
   * - Deadlocks
   * - Lock wait timeouts
   * - Pool exhaustion
   *
   * Permanent database errors:
   * - Constraint violations
   * - Query syntax errors
   * - Permission errors
   *
   * @private
   */
  private classifyDatabaseError(error: DatabaseError): ErrorType {
    const message = error.message.toLowerCase();

    // Check transient patterns
    for (const pattern of TRANSIENT_DB_PATTERNS) {
      if (pattern.test(message)) {
        return ErrorType.TRANSIENT;
      }
    }

    // Check operation type (some operations are always permanent)
    if (error.operation === 'QUERY' && message.includes('syntax')) {
      return ErrorType.PERMANENT;
    }

    // Connection-related operations are usually transient
    if (message.includes('connect') || message.includes('pool') || message.includes('socket')) {
      return ErrorType.TRANSIENT;
    }

    // Default to permanent for database errors
    return ErrorType.PERMANENT;
  }

  /**
   * Extracts HTTP status code from error.
   *
   * @param error - Error to inspect
   * @returns HTTP status code or null
   *
   * @remarks
   * Checks common properties where HTTP frameworks store status codes:
   * - error.status (Hono, Express)
   * - error.statusCode (Node.js http module)
   * - error.response.status (axios, fetch)
   *
   * @private
   */
  private extractHttpStatusCode(error: Error): number | null {
    const errorWithStatus = error as Error & {
      status?: number;
      statusCode?: number;
      response?: { status?: number };
    };

    if (typeof errorWithStatus.status === 'number') {
      return errorWithStatus.status;
    }

    if (typeof errorWithStatus.statusCode === 'number') {
      return errorWithStatus.statusCode;
    }

    if (typeof errorWithStatus.response?.status === 'number') {
      return errorWithStatus.response.status;
    }

    // Try to extract from message (e.g., "Request failed with status 500")
    const match = /\bstatus\s*:?\s*(\d{3})\b/i.exec(error.message);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }

    return null;
  }

  /**
   * Extracts network error code from error.
   *
   * @param error - Error to inspect
   * @returns Network error code or null
   *
   * @remarks
   * Node.js network errors have a `code` property with values like
   * 'ECONNRESET', 'ETIMEDOUT', etc.
   *
   * @private
   */
  private extractNetworkErrorCode(error: Error): string | null {
    const errorWithCode = error as Error & { code?: string };

    if (typeof errorWithCode.code === 'string') {
      return errorWithCode.code;
    }

    return null;
  }

  /**
   * Checks if error indicates a timeout.
   *
   * @param error - Error to inspect
   * @returns True if timeout error
   *
   * @remarks
   * Checks for:
   * - Error name includes 'timeout'
   * - Error message includes 'timeout' or 'timed out'
   * - Error code is 'ETIMEDOUT'
   *
   * @private
   */
  private isTimeoutError(error: Error): boolean {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    const code = this.extractNetworkErrorCode(error);

    return (
      name.includes('timeout') ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      code === 'ETIMEDOUT'
    );
  }
}
