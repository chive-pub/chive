'use client';

import { useEffect } from 'react';

import { ErrorCard } from '@/components/errors';
import { logger } from '@/lib/observability';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function OAuthError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('OAuth error', error, {
      digest: error.digest,
      component: 'oauth-error-boundary',
    });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="container mx-auto px-4 py-8">
      <ErrorCard
        title="Authentication Error"
        message={isDev ? error.message : 'Authentication failed. Please try again.'}
        error={error}
        onRetry={reset}
        showDetails={isDev}
      />
    </div>
  );
}
