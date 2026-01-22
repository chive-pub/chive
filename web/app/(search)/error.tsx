'use client';

import { useEffect } from 'react';

import { ErrorCard } from '@/components/errors';
import { logger } from '@/lib/observability';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SearchError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('Search error', error, {
      digest: error.digest,
      component: 'search-error-boundary',
    });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="container mx-auto px-4 py-8">
      <ErrorCard
        title="Search Error"
        message={isDev ? error.message : 'Search failed. Please try again.'}
        error={error}
        onRetry={reset}
        showDetails={isDev}
      />
    </div>
  );
}
