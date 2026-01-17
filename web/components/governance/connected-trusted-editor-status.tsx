'use client';

/**
 * Connected trusted editor status component.
 *
 * @remarks
 * Wrapper component that connects TrustedEditorStatus to the
 * governance hooks for automatic data fetching and mutations.
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { toast } from 'sonner';

import { TrustedEditorStatus, TrustedEditorStatusSkeleton } from './trusted-editor-status';
import { useMyEditorStatus, useRequestElevation, governanceKeys } from '@/lib/hooks/use-governance';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Props for ConnectedTrustedEditorStatus component.
 */
export interface ConnectedTrustedEditorStatusProps {
  /** Optional DID to fetch status for (defaults to current user) */
  did?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Connected trusted editor status component.
 *
 * @remarks
 * Fetches editor status using hooks and handles mutations.
 *
 * @example
 * ```tsx
 * <ConnectedTrustedEditorStatus />
 * ```
 */
export function ConnectedTrustedEditorStatus({ className }: ConnectedTrustedEditorStatusProps) {
  const queryClient = useQueryClient();
  const { data: status, isLoading, error, refetch } = useMyEditorStatus();
  const requestElevation = useRequestElevation();

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleRequestElevation = useCallback(async () => {
    try {
      const result = await requestElevation.mutateAsync();
      if (result.success) {
        toast.success('Elevation request submitted', {
          description: result.message,
        });
        queryClient.invalidateQueries({ queryKey: governanceKeys.myEditorStatus() });
      } else {
        toast.error('Elevation request failed', {
          description: result.message,
        });
      }
    } catch (err) {
      toast.error('Failed to request elevation', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [requestElevation, queryClient]);

  return (
    <TrustedEditorStatus
      status={status}
      isLoading={isLoading}
      error={error?.message}
      onRefresh={handleRefresh}
      onRequestElevation={handleRequestElevation}
      className={className}
    />
  );
}

export { TrustedEditorStatusSkeleton };
