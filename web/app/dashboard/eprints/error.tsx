'use client';

import { useEffect } from 'react';

import { ErrorCard } from '@/components/errors';
import { logger } from '@/lib/observability';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardEprintsError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('Dashboard eprints error', error, {
      digest: error.digest,
      component: 'dashboard-eprints-error-boundary',
    });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="container mx-auto px-4 py-8">
      <ErrorCard
        title="Eprints Error"
        message={isDev ? error.message : 'Failed to load your eprints. Please try again.'}
        error={error}
        onRetry={reset}
        showDetails={isDev}
      />
    </div>
  );
}
