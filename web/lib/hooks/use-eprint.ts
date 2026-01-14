import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type { Eprint, EprintSummary } from '@/lib/api/schema';

/**
 * Response from the listByAuthor endpoint.
 */
interface EprintsByAuthorResponse {
  eprints: EprintSummary[];
  cursor?: string;
  hasMore: boolean;
}

/**
 * Query key factory for eprint queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for eprint data.
 *
 * @example
 * ```typescript
 * // Invalidate all eprint queries
 * queryClient.invalidateQueries({ queryKey: eprintKeys.all });
 *
 * // Invalidate specific eprint
 * queryClient.invalidateQueries({ queryKey: eprintKeys.detail('at://did:plc:abc/...') });
 *
 * // Invalidate all eprints by a specific author
 * queryClient.invalidateQueries({ queryKey: eprintKeys.byAuthor('did:plc:abc') });
 * ```
 */
export const eprintKeys = {
  /** Base key for all eprint queries */
  all: ['eprints'] as const,
  /** Key for eprint list queries */
  lists: () => [...eprintKeys.all, 'list'] as const,
  /** Key for specific eprint list query with params */
  list: (params: { limit?: number; cursor?: string; field?: string }) =>
    [...eprintKeys.lists(), params] as const,
  /** Key for eprint detail queries */
  details: () => [...eprintKeys.all, 'detail'] as const,
  /** Key for specific eprint detail query */
  detail: (uri: string) => [...eprintKeys.details(), uri] as const,
  /** Key for eprints by author */
  byAuthor: (did: string) => [...eprintKeys.all, 'author', did] as const,
};

/**
 * Options for the useEprint hook.
 */
interface UseEprintOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches a single eprint by AT Protocol URI.
 *
 * @remarks
 * Uses TanStack Query with a 5-minute stale time since eprints rarely change.
 * Returns cached data while revalidating in background.
 *
 * @example
 * ```tsx
 * const { data: eprint, isLoading, error } = useEprint(
 *   'at://did:plc:abc/pub.chive.eprint.submission/123'
 * );
 *
 * if (isLoading) return <EprintSkeleton />;
 * if (error) return <EprintError error={error} />;
 *
 * return <EprintDetail eprint={eprint} />;
 * ```
 *
 * @param uri - AT Protocol URI of the eprint
 * @param options - Query options
 * @returns Query result with eprint data, loading state, and error
 *
 * @throws {Error} When the eprint API request fails
 */
export function useEprint(uri: string, options: UseEprintOptions = {}) {
  return useQuery({
    queryKey: eprintKeys.detail(uri),
    queryFn: async (): Promise<Eprint> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.eprint.getSubmission', {
        params: { query: { uri } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch eprint',
          undefined,
          '/xrpc/pub.chive.eprint.getSubmission'
        );
      }
      // API returns the eprint directly (not wrapped in { eprint: ... })
      return data as unknown as Eprint;
    },
    enabled: !!uri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000, // 5 minutes; eprints rarely change.
  });
}

/**
 * Parameters for the useEprints hook.
 */
interface UseEprintsParams {
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
 * Fetches a paginated list of eprints.
 *
 * @remarks
 * Uses placeholder data to show previous results while fetching new ones,
 * providing a smoother pagination experience.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useEprints({
 *   field: 'computer-science',
 *   limit: 20,
 * });
 *
 * return (
 *   <EprintList
 *     eprints={data?.eprints ?? []}
 *     isLoading={isLoading}
 *   />
 * );
 * ```
 *
 * @param params - Query parameters (limit, cursor, field)
 * @returns Query result with eprint list
 *
 * @throws {Error} When the eprints API request fails
 */
export function useEprints(params: UseEprintsParams = {}) {
  const { q, limit, cursor } = params;

  return useQuery({
    queryKey: eprintKeys.list(params),
    queryFn: async () => {
      // API requires q to be a non-empty string
      if (!q) {
        throw new APIError('Search query is required', undefined, '/api/v1/eprints');
      }

      const { data, error } = await api.GET('/api/v1/eprints', {
        params: { query: { q, limit, cursor } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch eprints',
          undefined,
          '/api/v1/eprints'
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
 * Parameters for the useEprintsByAuthor hook.
 */
interface UseEprintsByAuthorParams {
  /** Author's decentralized identifier (DID) */
  did: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

/**
 * Fetches eprints authored by a specific user.
 *
 * @remarks
 * Queries eprints by the author's DID. Only enabled when a valid DID is provided.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useEprintsByAuthor({
 *   did: 'did:plc:abc123',
 *   limit: 10,
 * });
 *
 * return (
 *   <AuthorEprints
 *     eprints={data?.eprints ?? []}
 *     isLoading={isLoading}
 *   />
 * );
 * ```
 *
 * @param params - Query parameters including author DID
 * @returns Query result with author's eprints
 *
 * @throws {Error} When the author eprints API request fails
 */
export function useEprintsByAuthor(params: UseEprintsByAuthorParams) {
  return useQuery<EprintsByAuthorResponse>({
    queryKey: eprintKeys.byAuthor(params.did),
    queryFn: async (): Promise<EprintsByAuthorResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.eprint.listByAuthor', {
        params: { query: { ...params, limit: params.limit ?? 20, sort: 'date' as const } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch eprints by author',
          undefined,
          '/xrpc/pub.chive.eprint.listByAuthor'
        );
      }
      // Cast to our local types - backend returns the new author format
      return data as unknown as EprintsByAuthorResponse;
    },
    enabled: !!params.did,
  });
}

/**
 * Hook for prefetching an eprint on hover/focus.
 *
 * @remarks
 * Improves perceived performance by loading eprint data before navigation.
 * Uses the same cache key as useEprint for seamless transitions.
 *
 * @example
 * ```tsx
 * const prefetchEprint = usePrefetchEprint();
 *
 * return (
 *   <EprintCard
 *     eprint={eprint}
 *     onMouseEnter={() => prefetchEprint(eprint.uri)}
 *     onFocus={() => prefetchEprint(eprint.uri)}
 *   />
 * );
 * ```
 *
 * @returns Function to prefetch an eprint by URI
 */
export function usePrefetchEprint() {
  const queryClient = useQueryClient();

  return (uri: string) => {
    queryClient.prefetchQuery({
      queryKey: eprintKeys.detail(uri),
      queryFn: async (): Promise<Eprint | undefined> => {
        const { data } = await api.GET('/xrpc/pub.chive.eprint.getSubmission', {
          params: { query: { uri } },
        });
        // API returns the eprint directly (not wrapped in { eprint: ... })
        return data as unknown as Eprint | undefined;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}
