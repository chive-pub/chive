/**
 * React hooks for related works data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for fetching, creating, and deleting
 * user-curated related work links for eprints. Related work records are
 * stored in the user's PDS and indexed by Chive from the firehose.
 *
 * @example
 * ```tsx
 * import { useEprintRelatedWorks, useCreateRelatedWork, relatedWorkKeys } from '@/lib/hooks/use-related-works';
 *
 * function RelatedWorks({ eprintUri }: { eprintUri: string }) {
 *   const { data } = useEprintRelatedWorks(eprintUri);
 *   const createRelatedWork = useCreateRelatedWork();
 *
 *   return (
 *     <RelatedWorksList
 *       works={data?.relatedWorks ?? []}
 *       onAdd={(input) => createRelatedWork.mutateAsync(input)}
 *     />
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { authApi, getApiBaseUrl } from '@/lib/api/client';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ context: { component: 'use-related-works' } });
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  createRelatedWorkRecord,
  deleteRecord,
  type CreateRelatedWorkInput as RecordCreatorRelatedWorkInput,
} from '@/lib/atproto/record-creator';

// =============================================================================
// LOCAL TYPES (until OpenAPI types are regenerated)
// =============================================================================

/**
 * Author reference in a related work view.
 */
interface RelatedWorkAuthorRef {
  did: string;
  handle?: string;
  displayName?: string;
}

/**
 * View of a related work as returned by the API.
 *
 * @remarks
 * Matches the output schema of `pub.chive.eprint.listRelatedWorks`.
 * These types will be replaced by generated types after OpenAPI regeneration.
 */
export interface RelatedWorkView {
  uri: string;
  cid: string;
  author: RelatedWorkAuthorRef;
  eprintUri: string;
  relatedUri: string;
  relationType: string;
  description?: string;
  /** Resolved title of the related eprint (if indexed in Chive) */
  relatedTitle?: string;
  /** Resolved authors of the related eprint */
  relatedAuthors?: string[];
  createdAt: string;
  indexedAt: string;
}

/**
 * Response from the listRelatedWorks endpoint.
 */
export interface ListRelatedWorksResponse {
  relatedWorks: RelatedWorkView[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for related work queries.
 *
 * @remarks
 * Follows TanStack Query best practices for hierarchical cache key management.
 *
 * @example
 * ```typescript
 * // Invalidate all related work queries
 * queryClient.invalidateQueries({ queryKey: relatedWorkKeys.all });
 *
 * // Invalidate related works for a specific eprint
 * queryClient.invalidateQueries({ queryKey: relatedWorkKeys.forEprint(eprintUri) });
 * ```
 */
export const relatedWorkKeys = {
  /** Base key for all related work queries */
  all: ['related-works'] as const,

  /** Key for related works by eprint */
  forEprint: (uri: string) => [...relatedWorkKeys.all, 'eprint', uri] as const,
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for related work query hooks.
 */
export interface UseRelatedWorksOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Input for creating a new related work link.
 */
export interface CreateRelatedWorkInput {
  /** AT-URI of the source eprint */
  eprintUri: string;
  /** AT-URI of the related eprint */
  relatedUri: string;
  /** Type of relationship (e.g., 'extends', 'replicates', 'contradicts') */
  relationType: string;
  /** Optional description of the relationship */
  description?: string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches user-curated related works for an eprint.
 *
 * @remarks
 * Returns related work links that users have created.
 * Uses a 2-minute stale time.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useEprintRelatedWorks(eprintUri);
 *
 * return (
 *   <RelatedWorksList
 *     works={data?.relatedWorks ?? []}
 *     total={data?.total ?? 0}
 *   />
 * );
 * ```
 *
 * @param eprintUri - AT-URI of the eprint
 * @param options - Hook options (enabled)
 * @returns Query result with related works data
 */
export function useEprintRelatedWorks(eprintUri: string, options: UseRelatedWorksOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: relatedWorkKeys.forEprint(eprintUri),
    queryFn: async (): Promise<ListRelatedWorksResponse> => {
      try {
        // Use direct fetch since the generated XRPC client may not include this
        // endpoint yet (backend is being developed in parallel).
        const searchParams = new URLSearchParams({ eprintUri });
        const baseUrl = getApiBaseUrl();
        const url = `${baseUrl}/xrpc/pub.chive.eprint.listRelatedWorks?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string' ? body['message'] : 'Failed to fetch related works',
            response.status,
            'pub.chive.eprint.listRelatedWorks'
          );
        }
        return (await response.json()) as ListRelatedWorksResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch related works',
          undefined,
          'pub.chive.eprint.listRelatedWorks'
        );
      }
    },
    enabled: !!eprintUri && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Mutation hook for creating a new related work link.
 *
 * @remarks
 * Creates a related work record in the user's PDS and requests
 * immediate indexing for UI responsiveness. Falls back to
 * firehose indexing if immediate indexing fails.
 *
 * @example
 * ```tsx
 * const createRelatedWork = useCreateRelatedWork();
 *
 * const handleAdd = async (relatedUri: string) => {
 *   await createRelatedWork.mutateAsync({
 *     eprintUri,
 *     relatedUri,
 *     relationType: 'extends',
 *     description: 'Builds on the framework from this paper.',
 *   });
 * };
 * ```
 *
 * @returns Mutation object for creating related work links
 */
export function useCreateRelatedWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRelatedWorkInput): Promise<RelatedWorkView> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createRelatedWork');
      }

      const result = await createRelatedWorkRecord(agent, {
        eprintUri: input.eprintUri,
        relatedUri: input.relatedUri,
        relationType: input.relationType,
        description: input.description,
      } as RecordCreatorRelatedWorkInput);

      // Request immediate indexing as a UX optimization.
      // The firehose is the primary indexing mechanism, but there may be latency.
      // This call ensures the related work appears immediately in Chive's index.
      // If this fails, the firehose will eventually index the record.
      try {
        const indexResult = await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        if (indexResult.data && !indexResult.data.indexed) {
          logger.warn('Immediate indexing returned failure', {
            uri: result.uri,
            error: indexResult.data.error,
          });
        } else {
          logger.info('Immediate indexing succeeded', { uri: result.uri });
        }
        // Small delay to ensure the database transaction is fully committed
        // before the query invalidation triggers a refetch
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (indexError) {
        // Log with details but don't throw; firehose will index eventually
        logger.warn('Immediate indexing failed; firehose will handle', {
          uri: result.uri,
          error: indexError instanceof Error ? indexError.message : String(indexError),
        });
      }

      // Return a RelatedWorkView-like object for cache management
      return {
        uri: result.uri,
        cid: result.cid,
        author: { did: agent.did ?? '' },
        eprintUri: input.eprintUri,
        relatedUri: input.relatedUri,
        relationType: input.relationType,
        description: input.description,
        createdAt: new Date().toISOString(),
        indexedAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: relatedWorkKeys.forEprint(data.eprintUri),
      });
    },
  });
}

/**
 * Mutation hook for deleting a related work link.
 *
 * @remarks
 * Deletes a related work record from the user's PDS. Only the
 * link creator can delete their own related work entries.
 *
 * @example
 * ```tsx
 * const deleteRelatedWork = useDeleteRelatedWork();
 *
 * const handleDelete = async () => {
 *   await deleteRelatedWork.mutateAsync({
 *     uri: relatedWork.uri,
 *     eprintUri: relatedWork.eprintUri,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for deleting related work links
 */
export function useDeleteRelatedWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri }: { uri: string; eprintUri: string }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'deleteRelatedWork');
      }

      await deleteRecord(agent, uri);

      // Request immediate deletion indexing as a UX optimization.
      try {
        await authApi.pub.chive.sync.deleteRecord({ uri });
      } catch {
        logger.warn('Immediate deletion indexing failed; firehose will handle', { uri });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: relatedWorkKeys.forEprint(variables.eprintUri),
      });
    },
  });
}
