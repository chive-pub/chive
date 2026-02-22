/**
 * React hooks for profile configuration data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for fetching and updating per-user profile
 * display configuration. Profile config records (pub.chive.actor.profileConfig)
 * control how a user's profile page is rendered: section visibility and ordering,
 * profile type, and which collection to feature prominently.
 *
 * @example
 * ```tsx
 * import { useProfileConfig, useUpdateProfileConfig } from '@/lib/hooks/use-profile-config';
 *
 * function ProfileSettings({ did }: { did: string }) {
 *   const { data: config } = useProfileConfig(did);
 *   const updateConfig = useUpdateProfileConfig();
 *
 *   return (
 *     <SectionManager
 *       sections={config?.sections ?? []}
 *       onSave={(sections) =>
 *         updateConfig.mutateAsync({ sections, profileType: 'individual' })
 *       }
 *     />
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { authApi, getApiBaseUrl } from '@/lib/api/client';
import { createLogger } from '@/lib/observability/logger';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { updateProfileConfig, type UpdateProfileConfigInput } from '@/lib/atproto/record-creator';

const logger = createLogger({ context: { component: 'use-profile-config' } });

// =============================================================================
// LOCAL TYPES
// =============================================================================

/**
 * Profile section configuration.
 */
export interface ProfileSection {
  /** Section identifier (e.g., 'publications', 'collections', 'endorsements') */
  id: string;
  /** Whether the section is visible on the profile */
  visible: boolean;
  /** Display order (lower values first) */
  order: number;
}

/**
 * Profile configuration as returned by the API.
 */
export interface ProfileConfigView {
  /** DID of the user this config belongs to */
  did: string;
  /** AT-URI of the config record */
  uri: string;
  /** CID of the indexed record */
  cid: string;
  /** Profile type (e.g., 'individual', 'lab', 'organization') */
  profileType?: string;
  /** Ordered list of profile sections */
  sections: ProfileSection[];
  /** AT-URI of the featured collection */
  featuredCollectionUri?: string;
  /** When the config was created */
  createdAt: string;
  /** When the config was last updated */
  updatedAt?: string;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for profile config queries.
 *
 * @example
 * ```typescript
 * // Invalidate a user's profile config
 * queryClient.invalidateQueries({ queryKey: profileConfigKeys.forUser(userDid) });
 * ```
 */
export const profileConfigKeys = {
  /** Base key for all profile config queries */
  all: ['profile-config'] as const,

  /** Key for a specific user's profile config */
  forUser: (did: string) => [...profileConfigKeys.all, did] as const,
};

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Fetches a user's profile display configuration.
 *
 * @remarks
 * Returns the profile config if one exists, or null if the user has not
 * configured their profile layout. A null result means the default layout
 * should be used.
 *
 * @param did - DID of the user
 * @param options - Hook options
 * @returns Query result with profile config or null
 *
 * @example
 * ```tsx
 * const { data: config, isLoading } = useProfileConfig(userDid);
 *
 * if (isLoading) return <ProfileSkeleton />;
 *
 * const sections = config?.sections ?? DEFAULT_SECTIONS;
 * return <ProfileLayout sections={sections} />;
 * ```
 */
export function useProfileConfig(did: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: profileConfigKeys.forUser(did),
    queryFn: async (): Promise<ProfileConfigView | null> => {
      try {
        const baseUrl = getApiBaseUrl();
        const searchParams = new URLSearchParams({ did });
        const url = `${baseUrl}/xrpc/pub.chive.actor.getProfileConfig?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          // 404 means no config exists yet; return null (use defaults)
          if (response.status === 404) return null;
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string'
              ? body['message']
              : 'Failed to fetch profile config',
            response.status,
            'pub.chive.actor.getProfileConfig'
          );
        }
        return (await response.json()) as ProfileConfigView;
      } catch (error) {
        if (error instanceof APIError) {
          if (error.statusCode === 404) return null;
          throw error;
        }
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch profile config',
          undefined,
          'pub.chive.actor.getProfileConfig'
        );
      }
    },
    enabled: !!did && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Mutation hook for creating or updating profile configuration.
 *
 * @remarks
 * Uses putRecord with 'self' as rkey, so this always creates or overwrites
 * the singleton config record. After writing to the PDS, requests immediate
 * indexing for UI responsiveness.
 *
 * @example
 * ```tsx
 * const updateConfig = useUpdateProfileConfig();
 *
 * const handleSave = async () => {
 *   await updateConfig.mutateAsync({
 *     profileType: 'individual',
 *     sections: [
 *       { id: 'publications', visible: true, order: 0 },
 *       { id: 'collections', visible: true, order: 1 },
 *     ],
 *     featuredCollectionUri: myCollectionUri,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for updating profile config
 */
export function useUpdateProfileConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileConfigInput): Promise<ProfileConfigView> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'updateProfileConfig');
      }

      const result = await updateProfileConfig(agent, input);

      // Request immediate indexing
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (indexError) {
        logger.warn('Immediate indexing failed; firehose will handle', {
          uri: result.uri,
          error: indexError instanceof Error ? indexError.message : String(indexError),
        });
      }

      return {
        did: agent.did ?? '',
        uri: result.uri,
        cid: result.cid,
        profileType: input.profileType,
        sections: input.sections,
        featuredCollectionUri: input.featuredCollectionUri,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: profileConfigKeys.forUser(data.did),
      });
    },
  });
}
