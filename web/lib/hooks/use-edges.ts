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
 * const { data } = useEdges({ sourceUri: nodeUri, relationSlug: 'broader' });
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

import {
  api,
  PubChiveGraphGetEdge,
  PubChiveGraphGetHierarchy,
  PubChiveGraphGetNode,
  PubChiveGraphListNodes,
} from '@/lib/api/client';

// =============================================================================
// TYPES - Derived from API Schema
// =============================================================================

/**
 * Edge status in the governance lifecycle.
 */
export type EdgeStatus = 'proposed' | 'established' | 'deprecated';

/**
 * Node status in the governance lifecycle.
 */
export type NodeStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/**
 * Node kind.
 */
export type NodeKind = 'type' | 'object';

/**
 * Edge from API response.
 */
export type GraphEdge = PubChiveGraphGetEdge.GraphEdge;

/**
 * Hierarchy item from API response.
 */
export type ApiHierarchyNode = PubChiveGraphGetHierarchy.HierarchyItem;

/**
 * API graph node from listNodes response.
 */
export type ApiGraphNode = PubChiveGraphListNodes.GraphNode;

/**
 * API node with edges from getNode response.
 */
export type ApiNodeWithEdges = PubChiveGraphGetNode.NodeWithEdges;

/**
 * Simplified graph node for UI consumption.
 */
export interface GraphNode {
  id: string;
  uri: string;
  kind: NodeKind;
  subkind?: string;
  subkindUri?: string;
  label: string;
  alternateLabels?: string[];
  description?: string;
  status: NodeStatus;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Hierarchy node for tree structures.
 */
export interface HierarchyNode {
  /** Full node data */
  node: GraphNode;
  /** Depth in the hierarchy */
  depth: number;
  /** Child nodes */
  children: HierarchyNode[];
}

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
 * Edge with resolved nodes.
 */
export interface EdgeWithNodes extends GraphEdge {
  /** Resolved source node */
  sourceNode?: GraphNode;
  /** Resolved target node */
  targetNode?: GraphNode;
}

/**
 * Edges response from listEdges.
 */
export interface EdgesResponse {
  edges: GraphEdge[];
  cursor?: string;
  hasMore: boolean;
  total: number;
}

/**
 * Hierarchy response from getHierarchy.
 */
export interface HierarchyResponse {
  roots: HierarchyNode[];
  subkind: string;
  relationSlug: string;
}

/**
 * Connected nodes response (derived from edges).
 */
export interface ConnectedNodesResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Ancestor path item.
 */
export interface AncestorPathItem {
  uri: string;
  label: string;
  depth: number;
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

  /** Key for edges list with params */
  list: (params: EdgeListParams) => [...edgeKeys.all, 'list', params] as const,

  /** Key for single edge */
  detail: (uri: string) => [...edgeKeys.all, 'detail', uri] as const,

  /** Key for hierarchy */
  hierarchy: (subkind: string, relationSlug: string) =>
    [...edgeKeys.all, 'hierarchy', subkind, relationSlug] as const,

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
 * Edge list parameters matching the API schema.
 */
export interface EdgeListParams {
  /** Filter by source node URI */
  sourceUri?: string;
  /** Filter by target node URI */
  targetUri?: string;
  /** Filter by relation slug */
  relationSlug?: string;
  /** Filter by status */
  status?: EdgeStatus;
  /** Maximum results */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Hierarchy parameters matching the API schema.
 */
export interface HierarchyParams {
  /** Subkind slug (e.g., 'field') */
  subkind: string;
  /** Relation slug for traversal (e.g., 'narrower') */
  relationSlug: string;
}

/**
 * Hook options.
 */
export interface UseEdgeOptions {
  /** Whether query is enabled */
  enabled?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Converts an API graph node to our simplified GraphNode type.
 * Accepts both GraphNode from listNodes and NodeWithEdges from getNode.
 */
function mapApiNode(apiNode: ApiGraphNode | ApiNodeWithEdges): GraphNode {
  return {
    id: apiNode.id,
    uri: apiNode.uri,
    kind: apiNode.kind as NodeKind,
    subkind: apiNode.subkind,
    subkindUri: apiNode.subkindUri,
    label: apiNode.label,
    alternateLabels: apiNode.alternateLabels,
    description: apiNode.description,
    status: apiNode.status as NodeStatus,
    createdAt: apiNode.createdAt,
    updatedAt: apiNode.updatedAt,
  };
}

/**
 * Converts an API hierarchy node to our simplified HierarchyNode type.
 */
function mapApiHierarchyNode(apiNode: ApiHierarchyNode): HierarchyNode {
  return {
    node: mapApiNode(apiNode.node),
    depth: apiNode.depth,
    children: apiNode.children.map(mapApiHierarchyNode),
  };
}

/**
 * Finds the path from root to a target node in a hierarchy.
 */
function findPathToNode(
  roots: HierarchyNode[],
  targetUri: string,
  currentPath: AncestorPathItem[] = []
): AncestorPathItem[] | null {
  for (const root of roots) {
    const newPath = [
      ...currentPath,
      { uri: root.node.uri, label: root.node.label, depth: root.depth },
    ];

    if (root.node.uri === targetUri) {
      return newPath;
    }

    const foundPath = findPathToNode(root.children, targetUri, newPath);
    if (foundPath) {
      return foundPath;
    }
  }
  return null;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches edges with filtering parameters.
 *
 * @param params - List parameters
 * @param options - Hook options
 * @returns Query result with edges
 *
 * @example
 * ```tsx
 * // Get all broader relations from a node
 * const { data } = useEdges({ sourceUri: nodeUri, relationSlug: 'broader' });
 *
 * // Get all edges targeting a node
 * const { data } = useEdges({ targetUri: nodeUri });
 * ```
 */
export function useEdges(params: EdgeListParams = {}, options: UseEdgeOptions = {}) {
  const hasFilter = !!(params.sourceUri || params.targetUri);

  return useQuery({
    queryKey: edgeKeys.list(params),
    queryFn: async (): Promise<EdgesResponse> => {
      const response = await api.pub.chive.graph.listEdges({
        limit: params.limit ?? 50,
        cursor: params.cursor,
        sourceUri: params.sourceUri,
        targetUri: params.targetUri,
        relationSlug: params.relationSlug,
        status: params.status ?? 'established',
      });

      return {
        edges: response.data.edges,
        cursor: response.data.cursor,
        hasMore: response.data.hasMore,
        total: response.data.total,
      };
    },
    enabled: hasFilter && (options.enabled ?? true),
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
    queryFn: async (): Promise<GraphEdge> => {
      const response = await api.pub.chive.graph.getEdge({ uri });
      return response.data;
    },
    enabled: !!uri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches hierarchy for a subkind (e.g., field tree).
 *
 * @param params - Hierarchy parameters (subkind and relationSlug required)
 * @param options - Hook options
 * @returns Query result with hierarchy tree
 *
 * @example
 * ```tsx
 * // Get full field hierarchy using narrower relations
 * const { data: hierarchy } = useHierarchy({ subkind: 'field', relationSlug: 'narrower' });
 * ```
 */
export function useHierarchy(params: HierarchyParams, options: UseEdgeOptions = {}) {
  return useQuery({
    queryKey: edgeKeys.hierarchy(params.subkind, params.relationSlug),
    queryFn: async (): Promise<HierarchyResponse> => {
      const response = await api.pub.chive.graph.getHierarchy({
        subkind: params.subkind,
        relationSlug: params.relationSlug,
      });

      return {
        roots: response.data.roots.map(mapApiHierarchyNode),
        subkind: response.data.subkind,
        relationSlug: response.data.relationSlug,
      };
    },
    enabled: !!params.subkind && !!params.relationSlug && (options.enabled ?? true),
    staleTime: 10 * 60 * 1000, // Longer stale time for hierarchy
  });
}

/**
 * Fetches children of a node (via narrower relation edges).
 *
 * @param nodeUri - Parent node URI
 * @param options - Hook options
 * @returns Query result with child node URIs from edges
 *
 * @remarks
 * Uses listEdges to find nodes connected via 'narrower' relation.
 * The node is the source, children are targets.
 */
export function useNodeChildren(nodeUri: string, options: UseEdgeOptions = {}) {
  return useQuery({
    queryKey: edgeKeys.children(nodeUri),
    queryFn: async (): Promise<ConnectedNodesResponse> => {
      const response = await api.pub.chive.graph.listEdges({
        limit: 100,
        sourceUri: nodeUri,
        relationSlug: 'narrower',
        status: 'established',
      });

      // Extract unique target URIs and fetch nodes
      const targetUris = [...new Set(response.data.edges.map((e: GraphEdge) => e.targetUri))];

      // Fetch each node (could be optimized with batch endpoint)
      const nodes: GraphNode[] = [];
      for (const targetUri of targetUris) {
        const nodeResponse = await api.pub.chive.graph.getNode({
          id: targetUri,
          includeEdges: false,
        });
        if (nodeResponse.data) {
          nodes.push(mapApiNode(nodeResponse.data));
        }
      }

      return { nodes, edges: response.data.edges };
    },
    enabled: !!nodeUri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches parents of a node (via broader relation edges).
 *
 * @param nodeUri - Child node URI
 * @param options - Hook options
 * @returns Query result with parent node URIs from edges
 *
 * @remarks
 * Uses listEdges to find nodes connected via 'broader' relation.
 * The node is the source, parents are targets.
 */
export function useNodeParents(nodeUri: string, options: UseEdgeOptions = {}) {
  return useQuery({
    queryKey: edgeKeys.parents(nodeUri),
    queryFn: async (): Promise<ConnectedNodesResponse> => {
      const response = await api.pub.chive.graph.listEdges({
        limit: 50,
        sourceUri: nodeUri,
        relationSlug: 'broader',
        status: 'established',
      });

      // Extract unique target URIs and fetch nodes
      const targetUris = [...new Set(response.data.edges.map((e: GraphEdge) => e.targetUri))];

      // Fetch each node
      const nodes: GraphNode[] = [];
      for (const targetUri of targetUris) {
        const nodeResponse = await api.pub.chive.graph.getNode({
          id: targetUri,
          includeEdges: false,
        });
        if (nodeResponse.data) {
          nodes.push(mapApiNode(nodeResponse.data));
        }
      }

      return { nodes, edges: response.data.edges };
    },
    enabled: !!nodeUri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches ancestor path from a node to root(s).
 *
 * @param nodeUri - Node URI
 * @param subkind - Subkind for the hierarchy (e.g., 'field')
 * @param options - Hook options
 * @returns Query result with ancestor path
 *
 * @remarks
 * Fetches the full hierarchy and finds the path to the target node.
 * This is efficient when the hierarchy is already cached.
 */
export function useNodeAncestors(
  nodeUri: string,
  subkind: string = 'field',
  options: UseEdgeOptions = {}
) {
  return useQuery({
    queryKey: edgeKeys.ancestors(nodeUri),
    queryFn: async (): Promise<{ ancestors: AncestorPathItem[] }> => {
      // Fetch the full hierarchy
      const response = await api.pub.chive.graph.getHierarchy({
        subkind,
        relationSlug: 'narrower',
      });

      // Map to our hierarchy format
      const roots = response.data.roots.map(mapApiHierarchyNode);

      // Find path to target node
      const path = findPathToNode(roots, nodeUri);

      if (!path) {
        // Node not found in hierarchy, return empty path
        return { ancestors: [] };
      }

      // Return ancestors (all nodes except the target itself)
      return { ancestors: path.slice(0, -1) };
    },
    enabled: !!nodeUri && !!subkind && (options.enabled ?? true),
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
  return useHierarchy({ subkind: 'field', relationSlug: 'narrower' }, options);
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
  return useNodeAncestors(fieldUri, 'field', options);
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
