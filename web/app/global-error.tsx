'use client';

/**
 * Global error boundary for root layout errors.
 *
 * @remarks
 * This is a special error boundary that catches errors in the root layout.
 * It must define its own <html> and <body> tags since it replaces the
 * root layout when an error occurs.
 *
 * Note: This component cannot use hooks like usePushError since it renders
 * outside the provider tree. It reports errors directly via the logger which
 * forwards to Faro in production.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 *
 * @packageDocumentation
 */

import { useEffect } from 'react';
import { logger } from '@/lib/observability';
import { getFaro } from '@/lib/observability/faro';

/**
 * Props for the global error boundary component.
 */
interface GlobalErrorProps {
  /** The error that was thrown */
  error: Error & { digest?: string };
  /** Function to reset the error boundary */
  reset: () => void;
}

/**
 * Global error boundary component.
 *
 * @remarks
 * This component is rendered when an error occurs in the root layout.
 * It provides a minimal UI without any dependencies that might have failed.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log error with structured context
    logger.error('Global error caught', error, {
      component: 'global-error-boundary',
      digest: error.digest,
    });

    // Try to report to Faro directly (may not be initialized)
    try {
      const faro = getFaro();
      if (faro) {
        faro.api.pushError(error, {
          context: {
            component: 'global-error-boundary',
            route: 'root-layout',
            digest: error.digest ?? '',
          },
        });
      }
    } catch {
      // Faro may not be available, ignore
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '24rem',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #ef4444',
              backgroundColor: '#fef2f2',
            }}
          >
            <h1
              style={{
                margin: '0 0 0.5rem',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#dc2626',
              }}
            >
              Application Error
            </h1>
            <p
              style={{
                margin: '0 0 1rem',
                fontSize: '0.875rem',
                color: '#7f1d1d',
              }}
            >
              A critical error occurred. Please refresh the page or try again later.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre
                style={{
                  margin: '0 0 1rem',
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.25rem',
                  backgroundColor: '#fee2e2',
                  overflow: 'auto',
                  maxHeight: '8rem',
                }}
              >
                {error.message}
              </pre>
            )}
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#dc2626',
                backgroundColor: 'white',
                border: '1px solid #dc2626',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
