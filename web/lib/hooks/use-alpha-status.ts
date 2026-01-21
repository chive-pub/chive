import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getApiBaseUrl } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import { getServiceAuthToken } from '@/lib/auth/service-auth';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import type { AlphaStatusResponse, AlphaApplyInput, AlphaApplyResponse } from '@/lib/api/schema';

/**
 * Check if running in E2E test mode.
 */
function isE2ETestMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_E2E_TEST === 'true') return true;
  return localStorage.getItem('chive_e2e_skip_oauth') === 'true';
}

/**
 * Get E2E test user DID from localStorage session metadata.
 */
function getE2ETestUserDid(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const metadata = localStorage.getItem('chive_session_metadata');
    if (!metadata) return null;
    const parsed = JSON.parse(metadata);
    return parsed?.did ?? null;
  } catch {
    return null;
  }
}

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
      // E2E test mode: use X-E2E-Auth-Did header instead of real OAuth
      if (isE2ETestMode()) {
        const e2eDid = getE2ETestUserDid();
        if (!e2eDid) {
          throw new APIError(
            'No E2E test user in localStorage',
            401,
            '/xrpc/pub.chive.alpha.checkStatus'
          );
        }

        const response = await fetch(`${getApiBaseUrl()}/xrpc/pub.chive.alpha.checkStatus`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-E2E-Auth-Did': e2eDid,
          },
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
      }

      // Production mode: get authenticated agent for service auth
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated', 401, '/xrpc/pub.chive.alpha.checkStatus');
      }

      // Get service auth JWT from user's PDS
      const token = await getServiceAuthToken(agent, 'pub.chive.alpha.checkStatus');

      // Fetch with service auth JWT
      const response = await fetch(`${getApiBaseUrl()}/xrpc/pub.chive.alpha.checkStatus`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
      // E2E test mode: use X-E2E-Auth-Did header instead of real OAuth
      if (isE2ETestMode()) {
        const e2eDid = getE2ETestUserDid();
        if (!e2eDid) {
          throw new APIError(
            'No E2E test user in localStorage',
            401,
            '/xrpc/pub.chive.alpha.apply'
          );
        }

        const response = await fetch(`${getApiBaseUrl()}/xrpc/pub.chive.alpha.apply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-E2E-Auth-Did': e2eDid,
          },
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
      }

      // Production mode: get authenticated agent for service auth
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated', 401, '/xrpc/pub.chive.alpha.apply');
      }

      // Get service auth JWT from user's PDS
      const token = await getServiceAuthToken(agent, 'pub.chive.alpha.apply');

      // Fetch with service auth JWT
      const response = await fetch(`${getApiBaseUrl()}/xrpc/pub.chive.alpha.apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
