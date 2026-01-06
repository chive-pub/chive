/**
 * OpenTelemetry tracing utilities and helpers.
 *
 * @remarks
 * Provides convenient wrappers around OpenTelemetry tracing API:
 * - {@link withSpan} for wrapping operations in spans
 * - {@link addSpanAttributes} for adding attributes to active span
 * - {@link recordSpanError} for recording errors on spans
 *
 * @packageDocumentation
 * @module observability/tracer
 * @public
 */

import {
  trace,
  context,
  SpanStatusCode,
  type Tracer,
  type Span,
  type SpanOptions,
  type Attributes,
} from '@opentelemetry/api';

/**
 * Default tracer name for Chive services.
 *
 * @public
 */
export const TRACER_NAME = 'chive-appview';

/**
 * Default tracer version.
 *
 * @public
 */
export const TRACER_VERSION = '0.1.0';

/**
 * Gets the Chive tracer instance.
 *
 * @returns Tracer instance for creating spans
 *
 * @remarks
 * Returns a tracer with the Chive service name.
 * Use this for manual span creation.
 *
 * @example
 * ```typescript
 * const tracer = getTracer();
 * const span = tracer.startSpan('myOperation');
 * try {
 *   // ... do work ...
 * } finally {
 *   span.end();
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}

/**
 * Gets the currently active span.
 *
 * @returns Active span or undefined if no span is active
 *
 * @remarks
 * Returns the span from the current execution context.
 * Useful for adding attributes to an existing span.
 *
 * @example
 * ```typescript
 * const span = getActiveSpan();
 * if (span) {
 *   span.setAttribute('user.id', userId);
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function getActiveSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/**
 * Adds attributes to the currently active span.
 *
 * @param attributes - Key-value pairs to add
 *
 * @remarks
 * Safely adds attributes to the active span.
 * Does nothing if no span is active.
 *
 * @example
 * ```typescript
 * // Add single attribute
 * addSpanAttributes({ 'preprint.uri': preprintUri });
 *
 * // Add multiple attributes
 * addSpanAttributes({
 *   'http.method': 'GET',
 *   'http.route': '/api/preprints/:id',
 *   'http.status_code': 200,
 * });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function addSpanAttributes(attributes: Attributes): void {
  const span = getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Records an error on the currently active span.
 *
 * @param error - Error to record
 * @param message - Optional additional message
 *
 * @remarks
 * Records the error as an exception event and sets span status to ERROR.
 * Does nothing if no span is active.
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   recordSpanError(error as Error, 'Failed to complete operation');
 *   throw error;
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function recordSpanError(error: Error, message?: string): void {
  const span = getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: message ?? error.message,
    });
  }
}

/**
 * Options for withSpan function.
 *
 * @public
 */
export interface WithSpanOptions extends SpanOptions {
  /**
   * Additional attributes to set on the span.
   */
  readonly attributes?: Attributes;
}

/**
 * Wraps an operation in a span.
 *
 * @param name - Span name
 * @param fn - Function to execute within the span
 * @param options - Optional span configuration
 * @returns Result of the wrapped function
 *
 * @remarks
 * Creates a span, executes the function within that span's context,
 * and properly ends the span (including error recording on failure).
 *
 * Supports both synchronous and asynchronous functions.
 *
 * @example
 * ```typescript
 * // Async operation
 * const result = await withSpan('indexPreprint', async () => {
 *   const preprint = await fetchPreprint(uri);
 *   await indexToElasticsearch(preprint);
 *   return preprint;
 * });
 *
 * // With attributes
 * const result = await withSpan(
 *   'processRequest',
 *   async () => {
 *     return await handleRequest(req);
 *   },
 *   { attributes: { 'http.method': 'GET', 'http.route': '/api/preprints' } }
 * );
 *
 * // Sync operation
 * const hash = withSpan('computeHash', () => {
 *   return crypto.createHash('sha256').update(data).digest('hex');
 * });
 *
 * // Nested spans (automatic parent-child relationship)
 * await withSpan('parentOperation', async () => {
 *   await withSpan('childOperation1', async () => { ... });
 *   await withSpan('childOperation2', async () => { ... });
 * });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export async function withSpan<T>(
  name: string,
  fn: () => T | Promise<T>,
  options?: WithSpanOptions
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(name, options);

  if (options?.attributes) {
    span.setAttributes(options.attributes);
  }

  const ctx = trace.setSpan(context.active(), span);

  try {
    const result = await context.with(ctx, fn);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Wraps a synchronous operation in a span.
 *
 * @param name - Span name
 * @param fn - Synchronous function to execute
 * @param options - Optional span configuration
 * @returns Result of the wrapped function
 *
 * @remarks
 * Similar to {@link withSpan} but for purely synchronous operations.
 * Does not create a Promise overhead.
 *
 * @example
 * ```typescript
 * // Sync operation
 * const result = withSpanSync('parseJson', () => {
 *   return JSON.parse(jsonString);
 * });
 *
 * // With attributes
 * const hash = withSpanSync(
 *   'computeHash',
 *   () => crypto.createHash('sha256').update(data).digest('hex'),
 *   { attributes: { 'hash.algorithm': 'sha256' } }
 * );
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function withSpanSync<T>(name: string, fn: () => T, options?: WithSpanOptions): T {
  const tracer = getTracer();
  const span = tracer.startSpan(name, options);

  if (options?.attributes) {
    span.setAttributes(options.attributes);
  }

  const ctx = trace.setSpan(context.active(), span);

  try {
    const result = context.with(ctx, fn);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Creates a span that wraps multiple child operations.
 *
 * @param name - Parent span name
 * @param operations - Array of named operations to execute
 * @returns Promise resolving to array of operation results
 *
 * @remarks
 * Executes operations sequentially, each in its own child span.
 * If any operation fails, subsequent operations are not executed.
 *
 * @example
 * ```typescript
 * const [fetchResult, indexResult, notifyResult] = await withChildSpans(
 *   'processPreprint',
 *   [
 *     { name: 'fetchPreprint', fn: () => fetchPreprint(uri) },
 *     { name: 'indexToSearch', fn: () => indexToElasticsearch(preprint) },
 *     { name: 'sendNotification', fn: () => sendNotification(preprint) },
 *   ]
 * );
 * ```
 *
 * @public
 * @since 0.1.0
 */
export async function withChildSpans<T extends unknown[]>(
  name: string,
  operations: { [K in keyof T]: { name: string; fn: () => T[K] | Promise<T[K]> } }
): Promise<T> {
  return withSpan(name, async () => {
    const results: unknown[] = [];
    for (const op of operations) {
      const result = await withSpan(op.name, op.fn);
      results.push(result);
    }
    return results as T;
  });
}

/**
 * Extracts trace context for propagation.
 *
 * @returns Object with trace_id, span_id, and trace_flags
 *
 * @remarks
 * Use this to propagate trace context to external systems
 * (e.g., in log entries or outgoing requests).
 *
 * @example
 * ```typescript
 * const traceContext = getTraceContext();
 * // { trace_id: 'abc123...', span_id: 'xyz789...', trace_flags: 1 }
 *
 * // Include in logs
 * logger.info('Operation complete', { ...traceContext, result: 'success' });
 *
 * // Include in outgoing request headers
 * fetch(url, {
 *   headers: {
 *     'X-Trace-ID': traceContext.trace_id,
 *     'X-Span-ID': traceContext.span_id,
 *   }
 * });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function getTraceContext(): {
  trace_id: string;
  span_id: string;
  trace_flags: number;
} | null {
  const span = getActiveSpan();
  if (!span) {
    return null;
  }

  const spanContext = span.spanContext();
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: spanContext.traceFlags,
  };
}

/**
 * Semantic conventions for common span attributes.
 *
 * @remarks
 * Use these constants for consistent attribute naming across spans.
 *
 * @example
 * ```typescript
 * addSpanAttributes({
 *   [SpanAttributes.HTTP_METHOD]: 'GET',
 *   [SpanAttributes.HTTP_ROUTE]: '/api/preprints/:id',
 *   [SpanAttributes.HTTP_STATUS_CODE]: 200,
 * });
 * ```
 *
 * @public
 */
export const SpanAttributes = {
  // HTTP
  HTTP_METHOD: 'http.method',
  HTTP_ROUTE: 'http.route',
  HTTP_STATUS_CODE: 'http.status_code',
  HTTP_URL: 'http.url',

  // Database
  DB_SYSTEM: 'db.system',
  DB_NAME: 'db.name',
  DB_OPERATION: 'db.operation',
  DB_STATEMENT: 'db.statement',

  // Messaging
  MESSAGING_SYSTEM: 'messaging.system',
  MESSAGING_OPERATION: 'messaging.operation',
  MESSAGING_DESTINATION: 'messaging.destination',

  // Custom: Chive specific
  PREPRINT_URI: 'chive.preprint.uri',
  PREPRINT_DID: 'chive.preprint.did',
  USER_DID: 'chive.user.did',
  OPERATION: 'chive.operation',
  REQUEST_ID: 'chive.request.id',
} as const;
