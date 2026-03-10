import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api, authApi } from '@/lib/api/client';
import { useCurrentUser, useAgent } from '@/lib/auth';
import { APIError } from '@/lib/errors';
import type {
  GetSimilarResponse,
  GetCitationsResponse,
  GetEnrichmentResponse,
  RelatedEprint,
  RelatedPapersSignals,
  RelatedPapersWeights,
  RelatedPapersThresholds,
  TrendingPreferences,
  CitationNetworkDisplay,
} from '@/lib/api/schema';

/**
 * Discovery settings for personalization features.
 *
 * @remarks
 * This is a frontend-friendly interface that matches the discovery.settings
 * lexicon record but with required nested objects for easier use.
 */
export interface DiscoverySettings {
  /** Enable personalized recommendations based on profile */
  enablePersonalization: boolean;
  /** Configuration for related papers panel signals */
  relatedPapersSignals: Omit<RelatedPapersSignals, '$type'>;
  /** Relative weights for related papers signals (0-100) */
  relatedPapersWeights: Omit<RelatedPapersWeights, '$type'>;
  /** Thresholds for related papers filtering */
  relatedPapersThresholds: Omit<RelatedPapersThresholds, '$type'>;
  /** Trending feed preferences */
  trendingPreferences: Omit<TrendingPreferences, '$type'>;
  /** How to display citation network */
  citationNetworkDisplay: CitationNetworkDisplay;
  /** Show explanations for why papers are recommended */
  showRecommendationReasons: boolean;
  /** How diverse recommendations should be */
  recommendationDiversity: 'low' | 'medium' | 'high';
  /** Minimum endorsements for a paper to appear in recommendations */
  minimumEndorsementThreshold: number;
  /** Field URIs the user follows for discovery (distinct from work fields) */
  followedFieldUris: string[];
  /** Whether the Following tab also includes the user's work fields */
  followingTabIncludesWorkFields: boolean;
}

/**
 * Input for updating discovery settings.
 *
 * @remarks
 * All properties are optional - only provided properties will be updated.
 */
export interface UpdateDiscoverySettingsInput {
  enablePersonalization?: boolean;
  relatedPapersSignals?: Partial<Omit<RelatedPapersSignals, '$type'>>;
  relatedPapersWeights?: Partial<Omit<RelatedPapersWeights, '$type'>>;
  relatedPapersThresholds?: Partial<Omit<RelatedPapersThresholds, '$type'>>;
  trendingPreferences?: Partial<Omit<TrendingPreferences, '$type'>>;
  citationNetworkDisplay?: CitationNetworkDisplay;
  showRecommendationReasons?: boolean;
  recommendationDiversity?: 'low' | 'medium' | 'high';
  minimumEndorsementThreshold?: number;
  followedFieldUris?: string[];
  followingTabIncludesWorkFields?: boolean;
}

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
  /** Key for similar papers queries */
  similar: (
    uri: string,
    options?: {
      limit?: number;
      includeTypes?: string[];
      weights?: Record<string, number | undefined>;
    }
  ) => [...discoveryKeys.all, 'similar', uri, options] as const,
  /** Key for citations queries */
  citations: (
    uri: string,
    options?: { direction?: string; limit?: number; onlyInfluential?: boolean }
  ) => [...discoveryKeys.all, 'citations', uri, options] as const,
  /** Key for enrichment queries */
  enrichment: (uri: string) => [...discoveryKeys.all, 'enrichment', uri] as const,
  /** Key for discovery settings */
  settings: (authenticated?: boolean) =>
    [...discoveryKeys.all, 'settings', { authenticated }] as const,
};

const VALID_CITATION_DISPLAYS = ['hidden', 'preview', 'expanded'] as const;

/**
 * Validates and narrows a citationNetworkDisplay value to the expected type.
 */
function validateCitationNetworkDisplay(
  value: string | undefined,
  fallback: CitationNetworkDisplay
): CitationNetworkDisplay {
  if (value && VALID_CITATION_DISPLAYS.includes(value as CitationNetworkDisplay)) {
    return value as CitationNetworkDisplay;
  }
  return fallback;
}

const VALID_RECOMMENDATION_DIVERSITY = ['low', 'medium', 'high'] as const;

/**
 * Validates and narrows a recommendationDiversity value to the expected union.
 */
function validateRecommendationDiversity(value: string | undefined): 'low' | 'medium' | 'high' {
  if (value && VALID_RECOMMENDATION_DIVERSITY.includes(value as 'low' | 'medium' | 'high')) {
    return value as 'low' | 'medium' | 'high';
  }
  return 'medium';
}

interface UseSimilarPapersOptions {
  /** Number of similar papers to fetch */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
  /** Relationship types to include (derived from user's discovery settings) */
  includeTypes?: string[];
  /** Signal weights (0-100 scale, derived from user's discovery settings) */
  weights?: {
    semantic?: number;
    coCitation?: number;
    conceptOverlap?: number;
    authorNetwork?: number;
    collaborative?: number;
  };
}

/**
 * Builds the includeTypes array from the user's relatedPapersSignals settings.
 */
export function buildIncludeTypes(signals: DiscoverySettings['relatedPapersSignals']): string[] {
  const types: string[] = [];
  if (signals.semantic) types.push('semantic');
  if (signals.citations) types.push('citation');
  if (signals.topics) types.push('topic');
  if (signals.authors) types.push('author');
  if (signals.coCitation) types.push('co-citation');
  if (signals.bibliographicCoupling) types.push('bibliographic-coupling');
  if (signals.collaborative) types.push('collaborative');
  return types;
}

/**
 * Fetches papers similar to a given eprint.
 *
 * @remarks
 * Uses multiple signals (citations, concepts, semantic similarity)
 * to find related papers. Respects the user's discovery settings to
 * determine which signal types to include. Does not require authentication.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useSimilarPapers('at://did:plc:abc/pub.chive.eprint/123');
 *
 * if (data) {
 *   console.log(data.related.map(r => r.title));
 * }
 * ```
 *
 * @param uri - AT-URI of the source eprint
 * @param options - Query options
 * @returns Query result with similar papers
 */
export function useSimilarPapers(uri: string, options: UseSimilarPapersOptions = {}) {
  const { limit = 5, enabled = true, includeTypes, weights } = options;

  return useQuery({
    queryKey: discoveryKeys.similar(uri, { limit, includeTypes, weights }),
    queryFn: async (): Promise<GetSimilarResponse> => {
      try {
        const response = await api.pub.chive.discovery.getSimilar({
          uri,
          limit,
          ...(includeTypes && includeTypes.length > 0 ? { includeTypes } : {}),
          ...(weights?.semantic !== undefined ? { weightSemantic: weights.semantic } : {}),
          ...(weights?.coCitation !== undefined ? { weightCoCitation: weights.coCitation } : {}),
          ...(weights?.conceptOverlap !== undefined
            ? { weightConceptOverlap: weights.conceptOverlap }
            : {}),
          ...(weights?.authorNetwork !== undefined
            ? { weightAuthorNetwork: weights.authorNetwork }
            : {}),
          ...(weights?.collaborative !== undefined
            ? { weightCollaborative: weights.collaborative }
            : {}),
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch similar papers',
          undefined,
          'pub.chive.discovery.getSimilar'
        );
      }
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
 * Fetches citation network data for an eprint.
 *
 * @remarks
 * Returns both citation counts and the actual citation relationships
 * between Chive-indexed eprints.
 *
 * @example
 * ```tsx
 * const { data } = useCitations('at://did:plc:abc/pub.chive.eprint/123');
 *
 * if (data) {
 *   console.log(`Cited by ${data.counts.citedByCount} papers`);
 * }
 * ```
 *
 * @param uri - AT-URI of the eprint
 * @param options - Query options
 * @returns Query result with citations data
 */
export function useCitations(uri: string, options: UseCitationsOptions = {}) {
  const { direction = 'both', limit = 20, onlyInfluential = false, enabled = true } = options;

  return useQuery({
    queryKey: discoveryKeys.citations(uri, { direction, limit, onlyInfluential }),
    queryFn: async (): Promise<GetCitationsResponse> => {
      try {
        const response = await api.pub.chive.discovery.getCitations({
          uri,
          direction,
          limit,
          onlyInfluential,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch citations',
          undefined,
          'pub.chive.discovery.getCitations'
        );
      }
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
 * Fetches enrichment data for an eprint.
 *
 * @remarks
 * Returns external IDs, citation counts, and concept/topic data
 * from Semantic Scholar and OpenAlex.
 *
 * @example
 * ```tsx
 * const { data } = useEnrichment('at://did:plc:abc/pub.chive.eprint/123');
 *
 * if (data?.available && data.enrichment) {
 *   console.log(`Citation count: ${data.enrichment.citationCount}`);
 * }
 * ```
 *
 * @param uri - AT-URI of the eprint
 * @param options - Query options
 * @returns Query result with enrichment data
 */
export function useEnrichment(uri: string, options: UseEnrichmentOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: discoveryKeys.enrichment(uri),
    queryFn: async (): Promise<GetEnrichmentResponse> => {
      try {
        const response = await api.pub.chive.discovery.getEnrichment({ uri });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch enrichment',
          undefined,
          'pub.chive.discovery.getEnrichment'
        );
      }
    },
    enabled: !!uri && enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes (enrichment changes less frequently)
  });
}

interface RecordInteractionInput {
  eprintUri: string;
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
 *   eprintUri: 'at://did:plc:abc/pub.chive.eprint/123',
 *   type: 'dismiss',
 *   recommendationId: 'rec-123',
 * });
 * ```
 */
export function useRecordInteraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordInteractionInput) => {
      try {
        await authApi.pub.chive.discovery.recordInteraction({
          eprintUri: input.eprintUri,
          type: input.type,
          recommendationId: input.recommendationId,
        });
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to record interaction',
          undefined,
          'pub.chive.discovery.recordInteraction'
        );
      }
    },
    onSuccess: () => {
      // Invalidate discovery queries after recording interaction
      queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
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
 *   onMouseEnter={() => prefetchSimilar(eprintUri)}
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
        try {
          const response = await api.pub.chive.discovery.getSimilar({ uri, limit: 5 });
          return response.data;
        } catch {
          return undefined;
        }
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
export const DEFAULT_RELATED_PAPERS_WEIGHTS: Omit<RelatedPapersWeights, '$type'> = {
  semantic: 25,
  coCitation: 20,
  conceptOverlap: 15,
  authorNetwork: 30,
  collaborative: 10,
};

export const DEFAULT_RELATED_PAPERS_THRESHOLDS: Omit<RelatedPapersThresholds, '$type'> = {
  minScore: 5,
  maxResults: 10,
};

export const DEFAULT_TRENDING_PREFERENCES: Omit<TrendingPreferences, '$type'> = {
  defaultWindow: '7d',
  defaultLimit: 20,
};

export const DEFAULT_DISCOVERY_SETTINGS: DiscoverySettings = {
  enablePersonalization: true,
  relatedPapersSignals: {
    semantic: true,
    citations: true,
    topics: true,
    authors: true,
    coCitation: false,
    bibliographicCoupling: false,
    collaborative: false,
  },
  relatedPapersWeights: DEFAULT_RELATED_PAPERS_WEIGHTS,
  relatedPapersThresholds: DEFAULT_RELATED_PAPERS_THRESHOLDS,
  trendingPreferences: DEFAULT_TRENDING_PREFERENCES,
  citationNetworkDisplay: 'preview',
  showRecommendationReasons: true,
  recommendationDiversity: 'medium',
  minimumEndorsementThreshold: 0,
  followedFieldUris: [],
  followingTabIncludesWorkFields: false,
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
        relatedPapersSignals: {
          ...DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals,
          ...parsed.relatedPapersSignals,
        },
        relatedPapersWeights: {
          ...DEFAULT_DISCOVERY_SETTINGS.relatedPapersWeights,
          ...parsed.relatedPapersWeights,
        },
        relatedPapersThresholds: {
          ...DEFAULT_DISCOVERY_SETTINGS.relatedPapersThresholds,
          ...parsed.relatedPapersThresholds,
        },
        trendingPreferences: {
          ...DEFAULT_DISCOVERY_SETTINGS.trendingPreferences,
          ...parsed.trendingPreferences,
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
 * For authenticated users, fetches from the API (which reads from PDS).
 * Falls back to localStorage for unauthenticated users or API errors.
 *
 * @example
 * ```tsx
 * const { data: settings, isLoading } = useDiscoverySettings();
 *
 * if (settings) {
 *   console.log('Personalization:', settings.enablePersonalization);
 * }
 * ```
 */
export function useDiscoverySettings(options: UseDiscoverySettingsOptions = {}) {
  const { enabled = true } = options;
  const user = useCurrentUser();
  const isAuthenticated = !!user?.did;

  return useQuery({
    queryKey: discoveryKeys.settings(isAuthenticated),
    queryFn: async (): Promise<DiscoverySettings> => {
      // Authenticated users: fetch from API (reads from PDS)
      if (isAuthenticated) {
        try {
          const response = await authApi.pub.chive.actor.getDiscoverySettings();
          const data = response.data;
          return {
            enablePersonalization:
              data.enablePersonalization ?? DEFAULT_DISCOVERY_SETTINGS.enablePersonalization,
            relatedPapersSignals: {
              semantic:
                data.relatedPapersSignals?.semantic ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.semantic,
              citations:
                data.relatedPapersSignals?.citations ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.citations,
              topics:
                data.relatedPapersSignals?.topics ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.topics,
              authors:
                data.relatedPapersSignals?.authors ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.authors,
              coCitation:
                data.relatedPapersSignals?.coCitation ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.coCitation,
              bibliographicCoupling:
                data.relatedPapersSignals?.bibliographicCoupling ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.bibliographicCoupling,
              collaborative:
                data.relatedPapersSignals?.collaborative ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.collaborative,
            },
            relatedPapersWeights: {
              semantic:
                data.relatedPapersWeights?.semantic ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersWeights.semantic,
              coCitation:
                data.relatedPapersWeights?.coCitation ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersWeights.coCitation,
              conceptOverlap:
                data.relatedPapersWeights?.conceptOverlap ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersWeights.conceptOverlap,
              authorNetwork:
                data.relatedPapersWeights?.authorNetwork ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersWeights.authorNetwork,
              collaborative:
                data.relatedPapersWeights?.collaborative ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersWeights.collaborative,
            },
            relatedPapersThresholds: {
              minScore:
                data.relatedPapersThresholds?.minScore ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersThresholds.minScore,
              maxResults:
                data.relatedPapersThresholds?.maxResults ??
                DEFAULT_DISCOVERY_SETTINGS.relatedPapersThresholds.maxResults,
            },
            trendingPreferences: {
              defaultWindow:
                data.trendingPreferences?.defaultWindow ??
                DEFAULT_DISCOVERY_SETTINGS.trendingPreferences.defaultWindow,
              defaultLimit:
                data.trendingPreferences?.defaultLimit ??
                DEFAULT_DISCOVERY_SETTINGS.trendingPreferences.defaultLimit,
            },
            citationNetworkDisplay: validateCitationNetworkDisplay(
              data.citationNetworkDisplay,
              DEFAULT_DISCOVERY_SETTINGS.citationNetworkDisplay
            ),
            showRecommendationReasons:
              data.showRecommendationReasons ??
              DEFAULT_DISCOVERY_SETTINGS.showRecommendationReasons,
            recommendationDiversity: validateRecommendationDiversity(
              data.recommendationDiversity ?? DEFAULT_DISCOVERY_SETTINGS.recommendationDiversity
            ),
            minimumEndorsementThreshold:
              data.minimumEndorsementThreshold ??
              DEFAULT_DISCOVERY_SETTINGS.minimumEndorsementThreshold,
            followedFieldUris:
              data.followedFieldUris ?? DEFAULT_DISCOVERY_SETTINGS.followedFieldUris,
            followingTabIncludesWorkFields:
              data.followingTabIncludesWorkFields ??
              DEFAULT_DISCOVERY_SETTINGS.followingTabIncludesWorkFields,
          };
        } catch {
          // Fall back to localStorage on API error
          return getStoredSettings();
        }
      }

      // Unauthenticated users: use localStorage
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
 * For authenticated users, persists to PDS via putRecord.
 * Falls back to localStorage for unauthenticated users or on error.
 *
 * @example
 * ```tsx
 * const { mutate: updateSettings, isPending } = useUpdateDiscoverySettings();
 *
 * updateSettings({
 *   enablePersonalization: false,
 * });
 * ```
 */
export function useUpdateDiscoverySettings() {
  const queryClient = useQueryClient();
  const agent = useAgent();
  const user = useCurrentUser();
  const isAuthenticated = !!user?.did;

  return useMutation({
    mutationFn: async (input: UpdateDiscoverySettingsInput) => {
      // Get current settings and merge with input
      const currentSettings = getStoredSettings();
      const newSettings: DiscoverySettings = {
        ...currentSettings,
        ...input,
        relatedPapersSignals: {
          ...currentSettings.relatedPapersSignals,
          ...input.relatedPapersSignals,
        },
        relatedPapersWeights: {
          ...currentSettings.relatedPapersWeights,
          ...input.relatedPapersWeights,
        },
        relatedPapersThresholds: {
          ...currentSettings.relatedPapersThresholds,
          ...input.relatedPapersThresholds,
        },
        trendingPreferences: {
          ...currentSettings.trendingPreferences,
          ...input.trendingPreferences,
        },
      };

      // Always save to localStorage as backup/fallback
      saveStoredSettings(newSettings);

      // For authenticated users, persist to PDS
      if (agent?.did) {
        try {
          await agent.com.atproto.repo.putRecord({
            repo: agent.did,
            collection: 'pub.chive.discovery.settings',
            rkey: 'self',
            record: {
              $type: 'pub.chive.discovery.settings',
              enablePersonalization: newSettings.enablePersonalization,
              relatedPapersSignals: newSettings.relatedPapersSignals,
              relatedPapersWeights: newSettings.relatedPapersWeights,
              relatedPapersThresholds: newSettings.relatedPapersThresholds,
              trendingPreferences: newSettings.trendingPreferences,
              citationNetworkDisplay: newSettings.citationNetworkDisplay,
              showRecommendationReasons: newSettings.showRecommendationReasons,
              recommendationDiversity: newSettings.recommendationDiversity,
              minimumEndorsementThreshold: newSettings.minimumEndorsementThreshold,
              followedFieldUris: newSettings.followedFieldUris,
              followingTabIncludesWorkFields: newSettings.followingTabIncludesWorkFields,
            },
          });
        } catch {
          // PDS write failed, but localStorage is already updated
          // Settings will sync on next login
        }
      }

      return newSettings;
    },
    onMutate: async (input) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: discoveryKeys.settings(isAuthenticated) });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<DiscoverySettings>(
        discoveryKeys.settings(isAuthenticated)
      );

      // Optimistically update to the new value
      if (previousSettings) {
        const newSettings: DiscoverySettings = {
          ...previousSettings,
          ...input,
          relatedPapersSignals: {
            ...previousSettings.relatedPapersSignals,
            ...input.relatedPapersSignals,
          },
          relatedPapersWeights: {
            ...previousSettings.relatedPapersWeights,
            ...input.relatedPapersWeights,
          },
          relatedPapersThresholds: {
            ...previousSettings.relatedPapersThresholds,
            ...input.relatedPapersThresholds,
          },
          trendingPreferences: {
            ...previousSettings.trendingPreferences,
            ...input.trendingPreferences,
          },
        };
        queryClient.setQueryData(discoveryKeys.settings(isAuthenticated), newSettings);
      }

      return { previousSettings };
    },
    onError: (_err, _input, context) => {
      // Roll back to previous value on error
      if (context?.previousSettings) {
        queryClient.setQueryData(discoveryKeys.settings(isAuthenticated), context.previousSettings);
      }
    },
    onSuccess: () => {
      // Invalidate related queries that depend on settings
      queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
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
 * Used to determine which empty state to show in discovery features.
 * For authenticated users, fetches from getMyProfile API.
 * Falls back to localStorage for unauthenticated users.
 *
 * @example
 * ```tsx
 * const { hasLinkedAccounts, hasClaimedPapers } = useUserProfileState();
 * ```
 */
export function useUserProfileState(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const user = useCurrentUser();
  const isAuthenticated = !!user?.did;

  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async (): Promise<UserProfileState> => {
      // Authenticated users: fetch from API
      if (isAuthenticated) {
        try {
          const response = await authApi.pub.chive.actor.getMyProfile();
          const profile = response.data;

          // Determine linked accounts from profile data
          const hasLinkedAccounts = !!(
            profile.orcid ||
            profile.semanticScholarId ||
            profile.openAlexId ||
            profile.googleScholarId
          );

          return {
            hasLinkedAccounts,
            hasClaimedPapers: getStoredUserProfile().hasClaimedPapers, // Still from storage until claims API
            orcid: profile.orcid ?? null,
            semanticScholarId: profile.semanticScholarId ?? null,
          };
        } catch {
          // Fall back to localStorage on API error
          return getStoredUserProfile();
        }
      }

      // Unauthenticated: use localStorage
      return getStoredUserProfile();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: DEFAULT_USER_PROFILE_STATE,
  });
}

// Re-export types for convenience
export type { RelatedEprint };
