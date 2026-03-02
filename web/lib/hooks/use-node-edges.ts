/**
 * React hook for fetching and resolving edges for any knowledge graph node.
 *
 * @remarks
 * Fetches both inbound and outbound edges for a given node URI, resolves
 * the labels of connected nodes, deduplicates by edge URI, and groups
 * the results by relation slug.
 *
 * @example
 * ```tsx
 * import { useNodeEdges } from '@/lib/hooks/use-node-edges';
 *
 * function NodeEdgesPanel({ nodeUri }: { nodeUri: string }) {
 *   const { data, isLoading } = useNodeEdges(nodeUri);
 *   if (isLoading) return <Spinner />;
 *   if (!data) return null;
 *
 *   return (
 *     <div>
 *       {Object.entries(data.grouped).map(([slug, edges]) => (
 *         <section key={slug}>
 *           <h3>{slug}</h3>
 *           {edges.map(e => <span key={e.uri}>{e.otherLabel}</span>)}
 *         </section>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';

// =============================================================================
// TYPES
// =============================================================================

/**
 * An edge with its direction resolved relative to a queried node.
 */
export interface ResolvedEdge {
  /** AT-URI of the edge */
  uri: string;
  /** AT-URI of the source node */
  sourceUri: string;
  /** AT-URI of the target node */
  targetUri: string;
  /** Relation type slug (e.g., 'broader', 'narrower', 'related') */
  relationSlug: string;
  /** AT-URI of the node on the other end of the edge */
  otherUri: string;
  /** Display label for the other node */
  otherLabel: string;
  /** Direction relative to the queried node */
  direction: 'outbound' | 'inbound';
}

/**
 * Edges grouped by relation slug.
 */
export interface GroupedEdges {
  [relationSlug: string]: ResolvedEdge[];
}

/**
 * Result returned by the useNodeEdges hook.
 */
export interface NodeEdgesResult {
  /** Flat list of all resolved edges */
  edges: ResolvedEdge[];
  /** Edges grouped by relation slug */
  grouped: GroupedEdges;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for node edge queries.
 */
export const nodeEdgeKeys = {
  all: ['node-edges'] as const,
  detail: (nodeUri: string) => [...nodeEdgeKeys.all, nodeUri] as const,
};

// =============================================================================
// FETCH AND RESOLVE
// =============================================================================

/**
 * Extracts a fallback label from an AT-URI.
 *
 * @param uri - The AT-URI to extract a label from
 * @returns The last path segment, or the full URI if no segments exist
 */
function fallbackLabel(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

/**
 * Extracts the node ID from an AT-URI for use with the getNode endpoint.
 *
 * @remarks
 * The getNode endpoint accepts a node ID (UUID or rkey). The rkey is the
 * last segment of the AT-URI path.
 *
 * @param uri - The AT-URI of the node
 * @returns The node ID (last path segment)
 */
function extractNodeId(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

/**
 * Fetches all edges (inbound and outbound) for a node and resolves
 * the labels of connected nodes.
 *
 * @param nodeUri - The AT-URI of the node to fetch edges for
 * @returns Resolved edges with labels and grouping
 */
async function fetchAndResolveEdges(nodeUri: string): Promise<NodeEdgesResult> {
  // Fetch outbound and inbound edges in parallel
  const [outboundResponse, inboundResponse] = await Promise.all([
    api.pub.chive.graph.listEdges({
      sourceUri: nodeUri,
      limit: 100,
    }),
    api.pub.chive.graph.listEdges({
      targetUri: nodeUri,
      limit: 100,
    }),
  ]);

  const outboundEdges = outboundResponse.data.edges ?? [];
  const inboundEdges = inboundResponse.data.edges ?? [];

  // Deduplicate by edge URI
  const edgeMap = new Map<
    string,
    { edge: (typeof outboundEdges)[number]; direction: 'outbound' | 'inbound' }
  >();

  for (const edge of outboundEdges) {
    edgeMap.set(edge.uri, { edge, direction: 'outbound' });
  }
  for (const edge of inboundEdges) {
    if (!edgeMap.has(edge.uri)) {
      edgeMap.set(edge.uri, { edge, direction: 'inbound' });
    }
  }

  // Determine the "other" URI for each edge and collect unique URIs to resolve
  const otherUris = new Set<string>();
  for (const { edge, direction } of edgeMap.values()) {
    const otherUri = direction === 'outbound' ? edge.targetUri : edge.sourceUri;
    otherUris.add(otherUri);
  }

  // Resolve node labels in parallel (with graceful degradation)
  const labelMap = new Map<string, string>();

  const labelResults = await Promise.all(
    Array.from(otherUris).map(async (uri) => {
      try {
        const nodeId = extractNodeId(uri);
        const response = await api.pub.chive.graph.getNode({
          id: nodeId,
          includeEdges: false,
        });
        return { uri, label: response.data.label };
      } catch {
        return { uri, label: fallbackLabel(uri) };
      }
    })
  );

  for (const { uri, label } of labelResults) {
    labelMap.set(uri, label);
  }

  // Build resolved edges
  const resolvedEdges: ResolvedEdge[] = [];

  for (const { edge, direction } of edgeMap.values()) {
    const otherUri = direction === 'outbound' ? edge.targetUri : edge.sourceUri;
    const otherLabel = labelMap.get(otherUri) ?? fallbackLabel(otherUri);

    resolvedEdges.push({
      uri: edge.uri,
      sourceUri: edge.sourceUri,
      targetUri: edge.targetUri,
      relationSlug: edge.relationSlug,
      otherUri,
      otherLabel,
      direction,
    });
  }

  // Group by relation slug
  const grouped: GroupedEdges = {};
  for (const edge of resolvedEdges) {
    if (!grouped[edge.relationSlug]) {
      grouped[edge.relationSlug] = [];
    }
    grouped[edge.relationSlug]!.push(edge);
  }

  return { edges: resolvedEdges, grouped };
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Fetches and resolves all edges for a knowledge graph node.
 *
 * @remarks
 * Retrieves both outbound edges (where the node is the source) and inbound
 * edges (where the node is the target), deduplicates them, resolves the
 * label of each connected node via getNode, and groups the results by
 * relation slug.
 *
 * If a connected node cannot be resolved (e.g., it has been deleted or the
 * request fails), the hook falls back to using the last segment of the
 * AT-URI as the label.
 *
 * @param nodeUri - The AT-URI of the node, or null to disable the query
 * @param options - Hook options
 * @returns Query result with resolved and grouped edges
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useNodeEdges(fieldUri);
 *
 * if (data) {
 *   console.log(`Total edges: ${data.edges.length}`);
 *   console.log(`Relation types: ${Object.keys(data.grouped).join(', ')}`);
 * }
 * ```
 */
export function useNodeEdges(nodeUri: string | null, options?: { enabled?: boolean }) {
  return useQuery<NodeEdgesResult>({
    queryKey: nodeEdgeKeys.detail(nodeUri ?? ''),
    queryFn: async (): Promise<NodeEdgesResult> => {
      try {
        return await fetchAndResolveEdges(nodeUri!);
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch node edges',
          undefined,
          'pub.chive.graph.listEdges'
        );
      }
    },
    enabled: !!nodeUri && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}
