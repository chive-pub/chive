/**
 * Hook for personalized eprint feed on the /eprints page.
 *
 * @remarks
 * Authenticated users with fields set in their profile see recent papers
 * in those fields, sorted chronologically. Anonymous users or users
 * without fields fall back to the global trending feed.
 * Respects the user's discovery settings (enablePersonalization).
 *
 * @packageDocumentation
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth';
import { APIError } from '@/lib/errors';
import type { SearchResultsResponse } from '@/lib/api/schema';

import { useAuthorProfile } from './use-author';
import { useDiscoverySettings } from './use-discovery';
import { useTrending } from './use-trending';

/**
 * Query key factory for personalized feed queries.
 *
 * @example
 * ```typescript
 * // Invalidate all personalized feed queries
 * queryClient.invalidateQueries({ queryKey: personalizedFeedKeys.all });
 * ```
 */
export const personalizedFeedKeys = {
  /** Base key for all personalized feed queries */
  all: ['personalized-feed'] as const,
  /** Key for a specific set of field URIs */
  fields: (fieldUris: string[]) => [...personalizedFeedKeys.all, fieldUris] as const,
};

/**
 * Return type for the usePersonalizedFeed hook.
 */
interface PersonalizedFeedResult {
  /** Whether the feed is personalized (true) or falling back to trending (false). */
  isPersonalized: boolean;
  /** Whether the user is authenticated but has no fields set. */
  needsFieldSetup: boolean;
  /** Eprint data from either the personalized search or the trending feed. */
  eprints: SearchHitOrTrending[];
  /** Whether the feed data is loading. */
  isLoading: boolean;
  /** Error from either feed source. */
  error: Error | null;
}

/**
 * Loose type for eprints that come from either search results or trending.
 *
 * @remarks
 * Both SearchHit and TrendingEntry have uri, title, authors, fields,
 * createdAt, and indexedAt. The EprintCard handles both shapes via
 * its EprintCardData union type.
 */
type SearchHitOrTrending = Record<string, unknown> & { uri: string };

/**
 * Hook for personalized eprint feed.
 *
 * @remarks
 * Authenticated users with fields: returns recent papers in their fields.
 * Authenticated users without fields: signals that profile setup is needed.
 * Anonymous users: falls back to trending.
 * Respects discovery settings: if personalization is disabled, falls back
 * to trending.
 *
 * @param options - optional configuration
 * @param options.limit - maximum number of results (default: 20)
 * @returns personalized feed state including eprints, loading, and personalization status
 */
export function usePersonalizedFeed(options: { limit?: number } = {}): PersonalizedFeedResult {
  const limit = options.limit ?? 20;
  const user = useCurrentUser();
  const { data: profile, isLoading: isProfileLoading } = useAuthorProfile(user?.did ?? '');
  const { data: discoverySettings } = useDiscoverySettings();

  // Check if personalization is enabled in discovery settings
  const personalizationEnabled = discoverySettings?.enablePersonalization !== false;

  // Extract field URIs from the author profile
  const fieldUris = profile?.fields ?? [];
  const hasFields = !!user && fieldUris.length > 0 && personalizationEnabled;
  const isAuthenticated = !!user;

  // Personalized feed: search for recent papers in the user's fields
  const personalizedQuery = useQuery({
    queryKey: personalizedFeedKeys.fields(fieldUris),
    queryFn: async (): Promise<SearchResultsResponse> => {
      try {
        const response = await api.pub.chive.eprint.searchSubmissions({
          fieldUris,
          sort: 'recent',
          limit,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch personalized feed',
          undefined,
          'pub.chive.eprint.searchSubmissions'
        );
      }
    },
    enabled: hasFields && !isProfileLoading,
    staleTime: 60 * 1000, // 1 minute
  });

  // Trending fallback for anonymous users or users without fields
  const trendingQuery = useTrending({ window: '7d', limit });

  // Determine which feed to use
  if (hasFields) {
    return {
      isPersonalized: true,
      needsFieldSetup: false,
      eprints: (personalizedQuery.data?.hits ?? []) as unknown as SearchHitOrTrending[],
      isLoading: personalizedQuery.isLoading || isProfileLoading,
      error: personalizedQuery.error,
    };
  }

  if (isAuthenticated && !isProfileLoading && fieldUris.length === 0) {
    // Authenticated but no fields set
    return {
      isPersonalized: false,
      needsFieldSetup: true,
      eprints: (trendingQuery.data?.trending ?? []) as unknown as SearchHitOrTrending[],
      isLoading: trendingQuery.isLoading,
      error: trendingQuery.error,
    };
  }

  // Anonymous, still loading profile, or personalization disabled
  return {
    isPersonalized: false,
    needsFieldSetup: false,
    eprints: (trendingQuery.data?.trending ?? []) as unknown as SearchHitOrTrending[],
    isLoading: isAuthenticated
      ? isProfileLoading || trendingQuery.isLoading
      : trendingQuery.isLoading,
    error: trendingQuery.error,
  };
}
