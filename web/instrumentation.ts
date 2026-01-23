/**
 * Next.js Instrumentation for server-side observability.
 *
 * @remarks
 * This file is automatically loaded by Next.js when the instrumentation
 * hook is enabled. It sets up OpenTelemetry for server-side tracing
 * using @vercel/otel for seamless integration.
 *
 * @see https://nextjs.org/docs/app/guides/instrumentation
 * @see https://www.npmjs.com/package/@vercel/otel
 *
 * @packageDocumentation
 */

import { registerOTel } from '@vercel/otel';

/**
 * Register OpenTelemetry instrumentation.
 *
 * @remarks
 * Called by Next.js during server startup. Sets up distributed tracing
 * with proper propagation to correlate frontend (Faro) and backend spans.
 */
export async function register() {
  // Register OpenTelemetry with @vercel/otel
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'chive-web',
    // Use OTLP exporter if configured, otherwise use console in development
    attributes: {
      'service.version': process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    },
  });

  // Only run additional initialization in Node.js runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import server-side tracing setup and logger
    const { initializeTraceContext, logger } = await import('./lib/observability');

    // Initialize a root trace context for server-side operations
    initializeTraceContext();

    // Log instrumentation registration
    if (process.env.NODE_ENV === 'development') {
      logger.info('Server-side observability initialized with OpenTelemetry', {
        component: 'instrumentation',
        serviceName: process.env.OTEL_SERVICE_NAME ?? 'chive-web',
      });
    }
  }
}

/**
 * Called when a request error occurs.
 *
 * @remarks
 * This hook is called for unhandled errors in API routes and server components.
 * It provides a central place to log and track errors with distributed tracing.
 */
export async function onRequestError(
  error: { digest: string } & Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource?:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering';
    revalidateReason?: 'on-demand' | 'stale' | undefined;
    renderType?: 'dynamic' | 'dynamic-resume';
  }
) {
  // Dynamic import to avoid issues during instrumentation bootstrap
  const { logger } = await import('./lib/observability');

  // Extract trace context from request headers for correlation
  const traceparent = request.headers['traceparent'];
  const tracestate = request.headers['tracestate'];

  // Log error with structured context
  logger.error('Request error', error, {
    component: 'instrumentation',
    digest: error.digest,
    // Include trace context for correlation with frontend
    ...(traceparent ? { traceparent } : {}),
    ...(tracestate ? { tracestate } : {}),
    request: {
      path: request.path,
      method: request.method,
    },
    context: {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  });
}
