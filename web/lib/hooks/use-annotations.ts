/**
 * React hooks for annotation data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for fetching, creating, and managing
 * annotations in the `pub.chive.annotation` namespace. Annotations
 * include inline comments with W3C-compliant text span targeting and
 * entity links that connect text spans to structured entities.
 *
 * @example
 * ```tsx
 * import { useAnnotations, useAnnotationThread, annotationKeys } from '@/lib/hooks/use-annotations';
 *
 * function EprintAnnotations({ eprintUri }: { eprintUri: string }) {
 *   const { data, isLoading } = useAnnotations(eprintUri);
 *
 *   if (isLoading) return <AnnotationListSkeleton />;
 *   return <AnnotationList annotations={data?.annotations ?? []} />;
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api, authApi } from '@/lib/api/client';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ context: { component: 'use-annotations' } });
import { APIError } from '@/lib/errors';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  createAnnotationRecord,
  createEntityLinkRecord,
  deleteRecord,
  type CreateAnnotationInput as RecordCreatorAnnotationInput,
  type CreateEntityLinkInput as RecordCreatorEntityLinkInput,
} from '@/lib/atproto/record-creator';
import type { UnifiedTextSpanTarget } from '@/lib/api/schema';

// =============================================================================
// LOCAL TYPES (until OpenAPI types are regenerated)
// =============================================================================

/**
 * Author reference in an annotation view.
 */
interface AnnotationAuthorRef {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

/**
 * View of an annotation comment as returned by the API.
 *
 * @remarks
 * Matches the output schema of `pub.chive.annotation.listForEprint`
 * and related endpoints. These types will be replaced by generated
 * types after OpenAPI regeneration.
 */
export interface AnnotationView {
  uri: string;
  cid: string;
  author: AnnotationAuthorRef;
  eprintUri: string;
  content: string;
  body?: { text: string; facets?: unknown[] };
  target: UnifiedTextSpanTarget;
  motivation: string;
  parentAnnotationUri?: string;
  replyCount: number;
  createdAt: string;
  indexedAt: string;
  deleted?: boolean;
}

/**
 * View of an entity link as returned by the API.
 */
export interface EntityLinkView {
  uri: string;
  cid: string;
  creator: AnnotationAuthorRef;
  eprintUri: string;
  target: UnifiedTextSpanTarget;
  linkedEntity: unknown;
  confidence?: number;
  createdAt: string;
  indexedAt: string;
}

/**
 * Response from the listForEprint annotation endpoint.
 */
export interface ListAnnotationsResponse {
  annotations: AnnotationView[];
  entityLinks?: EntityLinkView[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

/**
 * Response from the listForPage annotation endpoint.
 */
export interface ListAnnotationsForPageResponse {
  annotations: AnnotationView[];
  entityLinks?: EntityLinkView[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

/**
 * Annotation thread structure returned by getThread.
 */
export interface AnnotationThread {
  parent: AnnotationView;
  replies: AnnotationView[];
  totalReplies: number;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for annotation queries.
 *
 * @remarks
 * Follows TanStack Query best practices for hierarchical cache key management.
 * Enables fine-grained cache invalidation for annotation data.
 *
 * @example
 * ```typescript
 * // Invalidate all annotation queries
 * queryClient.invalidateQueries({ queryKey: annotationKeys.all });
 *
 * // Invalidate annotations for a specific eprint
 * queryClient.invalidateQueries({ queryKey: annotationKeys.forEprint(eprintUri) });
 *
 * // Invalidate a specific annotation thread
 * queryClient.invalidateQueries({ queryKey: annotationKeys.thread(annotationUri) });
 * ```
 */
export const annotationKeys = {
  /** Base key for all annotation queries */
  all: ['annotations'] as const,

  /** Key for annotations by eprint */
  forEprint: (eprintUri: string) => [...annotationKeys.all, 'eprint', eprintUri] as const,

  /** Key for annotations list with filters */
  list: (eprintUri: string, params?: AnnotationListParams) =>
    [...annotationKeys.forEprint(eprintUri), 'list', params] as const,

  /** Key for annotations on a specific page */
  forPage: (eprintUri: string, pageNumber: number) =>
    [...annotationKeys.forEprint(eprintUri), 'page', pageNumber] as const,

  /** Key for annotation thread queries */
  threads: () => [...annotationKeys.all, 'thread'] as const,

  /** Key for specific annotation thread */
  thread: (annotationUri: string) => [...annotationKeys.threads(), annotationUri] as const,

  /** Key for entity links by eprint */
  entityLinks: (eprintUri: string) =>
    [...annotationKeys.forEprint(eprintUri), 'entityLinks'] as const,
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parameters for listing annotations.
 */
export interface AnnotationListParams {
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Filter by motivation type */
  motivation?: string;
}

/**
 * Options for annotation query hooks.
 */
export interface UseAnnotationsOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Facet for rich text formatting in annotations.
 */
export interface AnnotationFacet {
  /** Byte range for the facet */
  index: {
    byteStart: number;
    byteEnd: number;
  };
  /** Features (e.g., link) */
  features: Array<{
    $type: string;
    uri?: string;
  }>;
}

/**
 * Input for creating a new annotation.
 */
export interface CreateAnnotationInput {
  /** AT-URI of the eprint to annotate */
  eprintUri: string;
  /** Plain text content */
  content: string;
  /** Target span (required for annotations) */
  target: UnifiedTextSpanTarget;
  /** Motivation */
  motivation?: string;
  /** Parent annotation URI for replies */
  parentAnnotationUri?: string;
  /** Optional facets for rich text (links, etc.) */
  facets?: AnnotationFacet[];
}

/**
 * Input for creating a new entity link.
 */
export interface CreateEntityLinkInput {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** Target span */
  target: UnifiedTextSpanTarget;
  /** Linked entity */
  linkedEntity: {
    $type: string;
    [key: string]: unknown;
  };
  /** Confidence score (0-1) */
  confidence?: number;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches annotations for an eprint.
 *
 * @remarks
 * Uses TanStack Query with a 1-minute stale time. Annotations are dynamic
 * content, so they are revalidated frequently.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useAnnotations(eprintUri);
 *
 * if (isLoading) return <AnnotationListSkeleton />;
 * if (error) return <AnnotationError error={error} />;
 *
 * return (
 *   <AnnotationList
 *     annotations={data.annotations}
 *     hasMore={data.hasMore}
 *     total={data.total}
 *   />
 * );
 * ```
 *
 * @param eprintUri - AT-URI of the eprint
 * @param params - Query parameters (limit, cursor, motivation)
 * @param options - Hook options
 * @returns Query result with annotations data
 *
 * @throws {Error} When the annotations API request fails
 */
export function useAnnotations(
  eprintUri: string,
  params: AnnotationListParams = {},
  options: UseAnnotationsOptions = {}
) {
  return useQuery({
    queryKey: annotationKeys.list(eprintUri, params),
    queryFn: async (): Promise<ListAnnotationsResponse> => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('eprintUri', eprintUri);
        if (params.limit) searchParams.set('limit', String(params.limit));
        if (params.cursor) searchParams.set('cursor', params.cursor);
        if (params.motivation) searchParams.set('motivation', params.motivation);

        // @ts-expect-error - annotation API types will be regenerated
        const response = await api.pub.chive.annotation.listForEprint({
          eprintUri,
          limit: params.limit ?? 20,
          cursor: params.cursor,
          motivation: params.motivation,
        });
        return response.data as unknown as ListAnnotationsResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch annotations',
          undefined,
          'pub.chive.annotation.listForEprint'
        );
      }
    },
    enabled: !!eprintUri && (options.enabled ?? true),
    staleTime: 60 * 1000, // 1 minute; annotations are dynamic.
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches annotations for a specific page of an eprint.
 *
 * @remarks
 * Returns annotations that target a specific page number.
 * Used for rendering annotation markers on a single PDF page.
 *
 * @example
 * ```tsx
 * const { data } = useAnnotationsForPage(eprintUri, 3);
 *
 * return (
 *   <PDFPageAnnotationLayer annotations={data?.annotations ?? []} />
 * );
 * ```
 *
 * @param eprintUri - AT-URI of the eprint
 * @param pageNumber - 1-indexed page number
 * @param options - Hook options
 * @returns Query result with page-scoped annotations
 */
export function useAnnotationsForPage(
  eprintUri: string,
  pageNumber: number,
  options: UseAnnotationsOptions = {}
) {
  return useQuery({
    queryKey: annotationKeys.forPage(eprintUri, pageNumber),
    queryFn: async (): Promise<ListAnnotationsForPageResponse> => {
      try {
        // @ts-expect-error - annotation API types will be regenerated
        const response = await api.pub.chive.annotation.listForPage({
          eprintUri,
          pageNumber,
        });
        return response.data as unknown as ListAnnotationsForPageResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch annotations for page',
          undefined,
          'pub.chive.annotation.listForPage'
        );
      }
    },
    enabled: !!eprintUri && pageNumber > 0 && (options.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/**
 * Fetches an annotation thread (annotation with all nested replies).
 *
 * @remarks
 * Returns the full thread tree structure for unlimited-depth threading.
 * The thread includes the parent annotation and all recursive replies.
 *
 * @example
 * ```tsx
 * const { data } = useAnnotationThread(annotationUri);
 *
 * return (
 *   <AnnotationThread
 *     parent={data?.parent}
 *     replies={data?.replies ?? []}
 *     totalReplies={data?.totalReplies ?? 0}
 *   />
 * );
 * ```
 *
 * @param uri - AT-URI of the parent annotation
 * @param options - Hook options
 * @returns Query result with thread data
 */
export function useAnnotationThread(uri: string, options: UseAnnotationsOptions = {}) {
  return useQuery({
    queryKey: annotationKeys.thread(uri),
    queryFn: async (): Promise<AnnotationThread> => {
      try {
        // @ts-expect-error - annotation API types will be regenerated
        const response = await api.pub.chive.annotation.getThread({ uri });
        return response.data as unknown as AnnotationThread;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch annotation thread',
          undefined,
          'pub.chive.annotation.getThread'
        );
      }
    },
    enabled: !!uri && (options.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/**
 * Mutation hook for creating a new annotation.
 *
 * @remarks
 * Creates an annotation comment record in the user's PDS. Annotations
 * require a target span (unlike general reviews, which may omit it).
 * Supports threaded replies via parentAnnotationUri.
 *
 * Automatically invalidates relevant queries on success.
 *
 * @example
 * ```tsx
 * const createAnnotation = useCreateAnnotation();
 *
 * const handleSubmit = async (content: string, target: UnifiedTextSpanTarget) => {
 *   await createAnnotation.mutateAsync({
 *     eprintUri,
 *     content,
 *     target,
 *     motivation: 'commenting',
 *   });
 * };
 *
 * return (
 *   <AnnotationForm
 *     onSubmit={handleSubmit}
 *     isSubmitting={createAnnotation.isPending}
 *   />
 * );
 * ```
 *
 * @returns Mutation object for creating annotations
 */
export function useCreateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAnnotationInput): Promise<AnnotationView> => {
      // Write directly to PDS from browser using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createAnnotation');
      }

      const result = await createAnnotationRecord(agent, {
        eprintUri: input.eprintUri,
        content: input.content,
        target: input.target,
        parentAnnotationUri: input.parentAnnotationUri,
        motivation: input.motivation,
        facets: input.facets,
      } as RecordCreatorAnnotationInput);

      // Request immediate indexing as a UX optimization.
      // The firehose is the primary indexing mechanism, but there may be latency.
      // This call ensures the record appears immediately in Chive's index.
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

      // Return an AnnotationView-like object for cache management
      return {
        uri: result.uri,
        cid: result.cid,
        author: { did: '' },
        eprintUri: input.eprintUri,
        content: input.content,
        target: input.target,
        motivation: input.motivation ?? 'commenting',
        parentAnnotationUri: input.parentAnnotationUri,
        replyCount: 0,
        createdAt: new Date().toISOString(),
        indexedAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      // Invalidate annotations for the eprint
      queryClient.invalidateQueries({
        queryKey: annotationKeys.forEprint(data.eprintUri),
      });

      // If this is a reply, also invalidate the parent thread
      if (data.parentAnnotationUri) {
        queryClient.invalidateQueries({
          queryKey: annotationKeys.thread(data.parentAnnotationUri),
        });
      }
    },
  });
}

/**
 * Mutation hook for creating an entity link.
 *
 * @remarks
 * Creates an entity link record in the user's PDS. Entity links
 * connect a text span in an eprint to a structured entity (e.g.,
 * a Wikidata item, a knowledge graph node, an author, or another eprint).
 *
 * Automatically invalidates relevant queries on success.
 *
 * @example
 * ```tsx
 * const createEntityLink = useCreateEntityLink();
 *
 * const handleLink = async (target: UnifiedTextSpanTarget, entity: LinkedEntity) => {
 *   await createEntityLink.mutateAsync({
 *     eprintUri,
 *     target,
 *     linkedEntity: entity,
 *     confidence: 0.95,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for creating entity links
 */
export function useCreateEntityLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEntityLinkInput): Promise<EntityLinkView> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createEntityLink');
      }

      const result = await createEntityLinkRecord(agent, {
        eprintUri: input.eprintUri,
        target: input.target,
        linkedEntity: input.linkedEntity,
        confidence: input.confidence,
      } as RecordCreatorEntityLinkInput);

      // Request immediate indexing as a UX optimization.
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
        creator: { did: '' },
        eprintUri: input.eprintUri,
        target: input.target,
        linkedEntity: input.linkedEntity,
        confidence: input.confidence,
        createdAt: new Date().toISOString(),
        indexedAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      // Invalidate annotations and entity links for the eprint
      queryClient.invalidateQueries({
        queryKey: annotationKeys.forEprint(data.eprintUri),
      });
    },
  });
}

/**
 * Mutation hook for deleting an annotation.
 *
 * @remarks
 * Deletes an annotation from the user's PDS and marks it as deleted in
 * Chive's index. Only the annotation creator can delete their own annotations.
 *
 * The deletion flow:
 * 1. Delete from user's PDS via ATProto
 * 2. Call sync.deleteRecord to mark as deleted in Chive's index immediately
 * 3. Firehose will eventually also process the deletion
 *
 * @example
 * ```tsx
 * const deleteAnnotation = useDeleteAnnotation();
 *
 * const handleDelete = async () => {
 *   await deleteAnnotation.mutateAsync({
 *     uri: annotation.uri,
 *     eprintUri: annotation.eprintUri,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for deleting annotations
 */
export function useDeleteAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri }: { uri: string; eprintUri: string }): Promise<void> => {
      // Delete directly from PDS using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'deleteAnnotation');
      }

      await deleteRecord(agent, uri);

      // Request immediate deletion indexing as a UX optimization.
      // The firehose is the primary deletion mechanism, but there may be latency.
      // This call ensures the deletion appears immediately in Chive's index.
      // If this fails, the firehose will eventually process the deletion.
      try {
        await authApi.pub.chive.sync.deleteRecord({ uri });
      } catch {
        // Silently ignore; firehose will handle the deletion eventually
        logger.warn('Immediate deletion indexing failed; firehose will handle', { uri });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.forEprint(variables.eprintUri),
      });
    },
  });
}
