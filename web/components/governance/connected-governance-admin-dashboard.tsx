'use client';

/**
 * Connected governance admin dashboard component.
 *
 * @remarks
 * Wrapper component that connects GovernanceAdminDashboard to the
 * governance hooks for automatic data fetching and mutations.
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { toast } from 'sonner';

import {
  GovernanceAdminDashboard,
  GovernanceAdminDashboardSkeleton,
} from './governance-admin-dashboard';
import {
  useMyEditorStatus,
  useTrustedEditors,
  useElevationRequests,
  useDelegations,
  useGrantDelegation,
  useRevokeDelegation,
  useRevokeRole,
  useApproveElevation,
  useRejectElevation,
  governanceKeys,
} from '@/lib/hooks/use-governance';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Props for ConnectedGovernanceAdminDashboard component.
 */
export interface ConnectedGovernanceAdminDashboardProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Connected governance admin dashboard component.
 *
 * @remarks
 * Fetches governance data using hooks and handles mutations.
 * Only renders the dashboard if the current user is an administrator.
 *
 * @example
 * ```tsx
 * <ConnectedGovernanceAdminDashboard />
 * ```
 */
export function ConnectedGovernanceAdminDashboard({
  className,
}: ConnectedGovernanceAdminDashboardProps) {
  const queryClient = useQueryClient();

  // Get current user's status to check admin role
  const { data: myStatus, isLoading: isLoadingMyStatus } = useMyEditorStatus();

  // Get list of trusted editors
  const {
    data: editorsResponse,
    isLoading: isLoadingEditors,
    error: editorsError,
    refetch: refetchEditors,
  } = useTrustedEditors({ limit: 100 });

  // Get elevation requests (only for admins)
  const isAdmin = myStatus?.role === 'administrator';
  const {
    data: elevationRequestsResponse,
    isLoading: isLoadingElevationRequests,
    refetch: refetchElevationRequests,
  } = useElevationRequests({ limit: 100 }, { enabled: isAdmin });

  // Get delegations (only for admins)
  const {
    data: delegationsResponse,
    isLoading: isLoadingDelegations,
    refetch: refetchDelegations,
  } = useDelegations({ limit: 100 }, { enabled: isAdmin });

  // Mutations
  const grantDelegation = useGrantDelegation();
  const revokeDelegation = useRevokeDelegation();
  const revokeRole = useRevokeRole();
  const approveElevation = useApproveElevation();
  const rejectElevation = useRejectElevation();

  const isLoading =
    isLoadingMyStatus || isLoadingEditors || isLoadingElevationRequests || isLoadingDelegations;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: governanceKeys.trustedEditors() });
    queryClient.invalidateQueries({ queryKey: governanceKeys.elevationRequests() });
    queryClient.invalidateQueries({ queryKey: governanceKeys.delegations() });
    refetchEditors();
    refetchElevationRequests();
    refetchDelegations();
  }, [queryClient, refetchEditors, refetchElevationRequests, refetchDelegations]);

  const handleRevokeRole = useCallback(
    async (did: string, reason: string) => {
      try {
        const result = await revokeRole.mutateAsync({ did, reason });
        if (result.success) {
          toast.success('Role revoked', {
            description: result.message,
          });
        } else {
          toast.error('Failed to revoke role', {
            description: result.message,
          });
        }
      } catch (err) {
        toast.error('Failed to revoke role', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [revokeRole]
  );

  const handleGrantDelegation = useCallback(
    async (did: string, collections: string[], daysValid: number) => {
      try {
        const result = await grantDelegation.mutateAsync({
          delegateDid: did,
          collections,
          daysValid,
        });
        if (result.success) {
          toast.success('Delegation granted', {
            description: result.message,
          });
        } else {
          toast.error('Failed to grant delegation', {
            description: result.message,
          });
        }
      } catch (err) {
        toast.error('Failed to grant delegation', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [grantDelegation]
  );

  const handleRevokeDelegation = useCallback(
    async (delegationId: string) => {
      try {
        const result = await revokeDelegation.mutateAsync({ delegationId });
        if (result.success) {
          toast.success('Delegation revoked', {
            description: result.message,
          });
        } else {
          toast.error('Failed to revoke delegation', {
            description: result.message,
          });
        }
      } catch (err) {
        toast.error('Failed to revoke delegation', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [revokeDelegation]
  );

  const handleApproveElevation = useCallback(
    async (requestId: string, notes?: string) => {
      try {
        const result = await approveElevation.mutateAsync({
          requestId,
          verificationNotes: notes,
        });
        if (result.success) {
          toast.success('Elevation approved', {
            description: result.message,
          });
        } else {
          toast.error('Failed to approve elevation', {
            description: result.message,
          });
        }
      } catch (err) {
        toast.error('Failed to approve elevation', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [approveElevation]
  );

  const handleRejectElevation = useCallback(
    async (requestId: string, reason: string) => {
      try {
        const result = await rejectElevation.mutateAsync({
          requestId,
          reason,
        });
        if (result.success) {
          toast.success('Elevation rejected', {
            description: result.message,
          });
        } else {
          toast.error('Failed to reject elevation', {
            description: result.message,
          });
        }
      } catch (err) {
        toast.error('Failed to reject elevation', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [rejectElevation]
  );

  return (
    <GovernanceAdminDashboard
      editors={editorsResponse?.editors}
      elevationRequests={elevationRequestsResponse?.requests}
      delegations={delegationsResponse?.delegations}
      isLoading={isLoading}
      error={editorsError?.message}
      isAdmin={isAdmin}
      onApproveElevation={handleApproveElevation}
      onRejectElevation={handleRejectElevation}
      onRevokeRole={handleRevokeRole}
      onGrantDelegation={handleGrantDelegation}
      onRevokeDelegation={handleRevokeDelegation}
      onRefresh={handleRefresh}
      className={className}
    />
  );
}

export { GovernanceAdminDashboardSkeleton };
