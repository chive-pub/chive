'use client';

import { useEffect } from 'react';

import { ErrorCard } from '@/components/errors';
import { logger } from '@/lib/observability';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TrendingError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('Trending error', error, {
      digest: error.digest,
      component: 'trending-error-boundary',
    });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="container mx-auto px-4 py-8">
      <ErrorCard
        title="Trending Error"
        message={isDev ? error.message : 'Failed to load trending content. Please try again.'}
        error={error}
        onRetry={reset}
        showDetails={isDev}
      />
    </div>
  );
}
