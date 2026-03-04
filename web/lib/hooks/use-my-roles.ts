/**
 * Hook for fetching the current user's roles from the Chive admin API.
 *
 * @remarks
 * Uses a manual fetch since `pub.chive.actor.getMyRoles` is not yet
 * in the generated XRPC types. Requires an authenticated session;
 * the service auth token is obtained from the user's PDS.
 *
 * @packageDocumentation
 */

import { useQuery } from '@tanstack/react-query';

import { getApiBaseUrl } from '@/lib/api/client';
import { getServiceAuthToken } from '@/lib/auth/service-auth';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { logger } from '@/lib/observability';

const rolesLogger = logger.child({ component: 'use-my-roles' });

/**
 * Response shape from the getMyRoles endpoint.
 */
export interface MyRolesResponse {
  /** List of role identifiers assigned to the user */
  roles: string[];
  /** Whether the user has admin privileges */
  isAdmin: boolean;
  /** Whether the user is an approved alpha tester */
  isAlphaTester: boolean;
  /** Whether the user has premium access */
  isPremium: boolean;
}

/**
 * Query key factory for roles queries.
 */
export const myRolesKeys = {
  all: ['myRoles'] as const,
};

/**
 * Fetches the current user's roles from the Chive backend.
 *
 * @param options - Hook options
 * @returns Query result with the user's roles
 *
 * @example
 * ```tsx
 * const { data: roles, isLoading } = useMyRoles();
 * if (roles?.isAdmin) {
 *   // Show admin controls
 * }
 * ```
 */
export function useMyRoles(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: myRolesKeys.all,
    queryFn: async (): Promise<MyRolesResponse> => {
      const apiBase = getApiBaseUrl();
      const agent = getCurrentAgent();
      const headers: Record<string, string> = {};

      if (agent) {
        try {
          const token = await getServiceAuthToken(agent, 'pub.chive.actor.getMyRoles');
          headers['Authorization'] = `Bearer ${token}`;
        } catch (authError) {
          rolesLogger.warn('Failed to get service auth token for getMyRoles', {
            error: authError instanceof Error ? authError.message : String(authError),
          });
        }
      }

      const response = await fetch(`${apiBase}/xrpc/pub.chive.actor.getMyRoles`, { headers });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Failed to fetch roles' }));
        throw new Error(
          typeof errorBody.message === 'string' ? errorBody.message : 'Failed to fetch roles'
        );
      }

      return response.json() as Promise<MyRolesResponse>;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
