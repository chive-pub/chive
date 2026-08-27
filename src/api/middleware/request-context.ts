/**
 * Request context middleware for logging, timing, and correlation.
 *
 * @remarks
 * Initializes request-scoped context variables:
 * - Request ID for correlation across logs and services
 * - Start time for duration tracking
 * - Child logger with request context
 *
 * @packageDocumentation
 * @public
 */

import type { MiddlewareHandler } from 'hono';

import { httpMetrics } from '../../observability/prometheus-registry.js';
import type { ChiveEnv } from '../types/context.js';

/**
 * Generates a unique request ID.
 *
 * @remarks
 * Format: `req_<timestamp>_<random>` for sortability and uniqueness.
 *
 * @returns Unique request identifier
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

/**
 * Request context middleware.
 *
 * @remarks
 * Sets up request-scoped variables for logging and timing:
 * - Generates or uses provided request ID
 * - Records request start time
 * - Creates child logger with request context
 * - Logs request completion with duration
 *
 * @example
 * ```typescript
 * app.use('*', requestContext());
 *
 * app.get('/test', (c) => {
 *   const requestId = c.get('requestId');
 *   const logger = c.get('logger');
 *   logger.info('Processing request'); // Includes requestId
 *   return c.json({ requestId });
 * });
 * ```
 *
 * @public
 */
/**
 * Parses W3C Trace Context traceparent header.
 *
 * @remarks
 * Format: 00-trace_id-span_id-trace_flags
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 *
 * @see https://www.w3.org/TR/trace-context/
 */
function parseTraceparent(
  header: string | undefined
): { traceId: string; parentSpanId: string; traceFlags: string } | null {
  if (!header) return null;

  const parts = header.split('-');
  if (parts.length !== 4) return null;

  const version = parts[0];
  const traceId = parts[1];
  const parentSpanId = parts[2];
  const traceFlags = parts[3];

  // TypeScript safety: ensure all parts exist
  if (!version || !traceId || !parentSpanId || !traceFlags) return null;

  // Validate version (currently only 00 is supported)
  if (version !== '00') return null;

  // Validate trace ID (32 hex chars, not all zeros)
  if (!/^[0-9a-f]{32}$/i.test(traceId) || traceId === '00000000000000000000000000000000') {
    return null;
  }

  // Validate span ID (16 hex chars, not all zeros)
  if (!/^[0-9a-f]{16}$/i.test(parentSpanId) || parentSpanId === '0000000000000000') {
    return null;
  }

  return { traceId, parentSpanId, traceFlags };
}

export function requestContext(): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    // Use provided request ID or generate new one
    const requestId =
      c.req.header('x-request-id') ?? c.req.header('x-correlation-id') ?? generateRequestId();

    const startTime = performance.now();

    // Extract W3C Trace Context if provided
    const traceparent = parseTraceparent(c.req.header('traceparent'));
    const tracestate = c.req.header('tracestate');

    // Set context variables
    c.set('requestId', requestId);
    c.set('requestStartTime', startTime);

    // Create child logger with request context (including trace info if available)
    const baseLogger = c.get('logger');
    const loggerContext: Record<string, unknown> = {
      requestId,
      method: c.req.method,
      path: c.req.path,
    };

    // Add trace context to logger if provided by frontend
    if (traceparent) {
      loggerContext.traceId = traceparent.traceId;
      loggerContext.parentSpanId = traceparent.parentSpanId;
      if (tracestate) {
        loggerContext.tracestate = tracestate;
      }
    }

    const requestLogger = baseLogger.child(loggerContext);
    c.set('logger', requestLogger);

    // Set response headers
    c.header('X-Request-ID', requestId);
    if (traceparent) {
      c.header('X-Trace-ID', traceparent.traceId);
    }

    requestLogger.debug('Request started', traceparent ? { traceId: traceparent.traceId } : {});

    let thrown: Error | undefined;
    try {
      await next();
    } catch (error) {
      // Captured and re-thrown so the 500 below is logged with the stack that
      // produced it. The `undefined` that used to sit in the error slot meant
      // every server error was recorded with a duration and a status and no
      // indication of what actually failed.
      thrown = error instanceof Error ? error : new Error(String(error));
      throw error;
    } finally {
      const duration = Math.round(performance.now() - startTime);
      const status = c.res.status;

      // Log completion
      if (status >= 500 || thrown) {
        requestLogger.error('Request failed', thrown ?? c.error, {
          status,
          durationMs: duration,
        });
      } else if (status >= 400) {
        requestLogger.warn('Request error', {
          status,
          durationMs: duration,
        });
      } else {
        requestLogger.info('Request completed', {
          status,
          durationMs: duration,
        });
      }

      // Record the request in Prometheus. The counter and histogram existed
      // with no emission site anywhere, so the service exposed no request rate,
      // latency or error-rate metrics at all — the middleware computed exactly
      // these numbers and then only logged them.
      //
      // The endpoint label uses the matched route pattern rather than the raw
      // path: labelling by path would mint a new time series per URI and blow
      // up cardinality within a day of real traffic.
      const endpoint = c.req.routePath ?? 'unmatched';
      const labels = { method: c.req.method, endpoint, status: String(status) };
      httpMetrics.requestsTotal.inc(labels);
      httpMetrics.requestDuration.observe(labels, duration / 1000);

      // Set server timing header
      c.header('Server-Timing', `total;dur=${duration}`);
    }
  };
}
