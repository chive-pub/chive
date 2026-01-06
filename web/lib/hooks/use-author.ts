import { useQuery, useQueryClient, useInfiniteQuery, useMutation } from '@tanstack/react-query';

import { api, authApi } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  updateChiveProfileRecord,
  type UpdateChiveProfileInput as DirectUpdateInput,
} from '@/lib/atproto/record-creator';
import type {
  AuthorProfile,
  AuthorMetrics,
  AuthorProfileResponse,
  PreprintSummary,
} from '@/lib/api/schema';
import type { paths } from '@/lib/api/schema.generated';

/**
 * Chive profile type extracted from OpenAPI schema.
 * Used for both get and update operations.
 */
export type ChiveProfile =
  paths['/xrpc/pub.chive.actor.getMyProfile']['get']['responses']['200']['content']['application/json'];

/**
 * Query key factory for author-related queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for author data.
 *
 * @example
 * ```typescript
 * // Invalidate all author queries
 * queryClient.invalidateQueries({ queryKey: authorKeys.all });
 *
 * // Invalidate specific author
 * queryClient.invalidateQueries({ queryKey: authorKeys.profile('did:plc:abc') });
 * ```
 */
export const authorKeys = {
  /** Base key for all author queries */
  all: ['authors'] as const,
  /** Key for author profile queries */
  profiles: () => [...authorKeys.all, 'profile'] as const,
  /** Key for specific author profile query */
  profile: (did: string) => [...authorKeys.profiles(), did] as const,
  /** Key for author metrics queries */
  metrics: (did: string) => [...authorKeys.all, 'metrics', did] as const,
  /** Key for author preprints queries */
  preprints: (did: string, params?: { limit?: number }) =>
    [...authorKeys.all, 'preprints', did, params] as const,
};

interface UseAuthorOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches an author profile by DID.
 *
 * @remarks
 * Uses TanStack Query with a 5-minute stale time.
 * Returns both profile information and metrics in a single request.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useAuthor('did:plc:abc123');
 *
 * if (data) {
 *   console.log(data.profile.displayName);
 *   console.log(data.metrics.totalPreprints);
 * }
 * ```
 *
 * @param did - The author's DID
 * @param options - Query options
 * @returns Query result with author profile and metrics
 *
 * @throws {Error} When the API request fails or author is not found
 */
export function useAuthor(did: string, options: UseAuthorOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: authorKeys.profile(did),
    queryFn: async (): Promise<AuthorProfileResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.author.getProfile', {
        params: { query: { did } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch author',
          undefined,
          '/xrpc/pub.chive.author.getProfile'
        );
      }
      return data!;
    },
    enabled: !!did && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetches just the author's profile information (without metrics).
 *
 * @remarks
 * Uses the same endpoint but extracts only the profile portion.
 * Useful when you don't need metrics data.
 *
 * @example
 * ```tsx
 * const { data: profile } = useAuthorProfile('did:plc:abc123');
 * ```
 *
 * @param did - The author's DID
 * @returns Query result with author profile
 */
export function useAuthorProfile(did: string) {
  return useQuery({
    queryKey: authorKeys.profile(did),
    queryFn: async (): Promise<AuthorProfile> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.author.getProfile', {
        params: { query: { did } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch author profile',
          undefined,
          '/xrpc/pub.chive.author.getProfile'
        );
      }
      return data!.profile;
    },
    enabled: !!did,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data as unknown as AuthorProfile,
  });
}

/**
 * Fetches author metrics separately.
 *
 * @remarks
 * Uses the same endpoint as useAuthor but extracts only metrics.
 * Shares cache with useAuthor when called with the same DID.
 *
 * @example
 * ```tsx
 * const { data: metrics } = useAuthorMetrics('did:plc:abc123');
 *
 * if (metrics) {
 *   console.log(`h-index: ${metrics.hIndex}`);
 * }
 * ```
 *
 * @param did - The author's DID
 * @returns Query result with author metrics
 */
export function useAuthorMetrics(did: string) {
  return useQuery({
    queryKey: authorKeys.metrics(did),
    queryFn: async (): Promise<AuthorMetrics> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.author.getProfile', {
        params: { query: { did } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch author metrics',
          undefined,
          '/xrpc/pub.chive.author.getProfile'
        );
      }
      return data!.metrics;
    },
    enabled: !!did,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for prefetching an author profile on hover/focus.
 *
 * @remarks
 * Improves perceived performance by loading author data before navigation.
 *
 * @example
 * ```tsx
 * const prefetchAuthor = usePrefetchAuthor();
 *
 * <AuthorLink
 *   onMouseEnter={() => prefetchAuthor(did)}
 *   href={`/authors/${did}`}
 * />
 * ```
 *
 * @returns Function to prefetch an author by DID
 */
export function usePrefetchAuthor() {
  const queryClient = useQueryClient();

  return (did: string) => {
    queryClient.prefetchQuery({
      queryKey: authorKeys.profile(did),
      queryFn: async (): Promise<AuthorProfileResponse | undefined> => {
        const { data } = await api.GET('/xrpc/pub.chive.author.getProfile', {
          params: { query: { did } },
        });
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}

/**
 * Checks if an author has an ORCID linked.
 *
 * @param profile - The author profile
 * @returns True if the author has an ORCID
 */
export function hasOrcid(profile: AuthorProfile | undefined | null): boolean {
  return !!profile?.orcid;
}

/**
 * Formats an ORCID for display with the full URL.
 *
 * @param orcid - The ORCID identifier (e.g., "0000-0002-1825-0097")
 * @returns The full ORCID URL
 *
 * @example
 * ```typescript
 * formatOrcidUrl('0000-0002-1825-0097')
 * // Returns 'https://orcid.org/0000-0002-1825-0097'
 * ```
 */
export function formatOrcidUrl(orcid: string): string {
  const cleanOrcid = orcid.replace(/^https?:\/\/orcid\.org\//, '');
  return `https://orcid.org/${cleanOrcid}`;
}

/**
 * Response type for author preprints.
 */
interface AuthorPreprintsResponse {
  preprints: PreprintSummary[];
  cursor?: string;
  hasMore: boolean;
}

interface UseAuthorPreprintsOptions {
  /** Number of preprints per page */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches an author's preprints with infinite scrolling support.
 *
 * @remarks
 * Uses TanStack Query's useInfiniteQuery for cursor-based pagination.
 * Preprints are ordered by most recent first.
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   isLoading,
 *   hasNextPage,
 *   fetchNextPage,
 *   isFetchingNextPage,
 * } = useAuthorPreprints('did:plc:abc123');
 *
 * const allPreprints = data?.pages.flatMap(p => p.preprints) ?? [];
 * ```
 *
 * @param did - The author's DID
 * @param options - Query options
 * @returns Infinite query result with paginated preprints
 */
export function useAuthorPreprints(did: string, options: UseAuthorPreprintsOptions = {}) {
  const { limit = 10, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: authorKeys.preprints(did, { limit }),
    queryFn: async ({ pageParam }): Promise<AuthorPreprintsResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.preprint.listByAuthor', {
        params: {
          query: {
            did,
            limit,
            sort: 'date' as const,
            cursor: pageParam as string | undefined,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch author preprints',
          undefined,
          '/xrpc/pub.chive.preprint.listByAuthor'
        );
      }
      return data!;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    enabled: !!did && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Mutation hook for updating the user's Chive profile.
 *
 * @remarks
 * This writes to the user's PDS via the authenticated agent.
 * Creates or updates the pub.chive.actor.profile record.
 *
 * @example
 * ```tsx
 * const { mutate: updateProfile, isPending } = useUpdateChiveProfile();
 *
 * updateProfile({
 *   nameVariants: ['J. Smith', 'Jane A. Smith'],
 *   researchKeywords: ['NLP', 'Machine Learning'],
 * });
 * ```
 */
export function useUpdateChiveProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DirectUpdateInput) => {
      // Write directly to PDS from browser using the authenticated agent
      // This bypasses the backend which doesn't have OAuth session access
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'updateProfile');
      }
      return updateChiveProfileRecord(agent, input);
    },
    onSuccess: () => {
      // Invalidate all author profile queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: authorKeys.profiles() });
      queryClient.invalidateQueries({ queryKey: ['my-chive-profile'] });
    },
  });
}

/**
 * Fetches the current user's Chive profile for editing.
 *
 * @remarks
 * Returns the full profile including all editable fields.
 * Used by the profile settings form.
 */
export function useMyChiveProfile() {
  return useQuery({
    queryKey: ['my-chive-profile'],
    queryFn: async (): Promise<ChiveProfile | null> => {
      try {
        // authApi throws APIError on non-2xx via error middleware
        const { data } = await authApi.GET('/xrpc/pub.chive.actor.getMyProfile');
        return data ?? null;
      } catch (error) {
        // Not found is okay; user may not have a Chive profile yet.
        if (error instanceof APIError && error.statusCode === 404) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
