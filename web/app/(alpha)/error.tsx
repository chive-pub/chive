'use client';

import { useEffect } from 'react';

import { ErrorCard } from '@/components/errors';
import { logger } from '@/lib/observability';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AlphaError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('Alpha access error', error, {
      digest: error.digest,
      component: 'alpha-error-boundary',
    });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="container mx-auto px-4 py-8">
      <ErrorCard
        title="Alpha Access Error"
        message={isDev ? error.message : 'Failed to load the page. Please try again.'}
        error={error}
        onRetry={reset}
        showDetails={isDev}
      />
    </div>
  );
}
