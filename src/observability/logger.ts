/**
 * Pino-based logger implementation.
 *
 * @remarks
 * Implements {@link ILogger} using Pino for structured JSON logging.
 * Outputs to stdout for collection by Promtail DaemonSet in Kubernetes.
 * Automatically injects OpenTelemetry trace context (trace_id, span_id).
 *
 * @packageDocumentation
 * @module observability/logger
 * @public
 */

import { trace, context } from '@opentelemetry/api';
import pino from 'pino';
import type { Logger as PinoBaseLogger, LoggerOptions as PinoOptions } from 'pino';

import type { ILogger, LogContext, LogLevel } from '../types/interfaces/logger.interface.js';

/**
 * Sensitive field names to redact from logs.
 *
 * @remarks
 * These fields are replaced with '[REDACTED]' to prevent PII leakage.
 *
 * @internal
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'apikey',
  'authorization',
  'secret',
  'credential',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
] as const;

/**
 * Configuration options for PinoLogger.
 *
 * @public
 */
export interface PinoLoggerOptions {
  /**
   * Log level threshold.
   *
   * @remarks
   * Messages below this level are not output.
   *
   * @defaultValue 'info'
   */
  readonly level?: LogLevel;

  /**
   * Service name for log entries.
   *
   * @remarks
   * Appears in every log entry as `service` field.
   *
   * @defaultValue 'chive-appview'
   */
  readonly service?: string;

  /**
   * Environment name.
   *
   * @remarks
   * Appears in every log entry as `environment` field.
   *
   * @defaultValue process.env.NODE_ENV || 'development'
   */
  readonly environment?: string;

  /**
   * Service version.
   *
   * @remarks
   * Appears in every log entry as `version` field.
   *
   * @defaultValue process.env.npm_package_version || '0.0.0'
   */
  readonly version?: string;

  /**
   * Enable pretty printing for development.
   *
   * @remarks
   * When true, outputs human-readable logs instead of JSON.
   * Only use in development; production should use JSON for Promtail.
   *
   * @defaultValue false
   */
  readonly pretty?: boolean;
}

/**
 * Redacts sensitive data from an object.
 *
 * @param obj - Object to redact
 * @returns Object with sensitive fields replaced by '[REDACTED]'
 *
 * @remarks
 * Recursively processes nested objects. Does not modify the original.
 *
 * @example
 * ```typescript
 * const safe = redactSensitiveData({ user: 'alice', password: 'secret' });
 * // { user: 'alice', password: '[REDACTED]' }
 * ```
 *
 * @internal
 */
function redactSensitiveData(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitiveData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Extracts OpenTelemetry trace context from the current span.
 *
 * @returns Trace context object with trace_id and span_id, or empty object if no active span
 *
 * @remarks
 * Used as a Pino mixin to inject trace context into every log entry.
 * Enables correlation between logs and traces in Grafana.
 *
 * @example
 * ```typescript
 * const ctx = getTraceContext();
 * // { trace_id: 'abc123...', span_id: 'xyz789...', trace_flags: 1 }
 * ```
 *
 * @internal
 */
function getTraceContext(): Record<string, string | number> {
  const span = trace.getSpan(context.active());

  if (span) {
    const spanContext = span.spanContext();
    return {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
      trace_flags: spanContext.traceFlags,
    };
  }

  return {};
}

/**
 * Pino-based structured logger implementing ILogger.
 *
 * @remarks
 * Provides structured JSON logging with:
 * - OpenTelemetry trace context injection (trace_id, span_id)
 * - Sensitive data redaction (passwords, tokens, API keys)
 * - Child logger support for request-scoped logging
 * - Base fields (service, environment, version)
 *
 * Logs are output to stdout in JSON format for collection by Promtail.
 *
 * @example
 * ```typescript
 * const logger = new PinoLogger({ level: 'info', service: 'chive-appview' });
 *
 * // Basic logging
 * logger.info('Server started', { port: 3000 });
 *
 * // Child logger for request context
 * const reqLogger = logger.child({ requestId: 'req_123' });
 * reqLogger.info('Processing request');
 *
 * // Error logging with stack trace
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logger.error('Operation failed', error as Error, { operation: 'riskyOp' });
 * }
 * ```
 *
 * @see {@link ILogger} for interface contract
 * @public
 * @since 0.1.0
 */
export class PinoLogger implements ILogger {
  private readonly pino: PinoBaseLogger;

  /**
   * Creates a new PinoLogger instance.
   *
   * @param options - Configuration options
   *
   * @example
   * ```typescript
   * // Production configuration
   * const logger = new PinoLogger({
   *   level: 'info',
   *   service: 'chive-appview',
   *   environment: 'production',
   * });
   *
   * // Development with pretty printing
   * const devLogger = new PinoLogger({
   *   level: 'debug',
   *   pretty: true,
   * });
   * ```
   *
   * @public
   */
  constructor(options: PinoLoggerOptions = {}) {
    const {
      level = process.env.LOG_LEVEL ?? 'info',
      service = process.env.OTEL_SERVICE_NAME ?? 'chive-appview',
      environment = process.env.NODE_ENV ?? 'development',
      version = process.env.npm_package_version ?? '0.0.0',
      pretty = false,
    } = options;

    const pinoOptions: PinoOptions = {
      level,
      formatters: {
        level: (label) => ({ level: label }),
      },
      base: {
        service,
        environment,
        version,
      },
      mixin: getTraceContext,
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    if (pretty) {
      pinoOptions.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      };
    }

    this.pino = pino(pinoOptions);
  }

  /**
   * Creates a PinoLogger wrapping an existing Pino instance.
   *
   * @param pinoInstance - Existing Pino logger instance
   * @returns PinoLogger wrapping the provided instance
   *
   * @remarks
   * Used internally for creating child loggers.
   *
   * @internal
   */
  private static fromPino(pinoInstance: PinoBaseLogger): PinoLogger {
    const logger = Object.create(PinoLogger.prototype) as PinoLogger;
    (logger as unknown as { pino: PinoBaseLogger }).pino = pinoInstance;
    return logger;
  }

  /**
   * Logs a debug message.
   *
   * @param message - Log message
   * @param context - Additional context metadata
   *
   * @remarks
   * Debug messages are typically disabled in production via LOG_LEVEL.
   * Context is automatically redacted for sensitive fields.
   *
   * @example
   * ```typescript
   * logger.debug('Processing event', { eventType: 'commit', seq: 12345 });
   * // Output: {"level":"debug","time":"...","msg":"Processing event","eventType":"commit","seq":12345,"trace_id":"..."}
   * ```
   *
   * @public
   */
  debug(message: string, context?: LogContext): void {
    if (context) {
      this.pino.debug(redactSensitiveData(context as Record<string, unknown>), message);
    } else {
      this.pino.debug(message);
    }
  }

  /**
   * Logs an info message.
   *
   * @param message - Log message
   * @param context - Additional context metadata
   *
   * @remarks
   * Standard level for operational messages.
   * Context is automatically redacted for sensitive fields.
   *
   * @example
   * ```typescript
   * logger.info('Indexed preprint', { uri: 'at://did:plc:abc/pub.chive.preprint/123', duration: 150 });
   * // Output: {"level":"info","time":"...","msg":"Indexed preprint","uri":"at://...","duration":150}
   * ```
   *
   * @public
   */
  info(message: string, context?: LogContext): void {
    if (context) {
      this.pino.info(redactSensitiveData(context as Record<string, unknown>), message);
    } else {
      this.pino.info(message);
    }
  }

  /**
   * Logs a warning message.
   *
   * @param message - Log message
   * @param context - Additional context metadata
   *
   * @remarks
   * Use for potentially problematic situations that don't prevent operation.
   * Context is automatically redacted for sensitive fields.
   *
   * @example
   * ```typescript
   * logger.warn('Index is stale', { uri: 'at://did:plc:abc/...', staleness: 'high' });
   * // Output: {"level":"warn","time":"...","msg":"Index is stale","uri":"at://...","staleness":"high"}
   * ```
   *
   * @public
   */
  warn(message: string, context?: LogContext): void {
    if (context) {
      this.pino.warn(redactSensitiveData(context as Record<string, unknown>), message);
    } else {
      this.pino.warn(message);
    }
  }

  /**
   * Logs an error message with optional error object.
   *
   * @param message - Log message
   * @param error - Error object with stack trace
   * @param context - Additional context metadata
   *
   * @remarks
   * Error objects are serialized with their stack traces.
   * Context is automatically redacted for sensitive fields.
   *
   * @example
   * ```typescript
   * try {
   *   await indexPreprint(preprint);
   * } catch (error) {
   *   logger.error('Failed to index preprint', error as Error, { uri: preprintUri });
   * }
   * // Output: {"level":"error","time":"...","msg":"Failed to index preprint","err":{"message":"...","stack":"..."},"uri":"..."}
   * ```
   *
   * @public
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const logObject: Record<string, unknown> = {};

    if (error) {
      logObject.err = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    }

    if (context) {
      Object.assign(logObject, redactSensitiveData(context as Record<string, unknown>));
    }

    if (Object.keys(logObject).length > 0) {
      this.pino.error(logObject, message);
    } else {
      this.pino.error(message);
    }
  }

  /**
   * Creates a child logger with additional context.
   *
   * @param context - Context to merge into all log entries
   * @returns Child logger with merged context
   *
   * @remarks
   * Child loggers inherit parent context and add their own.
   * Useful for per-request or per-operation logging.
   * Context is automatically redacted for sensitive fields.
   *
   * @example
   * ```typescript
   * const requestLogger = logger.child({ requestId: 'req_123', userId: 'did:plc:abc' });
   * requestLogger.info('Processing request');
   * // Output includes both requestId and userId in every log entry
   *
   * // Child loggers can be nested
   * const opLogger = requestLogger.child({ operation: 'indexPreprint' });
   * opLogger.debug('Starting operation');
   * // Output includes requestId, userId, and operation
   * ```
   *
   * @public
   */
  child(context: LogContext): ILogger {
    const redactedContext = redactSensitiveData(context as Record<string, unknown>);
    const childPino = this.pino.child(redactedContext);
    return PinoLogger.fromPino(childPino);
  }
}

/**
 * Creates a default logger instance.
 *
 * @param options - Configuration options
 * @returns Configured PinoLogger instance
 *
 * @remarks
 * Convenience function for creating loggers with default configuration.
 * Reads configuration from environment variables if not provided.
 *
 * @example
 * ```typescript
 * // Use environment defaults
 * const logger = createLogger();
 *
 * // Override specific options
 * const customLogger = createLogger({ level: 'debug', pretty: true });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function createLogger(options?: PinoLoggerOptions): ILogger {
  return new PinoLogger(options);
}
