import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getApiBaseUrl } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type { AlphaStatusResponse, AlphaApplyInput, AlphaApplyResponse } from '@/lib/api/schema';

/**
 * Query key factory for alpha status queries.
 */
export const alphaKeys = {
  /** Base key for all alpha queries */
  all: ['alpha'] as const,
  /** Key for status query */
  status: () => [...alphaKeys.all, 'status'] as const,
};

// =============================================================================
// QUERY HOOKS
// =============================================================================

interface UseAlphaStatusOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches the authenticated user's alpha application status.
 *
 * @param options - Query options
 * @returns Query result with alpha status
 */
export function useAlphaStatus(options: UseAlphaStatusOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: alphaKeys.status(),
    queryFn: async (): Promise<AlphaStatusResponse> => {
      // Manual fetch since endpoints aren't in OpenAPI yet
      const response = await fetch(`${getApiBaseUrl()}/xrpc/pub.chive.alpha.checkStatus`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new APIError(
          (body as { message?: string }).message ?? 'Failed to fetch alpha status',
          response.status,
          '/xrpc/pub.chive.alpha.checkStatus'
        );
      }

      return response.json() as Promise<AlphaStatusResponse>;
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
    retry: false, // Don't retry on auth errors
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Mutation hook to submit an alpha application.
 *
 * @returns Mutation for submitting alpha application
 */
export function useAlphaApply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AlphaApplyInput): Promise<AlphaApplyResponse> => {
      // Manual fetch since endpoints aren't in OpenAPI yet
      const response = await fetch(`${getApiBaseUrl()}/xrpc/pub.chive.alpha.apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new APIError(
          (body as { message?: string }).message ?? 'Failed to submit application',
          response.status,
          '/xrpc/pub.chive.alpha.apply'
        );
      }

      return response.json() as Promise<AlphaApplyResponse>;
    },
    onSuccess: () => {
      // Invalidate status query to refetch
      queryClient.invalidateQueries({ queryKey: alphaKeys.status() });
    },
  });
}
