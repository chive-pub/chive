import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type { FieldDetail, FieldSummary } from '@/lib/api/schema';

/**
 * Query key factory for field-related queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for field data.
 *
 * @example
 * ```typescript
 * // Invalidate all field queries
 * queryClient.invalidateQueries({ queryKey: fieldKeys.all });
 *
 * // Invalidate specific field
 * queryClient.invalidateQueries({ queryKey: fieldKeys.detail('field-id') });
 * ```
 */
export const fieldKeys = {
  /** Base key for all field queries */
  all: ['fields'] as const,
  /** Key for field list queries */
  lists: () => [...fieldKeys.all, 'list'] as const,
  /** Key for specific field list query with params */
  list: (params: { parentId?: string; status?: string; limit?: number }) =>
    [...fieldKeys.lists(), params] as const,
  /** Key for field detail queries */
  details: () => [...fieldKeys.all, 'detail'] as const,
  /** Key for specific field detail query */
  detail: (id: string) => [...fieldKeys.details(), id] as const,
  /** Key for field children queries */
  children: (id: string) => [...fieldKeys.detail(id), 'children'] as const,
  /** Key for field ancestors queries */
  ancestors: (id: string) => [...fieldKeys.detail(id), 'ancestors'] as const,
  /** Key for field eprints queries */
  eprints: (id: string) => [...fieldKeys.detail(id), 'eprints'] as const,
};

interface UseFieldOptions {
  /** Whether to include relationships in the response */
  includeRelationships?: boolean;
  /** Whether to include children in the response */
  includeChildren?: boolean;
  /** Whether to include ancestors in the response */
  includeAncestors?: boolean;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches a single field by ID with optional relationships.
 *
 * @remarks
 * Uses TanStack Query with a 6-hour stale time.
 * Fields change infrequently so aggressive caching is appropriate.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useField('computer-science', {
 *   includeChildren: true,
 *   includeAncestors: true,
 * });
 * ```
 *
 * @param id - The field ID
 * @param options - Query and data options
 * @returns Query result with field data, loading state, and error
 */
export function useField(id: string, options: UseFieldOptions = {}) {
  const {
    includeRelationships = false,
    includeChildren = false,
    includeAncestors = false,
    enabled = true,
  } = options;

  return useQuery({
    queryKey: fieldKeys.detail(id),
    queryFn: async (): Promise<FieldDetail> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.getField', {
        params: {
          query: {
            id,
            includeRelationships,
            includeChildren,
            includeAncestors,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch field',
          undefined,
          '/xrpc/pub.chive.graph.getField'
        );
      }
      // API returns field properties directly at top level
      return data!;
    },
    enabled: !!id && enabled,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours; fields rarely change.
  });
}

interface UseFieldsParams {
  /** Parent field ID to filter by */
  parentId?: string;
  /** Status filter */
  status?: 'proposed' | 'under_review' | 'approved' | 'deprecated';
  /** Number of fields to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Fetches a list of fields with optional filtering.
 *
 * @remarks
 * Used for browsing the field hierarchy or listing top-level fields.
 *
 * @example
 * ```tsx
 * // Get all top-level approved fields
 * const { data } = useFields({ status: 'approved' });
 *
 * // Get children of a specific field
 * const { data } = useFields({ parentId: 'computer-science' });
 * ```
 *
 * @param params - Query parameters
 * @returns Query result with field list
 */
export function useFields(params: UseFieldsParams = {}) {
  return useQuery({
    queryKey: fieldKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.listFields', {
        params: { query: { ...params, limit: params.limit ?? 50 } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch fields',
          undefined,
          '/xrpc/pub.chive.graph.listFields'
        );
      }
      return data!;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Options for useFieldChildren hook.
 */
interface UseFieldChildrenOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches child fields for a given parent field.
 *
 * @param parentId - The parent field ID
 * @param options - Query options
 * @returns Query result with child fields
 */
export function useFieldChildren(parentId: string, options: UseFieldChildrenOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: fieldKeys.children(parentId),
    queryFn: async (): Promise<FieldSummary[]> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.listFields', {
        params: { query: { parentId, limit: 100 } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch field children',
          undefined,
          '/xrpc/pub.chive.graph.listFields'
        );
      }
      return data!.fields;
    },
    enabled: !!parentId && enabled,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

interface UseFieldEprintsOptions {
  /** Number of eprints per page */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Minimal eprint info returned from field eprints API.
 */
interface FieldEprintInfo {
  uri: string;
  title: string;
  abstract?: string;
  authorDid: string;
  authorName?: string;
  createdAt: string;
  pdsUrl: string;
  views?: number;
}

/**
 * Response type for field eprints.
 */
interface FieldEprintsResponse {
  eprints: FieldEprintInfo[];
  cursor?: string;
  hasMore: boolean;
  total: number;
}

/**
 * Fetches eprints associated with a field with infinite scrolling support.
 *
 * @remarks
 * Uses TanStack Query's useInfiniteQuery for cursor-based pagination.
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   isLoading,
 *   hasNextPage,
 *   fetchNextPage,
 *   isFetchingNextPage,
 * } = useFieldEprints('computer-science');
 *
 * const allEprints = data?.pages.flatMap(p => p.eprints) ?? [];
 * ```
 *
 * @param fieldId - The field ID
 * @param options - Query options
 * @returns Infinite query result with paginated eprints
 */
export function useFieldEprints(fieldId: string, options: UseFieldEprintsOptions = {}) {
  const { limit = 10, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: fieldKeys.eprints(fieldId),
    queryFn: async ({ pageParam }): Promise<FieldEprintsResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.getFieldEprints', {
        params: {
          query: {
            fieldId,
            limit,
            cursor: pageParam as string | undefined,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch field eprints',
          undefined,
          '/xrpc/pub.chive.graph.getFieldEprints'
        );
      }
      return data!;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    enabled: !!fieldId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for prefetching a field on hover/focus.
 *
 * @remarks
 * Improves perceived performance by loading field data before navigation.
 *
 * @example
 * ```tsx
 * const prefetchField = usePrefetchField();
 *
 * <FieldLink
 *   onMouseEnter={() => prefetchField(fieldId)}
 *   href={`/fields/${fieldId}`}
 * />
 * ```
 *
 * @returns Function to prefetch a field by ID
 */
export function usePrefetchField() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: fieldKeys.detail(id),
      queryFn: async (): Promise<FieldDetail | undefined> => {
        const { data } = await api.GET('/xrpc/pub.chive.graph.getField', {
          params: {
            query: {
              id,
              includeRelationships: true,
              includeChildren: true,
              includeAncestors: true,
            },
          },
        });
        return (data ?? undefined) as FieldDetail | undefined;
      },
      staleTime: 6 * 60 * 60 * 1000,
    });
  };
}
