/**
 * Logger interface for structured logging.
 *
 * @remarks
 * This interface provides structured logging capabilities with multiple
 * log levels and contextual metadata.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Log level values.
 *
 * @remarks
 * Use `LogLevel.DEBUG`, `LogLevel.INFO`, etc. or string literals.
 *
 * @public
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

/**
 * Log level type.
 *
 * @public
 */
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Log context (structured metadata).
 *
 * @remarks
 * Additional context attached to log entries for filtering and debugging.
 *
 * Common fields:
 * - `userId`: DID of user
 * - `requestId`: Request correlation ID
 * - `operation`: Operation name
 * - `duration`: Operation duration in milliseconds
 *
 * @public
 */
export type LogContext = Readonly<Record<string, unknown>>;

/**
 * Logger interface for structured logging.
 *
 * @remarks
 * Provides structured logging with JSON output for machine parsing.
 *
 * Implementation notes:
 * - Outputs JSON to stdout/stderr
 * - Includes timestamp, level, message, context
 * - Integrates with OpenTelemetry for tracing
 *
 * @public
 */
export interface ILogger {
  /**
   * Logs a debug message.
   *
   * @param message - Log message
   * @param context - Additional context
   *
   * @remarks
   * Debug messages are typically disabled in production.
   *
   * @example
   * ```typescript
   * logger.debug('Processing event', { eventType: 'commit', seq: 12345 });
   * ```
   *
   * @public
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Logs an info message.
   *
   * @param message - Log message
   * @param context - Additional context
   *
   * @example
   * ```typescript
   * logger.info('Indexed preprint', { uri: preprintUri, duration: 150 });
   * ```
   *
   * @public
   */
  info(message: string, context?: LogContext): void;

  /**
   * Logs a warning message.
   *
   * @param message - Log message
   * @param context - Additional context
   *
   * @example
   * ```typescript
   * logger.warn('Index is stale', { uri: preprintUri, staleness: 'high' });
   * ```
   *
   * @public
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Logs an error message.
   *
   * @param message - Log message
   * @param error - Error object (optional)
   * @param context - Additional context
   *
   * @example
   * ```typescript
   * logger.error('Failed to index preprint', error, { uri: preprintUri });
   * ```
   *
   * @public
   */
  error(message: string, error?: Error, context?: LogContext): void;

  /**
   * Creates a child logger with additional context.
   *
   * @param context - Context to merge into all log entries
   * @returns Child logger with merged context
   *
   * @remarks
   * Child loggers inherit parent context and add their own.
   * Useful for per-request or per-operation logging.
   *
   * @example
   * ```typescript
   * const requestLogger = logger.child({ requestId: '123', userId: 'did:plc:abc' });
   * requestLogger.info('Processing request');
   * // Outputs: { requestId: '123', userId: 'did:plc:abc', message: 'Processing request' }
   * ```
   *
   * @public
   */
  child(context: LogContext): ILogger;
}
