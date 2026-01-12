import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type { Preprint, PreprintSummary } from '@/lib/api/schema';

/**
 * Response from the listByAuthor endpoint.
 */
interface PreprintsByAuthorResponse {
  preprints: PreprintSummary[];
  cursor?: string;
  hasMore: boolean;
}

/**
 * Query key factory for preprint queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for preprint data.
 *
 * @example
 * ```typescript
 * // Invalidate all preprint queries
 * queryClient.invalidateQueries({ queryKey: preprintKeys.all });
 *
 * // Invalidate specific preprint
 * queryClient.invalidateQueries({ queryKey: preprintKeys.detail('at://did:plc:abc/...') });
 *
 * // Invalidate all preprints by a specific author
 * queryClient.invalidateQueries({ queryKey: preprintKeys.byAuthor('did:plc:abc') });
 * ```
 */
export const preprintKeys = {
  /** Base key for all preprint queries */
  all: ['preprints'] as const,
  /** Key for preprint list queries */
  lists: () => [...preprintKeys.all, 'list'] as const,
  /** Key for specific preprint list query with params */
  list: (params: { limit?: number; cursor?: string; field?: string }) =>
    [...preprintKeys.lists(), params] as const,
  /** Key for preprint detail queries */
  details: () => [...preprintKeys.all, 'detail'] as const,
  /** Key for specific preprint detail query */
  detail: (uri: string) => [...preprintKeys.details(), uri] as const,
  /** Key for preprints by author */
  byAuthor: (did: string) => [...preprintKeys.all, 'author', did] as const,
};

/**
 * Options for the usePreprint hook.
 */
interface UsePreprintOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches a single preprint by AT Protocol URI.
 *
 * @remarks
 * Uses TanStack Query with a 5-minute stale time since preprints rarely change.
 * Returns cached data while revalidating in background.
 *
 * @example
 * ```tsx
 * const { data: preprint, isLoading, error } = usePreprint(
 *   'at://did:plc:abc/pub.chive.preprint.submission/123'
 * );
 *
 * if (isLoading) return <PreprintSkeleton />;
 * if (error) return <PreprintError error={error} />;
 *
 * return <PreprintDetail preprint={preprint} />;
 * ```
 *
 * @param uri - AT Protocol URI of the preprint
 * @param options - Query options
 * @returns Query result with preprint data, loading state, and error
 *
 * @throws {Error} When the preprint API request fails
 */
export function usePreprint(uri: string, options: UsePreprintOptions = {}) {
  return useQuery({
    queryKey: preprintKeys.detail(uri),
    queryFn: async (): Promise<Preprint> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.preprint.getSubmission', {
        params: { query: { uri } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch preprint',
          undefined,
          '/xrpc/pub.chive.preprint.getSubmission'
        );
      }
      // API returns the preprint directly (not wrapped in { preprint: ... })
      return data as unknown as Preprint;
    },
    enabled: !!uri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000, // 5 minutes; preprints rarely change.
  });
}

/**
 * Parameters for the usePreprints hook.
 */
interface UsePreprintsParams {
  /** Search query */
  q?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Filter by field ID */
  field?: string;
}

/**
 * Fetches a paginated list of preprints.
 *
 * @remarks
 * Uses placeholder data to show previous results while fetching new ones,
 * providing a smoother pagination experience.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = usePreprints({
 *   field: 'computer-science',
 *   limit: 20,
 * });
 *
 * return (
 *   <PreprintList
 *     preprints={data?.preprints ?? []}
 *     isLoading={isLoading}
 *   />
 * );
 * ```
 *
 * @param params - Query parameters (limit, cursor, field)
 * @returns Query result with preprint list
 *
 * @throws {Error} When the preprints API request fails
 */
export function usePreprints(params: UsePreprintsParams = {}) {
  const { q, limit, cursor } = params;

  return useQuery({
    queryKey: preprintKeys.list(params),
    queryFn: async () => {
      // API requires q to be a non-empty string
      if (!q) {
        throw new APIError('Search query is required', undefined, '/api/v1/preprints');
      }

      const { data, error } = await api.GET('/api/v1/preprints', {
        params: { query: { q, limit, cursor } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch preprints',
          undefined,
          '/api/v1/preprints'
        );
      }
      return data!;
    },
    // Only enable query when q is provided
    enabled: !!q,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Parameters for the usePreprintsByAuthor hook.
 */
interface UsePreprintsByAuthorParams {
  /** Author's decentralized identifier (DID) */
  did: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

/**
 * Fetches preprints authored by a specific user.
 *
 * @remarks
 * Queries preprints by the author's DID. Only enabled when a valid DID is provided.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = usePreprintsByAuthor({
 *   did: 'did:plc:abc123',
 *   limit: 10,
 * });
 *
 * return (
 *   <AuthorPreprints
 *     preprints={data?.preprints ?? []}
 *     isLoading={isLoading}
 *   />
 * );
 * ```
 *
 * @param params - Query parameters including author DID
 * @returns Query result with author's preprints
 *
 * @throws {Error} When the author preprints API request fails
 */
export function usePreprintsByAuthor(params: UsePreprintsByAuthorParams) {
  return useQuery<PreprintsByAuthorResponse>({
    queryKey: preprintKeys.byAuthor(params.did),
    queryFn: async (): Promise<PreprintsByAuthorResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.preprint.listByAuthor', {
        params: { query: { ...params, limit: params.limit ?? 20, sort: 'date' as const } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch preprints by author',
          undefined,
          '/xrpc/pub.chive.preprint.listByAuthor'
        );
      }
      // Cast to our local types - backend returns the new author format
      return data as unknown as PreprintsByAuthorResponse;
    },
    enabled: !!params.did,
  });
}

/**
 * Hook for prefetching a preprint on hover/focus.
 *
 * @remarks
 * Improves perceived performance by loading preprint data before navigation.
 * Uses the same cache key as usePreprint for seamless transitions.
 *
 * @example
 * ```tsx
 * const prefetchPreprint = usePrefetchPreprint();
 *
 * return (
 *   <PreprintCard
 *     preprint={preprint}
 *     onMouseEnter={() => prefetchPreprint(preprint.uri)}
 *     onFocus={() => prefetchPreprint(preprint.uri)}
 *   />
 * );
 * ```
 *
 * @returns Function to prefetch a preprint by URI
 */
export function usePrefetchPreprint() {
  const queryClient = useQueryClient();

  return (uri: string) => {
    queryClient.prefetchQuery({
      queryKey: preprintKeys.detail(uri),
      queryFn: async (): Promise<Preprint | undefined> => {
        const { data } = await api.GET('/xrpc/pub.chive.preprint.getSubmission', {
          params: { query: { uri } },
        });
        // API returns the preprint directly (not wrapped in { preprint: ... })
        return data as unknown as Preprint | undefined;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}
