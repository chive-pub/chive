/**
 * React hooks for review data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for fetching, creating, and managing peer reviews.
 * Reviews support unlimited-depth threading and W3C-compliant text span targeting.
 *
 * @example
 * ```tsx
 * import { useReviews, useReviewThread, reviewKeys } from '@/lib/hooks/use-review';
 *
 * function EprintReviews({ eprintUri }: { eprintUri: string }) {
 *   const { data, isLoading } = useReviews(eprintUri);
 *
 *   if (isLoading) return <ReviewListSkeleton />;
 *   return <ReviewList reviews={data?.reviews ?? []} />;
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api, getApiBaseUrl } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  createReviewRecord,
  deleteRecord,
  type CreateReviewInput as RecordCreatorReviewInput,
} from '@/lib/atproto/record-creator';
import type {
  Review,
  ReviewsResponse,
  ReviewThread,
  TextSpanTarget,
  AnnotationBody,
  AnnotationMotivation,
} from '@/lib/api/schema';

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for review queries.
 *
 * @remarks
 * Follows TanStack Query best practices for hierarchical cache key management.
 * Enables fine-grained cache invalidation for review data.
 *
 * @example
 * ```typescript
 * // Invalidate all review queries
 * queryClient.invalidateQueries({ queryKey: reviewKeys.all });
 *
 * // Invalidate reviews for a specific eprint
 * queryClient.invalidateQueries({ queryKey: reviewKeys.forEprint(eprintUri) });
 *
 * // Invalidate a specific review thread
 * queryClient.invalidateQueries({ queryKey: reviewKeys.thread(reviewUri) });
 * ```
 */
export const reviewKeys = {
  /** Base key for all review queries */
  all: ['reviews'] as const,

  /** Key for reviews by eprint */
  forEprint: (eprintUri: string) => [...reviewKeys.all, 'eprint', eprintUri] as const,

  /** Key for reviews list with filters */
  list: (eprintUri: string, params?: ReviewListParams) =>
    [...reviewKeys.forEprint(eprintUri), 'list', params] as const,

  /** Key for review thread queries */
  threads: () => [...reviewKeys.all, 'thread'] as const,

  /** Key for specific review thread */
  thread: (reviewUri: string) => [...reviewKeys.threads(), reviewUri] as const,

  /** Key for inline reviews (span annotations) */
  inline: (eprintUri: string) => [...reviewKeys.forEprint(eprintUri), 'inline'] as const,

  /** Key for reviews by user */
  byUser: (did: string) => [...reviewKeys.all, 'user', did] as const,
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parameters for listing reviews.
 */
export interface ReviewListParams {
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Filter by motivation type */
  motivation?: AnnotationMotivation;
  /** Only include inline annotations (with target) */
  inlineOnly?: boolean;
}

/**
 * Options for the useReviews hook.
 */
export interface UseReviewsOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Input for creating a new review.
 */
export interface CreateReviewInput {
  /** AT-URI of the eprint to review */
  eprintUri: string;
  /** Plain text content */
  content: string;
  /** Rich text body (optional) */
  body?: AnnotationBody;
  /** Target span (optional) */
  target?: TextSpanTarget;
  /** Motivation */
  motivation?: AnnotationMotivation;
  /** Parent review URI for replies */
  parentReviewUri?: string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches reviews for a eprint.
 *
 * @remarks
 * Uses TanStack Query with a 1-minute stale time. Reviews are more dynamic
 * than eprints so they're revalidated more frequently.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useReviews(eprintUri);
 *
 * if (isLoading) return <ReviewListSkeleton />;
 * if (error) return <ReviewError error={error} />;
 *
 * return (
 *   <ReviewList
 *     reviews={data.reviews}
 *     hasMore={data.hasMore}
 *     total={data.total}
 *   />
 * );
 * ```
 *
 * @param eprintUri - AT-URI of the eprint
 * @param params - Query parameters (limit, cursor, motivation, inlineOnly)
 * @param options - Hook options
 * @returns Query result with reviews data
 *
 * @throws {Error} When the reviews API request fails
 */
export function useReviews(
  eprintUri: string,
  params: ReviewListParams = {},
  options: UseReviewsOptions = {}
) {
  return useQuery({
    queryKey: reviewKeys.list(eprintUri, params),
    queryFn: async (): Promise<ReviewsResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.review.listForEprint', {
        params: {
          query: {
            eprintUri,
            limit: params.limit ?? 20,
            cursor: params.cursor,
            motivation: params.motivation,
            inlineOnly: params.inlineOnly,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch reviews',
          undefined,
          '/xrpc/pub.chive.review.listForEprint'
        );
      }
      return data! as unknown as ReviewsResponse;
    },
    enabled: !!eprintUri && (options.enabled ?? true),
    staleTime: 60 * 1000, // 1 minute; reviews are more dynamic.
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches inline reviews (span annotations) for a eprint.
 *
 * @remarks
 * Returns only reviews that have a target text span.
 * Used for rendering annotation markers on the PDF viewer.
 *
 * @example
 * ```tsx
 * const { data } = useInlineReviews(eprintUri);
 *
 * return (
 *   <PDFAnnotationLayer annotations={data?.reviews ?? []} />
 * );
 * ```
 *
 * @param eprintUri - AT-URI of the eprint
 * @param options - Hook options
 * @returns Query result with inline reviews
 */
export function useInlineReviews(eprintUri: string, options: UseReviewsOptions = {}) {
  return useQuery({
    queryKey: reviewKeys.inline(eprintUri),
    queryFn: async (): Promise<ReviewsResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.review.listForEprint', {
        params: {
          query: {
            eprintUri,
            inlineOnly: true,
            limit: 100, // Get all inline reviews
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch inline reviews',
          undefined,
          '/xrpc/pub.chive.review.listForEprint'
        );
      }
      return data! as unknown as ReviewsResponse;
    },
    enabled: !!eprintUri && (options.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/**
 * Fetches a review thread (review with all nested replies).
 *
 * @remarks
 * Returns the full thread tree structure for unlimited-depth threading.
 * The thread includes the parent review and all recursive replies.
 *
 * @example
 * ```tsx
 * const { data } = useReviewThread(reviewUri);
 *
 * return (
 *   <ReviewThread
 *     parent={data?.parent}
 *     replies={data?.replies ?? []}
 *     totalReplies={data?.totalReplies ?? 0}
 *   />
 * );
 * ```
 *
 * @param reviewUri - AT-URI of the parent review
 * @param options - Hook options
 * @returns Query result with thread data
 */
export function useReviewThread(reviewUri: string, options: UseReviewsOptions = {}) {
  return useQuery({
    queryKey: reviewKeys.thread(reviewUri),
    queryFn: async (): Promise<ReviewThread> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.review.getThread', {
        params: { query: { uri: reviewUri } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch review thread',
          undefined,
          '/xrpc/pub.chive.review.getThread'
        );
      }
      return data! as unknown as ReviewThread;
    },
    enabled: !!reviewUri && (options.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/**
 * Mutation hook for creating a new review.
 *
 * @remarks
 * Creates a review in the user's PDS. Supports:
 * - General reviews (no target)
 * - Inline annotations (with target span)
 * - Threaded replies (with parentReviewUri)
 * - Rich text bodies with embedded references
 *
 * Automatically invalidates relevant queries on success.
 *
 * @example
 * ```tsx
 * const createReview = useCreateReview();
 *
 * const handleSubmit = async (content: string) => {
 *   await createReview.mutateAsync({
 *     eprintUri,
 *     content,
 *     motivation: 'commenting',
 *   });
 * };
 *
 * return (
 *   <ReviewForm
 *     onSubmit={handleSubmit}
 *     isSubmitting={createReview.isPending}
 *   />
 * );
 * ```
 *
 * @returns Mutation object for creating reviews
 */
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReviewInput): Promise<Review> => {
      // Write directly to PDS from browser using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createReview');
      }

      const result = await createReviewRecord(agent, {
        eprintUri: input.eprintUri,
        content: input.content,
        parentReviewUri: input.parentReviewUri,
      } as RecordCreatorReviewInput);

      // Return a Review-like object for cache management
      return {
        uri: result.uri,
        cid: result.cid,
        author: { did: '' },
        eprintUri: input.eprintUri,
        content: input.content,
        body: input.body,
        target: input.target,
        motivation: input.motivation,
        parentReviewUri: input.parentReviewUri,
        replyCount: 0,
        createdAt: new Date().toISOString(),
        indexedAt: new Date().toISOString(),
      } as unknown as Review;
    },
    onSuccess: (data) => {
      // Invalidate reviews for the eprint
      queryClient.invalidateQueries({
        queryKey: reviewKeys.forEprint(data.eprintUri),
      });

      // If this is a reply, also invalidate the parent thread
      if (data.parentReviewUri) {
        queryClient.invalidateQueries({
          queryKey: reviewKeys.thread(data.parentReviewUri),
        });
      }
    },
  });
}

/**
 * Mutation hook for deleting a review.
 *
 * @remarks
 * Deletes a review from the user's PDS. Only the review creator
 * can delete their own reviews.
 *
 * @example
 * ```tsx
 * const deleteReview = useDeleteReview();
 *
 * const handleDelete = async () => {
 *   await deleteReview.mutateAsync({
 *     uri: review.uri,
 *     eprintUri: review.eprintUri,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for deleting reviews
 */
export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri }: { uri: string; eprintUri: string }): Promise<void> => {
      // Delete directly from PDS using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'deleteReview');
      }

      await deleteRecord(agent, uri);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.forEprint(variables.eprintUri),
      });
    },
  });
}

/**
 * Hook for prefetching reviews on hover/focus.
 *
 * @remarks
 * Improves perceived performance by loading review data before
 * the user navigates to a eprint's reviews section.
 *
 * @example
 * ```tsx
 * const prefetchReviews = usePrefetchReviews();
 *
 * return (
 *   <TabsTrigger
 *     value="reviews"
 *     onMouseEnter={() => prefetchReviews(eprintUri)}
 *     onFocus={() => prefetchReviews(eprintUri)}
 *   >
 *     Reviews
 *   </TabsTrigger>
 * );
 * ```
 *
 * @returns Function to prefetch reviews for a eprint
 */
export function usePrefetchReviews() {
  const queryClient = useQueryClient();

  return (eprintUri: string) => {
    queryClient.prefetchQuery({
      queryKey: reviewKeys.list(eprintUri, {}),
      queryFn: async (): Promise<ReviewsResponse | undefined> => {
        const { data } = await api.GET('/xrpc/pub.chive.review.listForEprint', {
          params: { query: { eprintUri, limit: 20 } },
        });
        return data as unknown as ReviewsResponse | undefined;
      },
      staleTime: 60 * 1000,
    });
  };
}

// =============================================================================
// AUTHOR REVIEWS
// =============================================================================

/**
 * Options for the useAuthorReviews hook.
 */
export interface UseAuthorReviewsOptions {
  /** Maximum number of results per page */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches reviews created by a specific author.
 *
 * @remarks
 * Returns all reviews (both inline annotations and general comments)
 * created by the specified author, ordered by most recent first.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAuthorReviews(authorDid);
 *
 * if (isLoading) return <ReviewListSkeleton />;
 *
 * return (
 *   <ReviewList
 *     reviews={data?.reviews ?? []}
 *     hasMore={data?.hasMore}
 *   />
 * );
 * ```
 *
 * @param reviewerDid - DID of the author whose reviews to fetch
 * @param options - Query options
 * @returns Query result with paginated reviews
 */
export function useAuthorReviews(reviewerDid: string, options: UseAuthorReviewsOptions = {}) {
  const { limit = 20, cursor, enabled = true } = options;

  return useQuery({
    queryKey: [...reviewKeys.byUser(reviewerDid), { limit, cursor }],
    queryFn: async (): Promise<ReviewsResponse> => {
      // Use the proper API base URL to reach the backend directly
      const baseUrl = getApiBaseUrl();
      const response = await fetch(
        `${baseUrl}/xrpc/pub.chive.review.listForAuthor?reviewerDid=${encodeURIComponent(reviewerDid)}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch author reviews',
          response.status,
          '/xrpc/pub.chive.review.listForAuthor'
        );
      }

      return response.json();
    },
    enabled: !!reviewerDid && enabled,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}
