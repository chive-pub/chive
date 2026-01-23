'use client';

/**
 * Retry button component with loading state.
 *
 * @packageDocumentation
 */

import { RefreshCw } from 'lucide-react';

import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * Props for the RetryButton component.
 */
export interface RetryButtonProps extends Omit<ButtonProps, 'children'> {
  /** Callback when retry is clicked */
  onRetry: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Button text when idle */
  label?: string;
  /** Button text when retrying */
  retryingLabel?: string;
}

/**
 * Retry button with loading spinner.
 *
 * @example
 * ```tsx
 * <RetryButton onRetry={refetch} isRetrying={isLoading} />
 * ```
 */
export function RetryButton({
  onRetry,
  isRetrying = false,
  label = 'Try again',
  retryingLabel = 'Retrying...',
  variant = 'outline',
  ...props
}: RetryButtonProps) {
  return (
    <Button variant={variant} onClick={onRetry} disabled={isRetrying} {...props}>
      <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? retryingLabel : label}
    </Button>
  );
}
