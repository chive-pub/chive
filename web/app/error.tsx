'use client';

/**
 * Root error boundary for the application.
 *
 * @remarks
 * Catches all unhandled errors in the app and displays a user-friendly
 * error message. Reports errors to Faro for production monitoring.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 *
 * @packageDocumentation
 */

import { useEffect } from 'react';

import { ErrorCard } from '@/components/errors';
import { logger, usePushError, useTraceId } from '@/lib/observability';

/**
 * Props for the error boundary component.
 */
interface ErrorBoundaryProps {
  /** The error that was thrown */
  error: Error & { digest?: string };
  /** Function to reset the error boundary */
  reset: () => void;
}

/**
 * Root error boundary component.
 */
export default function Error({ error, reset }: ErrorBoundaryProps) {
  const pushError = usePushError();
  const traceId = useTraceId();

  useEffect(() => {
    // Log the error to our observability system
    logger.error('Unhandled error caught by error boundary', error, {
      digest: error.digest,
      component: 'root-error-boundary',
      traceId,
    });

    // Report to Faro for production monitoring
    pushError(error, {
      component: 'root-error-boundary',
      route: '/',
      digest: error.digest ?? '',
      traceId: traceId ?? '',
    });
  }, [error, pushError, traceId]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <ErrorCard
          title="Something went wrong"
          message={
            isDev
              ? error.message
              : 'An unexpected error occurred. Please try again or contact support if the problem persists.'
          }
          error={error}
          onRetry={reset}
          showDetails={isDev}
        />
        {traceId && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Reference: {traceId.slice(0, 8)}
          </p>
        )}
      </div>
    </div>
  );
}
