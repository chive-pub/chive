'use client';

import { FaroErrorBoundary } from '@/lib/observability/faro/react/FaroErrorBoundary';
import { ErrorCard } from '@/components/errors';
import { useTraceId } from '@/lib/observability';

interface EprintFaroErrorBoundaryProps {
  uri: string;
  children: React.ReactNode;
}

/**
 * Faro-integrated error boundary for eprint detail rendering.
 *
 * @remarks
 * Catches rendering crashes inside EprintDetailContent and reports them
 * to Faro with the eprint URI and component stack. Shows a user-friendly
 * error card with a trace reference for support.
 */
export function EprintFaroErrorBoundary({ uri, children }: EprintFaroErrorBoundaryProps) {
  const traceId = useTraceId();

  return (
    <FaroErrorBoundary
      componentName="EprintDetailContent"
      context={{ eprintUri: uri, traceId: traceId ?? '' }}
      fallback={(error, reset) => (
        <div className="container mx-auto px-4 py-8">
          <ErrorCard
            title="Eprint Error"
            message="Failed to display eprint. Please try again."
            error={error}
            onRetry={reset}
            showDetails={process.env.NODE_ENV === 'development'}
          />
          {traceId && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Reference: {traceId.slice(0, 8)}
            </p>
          )}
        </div>
      )}
    >
      {children}
    </FaroErrorBoundary>
  );
}
