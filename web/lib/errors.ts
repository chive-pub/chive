/**
 * Error types for Chive frontend.
 *
 * @remarks
 * Frontend error hierarchy mirrors backend ChiveError pattern for consistency.
 * All frontend errors extend ChiveError base class with machine-readable codes.
 *
 * @see src/types/errors.ts for backend error hierarchy
 *
 * @packageDocumentation
 */

/**
 * Error severity levels for monitoring and alerting.
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Serialized error format for structured logging.
 */
export interface SerializedError {
  name: string;
  code: string;
  message: string;
  severity: ErrorSeverity;
  isRetryable: boolean;
  stack?: string;
  cause?: SerializedError;
  [key: string]: unknown;
}

/**
 * Base error class for all Chive frontend errors.
 *
 * @remarks
 * Follows the same pattern as backend ChiveError (src/types/errors.ts).
 * All frontend errors should extend this class rather than the native Error class.
 * This ensures consistent error code structure, enables error cause chaining
 * for debugging, captures proper stack traces, and allows type discrimination
 * via instanceof.
 *
 * Never throw raw strings or objects; always use Error classes.
 *
 * @example
 * ```typescript
 * class CustomError extends ChiveError {
 *   readonly code = 'CUSTOM_ERROR';
 *
 *   constructor(message: string) {
 *     super(message);
 *   }
 * }
 *
 * throw new CustomError('Something went wrong');
 * ```
 */
export abstract class ChiveError extends Error {
  /**
   * Machine-readable error code.
   *
   * @remarks
   * Error codes are unique identifiers for error types, enabling programmatic
   * error handling (switch statements, error maps), error tracking in monitoring
   * systems, and client-side error translation (i18n).
   */
  abstract readonly code: string;

  /**
   * Original error that caused this error (if any).
   *
   * @remarks
   * Error chaining allows tracking the full error context through
   * multiple layers of the application. Useful for debugging complex
   * error scenarios.
   */
  readonly cause?: Error;

  /**
   * Creates a new ChiveError.
   *
   * @param message - Human-readable error message
   * @param cause - Original error (if chained)
   */
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Error severity for monitoring and alerting.
   *
   * @remarks
   * Override in subclasses to customize severity based on error type.
   * Default is 'medium' for most errors.
   */
  get severity(): ErrorSeverity {
    return 'medium';
  }

  /**
   * Whether this error is retryable.
   *
   * @remarks
   * Override in subclasses to indicate whether the operation
   * can be retried. Default is false (non-retryable).
   */
  get isRetryable(): boolean {
    return false;
  }

  /**
   * Converts error to a plain object for structured logging.
   *
   * @remarks
   * Produces a JSON-serializable object with all error properties,
   * including nested cause chains.
   */
  toJSON(): SerializedError {
    const result: SerializedError = {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      isRetryable: this.isRetryable,
      stack: this.stack,
    };

    if (this.cause) {
      result.cause =
        this.cause instanceof ChiveError
          ? this.cause.toJSON()
          : {
              name: this.cause.name,
              code: 'UNKNOWN',
              message: this.cause.message,
              severity: 'medium',
              isRetryable: false,
              stack: this.cause.stack,
            };
    }

    return result;
  }
}

/**
 * API request error.
 *
 * @remarks
 * Thrown when an API request fails. Used in frontend code when
 * fetching data from backend endpoints. Captures HTTP status code and
 * endpoint information for debugging.
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/eprints');
 * if (!response.ok) {
 *   throw new APIError(
 *     `Failed to fetch eprints: ${response.statusText}`,
 *     response.status,
 *     '/api/eprints'
 *   );
 * }
 * ```
 */
export class APIError extends ChiveError {
  readonly code = 'API_ERROR';

  /**
   * HTTP status code from the failed request (if available).
   */
  readonly statusCode?: number;

  /**
   * API endpoint that was called.
   */
  readonly endpoint?: string;

  /**
   * Creates a new APIError.
   *
   * @param message - Description of the API failure
   * @param statusCode - HTTP status code (e.g., 404, 500)
   * @param endpoint - API endpoint that failed (e.g., '/api/eprints')
   * @param cause - Original error (if chained)
   */
  constructor(message: string, statusCode?: number, endpoint?: string, cause?: Error) {
    super(message, cause);
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }

  get severity(): ErrorSeverity {
    // 5xx errors are high severity, 4xx are medium
    if (this.statusCode && this.statusCode >= 500) return 'high';
    return 'medium';
  }

  get isRetryable(): boolean {
    // 5xx errors and specific 4xx errors are retryable
    if (!this.statusCode) return true;
    if (this.statusCode >= 500) return true;
    if (this.statusCode === 408 || this.statusCode === 429) return true;
    return false;
  }

  toJSON(): SerializedError {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
      endpoint: this.endpoint,
    };
  }
}

/**
 * Resource not found error.
 *
 * @remarks
 * Thrown when a requested resource does not exist. Includes the
 * resource type and identifier for better error messages.
 *
 * @example
 * ```typescript
 * const eprint = await getEprint(uri);
 * if (!eprint) {
 *   throw new NotFoundError('Eprint', uri);
 * }
 * ```
 */
export class NotFoundError extends ChiveError {
  readonly code = 'NOT_FOUND';

  /**
   * Type of resource that was not found.
   *
   * @example 'Eprint', 'Review', 'Author', 'Field'
   */
  readonly resourceType: string;

  /**
   * Identifier of the resource that was not found.
   *
   * @example AT URI, DID, field ID
   */
  readonly resourceId: string;

  /**
   * Creates a new NotFoundError.
   *
   * @param resourceType - Type of resource (e.g., 'Eprint', 'Author')
   * @param resourceId - Resource identifier (e.g., AT URI, DID)
   */
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} not found: ${resourceId}`);
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Validation error for invalid input data.
 *
 * @remarks
 * Thrown when input data fails validation rules (e.g., required fields,
 * format constraints, business rules).
 *
 * @example
 * ```typescript
 * if (!title.trim()) {
 *   throw new ValidationError(
 *     'Title is required',
 *     'title',
 *     'required'
 *   );
 * }
 * ```
 */
export class ValidationError extends ChiveError {
  readonly code = 'VALIDATION_ERROR';

  /**
   * Field that failed validation (if applicable).
   */
  readonly field?: string;

  /**
   * Constraint that was violated (if applicable).
   *
   * @example 'required', 'min_length', 'max_length', 'pattern'
   */
  readonly constraint?: string;

  /**
   * Creates a new ValidationError.
   *
   * @param message - Description of validation failure
   * @param field - Field that failed validation
   * @param constraint - Constraint that was violated
   * @param cause - Original error (if chained)
   */
  constructor(message: string, field?: string, constraint?: string, cause?: Error) {
    super(message, cause);
    this.field = field;
    this.constraint = constraint;
  }
}

/**
 * Authentication error for failed authentication attempts.
 *
 * @remarks
 * Thrown when:
 * - Credentials are invalid
 * - DID verification fails
 * - Session token is missing or invalid
 * - OAuth flow fails
 *
 * @example
 * ```typescript
 * if (!session.isValid()) {
 *   throw new AuthenticationError('Session expired');
 * }
 * ```
 */
export class AuthenticationError extends ChiveError {
  readonly code = 'AUTHENTICATION_ERROR';
}

/**
 * Authorization error for insufficient permissions.
 *
 * @remarks
 * Thrown when an authenticated user attempts an action they don't have
 * permission to perform.
 *
 * @example
 * ```typescript
 * if (!user.canEdit(eprint)) {
 *   throw new AuthorizationError(
 *     'You do not have permission to edit this eprint',
 *     'write:eprints'
 *   );
 * }
 * ```
 */
export class AuthorizationError extends ChiveError {
  readonly code = 'AUTHORIZATION_ERROR';

  /**
   * Required scope that the user lacks (if applicable).
   */
  readonly requiredScope?: string;

  /**
   * Creates a new AuthorizationError.
   *
   * @param message - Description of authorization failure
   * @param requiredScope - Required scope (e.g., 'write:eprints')
   */
  constructor(message: string, requiredScope?: string) {
    super(message);
    this.requiredScope = requiredScope;
  }
}

/**
 * Rate limit exceeded error.
 *
 * @remarks
 * Thrown when a client exceeds the allowed request rate for an endpoint.
 * Includes the retry-after value for implementing backoff.
 *
 * @example
 * ```typescript
 * if (response.status === 429) {
 *   const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
 *   throw new RateLimitError(retryAfter);
 * }
 * ```
 */
export class RateLimitError extends ChiveError {
  readonly code = 'RATE_LIMIT_EXCEEDED';

  /**
   * Seconds to wait before retrying.
   *
   * @remarks
   * Clients should respect this value and implement exponential backoff
   * for repeated rate limit errors.
   */
  readonly retryAfter: number;

  /**
   * Creates a new RateLimitError.
   *
   * @param retryAfter - Seconds to wait before retrying
   */
  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.retryAfter = retryAfter;
  }

  get severity(): ErrorSeverity {
    return 'low';
  }

  get isRetryable(): boolean {
    return true;
  }

  toJSON(): SerializedError {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * Network error for connection failures.
 *
 * @remarks
 * Thrown when the network request fails (e.g., no internet, DNS failure,
 * connection timeout). Distinct from API errors which indicate the server
 * responded with an error.
 *
 * @example
 * ```typescript
 * try {
 *   await fetch('/api/eprints');
 * } catch (err) {
 *   if (err instanceof TypeError) {
 *     throw new NetworkError('Network request failed', err);
 *   }
 *   throw err;
 * }
 * ```
 */
export class NetworkError extends ChiveError {
  readonly code = 'NETWORK_ERROR';

  /**
   * Creates a new NetworkError.
   *
   * @param message - Description of the network failure
   * @param cause - Original fetch error
   */
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }

  get severity(): ErrorSeverity {
    return 'high';
  }

  get isRetryable(): boolean {
    // Network errors are typically transient and retryable
    return true;
  }
}
