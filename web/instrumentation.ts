/**
 * Next.js Instrumentation for server-side observability.
 *
 * @remarks
 * This file is automatically loaded by Next.js when the instrumentation
 * hook is enabled. It sets up OpenTelemetry for server-side tracing.
 *
 * @see https://nextjs.org/docs/app/guides/instrumentation
 * @packageDocumentation
 */

export async function register() {
  // Only register server-side instrumentation in Node.js runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import server-side tracing setup
    // This will be expanded when we add full OTEL SDK
    const { initializeTraceContext } = await import('./lib/observability/trace');

    // Initialize a root trace context for server-side operations
    initializeTraceContext();

    // Log instrumentation registration
    if (process.env.NODE_ENV === 'development') {
      console.log('[instrumentation] Server-side observability initialized');
    }
  }
}

/**
 * Called when a request error occurs.
 *
 * @remarks
 * This hook is called for unhandled errors in API routes and server components.
 * It provides a central place to log and track errors.
 */
export function onRequestError(
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
  // Log error with context for debugging
  // This will be enhanced with structured logging when OTEL is fully integrated
  console.error('[instrumentation] Request error:', {
    error: {
      message: error.message,
      digest: error.digest,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
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
