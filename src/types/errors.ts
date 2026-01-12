/**
 * Error types for Chive application.
 *
 * @remarks
 * This module defines a hierarchy of error types for structured error handling
 * throughout the application. All errors extend from the base ChiveError class,
 * which provides consistent error structure and stack trace capture.
 *
 * Errors are designed to be machine-readable (via error codes) and human-readable
 * (via messages), enabling both programmatic error handling and user-facing
 * error displays.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Base error class for all Chive errors.
 *
 * @remarks
 * All Chive errors should extend this class rather than the native Error class.
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
 *
 * @public
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
   *
   * @example
   * ```typescript
   * try {
   *   await fetchData();
   * } catch (err) {
   *   throw new ValidationError('Failed to validate data', 'field', 'required', err as Error);
   * }
   * ```
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
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * AT Protocol compliance violation error.
 *
 * @remarks
 * Thrown when code attempts to violate AT Protocol AppView principles:
 * - Writing to user PDSes (forbidden)
 * - Storing blob data instead of BlobRefs (forbidden)
 * - Creating non-rebuildable indexes (forbidden)
 * - Missing PDS source tracking (required)
 *
 * These errors indicate critical bugs that must be fixed before release.
 * All compliance violations should be caught by automated tests.
 *
 * @example
 * ```typescript
 * if (operation === 'WRITE_TO_PDS') {
 *   throw new ComplianceError(
 *     'WRITE_TO_PDS',
 *     'AppViews must never write to user PDSes'
 *   );
 * }
 * ```
 *
 * @public
 */
export class ComplianceError extends ChiveError {
  readonly code = 'COMPLIANCE_VIOLATION';

  /**
   * Type of compliance violation.
   *
   * @remarks
   * Specific violation types enable targeted error handling and reporting.
   */
  readonly violationType:
    | 'WRITE_TO_PDS'
    | 'BLOB_STORAGE'
    | 'MISSING_SOURCE_TRACKING'
    | 'NON_REBUILDABLE';

  /**
   * Creates a new ComplianceError.
   *
   * @param violationType - Specific type of compliance violation
   * @param message - Description of the violation
   */
  constructor(violationType: ComplianceError['violationType'], message: string) {
    super(message);
    this.violationType = violationType;
  }
}

/**
 * Resource not found error.
 *
 * @remarks
 * Thrown when a requested resource does not exist in the AppView index.
 *
 * This error does NOT mean the resource doesn't exist in the AT Protocol
 * network; it may exist in a user's PDS but not be indexed by Chive.
 *
 * HTTP mapping: 404 Not Found
 *
 * @example
 * ```typescript
 * const eprint = await storage.getEprint(uri);
 * if (!eprint) {
 *   throw new NotFoundError('Eprint', uri);
 * }
 * ```
 *
 * @public
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
 * HTTP mapping: 400 Bad Request
 *
 * @example
 * ```typescript
 * if (!eprint.title) {
 *   throw new ValidationError(
 *     'Eprint title is required',
 *     'title',
 *     'required'
 *   );
 * }
 * ```
 *
 * @public
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
 * - Multi-factor authentication fails
 *
 * HTTP mapping: 401 Unauthorized
 *
 * @example
 * ```typescript
 * if (!isValidDID(did)) {
 *   throw new AuthenticationError('Invalid DID format');
 * }
 * ```
 *
 * @public
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
 * HTTP mapping: 403 Forbidden
 *
 * @example
 * ```typescript
 * if (!user.hasScope('write:eprints')) {
 *   throw new AuthorizationError(
 *     'Missing required scope',
 *     'write:eprints'
 *   );
 * }
 * ```
 *
 * @public
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
 *
 * HTTP mapping: 429 Too Many Requests
 *
 * @example
 * ```typescript
 * if (requestCount > limit) {
 *   throw new RateLimitError(60); // Retry after 60 seconds
 * }
 * ```
 *
 * @public
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
}

/**
 * Database operation error.
 *
 * @remarks
 * Thrown when an internal database operation fails unexpectedly.
 * This indicates a system-level error, not a user input problem.
 *
 * Examples include:
 * - Query execution failures (unexpected null results)
 * - Connection failures (not covered by connection retry logic)
 * - Transaction commit/rollback failures
 * - Constraint violations at the database level
 * - Index corruption or unavailability
 *
 * HTTP mapping: 500 Internal Server Error
 *
 * @example
 * ```typescript
 * const record = result.records[0];
 * if (!record) {
 *   throw new DatabaseError(
 *     'CREATE',
 *     'Failed to create field: no record returned from database'
 *   );
 * }
 * ```
 *
 * @public
 */
export class DatabaseError extends ChiveError {
  readonly code = 'DATABASE_ERROR';

  /**
   * Type of database operation that failed.
   *
   * @example 'CREATE', 'READ', 'UPDATE', 'DELETE', 'QUERY'
   */
  readonly operation: string;

  /**
   * Creates a new DatabaseError.
   *
   * @param operation - Type of operation (e.g., 'CREATE', 'UPDATE')
   * @param message - Description of the database failure
   * @param cause - Original database error (if available)
   */
  constructor(operation: string, message: string, cause?: Error) {
    super(message, cause);
    this.operation = operation;
  }
}

/**
 * Plugin operation types for error tracking.
 *
 * @public
 */
export type PluginOperation = 'LOAD' | 'INITIALIZE' | 'EXECUTE' | 'SHUTDOWN';

/**
 * Plugin error for general plugin failures.
 *
 * @remarks
 * Thrown when plugin operations fail, including loading, initialization,
 * execution, or shutdown. Includes the plugin ID and operation for debugging.
 *
 * @example
 * ```typescript
 * throw new PluginError(
 *   'com.example.github',
 *   'INITIALIZE',
 *   'Failed to connect to GitHub API'
 * );
 * ```
 *
 * @public
 */
export class PluginError extends ChiveError {
  readonly code = 'PLUGIN_ERROR';

  /**
   * ID of the plugin that failed.
   */
  readonly pluginId: string;

  /**
   * Operation that was being performed when the error occurred.
   */
  readonly operation: PluginOperation;

  /**
   * Creates a new PluginError.
   *
   * @param pluginId - ID of the plugin that failed
   * @param operation - Operation being performed ('LOAD', 'INITIALIZE', 'EXECUTE', 'SHUTDOWN')
   * @param message - Description of the failure
   * @param cause - Original error (if chained)
   */
  constructor(pluginId: string, operation: PluginOperation, message: string, cause?: Error) {
    super(message, cause);
    this.pluginId = pluginId;
    this.operation = operation;
  }
}

/**
 * Plugin permission denied error.
 *
 * @remarks
 * Thrown when a plugin attempts to access a resource or perform an action
 * that it does not have permission for. Permissions must be declared in
 * the plugin manifest.
 *
 * @example
 * ```typescript
 * // Plugin tries to access undeclared domain
 * throw new PluginPermissionError(
 *   'com.example.plugin',
 *   'network:api.unauthorized.com'
 * );
 * ```
 *
 * @public
 */
export class PluginPermissionError extends ChiveError {
  readonly code = 'PLUGIN_PERMISSION_DENIED';

  /**
   * ID of the plugin that violated permissions.
   */
  readonly pluginId: string;

  /**
   * Permission that was required but not granted.
   *
   * @example 'network:api.github.com', 'hook:eprint.indexed', 'storage:write'
   */
  readonly permission: string;

  /**
   * Creates a new PluginPermissionError.
   *
   * @param pluginId - ID of the plugin that violated permissions
   * @param permission - Permission that was required but not granted
   */
  constructor(pluginId: string, permission: string) {
    super(`Plugin '${pluginId}' lacks required permission: ${permission}`);
    this.pluginId = pluginId;
    this.permission = permission;
  }
}

/**
 * Plugin manifest validation error.
 *
 * @remarks
 * Thrown when a plugin manifest (plugin.json) fails schema validation.
 * Contains all validation errors for debugging.
 *
 * @example
 * ```typescript
 * const errors = ['id is required', 'version must match semver'];
 * throw new ManifestValidationError(errors);
 * ```
 *
 * @public
 */
export class ManifestValidationError extends ChiveError {
  readonly code = 'MANIFEST_VALIDATION_ERROR';

  /**
   * List of validation errors found in the manifest.
   */
  readonly validationErrors: readonly string[];

  /**
   * Creates a new ManifestValidationError.
   *
   * @param errors - List of validation error messages
   */
  constructor(errors: readonly string[]) {
    super(`Invalid plugin manifest: ${errors.join('; ')}`);
    this.validationErrors = errors;
  }
}

/**
 * Sandbox violation types for security tracking.
 *
 * @public
 */
export type SandboxViolationType = 'NETWORK' | 'STORAGE' | 'CPU' | 'MEMORY' | 'HOOK';

/**
 * Sandbox security violation error.
 *
 * @remarks
 * Thrown when a plugin violates security constraints enforced by the
 * isolated-vm sandbox. This includes network access violations, storage
 * quota exceeded, CPU timeout, memory limit exceeded, or unauthorized
 * hook access.
 *
 * @example
 * ```typescript
 * throw new SandboxViolationError(
 *   'com.example.plugin',
 *   'MEMORY',
 *   'Plugin exceeded 128MB memory limit'
 * );
 * ```
 *
 * @public
 */
export class SandboxViolationError extends ChiveError {
  readonly code = 'SANDBOX_VIOLATION';

  /**
   * ID of the plugin that violated sandbox rules.
   */
  readonly pluginId: string;

  /**
   * Type of sandbox violation.
   */
  readonly violationType: SandboxViolationType;

  /**
   * Creates a new SandboxViolationError.
   *
   * @param pluginId - ID of the plugin that violated sandbox rules
   * @param violationType - Type of violation ('NETWORK', 'STORAGE', 'CPU', 'MEMORY', 'HOOK')
   * @param message - Description of the violation
   */
  constructor(pluginId: string, violationType: SandboxViolationType, message: string) {
    super(message);
    this.pluginId = pluginId;
    this.violationType = violationType;
  }
}

/**
 * API request error.
 *
 * @remarks
 * Thrown when an API request fails. Used primarily in frontend code when
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
 *
 * @public
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
}

/**
 * Service unavailable error.
 *
 * @remarks
 * Thrown when a required service is not configured or not available.
 * Maps to HTTP 503 Service Unavailable.
 *
 * @example
 * ```typescript
 * if (!discoveryService) {
 *   throw new ServiceUnavailableError('Discovery service not available');
 * }
 * ```
 *
 * @public
 */
export class ServiceUnavailableError extends ChiveError {
  readonly code = 'SERVICE_UNAVAILABLE';

  /**
   * Name of the unavailable service.
   */
  readonly service?: string;

  /**
   * Creates a new ServiceUnavailableError.
   *
   * @param message - Description of the unavailability
   * @param service - Name of the unavailable service
   * @param cause - Original error (if chained)
   */
  constructor(message: string, service?: string, cause?: Error) {
    super(message, cause);
    this.service = service;
  }
}
