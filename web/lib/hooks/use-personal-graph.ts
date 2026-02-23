/**
 * React hooks for personal graph data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for creating and querying user-owned
 * graph nodes and edges. Personal graph records live in user PDSes
 * (not the Governance PDS) and are indexed by Chive from the firehose.
 *
 * Personal nodes can represent user-created concepts, tags, reading lists,
 * and other user-specific graph structures. Personal edges link these
 * nodes together with typed relationships.
 *
 * @example
 * ```tsx
 * import {
 *   usePersonalNodes,
 *   useCreatePersonalNode,
 * } from '@/lib/hooks/use-personal-graph';
 *
 * function PersonalConcepts({ did }: { did: string }) {
 *   const { data } = usePersonalNodes(did, { subkind: 'concept' });
 *   const createNode = useCreatePersonalNode();
 *
 *   return (
 *     <ConceptList
 *       nodes={data?.nodes ?? []}
 *       onCreate={(input) => createNode.mutateAsync(input)}
 *     />
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { authApi } from '@/lib/api/client';
import { createLogger } from '@/lib/observability/logger';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  createPersonalNode,
  createPersonalEdge,
  type CreatePersonalNodeInput,
  type CreatePersonalEdgeInput,
} from '@/lib/atproto/record-creator';

const logger = createLogger({ context: { component: 'use-personal-graph' } });

// =============================================================================
// LOCAL TYPES
// =============================================================================

/**
 * Personal graph node as returned by the API.
 */
export interface PersonalNodeView {
  uri: string;
  cid: string;
  ownerDid: string;
  kind: string;
  subkind?: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
}

/**
 * Personal graph edge as returned by the API.
 */
export interface PersonalEdgeView {
  uri: string;
  cid: string;
  ownerDid: string;
  sourceUri: string;
  targetUri: string;
  relationSlug: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Response from listing personal nodes.
 */
export interface ListPersonalNodesResponse {
  nodes: PersonalNodeView[];
  cursor?: string;
  total?: number;
}

/**
 * Response from listing personal edge types.
 */
export interface PersonalEdgeTypesResponse {
  edgeTypes: Array<{
    relationSlug: string;
    count: number;
  }>;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for personal graph queries.
 *
 * @example
 * ```typescript
 * // Invalidate all personal graph queries
 * queryClient.invalidateQueries({ queryKey: personalGraphKeys.all });
 *
 * // Invalidate nodes for a specific user
 * queryClient.invalidateQueries({ queryKey: personalGraphKeys.nodes(userDid) });
 * ```
 */
export const personalGraphKeys = {
  /** Base key for all personal graph queries */
  all: ['personal-graph'] as const,

  /** Key for personal nodes of a user */
  nodes: (did: string, params?: { subkind?: string }) =>
    [...personalGraphKeys.all, 'nodes', did, params] as const,

  /** Key for personal edge types of a user */
  edgeTypes: (did: string) => [...personalGraphKeys.all, 'edge-types', did] as const,
};

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Fetches personal graph nodes for a user, optionally filtered by subkind.
 *
 * @param did - DID of the user
 * @param options - Filter and hook options
 * @returns Query result with personal nodes
 *
 * @example
 * ```tsx
 * // All personal nodes
 * const { data } = usePersonalNodes(userDid);
 *
 * // Only concept nodes
 * const { data } = usePersonalNodes(userDid, { subkind: 'concept' });
 * ```
 */
export function usePersonalNodes(did: string, options?: { subkind?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: personalGraphKeys.nodes(did, { subkind: options?.subkind }),
    queryFn: async (): Promise<ListPersonalNodesResponse> => {
      try {
        const params: { limit: number; subkind?: string } = { limit: 100 };
        if (options?.subkind) {
          params.subkind = options.subkind;
        }
        const response = await authApi.pub.chive.graph.listPersonalNodes(params);
        return response.data as unknown as ListPersonalNodesResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch personal nodes',
          undefined,
          'pub.chive.graph.listPersonalNodes'
        );
      }
    },
    enabled: !!did && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches the distinct edge types (relation slugs) used in a user's personal graph.
 *
 * @param did - DID of the user
 * @param options - Hook options
 * @returns Query result with edge type counts
 *
 * @example
 * ```tsx
 * const { data } = usePersonalEdgeTypes(userDid);
 * // data.edgeTypes = [{ relationSlug: 'related-to', count: 5 }, ...]
 * ```
 */
export function usePersonalEdgeTypes(did: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: personalGraphKeys.edgeTypes(did),
    queryFn: async (): Promise<PersonalEdgeTypesResponse> => {
      try {
        const response = await authApi.pub.chive.graph.listPersonalEdgeTypes({});
        return response.data as unknown as PersonalEdgeTypesResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch edge types',
          undefined,
          'pub.chive.graph.listPersonalEdgeTypes'
        );
      }
    },
    enabled: !!did && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Mutation hook for creating a personal graph node.
 *
 * @remarks
 * Creates a graph node in the user's PDS and requests immediate indexing.
 *
 * @example
 * ```tsx
 * const createNode = useCreatePersonalNode();
 *
 * const handleCreate = async () => {
 *   await createNode.mutateAsync({
 *     kind: 'object',
 *     subkind: 'concept',
 *     label: 'Attention Mechanism',
 *   });
 * };
 * ```
 *
 * @returns Mutation object for creating personal nodes
 */
export function useCreatePersonalNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePersonalNodeInput): Promise<PersonalNodeView> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createPersonalNode');
      }

      const result = await createPersonalNode(agent, input);

      // Request immediate indexing
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (indexError) {
        logger.warn('Immediate indexing failed; firehose will handle', {
          uri: result.uri,
          error: indexError instanceof Error ? indexError.message : String(indexError),
        });
      }

      return {
        uri: result.uri,
        cid: result.cid,
        ownerDid: agent.did ?? '',
        kind: input.kind,
        subkind: input.subkind,
        label: input.label,
        description: input.description,
        metadata: input.metadata,
        status: 'established',
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: personalGraphKeys.nodes(data.ownerDid),
      });
    },
  });
}

/**
 * Mutation hook for creating a personal graph edge.
 *
 * @remarks
 * Creates a graph edge in the user's PDS linking two nodes.
 *
 * @example
 * ```tsx
 * const createEdge = useCreatePersonalEdge();
 *
 * const handleLink = async () => {
 *   await createEdge.mutateAsync({
 *     sourceUri: nodeAUri,
 *     targetUri: nodeBUri,
 *     relationSlug: 'related-to',
 *   });
 * };
 * ```
 *
 * @returns Mutation object for creating personal edges
 */
export function useCreatePersonalEdge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CreatePersonalEdgeInput & { ownerDid: string }
    ): Promise<PersonalEdgeView> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createPersonalEdge');
      }

      const result = await createPersonalEdge(agent, input);

      // Request immediate indexing
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (indexError) {
        logger.warn('Immediate indexing failed; firehose will handle', {
          uri: result.uri,
          error: indexError instanceof Error ? indexError.message : String(indexError),
        });
      }

      return {
        uri: result.uri,
        cid: result.cid,
        ownerDid: input.ownerDid,
        sourceUri: input.sourceUri,
        targetUri: input.targetUri,
        relationSlug: input.relationSlug,
        metadata: input.metadata,
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: personalGraphKeys.nodes(data.ownerDid),
      });
      queryClient.invalidateQueries({
        queryKey: personalGraphKeys.edgeTypes(data.ownerDid),
      });
    },
  });
}
