/**
 * Structured browser logger for Chive frontend.
 *
 * @remarks
 * Mirrors the backend Pino logger pattern for consistency across the stack.
 * Outputs JSON-structured logs with automatic context injection, sensitive
 * data redaction, and support for child loggers.
 *
 * In development: Pretty-prints to console with colors.
 * In production: Outputs JSON for potential remote collection.
 *
 * @packageDocumentation
 */

/**
 * Log levels in order of severity.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Numeric values for log levels (for comparison).
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Context object for structured logging.
 */
export interface LogContext {
  /** Request correlation ID */
  requestId?: string;
  /** OpenTelemetry trace ID */
  traceId?: string;
  /** OpenTelemetry span ID */
  spanId?: string;
  /** User DID */
  userId?: string;
  /** Current page path */
  path?: string;
  /** Component or module name */
  component?: string;
  /** Additional arbitrary context */
  [key: string]: unknown;
}

/**
 * Structured log entry format (matches backend Pino output).
 */
export interface LogEntry {
  level: LogLevel;
  time: string;
  msg: string;
  service: string;
  environment: string;
  version: string;
  [key: string]: unknown;
}

/**
 * Logger configuration options.
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel;
  /** Base context to include in all logs */
  context?: LogContext;
  /** Service name for log entries */
  service?: string;
}

/**
 * Sensitive keys to redact from log output.
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'jwt',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
];

/**
 * Redacts sensitive values from an object.
 */
function redactSensitiveData(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveData(value);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Determines if we're in a browser environment.
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Determines if we're in development mode.
 */
const isDev = process.env.NODE_ENV === 'development';

/**
 * Default log level based on environment.
 */
const DEFAULT_LEVEL: LogLevel = isDev ? 'debug' : 'info';

/**
 * Global log buffer for debug panel access.
 */
const LOG_BUFFER_MAX_SIZE = 100;
const logBuffer: LogEntry[] = [];

/**
 * Get the log buffer (for debug panel).
 */
export function getLogBuffer(): readonly LogEntry[] {
  return logBuffer;
}

/**
 * Clear the log buffer.
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

/**
 * Browser logger implementation.
 *
 * @remarks
 * Provides structured logging with:
 * - Log levels (debug, info, warn, error)
 * - JSON output format (matches backend Pino)
 * - Automatic context injection
 * - Sensitive data redaction
 * - Child logger support
 *
 * @example
 * ```typescript
 * const logger = createLogger({ context: { component: 'api-client' } });
 * logger.debug('Request started', { url: '/api/eprints' });
 * logger.error('Request failed', new Error('Network error'), { statusCode: 500 });
 *
 * // Child logger with additional context
 * const childLogger = logger.child({ requestId: 'req_123' });
 * childLogger.info('Processing request');
 * ```
 */
export class BrowserLogger {
  private level: LogLevel;
  private context: LogContext;
  private service: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? DEFAULT_LEVEL;
    this.context = options.context ?? {};
    this.service = options.service ?? 'chive-web';
  }

  /**
   * Creates a child logger with additional context.
   */
  child(additionalContext: LogContext): BrowserLogger {
    return new BrowserLogger({
      level: this.level,
      context: { ...this.context, ...additionalContext },
      service: this.service,
    });
  }

  /**
   * Checks if the given level should be logged.
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.level];
  }

  /**
   * Creates a log entry.
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      time: new Date().toISOString(),
      msg: message,
      service: this.service,
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
      ...(redactSensitiveData(this.context) as object),
      ...(redactSensitiveData(context) as object),
    };

    // Add path if in browser and not already set
    if (isBrowser && !entry.path) {
      entry.path = window.location.pathname;
    }

    // Add error details
    if (error) {
      entry.err = {
        type: error.name,
        message: error.message,
        stack: error.stack,
        // Include custom error properties
        ...('code' in error ? { code: (error as { code: string }).code } : {}),
        ...('statusCode' in error
          ? { statusCode: (error as { statusCode: number }).statusCode }
          : {}),
        ...('endpoint' in error ? { endpoint: (error as { endpoint: string }).endpoint } : {}),
      };
    }

    return entry;
  }

  /**
   * Outputs a log entry.
   */
  private output(entry: LogEntry): void {
    // Add to buffer for debug panel
    logBuffer.push(entry);
    if (logBuffer.length > LOG_BUFFER_MAX_SIZE) {
      logBuffer.shift();
    }

    // In production, output JSON
    if (!isDev) {
      const jsonLine = JSON.stringify(entry);
      switch (entry.level) {
        case 'debug':
          console.debug(jsonLine);
          break;
        case 'info':
          console.info(jsonLine);
          break;
        case 'warn':
          console.warn(jsonLine);
          break;
        case 'error':
          console.error(jsonLine);
          break;
      }
      return;
    }

    // In development, pretty-print
    const timestamp = entry.time.split('T')[1]?.slice(0, 12) ?? entry.time;
    const prefix = `[${timestamp}]`;
    const contextStr = Object.entries(entry)
      .filter(([k]) => !['level', 'time', 'msg', 'service', 'environment', 'version'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');

    const message = contextStr ? `${entry.msg} ${contextStr}` : entry.msg;

    switch (entry.level) {
      case 'debug':
        console.debug(`%c${prefix} DEBUG`, 'color: gray', message);
        break;
      case 'info':
        console.info(`%c${prefix} INFO`, 'color: blue', message);
        break;
      case 'warn':
        console.warn(`%c${prefix} WARN`, 'color: orange', message);
        break;
      case 'error':
        console.error(`%c${prefix} ERROR`, 'color: red', message);
        break;
    }
  }

  /**
   * Log a debug message.
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    this.output(this.createEntry('debug', message, context));
  }

  /**
   * Log an info message.
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    this.output(this.createEntry('info', message, context));
  }

  /**
   * Log a warning message.
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    this.output(this.createEntry('warn', message, context));
  }

  /**
   * Log an error message.
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    const err = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    this.output(this.createEntry('error', message, context, err));
  }
}

/**
 * Creates a new logger instance.
 */
export function createLogger(options: LoggerOptions = {}): BrowserLogger {
  return new BrowserLogger(options);
}

/**
 * Default logger instance for general use.
 */
export const logger = createLogger();

export default logger;
