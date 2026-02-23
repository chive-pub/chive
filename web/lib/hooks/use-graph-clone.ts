/**
 * React hooks for graph subgraph expansion and cloning into collections.
 *
 * @remarks
 * Provides a BFS-based subgraph expansion hook that traverses the knowledge
 * graph from root nodes up to N hops, and a mutation hook that materializes
 * the selected subgraph as a personal collection with CONTAINS edges and
 * personal relationship edges.
 *
 * @example
 * ```tsx
 * import { useGraphSubgraph, useCloneSubgraph } from '@/lib/hooks/use-graph-clone';
 *
 * function ClonePanel({ rootUris }: { rootUris: string[] }) {
 *   const { data: subgraph } = useGraphSubgraph(rootUris, 2);
 *   const cloneMutation = useCloneSubgraph();
 *
 *   const handleClone = () => {
 *     cloneMutation.mutateAsync({
 *       name: 'My Subfield Map',
 *       visibility: 'public',
 *       nodes: subgraph.nodes,
 *       edges: subgraph.edges,
 *     });
 *   };
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { api, authApi } from '@/lib/api/client';
import { createLogger } from '@/lib/observability/logger';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  createCollectionNode,
  createPersonalNode,
  addItemToCollection,
  createPersonalEdge,
} from '@/lib/atproto/record-creator';
import { collectionKeys } from '@/lib/hooks/use-collections';

const logger = createLogger({ context: { component: 'use-graph-clone' } });

// =============================================================================
// TYPES
// =============================================================================

/**
 * A node discovered during subgraph expansion.
 */
export interface SubgraphNode {
  /** Node AT-URI */
  uri: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Node kind (type or object) */
  kind: string;
  /** Node subkind (field, institution, etc.) */
  subkind?: string;
  /** Hop distance from root (0 = root node) */
  depth: number;
}

/**
 * An edge discovered during subgraph expansion.
 */
export interface SubgraphEdge {
  /** Edge AT-URI */
  uri: string;
  /** Source node AT-URI */
  sourceUri: string;
  /** Target node AT-URI */
  targetUri: string;
  /** Relation type slug (broader, narrower, related, etc.) */
  relationSlug: string;
}

/**
 * Result of a subgraph expansion query.
 */
export interface SubgraphResult {
  /** All discovered nodes */
  nodes: SubgraphNode[];
  /** All discovered edges between the nodes */
  edges: SubgraphEdge[];
  /** Whether the node cap was reached */
  capped: boolean;
}

/**
 * Input for the clone subgraph mutation.
 */
export interface CloneSubgraphInput {
  /** Collection name */
  name: string;
  /** Optional description */
  description?: string;
  /** Visibility setting */
  visibility: 'public' | 'unlisted' | 'private';
  /** Nodes to include, with optional per-node notes */
  nodes: Array<{ uri: string; label: string; note?: string }>;
  /** Edges to recreate as personal edges */
  edges: Array<{ sourceUri: string; targetUri: string; relationSlug: string }>;
  /** Optional tags for categorization */
  tags?: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum number of nodes the BFS will collect */
const MAX_NODES = 100;

/** Maximum edges to fetch per node during BFS */
const EDGES_PER_NODE = 50;

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for graph clone queries.
 */
export const graphCloneKeys = {
  all: ['graph-clone'] as const,
  subgraph: (rootUris: string[], depth: number, edgeTypes?: string[]) =>
    [...graphCloneKeys.all, 'subgraph', rootUris, depth, edgeTypes] as const,
};

// =============================================================================
// BFS EXPANSION
// =============================================================================

/**
 * Performs breadth-first expansion from root nodes, collecting nodes and edges.
 *
 * @param rootNodeUris - AT-URIs of the starting nodes
 * @param maxDepth - Maximum number of hops from root
 * @param edgeTypes - Optional filter for edge relation slugs
 * @returns The discovered subgraph
 */
async function expandSubgraph(
  rootNodeUris: string[],
  maxDepth: number,
  edgeTypes?: string[]
): Promise<SubgraphResult> {
  const visitedNodes = new Map<string, SubgraphNode>();
  const collectedEdges: SubgraphEdge[] = [];
  const seenEdgeUris = new Set<string>();
  let capped = false;

  // Initialize BFS queue with root nodes
  const queue: Array<{ uri: string; depth: number }> = rootNodeUris.map((uri) => ({
    uri,
    depth: 0,
  }));

  // Fetch root node details first
  for (const uri of rootNodeUris) {
    if (visitedNodes.size >= MAX_NODES) {
      capped = true;
      break;
    }
    try {
      const nodeResponse = await api.pub.chive.graph.getNode({
        id: uri,
        includeEdges: false,
      });
      if (nodeResponse.data) {
        visitedNodes.set(uri, {
          uri: nodeResponse.data.uri,
          label: nodeResponse.data.label,
          description: nodeResponse.data.description,
          kind: nodeResponse.data.kind,
          subkind: nodeResponse.data.subkind,
          depth: 0,
        });
      }
    } catch {
      // Node may not exist; skip it
      logger.warn('Failed to fetch root node during BFS', { uri });
    }
  }

  // BFS traversal
  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.depth >= maxDepth) continue;
    if (visitedNodes.size >= MAX_NODES) {
      capped = true;
      break;
    }

    // Fetch edges from this node (both outgoing and incoming)
    try {
      const [outgoing, incoming] = await Promise.all([
        api.pub.chive.graph.listEdges({
          sourceUri: current.uri,
          status: 'established',
          limit: EDGES_PER_NODE,
        }),
        api.pub.chive.graph.listEdges({
          targetUri: current.uri,
          status: 'established',
          limit: EDGES_PER_NODE,
        }),
      ]);

      const allEdges = [...outgoing.data.edges, ...incoming.data.edges];

      for (const edge of allEdges) {
        // Apply edge type filter if specified
        if (edgeTypes && edgeTypes.length > 0 && !edgeTypes.includes(edge.relationSlug)) {
          continue;
        }

        // Record the edge (deduplicate)
        if (!seenEdgeUris.has(edge.uri)) {
          seenEdgeUris.add(edge.uri);
          collectedEdges.push({
            uri: edge.uri,
            sourceUri: edge.sourceUri,
            targetUri: edge.targetUri,
            relationSlug: edge.relationSlug,
          });
        }

        // Determine the neighbor node URI
        const neighborUri = edge.sourceUri === current.uri ? edge.targetUri : edge.sourceUri;

        // Skip if already visited
        if (visitedNodes.has(neighborUri)) continue;

        // Check cap
        if (visitedNodes.size >= MAX_NODES) {
          capped = true;
          break;
        }

        // Fetch the neighbor node
        try {
          const nodeResponse = await api.pub.chive.graph.getNode({
            id: neighborUri,
            includeEdges: false,
          });
          if (nodeResponse.data) {
            const newDepth = current.depth + 1;
            visitedNodes.set(neighborUri, {
              uri: nodeResponse.data.uri,
              label: nodeResponse.data.label,
              description: nodeResponse.data.description,
              kind: nodeResponse.data.kind,
              subkind: nodeResponse.data.subkind,
              depth: newDepth,
            });

            // Enqueue for further expansion
            if (newDepth < maxDepth) {
              queue.push({ uri: neighborUri, depth: newDepth });
            }
          }
        } catch {
          // Node fetch failed; skip this neighbor
        }
      }
    } catch {
      // Edge listing failed for this node; continue with others
      logger.warn('Failed to list edges during BFS', { uri: current.uri });
    }
  }

  // Filter edges to only include those where both endpoints are in the visited set
  const nodeUris = new Set(visitedNodes.keys());
  const filteredEdges = collectedEdges.filter(
    (e) => nodeUris.has(e.sourceUri) && nodeUris.has(e.targetUri)
  );

  return {
    nodes: Array.from(visitedNodes.values()),
    edges: filteredEdges,
    capped,
  };
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches a subgraph starting from root node URIs up to N hops.
 *
 * @param rootNodeUris - AT-URIs of the root nodes to start expansion from
 * @param depth - Maximum number of hops from root (1-3)
 * @param options - Optional edge type filter and enabled flag
 * @returns Query result with the expanded subgraph
 *
 * @remarks
 * Uses client-side BFS because Chive does not have a dedicated subgraph
 * expansion endpoint. For each node, calls `listEdges` to discover
 * neighbors and `getNode` to fetch metadata. Tracks visited nodes
 * to avoid cycles and caps at 100 nodes maximum.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useGraphSubgraph(
 *   ['at://did:plc:governance/pub.chive.graph.node/uuid1'],
 *   2,
 *   { edgeTypes: ['broader', 'narrower', 'related'] }
 * );
 * ```
 */
export function useGraphSubgraph(
  rootNodeUris: string[],
  depth: number,
  options?: { edgeTypes?: string[]; enabled?: boolean }
) {
  return useQuery({
    queryKey: graphCloneKeys.subgraph(rootNodeUris, depth, options?.edgeTypes),
    queryFn: async (): Promise<SubgraphResult> => {
      try {
        return await expandSubgraph(rootNodeUris, depth, options?.edgeTypes);
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to expand subgraph',
          undefined,
          'graph.expandSubgraph'
        );
      }
    },
    enabled: rootNodeUris.length > 0 && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation that creates a collection from a selected subgraph.
 *
 * @remarks
 * The mutation performs three steps:
 * 1. Creates a collection node in the user's PDS
 * 2. Adds each selected node as a CONTAINS item in the collection
 * 3. Creates personal edges for the cloned relationships
 *
 * Each record is created in the user's PDS with immediate indexing
 * requested for instant UI feedback.
 *
 * @returns Mutation object with `collectionUri` on success
 *
 * @example
 * ```tsx
 * const cloneMutation = useCloneSubgraph();
 *
 * await cloneMutation.mutateAsync({
 *   name: 'NLP Field Map',
 *   visibility: 'public',
 *   nodes: [{ uri: 'at://...', label: 'NLP' }],
 *   edges: [{ sourceUri: 'at://...', targetUri: 'at://...', relationSlug: 'narrower' }],
 * });
 * ```
 */
export function useCloneSubgraph() {
  const queryClient = useQueryClient();

  return useMutation<{ collectionUri: string }, APIError, CloneSubgraphInput>({
    mutationFn: async (input) => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'cloneSubgraph');
      }

      // 1. Create the collection node
      const collectionResult = await createCollectionNode(agent, {
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        tags: input.tags,
      });

      // Index the collection immediately
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: collectionResult.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (indexError) {
        logger.warn('Immediate indexing failed for collection; firehose will handle', {
          uri: collectionResult.uri,
          error: indexError instanceof Error ? indexError.message : String(indexError),
        });
      }

      // 2. Clone each community graph node into the user's personal graph
      const uriMap = new Map<string, string>(); // community URI -> personal node URI

      for (const node of input.nodes) {
        try {
          const personalNode = await createPersonalNode(agent, {
            kind: 'object',
            subkind: 'concept',
            label: node.label,
            metadata: { clonedFrom: node.uri },
          });

          uriMap.set(node.uri, personalNode.uri);

          // Request immediate indexing of the personal node
          try {
            await authApi.pub.chive.sync.indexRecord({ uri: personalNode.uri });
          } catch {
            // Firehose will handle
          }
        } catch (nodeError) {
          logger.warn('Failed to clone node to personal graph', {
            nodeUri: node.uri,
            error: nodeError instanceof Error ? nodeError.message : String(nodeError),
          });
          // Fall back to using community URI directly
          uriMap.set(node.uri, node.uri);
        }
      }

      // 3. Add each cloned personal node as a CONTAINS item
      for (let i = 0; i < input.nodes.length; i++) {
        const node = input.nodes[i];
        const personalUri = uriMap.get(node.uri) ?? node.uri;
        try {
          const edgeResult = await addItemToCollection(agent, {
            collectionUri: collectionResult.uri,
            itemUri: personalUri,
            note: node.note,
            order: i + 1,
          });

          // Best-effort immediate indexing for each edge
          try {
            await authApi.pub.chive.sync.indexRecord({ uri: edgeResult.uri });
          } catch {
            // Firehose will handle
          }
        } catch (itemError) {
          logger.warn('Failed to add node to collection', {
            collectionUri: collectionResult.uri,
            nodeUri: personalUri,
            error: itemError instanceof Error ? itemError.message : String(itemError),
          });
        }
      }

      // 4. Create personal edges for the cloned relationships using remapped URIs
      for (const edge of input.edges) {
        try {
          const edgeResult = await createPersonalEdge(agent, {
            sourceUri: uriMap.get(edge.sourceUri) ?? edge.sourceUri,
            targetUri: uriMap.get(edge.targetUri) ?? edge.targetUri,
            relationSlug: edge.relationSlug,
            metadata: { clonedFrom: 'graph-clone-wizard' },
          });

          // Best-effort immediate indexing
          try {
            await authApi.pub.chive.sync.indexRecord({ uri: edgeResult.uri });
          } catch {
            // Firehose will handle
          }
        } catch (edgeError) {
          logger.warn('Failed to create cloned edge', {
            sourceUri: edge.sourceUri,
            targetUri: edge.targetUri,
            error: edgeError instanceof Error ? edgeError.message : String(edgeError),
          });
        }
      }

      // Brief delay before cache invalidation for DB commit
      await new Promise((resolve) => setTimeout(resolve, 100));

      return { collectionUri: collectionResult.uri };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    },
  });
}
