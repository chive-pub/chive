import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type { GetTrendingResponse } from '@/lib/api/schema';

/**
 * Query key factory for trending queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Uses the time window as part of the key for separate caching per window.
 *
 * @example
 * ```typescript
 * // Invalidate all trending queries
 * queryClient.invalidateQueries({ queryKey: trendingKeys.all });
 *
 * // Invalidate specific window
 * queryClient.invalidateQueries({ queryKey: trendingKeys.window('7d') });
 * ```
 */
export const trendingKeys = {
  /** Base key for all trending queries */
  all: ['trending'] as const,
  /** Key for trending query with specific time window */
  window: (window: '24h' | '7d' | '30d') => [...trendingKeys.all, window] as const,
};

/**
 * Parameters for the useTrending hook.
 */
interface UseTrendingParams {
  /** Time window for trending calculation */
  window?: '24h' | '7d' | '30d';
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

/**
 * Fetches trending preprints based on view metrics.
 *
 * @remarks
 * Uses TanStack Query with a 1-minute stale time for near-real-time updates.
 * Trending is calculated based on views within the specified time window.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useTrending({ window: '7d', limit: 10 });
 *
 * if (isLoading) return <TrendingSkeleton />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return (
 *   <TrendingList>
 *     {data.trending.map((preprint) => (
 *       <TrendingCard key={preprint.uri} preprint={preprint} />
 *     ))}
 *   </TrendingList>
 * );
 * ```
 *
 * @param params - Query parameters (window, limit, cursor)
 * @returns Query result with trending preprints, loading state, and error
 *
 * @throws {Error} When the trending API request fails
 */
export function useTrending(params: UseTrendingParams = {}) {
  const window = params.window ?? '7d';

  return useQuery({
    queryKey: trendingKeys.window(window),
    queryFn: async (): Promise<GetTrendingResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.metrics.getTrending', {
        params: { query: { ...params, window, limit: params.limit ?? 20 } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch trending preprints',
          undefined,
          '/xrpc/pub.chive.metrics.getTrending'
        );
      }
      return data!;
    },
    staleTime: 60 * 1000, // 1 minute for trending data
  });
}
