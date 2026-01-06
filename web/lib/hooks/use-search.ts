import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type { SearchResultsResponse } from '@/lib/api/schema';

/**
 * Query key factory for search queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for search results.
 *
 * @example
 * ```typescript
 * // Invalidate all search queries
 * queryClient.invalidateQueries({ queryKey: searchKeys.all });
 *
 * // Invalidate specific search query
 * queryClient.invalidateQueries({ queryKey: searchKeys.query('machine learning') });
 * ```
 */
export const searchKeys = {
  /** Base key for all search queries */
  all: ['search'] as const,
  /** Key for specific search query with params */
  query: (q: string, params?: { limit?: number; cursor?: string }) =>
    [...searchKeys.all, q, params] as const,
};

/**
 * Parameters for the useSearch hook.
 */
interface UseSearchParams {
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Filter by field ID */
  field?: string;
  /** Filter by author DID */
  author?: string;
  /** Filter by date range start (ISO 8601) */
  dateFrom?: string;
  /** Filter by date range end (ISO 8601) */
  dateTo?: string;
}

/**
 * Searches preprints by query string with optional filters.
 *
 * @remarks
 * Uses TanStack Query with a 30-second stale time.
 * Only executes when query is at least 2 characters to prevent excessive requests.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSearch('machine learning', {
 *   field: 'computer-science',
 *   limit: 20,
 * });
 *
 * if (isLoading) return <SearchSkeleton />;
 * if (error) return <SearchError error={error} />;
 *
 * return <SearchResults hits={data.hits} total={data.total} />;
 * ```
 *
 * @param query - Search query string (minimum 2 characters)
 * @param params - Optional search parameters (limit, cursor, filters)
 * @returns Query result with search results, loading state, and error
 *
 * @throws {Error} When the search API request fails
 */
export function useSearch(query: string, params: UseSearchParams = {}) {
  return useQuery({
    queryKey: searchKeys.query(query, params),
    queryFn: async (): Promise<SearchResultsResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.preprint.searchSubmissions', {
        params: {
          query: {
            q: query,
            limit: params.limit ?? 20,
            cursor: params.cursor,
            sort: 'relevance' as const,
            field: params.field,
            author: params.author,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to search preprints',
          undefined,
          '/xrpc/pub.chive.preprint.searchSubmissions'
        );
      }
      return data! as unknown as SearchResultsResponse;
    },
    enabled: query.length >= 2, // Only search with 2+ characters
    staleTime: 30 * 1000, // 30 seconds per user preference
  });
}

/**
 * Instant search hook for autocomplete and type-ahead suggestions.
 *
 * @remarks
 * Optimized for real-time search with shorter stale time and fewer results.
 * Uses a separate cache key to avoid interfering with full search results.
 *
 * @example
 * ```tsx
 * const [query, setQuery] = useState('');
 * const { data, isLoading } = useInstantSearch(query);
 *
 * return (
 *   <SearchAutocomplete
 *     onChange={setQuery}
 *     suggestions={data?.hits ?? []}
 *     isLoading={isLoading}
 *   />
 * );
 * ```
 *
 * @param query - Search query string (minimum 2 characters)
 * @returns Query result with limited search results for autocomplete
 *
 * @throws {Error} When the search API request fails
 */
export function useInstantSearch(query: string) {
  return useQuery({
    queryKey: ['instant-search', query],
    queryFn: async (): Promise<SearchResultsResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.preprint.searchSubmissions', {
        params: {
          query: {
            q: query,
            limit: 5, // Fewer results for instant search
            sort: 'relevance' as const,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to search preprints',
          undefined,
          '/xrpc/pub.chive.preprint.searchSubmissions'
        );
      }
      return data! as unknown as SearchResultsResponse;
    },
    enabled: query.length >= 2,
    staleTime: 10 * 1000, // 10 seconds for instant search
  });
}
