import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api, authApi } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type {
  GetRecommendationsResponse,
  GetSimilarResponse,
  GetCitationsResponse,
  GetEnrichmentResponse,
  RecommendedPreprint,
  RelatedPreprint,
  DiscoverySettings,
  UpdateDiscoverySettingsInput,
} from '@/lib/api/schema';

/**
 * Query key factory for discovery-related queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for discovery data.
 */
export const discoveryKeys = {
  /** Base key for all discovery queries */
  all: ['discovery'] as const,
  /** Key for For You feed queries */
  forYou: (options?: { limit?: number }) => [...discoveryKeys.all, 'forYou', options] as const,
  /** Key for similar papers queries */
  similar: (uri: string, options?: { limit?: number }) =>
    [...discoveryKeys.all, 'similar', uri, options] as const,
  /** Key for citations queries */
  citations: (uri: string, options?: { direction?: string; limit?: number }) =>
    [...discoveryKeys.all, 'citations', uri, options] as const,
  /** Key for enrichment queries */
  enrichment: (uri: string) => [...discoveryKeys.all, 'enrichment', uri] as const,
  /** Key for discovery settings */
  settings: () => [...discoveryKeys.all, 'settings'] as const,
};

interface UseForYouFeedOptions {
  /** Number of recommendations per page */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches personalized recommendations for the authenticated user.
 *
 * @remarks
 * Uses TanStack Query's useInfiniteQuery for cursor-based pagination.
 * Requires authentication; returns empty state for anonymous users.
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   isLoading,
 *   hasNextPage,
 *   fetchNextPage,
 *   isFetchingNextPage,
 * } = useForYouFeed();
 *
 * const allRecommendations = data?.pages.flatMap(p => p.recommendations) ?? [];
 * ```
 *
 * @param options - Query options
 * @returns Infinite query result with paginated recommendations
 */
export function useForYouFeed(options: UseForYouFeedOptions = {}) {
  const { limit = 10, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: discoveryKeys.forYou({ limit }),
    queryFn: async ({ pageParam }): Promise<GetRecommendationsResponse> => {
      const { data, error } = await authApi.GET('/xrpc/pub.chive.discovery.getRecommendations', {
        params: {
          query: {
            limit,
            cursor: pageParam as string | undefined,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch recommendations',
          undefined,
          '/xrpc/pub.chive.discovery.getRecommendations'
        );
      }
      return data!;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

interface UseSimilarPapersOptions {
  /** Number of similar papers to fetch */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches papers similar to a given preprint.
 *
 * @remarks
 * Uses multiple signals (citations, concepts, semantic similarity)
 * to find related papers. Does not require authentication.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useSimilarPapers('at://did:plc:abc/pub.chive.preprint/123');
 *
 * if (data) {
 *   console.log(data.related.map(r => r.title));
 * }
 * ```
 *
 * @param uri - AT-URI of the source preprint
 * @param options - Query options
 * @returns Query result with similar papers
 */
export function useSimilarPapers(uri: string, options: UseSimilarPapersOptions = {}) {
  const { limit = 5, enabled = true } = options;

  return useQuery({
    queryKey: discoveryKeys.similar(uri, { limit }),
    queryFn: async (): Promise<GetSimilarResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.discovery.getSimilar', {
        params: {
          query: { uri, limit },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch similar papers',
          undefined,
          '/xrpc/pub.chive.discovery.getSimilar'
        );
      }
      return data as GetSimilarResponse;
    },
    enabled: !!uri && enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

interface UseCitationsOptions {
  /** Citation direction */
  direction?: 'citing' | 'cited-by' | 'both';
  /** Number of citations per page */
  limit?: number;
  /** Only return influential citations */
  onlyInfluential?: boolean;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches citation network data for a preprint.
 *
 * @remarks
 * Returns both citation counts and the actual citation relationships
 * between Chive-indexed preprints.
 *
 * @example
 * ```tsx
 * const { data } = useCitations('at://did:plc:abc/pub.chive.preprint/123');
 *
 * if (data) {
 *   console.log(`Cited by ${data.counts.citedByCount} papers`);
 * }
 * ```
 *
 * @param uri - AT-URI of the preprint
 * @param options - Query options
 * @returns Query result with citations data
 */
export function useCitations(uri: string, options: UseCitationsOptions = {}) {
  const { direction = 'both', limit = 20, onlyInfluential = false, enabled = true } = options;

  return useQuery({
    queryKey: discoveryKeys.citations(uri, { direction, limit }),
    queryFn: async (): Promise<GetCitationsResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.discovery.getCitations', {
        params: {
          query: { uri, direction, limit, onlyInfluential },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch citations',
          undefined,
          '/xrpc/pub.chive.discovery.getCitations'
        );
      }
      return data as GetCitationsResponse;
    },
    enabled: !!uri && enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

interface UseEnrichmentOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches enrichment data for a preprint.
 *
 * @remarks
 * Returns external IDs, citation counts, and concept/topic data
 * from Semantic Scholar and OpenAlex.
 *
 * @example
 * ```tsx
 * const { data } = useEnrichment('at://did:plc:abc/pub.chive.preprint/123');
 *
 * if (data?.available && data.enrichment) {
 *   console.log(`Citation count: ${data.enrichment.citationCount}`);
 * }
 * ```
 *
 * @param uri - AT-URI of the preprint
 * @param options - Query options
 * @returns Query result with enrichment data
 */
export function useEnrichment(uri: string, options: UseEnrichmentOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: discoveryKeys.enrichment(uri),
    queryFn: async (): Promise<GetEnrichmentResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.discovery.getEnrichment', {
        params: {
          query: { uri },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch enrichment',
          undefined,
          '/xrpc/pub.chive.discovery.getEnrichment'
        );
      }
      return data as GetEnrichmentResponse;
    },
    enabled: !!uri && enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes (enrichment changes less frequently)
  });
}

interface RecordInteractionInput {
  preprintUri: string;
  type: 'view' | 'click' | 'endorse' | 'dismiss' | 'claim';
  recommendationId?: string;
}

/**
 * Mutation hook for recording user interactions with recommendations.
 *
 * @remarks
 * Used to improve recommendations over time via feedback loop.
 * Dismissals are used as negative signals.
 *
 * @example
 * ```tsx
 * const { mutate: recordInteraction } = useRecordInteraction();
 *
 * // When user dismisses a recommendation
 * recordInteraction({
 *   preprintUri: 'at://did:plc:abc/pub.chive.preprint/123',
 *   type: 'dismiss',
 *   recommendationId: 'rec-123',
 * });
 * ```
 */
export function useRecordInteraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordInteractionInput) => {
      const { error } = await authApi.POST('/xrpc/pub.chive.discovery.recordInteraction', {
        body: input,
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to record interaction',
          undefined,
          '/xrpc/pub.chive.discovery.recordInteraction'
        );
      }
    },
    onSuccess: (_, variables) => {
      // If dismissed, invalidate the For You feed to remove it
      if (variables.type === 'dismiss') {
        queryClient.invalidateQueries({ queryKey: discoveryKeys.forYou() });
      }
    },
  });
}

/**
 * Hook for prefetching similar papers on hover/focus.
 *
 * @remarks
 * Improves perceived performance by loading related papers before expansion.
 *
 * @example
 * ```tsx
 * const prefetchSimilar = usePrefetchSimilarPapers();
 *
 * <Button
 *   onMouseEnter={() => prefetchSimilar(preprintUri)}
 *   onClick={() => setShowSimilar(true)}
 * >
 *   Show Related Papers
 * </Button>
 * ```
 *
 * @returns Function to prefetch similar papers by URI
 */
export function usePrefetchSimilarPapers() {
  const queryClient = useQueryClient();

  return (uri: string) => {
    queryClient.prefetchQuery({
      queryKey: discoveryKeys.similar(uri, { limit: 5 }),
      queryFn: async (): Promise<GetSimilarResponse | undefined> => {
        const { data } = await api.GET('/xrpc/pub.chive.discovery.getSimilar', {
          params: { query: { uri, limit: 5 } },
        });
        return data;
      },
      staleTime: 10 * 60 * 1000,
    });
  };
}

// =============================================================================
// DISCOVERY SETTINGS HOOKS
// =============================================================================

/**
 * Default discovery settings used when user has no saved settings.
 */
export const DEFAULT_DISCOVERY_SETTINGS: DiscoverySettings = {
  enablePersonalization: true,
  enableForYouFeed: true,
  forYouSignals: {
    fields: true,
    citations: true,
    collaborators: true,
    trending: true,
  },
  relatedPapersSignals: {
    citations: true,
    topics: true,
  },
  citationNetworkDisplay: 'preview',
  showRecommendationReasons: true,
};

interface UseDiscoverySettingsOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

const DISCOVERY_SETTINGS_STORAGE_KEY = 'chive:discoverySettings';

/**
 * Gets discovery settings from localStorage.
 */
function getStoredSettings(): DiscoverySettings {
  if (typeof window === 'undefined') {
    return DEFAULT_DISCOVERY_SETTINGS;
  }
  try {
    const stored = localStorage.getItem(DISCOVERY_SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<DiscoverySettings>;
      return {
        ...DEFAULT_DISCOVERY_SETTINGS,
        ...parsed,
        forYouSignals: {
          ...DEFAULT_DISCOVERY_SETTINGS.forYouSignals,
          ...parsed.forYouSignals,
        },
        relatedPapersSignals: {
          ...DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals,
          ...parsed.relatedPapersSignals,
        },
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_DISCOVERY_SETTINGS;
}

/**
 * Saves discovery settings to localStorage.
 */
function saveStoredSettings(settings: DiscoverySettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(DISCOVERY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Fetches the authenticated user's discovery settings.
 *
 * @remarks
 * Returns default settings if user has no saved preferences.
 * Currently uses localStorage; will use PDS (pub.chive.actor.discoverySettings)
 * once backend endpoints are available.
 *
 * @example
 * ```tsx
 * const { data: settings, isLoading } = useDiscoverySettings();
 *
 * if (settings) {
 *   console.log('Show For You:', settings.enableForYouFeed);
 * }
 * ```
 */
export function useDiscoverySettings(options: UseDiscoverySettingsOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: discoveryKeys.settings(),
    queryFn: async (): Promise<DiscoverySettings> => {
      // TODO: Replace with API call when endpoint is available
      // const { data, error } = await authApi.GET('/xrpc/pub.chive.discovery.getSettings');
      return getStoredSettings();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: DEFAULT_DISCOVERY_SETTINGS,
  });
}

/**
 * Mutation hook for updating discovery settings.
 *
 * @remarks
 * Optimistically updates the cache for immediate UI feedback.
 * Currently uses localStorage; will persist to PDS once backend endpoints are available.
 *
 * @example
 * ```tsx
 * const { mutate: updateSettings, isPending } = useUpdateDiscoverySettings();
 *
 * updateSettings({
 *   enableForYouFeed: false,
 *   forYouSignals: { trending: false },
 * });
 * ```
 */
export function useUpdateDiscoverySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateDiscoverySettingsInput) => {
      // Get current settings and merge with input
      const currentSettings = getStoredSettings();
      const newSettings: DiscoverySettings = {
        ...currentSettings,
        ...input,
        forYouSignals: {
          ...currentSettings.forYouSignals,
          ...input.forYouSignals,
        },
        relatedPapersSignals: {
          ...currentSettings.relatedPapersSignals,
          ...input.relatedPapersSignals,
        },
      };

      // Save to localStorage
      saveStoredSettings(newSettings);

      // TODO: Replace with API call when endpoint is available
      // const { error } = await authApi.POST('/xrpc/pub.chive.discovery.updateSettings', {
      //   body: input,
      // });
      // if (error) {
      //   throw new APIError(
      //     (error as { message?: string }).message ?? 'Failed to update discovery settings',
      //     undefined,
      //     '/xrpc/pub.chive.discovery.updateSettings'
      //   );
      // }

      return newSettings;
    },
    onMutate: async (input) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: discoveryKeys.settings() });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<DiscoverySettings>(
        discoveryKeys.settings()
      );

      // Optimistically update to the new value
      if (previousSettings) {
        const newSettings: DiscoverySettings = {
          ...previousSettings,
          ...input,
          forYouSignals: {
            ...previousSettings.forYouSignals,
            ...input.forYouSignals,
          },
          relatedPapersSignals: {
            ...previousSettings.relatedPapersSignals,
            ...input.relatedPapersSignals,
          },
        };
        queryClient.setQueryData(discoveryKeys.settings(), newSettings);
      }

      return { previousSettings };
    },
    onError: (_err, _input, context) => {
      // Roll back to previous value on error
      if (context?.previousSettings) {
        queryClient.setQueryData(discoveryKeys.settings(), context.previousSettings);
      }
    },
    onSuccess: () => {
      // Invalidate related queries that depend on settings
      queryClient.invalidateQueries({ queryKey: discoveryKeys.forYou() });
    },
  });
}

// =============================================================================
// USER PROFILE STATE HOOK
// =============================================================================

const USER_PROFILE_STORAGE_KEY = 'chive:userProfile';

/**
 * User profile state for discovery features.
 */
export interface UserProfileState {
  /** Whether user has linked external accounts (ORCID, S2) */
  hasLinkedAccounts: boolean;
  /** Whether user has claimed any papers */
  hasClaimedPapers: boolean;
  /** ORCID identifier if linked */
  orcid?: string | null;
  /** Semantic Scholar ID if linked */
  semanticScholarId?: string | null;
}

const DEFAULT_USER_PROFILE_STATE: UserProfileState = {
  hasLinkedAccounts: false,
  hasClaimedPapers: false,
  orcid: null,
  semanticScholarId: null,
};

/**
 * Gets user profile state from localStorage.
 */
function getStoredUserProfile(): UserProfileState {
  if (typeof window === 'undefined') {
    return DEFAULT_USER_PROFILE_STATE;
  }
  try {
    const stored = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<UserProfileState>;
      return {
        ...DEFAULT_USER_PROFILE_STATE,
        ...parsed,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_USER_PROFILE_STATE;
}

/**
 * Hook for user profile state (linked accounts, claimed papers).
 *
 * @remarks
 * Used to determine which empty state to show in the For You feed.
 * Currently reads from localStorage; will integrate with API once available.
 *
 * @example
 * ```tsx
 * const { hasLinkedAccounts, hasClaimedPapers } = useUserProfileState();
 * ```
 */
export function useUserProfileState(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async (): Promise<UserProfileState> => {
      // TODO: Replace with API call when endpoint is available
      return getStoredUserProfile();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: DEFAULT_USER_PROFILE_STATE,
  });
}

// Re-export types for convenience
export type {
  RecommendedPreprint,
  RelatedPreprint,
  DiscoverySettings,
  UpdateDiscoverySettingsInput,
};
