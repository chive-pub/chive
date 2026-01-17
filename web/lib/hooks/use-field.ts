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
  /** Key for field hierarchy queries */
  hierarchy: () => [...fieldKeys.all, 'hierarchy'] as const,
};

interface UseFieldOptions {
  /** Whether to include edges in the response */
  includeEdges?: boolean;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Edge from API response.
 */
interface GraphEdge {
  id: string;
  uri: string;
  sourceUri: string;
  targetUri: string;
  relationSlug: string;
  status: string;
}

/**
 * Extended FieldDetail with edges.
 */
export interface FieldDetailWithEdges extends FieldDetail {
  edges?: GraphEdge[];
  externalIds?: { system: string; identifier: string; uri?: string }[];
}

/**
 * Maps a graph node response to the FieldDetail shape expected by components.
 */
function mapNodeToFieldDetail(node: {
  id: string;
  uri: string;
  label: string;
  description?: string;
  externalIds?: { system: string; identifier: string; uri?: string }[];
  status: string;
  edges?: GraphEdge[];
}): FieldDetailWithEdges {
  return {
    id: node.id,
    uri: node.uri,
    name: node.label,
    description: node.description,
    wikidataId: node.externalIds?.find((e) => e.system === 'wikidata')?.identifier,
    status: node.status as 'proposed' | 'provisional' | 'established' | 'deprecated',
    edges: node.edges,
    externalIds: node.externalIds,
  };
}

/**
 * Maps a graph node response to the FieldSummary shape expected by components.
 */
function mapNodeToFieldSummary(node: {
  id: string;
  uri: string;
  label: string;
  description?: string;
  status: string;
}): FieldSummary {
  return {
    id: node.id,
    uri: node.uri,
    name: node.label,
    description: node.description,
    status: node.status as 'proposed' | 'provisional' | 'established' | 'deprecated',
  };
}

/**
 * Fetches a single field by ID with optional edges.
 *
 * @remarks
 * Uses TanStack Query with a 6-hour stale time.
 * Fields change infrequently so aggressive caching is appropriate.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useField('c4613057-bc2d-54bc-b4de-43f9b8136438', {
 *   includeEdges: true,
 * });
 * ```
 *
 * @param id - The field node ID
 * @param options - Query and data options
 * @returns Query result with field data, loading state, and error
 */
export function useField(id: string, options: UseFieldOptions = {}) {
  const { includeEdges = false, enabled = true } = options;

  return useQuery({
    queryKey: fieldKeys.detail(id),
    queryFn: async (): Promise<FieldDetailWithEdges> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.getNode', {
        params: {
          query: {
            id,
            includeEdges,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch field',
          undefined,
          '/xrpc/pub.chive.graph.getNode'
        );
      }
      return mapNodeToFieldDetail(data!);
    },
    enabled: !!id && enabled,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours; fields rarely change.
  });
}

/**
 * Related field reference.
 */
export interface RelatedField {
  id: string;
  uri: string;
  name: string;
  relationSlug: string;
}

/**
 * Field with resolved relationships.
 */
export interface FieldWithRelations extends FieldDetailWithEdges {
  parents: RelatedField[];
  children: RelatedField[];
  related: RelatedField[];
}

/**
 * Fetches a field with resolved relationship labels.
 *
 * @remarks
 * Fetches the field with edges, then resolves target node labels.
 *
 * @param id - The field node ID
 * @param options - Query options
 * @returns Query result with field and resolved relationships
 */
export function useFieldWithRelations(id: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: [...fieldKeys.detail(id), 'relations'],
    queryFn: async (): Promise<FieldWithRelations> => {
      // Fetch field with edges
      const { data: nodeData, error: nodeError } = await api.GET('/xrpc/pub.chive.graph.getNode', {
        params: {
          query: {
            id,
            includeEdges: true,
          },
        },
      });

      if (nodeError) {
        throw new APIError(
          (nodeError as { message?: string }).message ?? 'Failed to fetch field',
          undefined,
          '/xrpc/pub.chive.graph.getNode'
        );
      }

      const field = mapNodeToFieldDetail(nodeData!);
      const edges = nodeData?.edges ?? [];

      // Group edges by relation type
      const broaderEdges = edges.filter((e) => e.relationSlug === 'broader');
      const narrowerEdges = edges.filter((e) => e.relationSlug === 'narrower');
      const relatedEdges = edges.filter((e) => e.relationSlug === 'related');

      // Extract target IDs from edges
      const extractTargetId = (uri: string) => uri.split('/').pop() ?? '';
      const allTargetIds = [...broaderEdges, ...narrowerEdges, ...relatedEdges].map((e) =>
        extractTargetId(e.targetUri)
      );

      // Fetch all target nodes in parallel
      const targetNodes = await Promise.all(
        allTargetIds.map(async (targetId) => {
          try {
            const { data } = await api.GET('/xrpc/pub.chive.graph.getNode', {
              params: { query: { id: targetId, includeEdges: false } },
            });
            return data ? { id: data.id, uri: data.uri, label: data.label } : null;
          } catch {
            return null;
          }
        })
      );

      // Build lookup map
      const nodeMap = new Map(
        targetNodes.filter((n): n is NonNullable<typeof n> => n !== null).map((n) => [n.id, n])
      );

      // Map edges to related fields
      const mapEdgesToRelated = (edgeList: typeof edges, relation: string): RelatedField[] =>
        edgeList
          .map((edge) => {
            const targetId = extractTargetId(edge.targetUri);
            const target = nodeMap.get(targetId);
            if (!target) return null;
            return {
              id: target.id,
              uri: target.uri,
              name: target.label,
              relationSlug: relation,
            };
          })
          .filter((r): r is RelatedField => r !== null);

      return {
        ...field,
        parents: mapEdgesToRelated(broaderEdges, 'broader'),
        children: mapEdgesToRelated(narrowerEdges, 'narrower'),
        related: mapEdgesToRelated(relatedEdges, 'related'),
      };
    },
    enabled: !!id && enabled,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

interface UseFieldsParams {
  /** Status filter (maps to node status) */
  status?: 'proposed' | 'provisional' | 'established' | 'deprecated';
  /** Number of fields to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Fetches a list of fields with optional filtering.
 *
 * @remarks
 * Uses the unified listNodes endpoint with subkind='field'.
 *
 * @example
 * ```tsx
 * // Get all established fields
 * const { data } = useFields({ status: 'established' });
 * ```
 *
 * @param params - Query parameters
 * @returns Query result with field list
 */
export function useFields(params: UseFieldsParams = {}) {
  return useQuery({
    queryKey: fieldKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.listNodes', {
        params: {
          query: {
            subkind: 'field',
            status: params.status,
            limit: params.limit ?? 50,
            cursor: params.cursor,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch fields',
          undefined,
          '/xrpc/pub.chive.graph.listNodes'
        );
      }
      return {
        fields: data!.nodes.map(mapNodeToFieldSummary),
        cursor: data!.cursor,
        hasMore: data!.hasMore,
        total: data!.total,
      };
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Options for useFieldHierarchy hook.
 */
interface UseFieldHierarchyOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches the field hierarchy tree.
 *
 * @param options - Query options
 * @returns Query result with field hierarchy
 */
export function useFieldHierarchy(options: UseFieldHierarchyOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: fieldKeys.hierarchy(),
    queryFn: async () => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.getHierarchy', {
        params: {
          query: {
            subkind: 'field',
            relationSlug: 'broader',
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch field hierarchy',
          undefined,
          '/xrpc/pub.chive.graph.getHierarchy'
        );
      }
      return data!;
    },
    enabled,
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
 * Minimal eprint info returned from eprint search.
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
 * Uses the eprint search endpoint with field filter.
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   isLoading,
 *   hasNextPage,
 *   fetchNextPage,
 *   isFetchingNextPage,
 * } = useFieldEprints('c4613057-bc2d-54bc-b4de-43f9b8136438');
 *
 * const allEprints = data?.pages.flatMap(p => p.eprints) ?? [];
 * ```
 *
 * @param fieldId - The field node ID
 * @param options - Query options
 * @returns Infinite query result with paginated eprints
 */
export function useFieldEprints(fieldId: string, options: UseFieldEprintsOptions = {}) {
  const { limit = 10, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: fieldKeys.eprints(fieldId),
    queryFn: async ({ pageParam }): Promise<FieldEprintsResponse> => {
      // Use eprint search with field filter
      const { data, error } = await api.GET('/xrpc/pub.chive.eprint.searchSubmissions', {
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
          '/xrpc/pub.chive.eprint.searchSubmissions'
        );
      }
      return {
        eprints: (data!.hits ?? []).map((hit) => ({
          uri: hit.uri,
          title: hit.title,
          abstract: hit.abstract,
          authorDid: hit.submittedBy,
          authorName: hit.authors?.[0]?.name,
          createdAt: hit.createdAt,
          pdsUrl: hit.source?.pdsUrl ?? '',
          views: undefined,
        })),
        cursor: data!.cursor,
        hasMore: data!.hasMore,
        total: data!.total,
      };
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
        const { data } = await api.GET('/xrpc/pub.chive.graph.getNode', {
          params: {
            query: {
              id,
              includeEdges: true,
            },
          },
        });
        return data ? mapNodeToFieldDetail(data) : undefined;
      },
      staleTime: 6 * 60 * 60 * 1000,
    });
  };
}
