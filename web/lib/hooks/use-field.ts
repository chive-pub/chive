import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type { EprintSummary } from '@/lib/api/schema';

/**
 * Query key factory for field-related queries.
 */
export const fieldKeys = {
  all: ['fields'] as const,
  lists: () => [...fieldKeys.all, 'list'] as const,
  list: (params: { parentId?: string; status?: string; limit?: number }) =>
    [...fieldKeys.lists(), params] as const,
  details: () => [...fieldKeys.all, 'detail'] as const,
  detail: (id: string) => [...fieldKeys.details(), id] as const,
  children: (id: string) => [...fieldKeys.detail(id), 'children'] as const,
  ancestors: (id: string) => [...fieldKeys.detail(id), 'ancestors'] as const,
  eprints: (id: string) => [...fieldKeys.detail(id), 'eprints'] as const,
  hierarchy: () => [...fieldKeys.all, 'hierarchy'] as const,
};

interface UseFieldOptions {
  includeEdges?: boolean;
  enabled?: boolean;
}

/**
 * Edge from API response.
 */
export interface GraphEdge {
  id: string;
  uri: string;
  sourceUri: string;
  targetUri: string;
  relationSlug: string;
  status: string;
}

/**
 * External ID reference.
 */
export interface ExternalId {
  system: string;
  identifier: string;
  uri?: string;
}

/**
 * Field node with full details.
 */
export interface FieldNode {
  id: string;
  uri: string;
  label: string;
  description?: string;
  wikidataId?: string;
  status: 'proposed' | 'provisional' | 'established' | 'deprecated';
  edges?: GraphEdge[];
  externalIds?: ExternalId[];
}

/**
 * Field summary for lists.
 */
export interface FieldSummaryNode {
  id: string;
  uri: string;
  label: string;
  description?: string;
  status: 'proposed' | 'provisional' | 'established' | 'deprecated';
  childCount?: number;
  eprintCount?: number;
}

/**
 * Related field reference.
 */
export interface RelatedField {
  id: string;
  uri: string;
  label: string;
  relationSlug: string;
}

/**
 * Field with resolved relationships.
 */
export interface FieldWithRelations extends FieldNode {
  parents: RelatedField[];
  children: RelatedField[];
  related: RelatedField[];
}

/**
 * Fetches a single field by ID with optional edges.
 */
export function useField(id: string, options: UseFieldOptions = {}) {
  const { includeEdges = false, enabled = true } = options;

  return useQuery({
    queryKey: fieldKeys.detail(id),
    queryFn: async (): Promise<FieldNode> => {
      try {
        const response = await api.pub.chive.graph.getNode({
          id,
          includeEdges,
        });
        const data = response.data;
        return {
          id: data.id,
          uri: data.uri,
          label: data.label,
          description: data.description,
          wikidataId: data.externalIds?.find((e) => e.system === 'wikidata')?.identifier,
          status: data.status as FieldNode['status'],
          edges: data.edges,
          externalIds: data.externalIds,
        };
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch field',
          undefined,
          'pub.chive.graph.getNode'
        );
      }
    },
    enabled: !!id && enabled,
    staleTime: 6 * 60 * 60 * 1000,
  });
}

/**
 * Fetches a field with resolved relationship labels.
 */
export function useFieldWithRelations(id: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: [...fieldKeys.detail(id), 'relations'],
    queryFn: async (): Promise<FieldWithRelations> => {
      try {
        const nodeResponse = await api.pub.chive.graph.getNode({
          id,
          includeEdges: true,
        });
        const nodeData = nodeResponse.data;

        const field: FieldNode = {
          id: nodeData.id,
          uri: nodeData.uri,
          label: nodeData.label,
          description: nodeData.description,
          wikidataId: nodeData.externalIds?.find((e) => e.system === 'wikidata')?.identifier,
          status: nodeData.status as FieldNode['status'],
          edges: nodeData.edges,
          externalIds: nodeData.externalIds,
        };

        const edges = nodeData?.edges ?? [];

        const broaderEdges = edges.filter((e) => e.relationSlug === 'broader');
        const narrowerEdges = edges.filter((e) => e.relationSlug === 'narrower');
        const relatedEdges = edges.filter((e) => e.relationSlug === 'related');

        const extractTargetId = (uri: string) => uri.split('/').pop() ?? '';
        const allTargetIds = [...broaderEdges, ...narrowerEdges, ...relatedEdges].map((e) =>
          extractTargetId(e.targetUri)
        );

        const targetNodes = await Promise.all(
          allTargetIds.map(async (targetId) => {
            try {
              const response = await api.pub.chive.graph.getNode({
                id: targetId,
                includeEdges: false,
              });
              const data = response.data;
              return { id: data.id, uri: data.uri, label: data.label };
            } catch {
              return null;
            }
          })
        );

        const nodeMap = new Map(
          targetNodes.filter((n): n is NonNullable<typeof n> => n !== null).map((n) => [n.id, n])
        );

        const mapEdgesToRelated = (edgeList: typeof edges, relation: string): RelatedField[] =>
          edgeList
            .map((edge) => {
              const targetId = extractTargetId(edge.targetUri);
              const target = nodeMap.get(targetId);
              if (!target) return null;
              return {
                id: target.id,
                uri: target.uri,
                label: target.label,
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
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch field',
          undefined,
          'pub.chive.graph.getNode'
        );
      }
    },
    enabled: !!id && enabled,
    staleTime: 60 * 60 * 1000,
  });
}

interface UseFieldsParams {
  status?: 'proposed' | 'provisional' | 'established' | 'deprecated';
  limit?: number;
  cursor?: string;
}

/**
 * Fetches a list of fields with optional filtering.
 */
export function useFields(params: UseFieldsParams = {}) {
  return useQuery({
    queryKey: fieldKeys.list(params),
    queryFn: async () => {
      try {
        const response = await api.pub.chive.graph.listNodes({
          subkind: 'field',
          status: params.status,
          limit: params.limit ?? 50,
          cursor: params.cursor,
        });
        const data = response.data;
        return {
          fields: data.nodes.map(
            (node): FieldSummaryNode => ({
              id: node.id,
              uri: node.uri,
              label: node.label,
              description: node.description,
              status: node.status as FieldSummaryNode['status'],
            })
          ),
          cursor: data.cursor,
          hasMore: data.hasMore,
          total: data.total,
        };
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch fields',
          undefined,
          'pub.chive.graph.listNodes'
        );
      }
    },
    staleTime: 60 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

interface UseFieldHierarchyOptions {
  enabled?: boolean;
}

/**
 * Fetches the field hierarchy tree.
 */
export function useFieldHierarchy(options: UseFieldHierarchyOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: fieldKeys.hierarchy(),
    queryFn: async () => {
      try {
        const response = await api.pub.chive.graph.getHierarchy({
          subkind: 'field',
          relationSlug: 'broader',
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch field hierarchy',
          undefined,
          'pub.chive.graph.getHierarchy'
        );
      }
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

interface UseFieldChildrenOptions {
  enabled?: boolean;
}

/**
 * Fetches children of a field.
 *
 * @param fieldUri - The AT-URI of the field node
 * @param options - Query options
 */
export function useFieldChildren(fieldUri: string, options: UseFieldChildrenOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: fieldKeys.children(fieldUri),
    queryFn: async (): Promise<FieldSummaryNode[]> => {
      try {
        const response = await api.pub.chive.graph.listEdges({
          limit: 100,
          sourceUri: fieldUri,
          relationSlug: 'narrower',
          status: 'established',
        });
        const data = response.data;
        // Extract target nodes from edges
        const edges = data?.edges ?? [];
        const targetIds = edges
          .map((edge) => edge.targetUri.split('/').pop())
          .filter(Boolean) as string[];

        if (targetIds.length === 0) {
          return [];
        }

        // Fetch target nodes in parallel
        const nodes = await Promise.all(
          targetIds.map(async (targetId) => {
            try {
              const nodeResponse = await api.pub.chive.graph.getNode({
                id: targetId,
                includeEdges: false,
              });
              return nodeResponse.data;
            } catch {
              return null;
            }
          })
        );

        return nodes
          .filter((n): n is NonNullable<typeof n> => n !== null)
          .map(
            (node): FieldSummaryNode => ({
              id: node.id,
              uri: node.uri,
              label: node.label,
              description: node.description,
              status: node.status as FieldSummaryNode['status'],
            })
          );
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch field children',
          undefined,
          'pub.chive.graph.listEdges'
        );
      }
    },
    enabled: !!fieldUri && enabled,
    staleTime: 60 * 60 * 1000,
  });
}

interface UseFieldEprintsOptions {
  limit?: number;
  enabled?: boolean;
}

interface FieldEprintsResponse {
  eprints: EprintSummary[];
  cursor?: string;
  hasMore: boolean;
  total: number;
}

/**
 * Fetches eprints associated with a field with infinite scrolling support.
 *
 * @remarks
 * The searchSubmissions API returns SearchHit objects containing only URI and score.
 * This hook returns minimal eprint references. Callers should use useEprint to
 * fetch full eprint details for display if needed.
 *
 * @param fieldUri - The full AT-URI of the field node (e.g., at://did:plc:.../pub.chive.graph.node/...)
 */
export function useFieldEprints(fieldUri: string, options: UseFieldEprintsOptions = {}) {
  const { limit = 10, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: fieldKeys.eprints(fieldUri),
    queryFn: async ({ pageParam }): Promise<FieldEprintsResponse> => {
      try {
        const response = await api.pub.chive.eprint.searchSubmissions({
          q: '*', // Required parameter - search all eprints
          fieldUris: [fieldUri],
          limit,
          cursor: pageParam as string | undefined,
        });
        const data = response.data;
        // SearchHit only contains uri and score - map to minimal EprintSummary
        const hasMore = !!data.cursor;
        return {
          eprints: (data.hits ?? []).map((hit) => ({
            uri: hit.uri,
            // Other fields require separate getSubmission calls to hydrate
          })) as EprintSummary[],
          cursor: data.cursor,
          hasMore,
          total: data.total ?? 0,
        };
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch field eprints',
          undefined,
          'pub.chive.eprint.searchSubmissions'
        );
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    enabled: !!fieldUri && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for prefetching a field on hover/focus.
 */
export function usePrefetchField() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: fieldKeys.detail(id),
      queryFn: async (): Promise<FieldNode | undefined> => {
        try {
          const response = await api.pub.chive.graph.getNode({
            id,
            includeEdges: true,
          });
          const data = response.data;
          return {
            id: data.id,
            uri: data.uri,
            label: data.label,
            description: data.description,
            wikidataId: data.externalIds?.find((e) => e.system === 'wikidata')?.identifier,
            status: data.status as FieldNode['status'],
            edges: data.edges,
            externalIds: data.externalIds,
          };
        } catch {
          return undefined;
        }
      },
      staleTime: 6 * 60 * 60 * 1000,
    });
  };
}
