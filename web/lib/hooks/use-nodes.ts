/**
 * React hooks for unified knowledge graph node data fetching.
 *
 * @remarks
 * Provides TanStack Query hooks for searching and fetching nodes from the
 * unified knowledge graph. All node types (fields, facets, institutions,
 * contribution types, etc.) use a single unified API.
 *
 * @example
 * ```tsx
 * import { useNodeSearch, useNode, useNodesBySubkind } from '@/lib/hooks/use-nodes';
 *
 * // Search for any nodes
 * const { data } = useNodeSearch('MIT', { subkind: 'institution' });
 *
 * // Get all document formats
 * const { data: formats } = useNodesBySubkind('document-format');
 *
 * // Get a specific node
 * const { data: node } = useNode(nodeUri);
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Node kind - distinguishes classifications from instances.
 */
export type NodeKind = 'type' | 'object';

/**
 * Node status in the governance lifecycle.
 */
export type NodeStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/**
 * External ID linking to external systems.
 */
export interface ExternalId {
  /** External system identifier */
  system: string;
  /** Identifier within the system */
  identifier: string;
  /** Optional URI */
  uri?: string;
  /** Match type for vocabulary alignment */
  matchType?: 'exact' | 'close' | 'broader' | 'narrower' | 'related';
}

/**
 * Node metadata for subkind-specific fields.
 */
export interface NodeMetadata {
  /** Country code (ISO 3166-1 alpha-2) */
  country?: string;
  /** City name */
  city?: string;
  /** Website URL */
  website?: string;
  /** Organization status */
  organizationStatus?: 'active' | 'merged' | 'inactive' | 'defunct';
  /** MIME types (for document formats) */
  mimeTypes?: string[];
  /** SPDX ID (for licenses) */
  spdxId?: string;
  /** Display order in UI selectors */
  displayOrder?: number;
}

/**
 * Unified knowledge graph node.
 */
export interface GraphNode {
  /** AT-URI of the node */
  uri: string;
  /** Node identifier (UUID) */
  id: string;
  /** Node kind */
  kind: NodeKind;
  /** Subkind slug */
  subkind: string;
  /** Display label */
  label: string;
  /** Alternate labels */
  alternateLabels?: string[];
  /** Description */
  description?: string;
  /** External identifiers */
  externalIds?: ExternalId[];
  /** Subkind-specific metadata */
  metadata?: NodeMetadata;
  /** Governance status */
  status: NodeStatus;
  /** URI of deprecation replacement */
  deprecatedBy?: string;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Node detail with connected nodes.
 */
export interface NodeDetail extends GraphNode {
  /** Parent nodes (via broader relation) */
  parents?: Array<{ uri: string; label: string }>;
  /** Child nodes (via narrower relation) */
  children?: Array<{ uri: string; label: string; description?: string }>;
  /** Related nodes */
  related?: Array<{ uri: string; label: string; relationSlug: string }>;
}

/**
 * Node search/list response.
 */
export interface NodesResponse {
  nodes: GraphNode[];
  total?: number;
  cursor?: string;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for node queries.
 */
export const nodeKeys = {
  /** Base key */
  all: ['nodes'] as const,

  /** Key for search queries */
  search: (query: string, params?: NodeSearchParams) =>
    [...nodeKeys.all, 'search', query, params] as const,

  /** Key for single node */
  detail: (uri: string) => [...nodeKeys.all, 'detail', uri] as const,

  /** Key for nodes by subkind */
  bySubkind: (subkind: string, params?: NodeListParams) =>
    [...nodeKeys.all, 'subkind', subkind, params] as const,

  /** Key for nodes by kind */
  byKind: (kind: NodeKind, params?: NodeListParams) =>
    [...nodeKeys.all, 'kind', kind, params] as const,

  /** Key for hierarchy (field tree, etc.) */
  hierarchy: (subkind: string) => [...nodeKeys.all, 'hierarchy', subkind] as const,
};

// =============================================================================
// PARAMETER TYPES
// =============================================================================

/**
 * Search parameters.
 */
export interface NodeSearchParams {
  /** Filter by kind */
  kind?: NodeKind;
  /** Filter by subkind slug */
  subkind?: string;
  /** Filter by status */
  status?: NodeStatus;
  /** Maximum results */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * List parameters.
 */
export interface NodeListParams {
  /** Filter by status */
  status?: NodeStatus;
  /** Maximum results */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Hook options.
 */
export interface UseNodeOptions {
  /** Whether query is enabled */
  enabled?: boolean;
  /** Include parent nodes */
  includeParents?: boolean;
  /** Include child nodes */
  includeChildren?: boolean;
  /** Include related nodes */
  includeRelated?: boolean;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Searches knowledge graph nodes.
 *
 * @param query - Search query
 * @param params - Search parameters
 * @param options - Hook options
 * @returns Query result with matching nodes
 *
 * @example
 * ```tsx
 * // Search institutions
 * const { data } = useNodeSearch('MIT', { subkind: 'institution' });
 *
 * // Search all type nodes
 * const { data } = useNodeSearch('machine learning', { kind: 'type' });
 * ```
 */
export function useNodeSearch(
  query: string,
  params: NodeSearchParams = {},
  options: UseNodeOptions = {}
) {
  return useQuery({
    queryKey: nodeKeys.search(query, params),
    queryFn: async (): Promise<NodesResponse> => {
      const response = await api.pub.chive.graph.searchNodes({
        query,
        kind: params.kind,
        subkind: params.subkind,
        status: params.status,
        limit: params.limit ?? 20,
        cursor: params.cursor,
      });
      return response.data as NodesResponse;
    },
    enabled: query.length >= 2 && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches a single node by ID.
 *
 * @param id - Node ID (UUID)
 * @param options - Hook options
 * @returns Query result with node detail
 *
 * @example
 * ```tsx
 * const { data: node } = useNode(nodeId);
 * ```
 */
export function useNode(id: string, options: UseNodeOptions = {}) {
  // includeEdges fetches all connected edges
  const includeEdges = options.includeParents || options.includeChildren || options.includeRelated;

  return useQuery({
    queryKey: nodeKeys.detail(id),
    queryFn: async (): Promise<NodeDetail> => {
      const response = await api.pub.chive.graph.getNode({
        id,
        includeEdges: includeEdges ?? false,
      });
      return response.data as NodeDetail;
    },
    enabled: !!id && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches nodes by subkind.
 *
 * @param subkind - Subkind slug (e.g., 'document-format', 'license')
 * @param params - List parameters
 * @param options - Hook options
 * @returns Query result with nodes
 *
 * @example
 * ```tsx
 * // Get all document formats
 * const { data } = useNodesBySubkind('document-format');
 *
 * // Get all established licenses
 * const { data } = useNodesBySubkind('license', { status: 'established' });
 * ```
 */
export function useNodesBySubkind(
  subkind: string,
  params: NodeListParams = {},
  options: UseNodeOptions = {}
) {
  return useQuery({
    queryKey: nodeKeys.bySubkind(subkind, params),
    queryFn: async (): Promise<NodesResponse> => {
      const response = await api.pub.chive.graph.listNodes({
        subkind,
        status: params.status ?? 'established',
        limit: params.limit ?? 100,
        cursor: params.cursor,
      });
      return response.data as NodesResponse;
    },
    enabled: !!subkind && (options.enabled ?? true),
    staleTime: 10 * 60 * 1000, // Longer stale time for type listings
  });
}

/**
 * Fetches nodes by kind (type or object).
 *
 * @param kind - Node kind
 * @param params - List parameters
 * @param options - Hook options
 * @returns Query result with nodes
 */
export function useNodesByKind(
  kind: NodeKind,
  params: NodeListParams = {},
  options: UseNodeOptions = {}
) {
  return useQuery({
    queryKey: nodeKeys.byKind(kind, params),
    queryFn: async (): Promise<NodesResponse> => {
      const response = await api.pub.chive.graph.listNodes({
        kind,
        status: params.status ?? 'established',
        limit: params.limit ?? 100,
        cursor: params.cursor,
      });
      return response.data as NodesResponse;
    },
    enabled: options.enabled ?? true,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for prefetching a node on hover.
 */
export function usePrefetchNode() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: nodeKeys.detail(id),
      queryFn: async (): Promise<NodeDetail | undefined> => {
        const response = await api.pub.chive.graph.getNode({
          id,
          includeEdges: false,
        });
        return response.data as NodeDetail | undefined;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}

// =============================================================================
// CONVENIENCE HOOKS
// =============================================================================

/**
 * Fetches document format nodes.
 */
export function useDocumentFormats(options: UseNodeOptions = {}) {
  return useNodesBySubkind('document-format', { status: 'established' }, options);
}

/**
 * Fetches license nodes.
 */
export function useLicenses(options: UseNodeOptions = {}) {
  return useNodesBySubkind('license', { status: 'established' }, options);
}

/**
 * Fetches publication status nodes.
 */
export function usePublicationStatuses(options: UseNodeOptions = {}) {
  return useNodesBySubkind('publication-status', { status: 'established' }, options);
}

/**
 * Fetches contribution type nodes.
 */
export function useContributionTypeNodes(options: UseNodeOptions = {}) {
  return useNodesBySubkind('contribution-type', { status: 'established' }, options);
}

/**
 * Fetches contribution degree nodes.
 */
export function useContributionDegrees(options: UseNodeOptions = {}) {
  return useNodesBySubkind('contribution-degree', { status: 'established' }, options);
}

/**
 * Fetches paper type nodes.
 */
export function usePaperTypes(options: UseNodeOptions = {}) {
  return useNodesBySubkind('paper-type', { status: 'established' }, options);
}

/**
 * Fetches supplementary category nodes.
 */
export function useSupplementaryCategories(options: UseNodeOptions = {}) {
  return useNodesBySubkind('supplementary-category', { status: 'established' }, options);
}

/**
 * Fetches annotation motivation nodes.
 */
export function useMotivations(options: UseNodeOptions = {}) {
  return useNodesBySubkind('motivation', { status: 'established' }, options);
}

/**
 * Fetches platform nodes by type.
 */
export function usePlatforms(
  platformType:
    | 'platform-code'
    | 'platform-data'
    | 'platform-preprint'
    | 'platform-preregistration'
    | 'platform-protocol',
  options: UseNodeOptions = {}
) {
  return useNodesBySubkind(platformType, { status: 'established' }, options);
}

/**
 * Fetches institution type nodes.
 */
export function useInstitutionTypes(options: UseNodeOptions = {}) {
  return useNodesBySubkind('institution-type', { status: 'established' }, options);
}

/**
 * Searches institutions (object nodes with subkind=institution).
 */
export function useInstitutionSearch(query: string, options: UseNodeOptions = {}) {
  return useNodeSearch(query, { subkind: 'institution', kind: 'object' }, options);
}

/**
 * Fetches facet nodes (classification dimensions).
 *
 * @remarks
 * Facets are dynamic and fetched from the knowledge graph where subkind='facet'.
 * Users can propose new facets through governance.
 *
 * @example
 * ```tsx
 * const { data } = useFacets();
 * // Returns: [{ label: 'Methodology', slug: 'methodology', ... }, ...]
 * ```
 */
export function useFacets(options: UseNodeOptions = {}) {
  return useNodesBySubkind('facet', { status: 'established' }, options);
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Node status labels.
 */
export const NODE_STATUS_LABELS: Record<NodeStatus, string> = {
  proposed: 'Proposed',
  provisional: 'Provisional',
  established: 'Established',
  deprecated: 'Deprecated',
};

/**
 * Node kind labels.
 */
export const NODE_KIND_LABELS: Record<NodeKind, string> = {
  type: 'Type',
  object: 'Object',
};

/**
 * Common subkind labels.
 */
export const SUBKIND_LABELS: Record<string, string> = {
  // Meta-types
  subkind: 'Subkind',
  relation: 'Relation Type',
  // Core graph
  field: 'Academic Field',
  facet: 'Classification Facet',
  // Submission form types
  'document-format': 'Document Format',
  license: 'License',
  'supplementary-category': 'Supplementary Category',
  'publication-status': 'Publication Status',
  'paper-type': 'Paper Type',
  'contribution-type': 'Contribution Type',
  'contribution-degree': 'Contribution Degree',
  // Platform types
  'platform-code': 'Code Platform',
  'platform-data': 'Data Repository',
  'platform-preprint': 'Preprint Server',
  'platform-preregistration': 'Preregistration Registry',
  'platform-protocol': 'Protocol Repository',
  // Other types
  'presentation-type': 'Presentation Type',
  'institution-type': 'Institution Type',
  motivation: 'Annotation Motivation',
  'endorsement-contribution': 'Endorsement Contribution',
  'access-type': 'Access Type',
  // Object subkinds
  institution: 'Institution',
  person: 'Person',
  event: 'Event',
};
