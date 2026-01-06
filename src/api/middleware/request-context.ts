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
export function requestContext(): MiddlewareHandler<ChiveEnv> {
  return async (c, next) => {
    // Use provided request ID or generate new one
    const requestId =
      c.req.header('x-request-id') ?? c.req.header('x-correlation-id') ?? generateRequestId();

    const startTime = performance.now();

    // Set context variables
    c.set('requestId', requestId);
    c.set('requestStartTime', startTime);

    // Create child logger with request context
    const baseLogger = c.get('logger');
    const requestLogger = baseLogger.child({
      requestId,
      method: c.req.method,
      path: c.req.path,
    });
    c.set('logger', requestLogger);

    // Set response header
    c.header('X-Request-ID', requestId);

    requestLogger.debug('Request started');

    try {
      await next();
    } finally {
      const duration = Math.round(performance.now() - startTime);
      const status = c.res.status;

      // Log completion
      if (status >= 500) {
        requestLogger.error('Request failed', undefined, {
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

      // Set server timing header
      c.header('Server-Timing', `total;dur=${duration}`);
    }
  };
}
