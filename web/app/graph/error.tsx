'use client';

import { useEffect } from 'react';

import { ErrorCard } from '@/components/errors';
import { logger } from '@/lib/observability';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GraphError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('Graph error', error, {
      digest: error.digest,
      component: 'graph-error-boundary',
    });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="container mx-auto px-4 py-8">
      <ErrorCard
        title="Knowledge Graph Error"
        message={isDev ? error.message : 'Failed to load the knowledge graph. Please try again.'}
        error={error}
        onRetry={reset}
        showDetails={isDev}
      />
    </div>
  );
}
