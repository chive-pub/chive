/**
 * React hooks for knowledge graph edge data fetching.
 *
 * @remarks
 * Provides TanStack Query hooks for fetching edges (relationships) between
 * nodes and traversing hierarchies in the knowledge graph.
 *
 * @example
 * ```tsx
 * import { useEdges, useFieldHierarchy, useNodeChildren } from '@/lib/hooks/use-edges';
 *
 * // Get edges from a node
 * const { data } = useEdges(nodeUri, { relationSlug: 'broader' });
 *
 * // Get field hierarchy
 * const { data: hierarchy } = useFieldHierarchy();
 *
 * // Get children of a field
 * const { data: children } = useNodeChildren(fieldUri);
 * ```
 *
 * @packageDocumentation
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { GraphNode } from './use-nodes';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Edge status in the governance lifecycle.
 */
export type EdgeStatus = 'proposed' | 'established' | 'deprecated';

/**
 * Edge metadata.
 */
export interface EdgeMetadata {
  /** Confidence score (0-1) */
  confidence?: number;
  /** Start date for temporal relationships */
  startDate?: string;
  /** End date for temporal relationships */
  endDate?: string;
  /** Source of the relationship */
  source?: string;
}

/**
 * Knowledge graph edge (relationship).
 */
export interface GraphEdge {
  /** AT-URI of the edge */
  uri: string;
  /** Edge identifier (UUID) */
  id: string;
  /** Source node URI */
  sourceUri: string;
  /** Target node URI */
  targetUri: string;
  /** Relation type URI */
  relationUri?: string;
  /** Relation slug */
  relationSlug: string;
  /** Edge weight (0-1) */
  weight?: number;
  /** Edge metadata */
  metadata?: EdgeMetadata;
  /** Governance status */
  status: EdgeStatus;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Edge with resolved nodes.
 */
export interface EdgeWithNodes extends GraphEdge {
  /** Resolved source node */
  sourceNode?: GraphNode;
  /** Resolved target node */
  targetNode?: GraphNode;
}

/**
 * Hierarchy node for tree structures.
 */
export interface HierarchyNode {
  /** Node URI */
  uri: string;
  /** Node ID */
  id: string;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Child nodes */
  children?: HierarchyNode[];
  /** Whether node has children (for lazy loading) */
  hasChildren?: boolean;
  /** Depth in the hierarchy */
  depth?: number;
}

/**
 * Edges response.
 */
export interface EdgesResponse {
  edges: GraphEdge[];
  cursor?: string;
}

/**
 * Hierarchy response.
 */
export interface HierarchyResponse {
  roots: HierarchyNode[];
  total: number;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for edge queries.
 */
export const edgeKeys = {
  /** Base key */
  all: ['edges'] as const,

  /** Key for edges from/to a node */
  byNode: (nodeUri: string, params?: EdgeListParams) =>
    [...edgeKeys.all, 'node', nodeUri, params] as const,

  /** Key for single edge */
  detail: (uri: string) => [...edgeKeys.all, 'detail', uri] as const,

  /** Key for hierarchy */
  hierarchy: (subkind: string, rootUri?: string) =>
    [...edgeKeys.all, 'hierarchy', subkind, rootUri] as const,

  /** Key for children of a node */
  children: (nodeUri: string) => [...edgeKeys.all, 'children', nodeUri] as const,

  /** Key for parents of a node */
  parents: (nodeUri: string) => [...edgeKeys.all, 'parents', nodeUri] as const,

  /** Key for ancestors (full path) */
  ancestors: (nodeUri: string) => [...edgeKeys.all, 'ancestors', nodeUri] as const,
};

// =============================================================================
// PARAMETER TYPES
// =============================================================================

/**
 * Edge list parameters.
 */
export interface EdgeListParams {
  /** Filter by relation slug */
  relationSlug?: string;
  /** Direction of edges to fetch */
  direction?: 'outgoing' | 'incoming' | 'both';
  /** Filter by status */
  status?: EdgeStatus;
  /** Maximum results */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Hierarchy parameters.
 */
export interface HierarchyParams {
  /** Root node URI (optional, for subtree) */
  rootUri?: string;
  /** Maximum depth */
  maxDepth?: number;
}

/**
 * Hook options.
 */
export interface UseEdgeOptions {
  /** Whether query is enabled */
  enabled?: boolean;
  /** Resolve source/target nodes */
  resolveNodes?: boolean;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches edges connected to a node.
 *
 * @param nodeUri - Node AT-URI
 * @param params - List parameters
 * @param options - Hook options
 * @returns Query result with edges
 *
 * @example
 * ```tsx
 * // Get all broader relations (parents)
 * const { data } = useEdges(nodeUri, { relationSlug: 'broader' });
 *
 * // Get all outgoing edges
 * const { data } = useEdges(nodeUri, { direction: 'outgoing' });
 * ```
 */
export function useEdges(
  nodeUri: string,
  params: EdgeListParams = {},
  options: UseEdgeOptions = {}
) {
  return useQuery({
    queryKey: edgeKeys.byNode(nodeUri, params),
    queryFn: async (): Promise<EdgesResponse> => {
      const { data } = await api.GET('/xrpc/pub.chive.graph.listEdges', {
        params: {
          query: {
            nodeUri,
            relationSlug: params.relationSlug,
            direction: params.direction ?? 'both',
            status: params.status ?? 'established',
            limit: params.limit ?? 50,
            cursor: params.cursor,
          },
        },
      });
      return data as EdgesResponse;
    },
    enabled: !!nodeUri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches a single edge by URI.
 *
 * @param uri - Edge AT-URI
 * @param options - Hook options
 * @returns Query result with edge
 */
export function useEdge(uri: string, options: UseEdgeOptions = {}) {
  return useQuery({
    queryKey: edgeKeys.detail(uri),
    queryFn: async (): Promise<EdgeWithNodes> => {
      const { data } = await api.GET('/xrpc/pub.chive.graph.getEdge', {
        params: {
          query: {
            uri,
            resolveNodes: options.resolveNodes ?? false,
          },
        },
      });
      return data as EdgeWithNodes;
    },
    enabled: !!uri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches hierarchy for a subkind (e.g., field tree).
 *
 * @param subkind - Subkind slug (e.g., 'field')
 * @param params - Hierarchy parameters
 * @param options - Hook options
 * @returns Query result with hierarchy tree
 *
 * @example
 * ```tsx
 * // Get full field hierarchy
 * const { data: hierarchy } = useHierarchy('field');
 *
 * // Get subtree from a specific root
 * const { data: subtree } = useHierarchy('field', { rootUri: computerScienceUri });
 * ```
 */
export function useHierarchy(
  subkind: string,
  params: HierarchyParams = {},
  options: UseEdgeOptions = {}
) {
  return useQuery({
    queryKey: edgeKeys.hierarchy(subkind, params.rootUri),
    queryFn: async (): Promise<HierarchyResponse> => {
      const { data } = await api.GET('/xrpc/pub.chive.graph.getHierarchy', {
        params: {
          query: {
            subkind,
            rootUri: params.rootUri,
            maxDepth: params.maxDepth ?? 10,
          },
        },
      });
      return data as HierarchyResponse;
    },
    enabled: !!subkind && (options.enabled ?? true),
    staleTime: 10 * 60 * 1000, // Longer stale time for hierarchy
  });
}

/**
 * Fetches children of a node (via narrower relation).
 *
 * @param nodeUri - Parent node URI
 * @param options - Hook options
 * @returns Query result with child nodes
 */
export function useNodeChildren(nodeUri: string, options: UseEdgeOptions = {}) {
  return useQuery({
    queryKey: edgeKeys.children(nodeUri),
    queryFn: async (): Promise<{ children: GraphNode[] }> => {
      const { data } = await api.GET('/xrpc/pub.chive.graph.getConnected', {
        params: {
          query: {
            nodeUri,
            relationSlug: 'narrower',
            direction: 'outgoing',
          },
        },
      });
      return data as { children: GraphNode[] };
    },
    enabled: !!nodeUri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches parents of a node (via broader relation).
 *
 * @param nodeUri - Child node URI
 * @param options - Hook options
 * @returns Query result with parent nodes
 */
export function useNodeParents(nodeUri: string, options: UseEdgeOptions = {}) {
  return useQuery({
    queryKey: edgeKeys.parents(nodeUri),
    queryFn: async (): Promise<{ parents: GraphNode[] }> => {
      const { data } = await api.GET('/xrpc/pub.chive.graph.getConnected', {
        params: {
          query: {
            nodeUri,
            relationSlug: 'broader',
            direction: 'outgoing',
          },
        },
      });
      return data as { parents: GraphNode[] };
    },
    enabled: !!nodeUri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches ancestor path from a node to root(s).
 *
 * @param nodeUri - Node URI
 * @param options - Hook options
 * @returns Query result with ancestor path
 */
export function useNodeAncestors(nodeUri: string, options: UseEdgeOptions = {}) {
  return useQuery({
    queryKey: edgeKeys.ancestors(nodeUri),
    queryFn: async (): Promise<{ ancestors: Array<{ uri: string; label: string }> }> => {
      const { data } = await api.GET('/xrpc/pub.chive.graph.getAncestors', {
        params: {
          query: { nodeUri },
        },
      });
      return data as { ancestors: Array<{ uri: string; label: string }> };
    },
    enabled: !!nodeUri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// CONVENIENCE HOOKS
// =============================================================================

/**
 * Fetches the academic field hierarchy.
 */
export function useFieldHierarchy(options: UseEdgeOptions = {}) {
  return useHierarchy('field', {}, options);
}

/**
 * Fetches children of an academic field.
 */
export function useFieldChildren(fieldUri: string, options: UseEdgeOptions = {}) {
  return useNodeChildren(fieldUri, options);
}

/**
 * Fetches the ancestor path for an academic field.
 */
export function useFieldAncestors(fieldUri: string, options: UseEdgeOptions = {}) {
  return useNodeAncestors(fieldUri, options);
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Edge status labels.
 */
export const EDGE_STATUS_LABELS: Record<EdgeStatus, string> = {
  proposed: 'Proposed',
  established: 'Established',
  deprecated: 'Deprecated',
};

/**
 * Common relation labels.
 */
export const RELATION_LABELS: Record<string, string> = {
  broader: 'Broader',
  narrower: 'Narrower',
  related: 'Related',
  'exact-match': 'Exact Match',
  'close-match': 'Close Match',
  'interdisciplinary-with': 'Interdisciplinary With',
  supersedes: 'Supersedes',
  'superseded-by': 'Superseded By',
  'affiliated-with': 'Affiliated With',
  'part-of': 'Part Of',
  'has-part': 'Has Part',
  'located-in': 'Located In',
  'member-of': 'Member Of',
  studies: 'Studies',
  'studied-by': 'Studied By',
  'applies-to': 'Applies To',
  'applied-in': 'Applied In',
};
