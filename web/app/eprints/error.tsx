'use client';

import { useEffect } from 'react';

import { ErrorCard } from '@/components/errors';
import { logger, usePushError, useTraceId } from '@/lib/observability';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EprintsError({ error, reset }: ErrorBoundaryProps) {
  const pushError = usePushError();
  const traceId = useTraceId();

  useEffect(() => {
    logger.error('Eprints error', error, {
      digest: error.digest,
      component: 'eprints-error-boundary',
      traceId,
    });

    pushError(error, {
      component: 'eprints-error-boundary',
      route: '/eprints',
      digest: error.digest ?? '',
      traceId: traceId ?? '',
    });
  }, [error, pushError, traceId]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="container mx-auto px-4 py-8">
      <ErrorCard
        title="Eprint Error"
        message={isDev ? error.message : 'Failed to load eprint. Please try again.'}
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
  );
}
