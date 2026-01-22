'use client';

/**
 * Reusable error display card component.
 *
 * @remarks
 * Displays errors in a consistent, user-friendly format with optional
 * retry functionality. Shows additional debug information in development mode.
 *
 * @packageDocumentation
 */

import { AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { ErrorDetails } from './error-details';

/**
 * Props for the ErrorCard component.
 */
export interface ErrorCardProps {
  /** Error title */
  title?: string;
  /** User-friendly error message */
  message?: string;
  /** Full error object for debug details */
  error?: Error;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Show debug details (defaults to dev mode only) */
  showDetails?: boolean;
}

/**
 * Error display card with retry functionality.
 *
 * @example
 * ```tsx
 * <ErrorCard
 *   title="Failed to load eprints"
 *   message="The server returned an error. Please try again."
 *   error={error}
 *   onRetry={refetch}
 * />
 * ```
 */
export function ErrorCard({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  error,
  onRetry,
  isRetrying = false,
  showDetails,
}: ErrorCardProps) {
  const isDev = process.env.NODE_ENV === 'development';
  const shouldShowDetails = showDetails ?? isDev;

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">{title}</CardTitle>
        </div>
        <CardDescription className="text-destructive/80">{message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onRetry && (
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try again'}
          </Button>
        )}
        {shouldShowDetails && error && <ErrorDetails error={error} />}
      </CardContent>
    </Card>
  );
}
