/**
 * XRPC handler for pub.chive.review.listForPreprint.
 *
 * @remarks
 * Lists reviews for a specific preprint with optional filtering.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { ReviewThread as ServiceReviewThread } from '../../../../services/review/review-service.js';
import type { AtUri } from '../../../../types/atproto.js';
import {
  listReviewsForPreprintParamsSchema,
  reviewsResponseSchema,
  type ListReviewsForPreprintParams,
  type ReviewsResponse,
} from '../../../schemas/review.js';
import type { Review } from '../../../schemas/review.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Flattens a review thread tree into a list of reviews.
 *
 * @internal
 */
function flattenThreads(threads: readonly ServiceReviewThread[]): Review[] {
  const reviews: Review[] = [];

  function processThread(thread: ServiceReviewThread): void {
    const root = thread.root;
    reviews.push({
      uri: root.uri,
      cid: '', // CID is not stored in the service layer
      author: {
        did: root.author,
        handle: 'unknown', // Handle would need DID resolution
      },
      preprintUri: root.subject,
      content: root.text,
      body: undefined,
      target: undefined,
      motivation: 'commenting' as const,
      parentReviewUri: root.parent ?? undefined,
      replyCount: root.replyCount,
      createdAt: root.createdAt.toISOString(),
      indexedAt: root.createdAt.toISOString(), // Use createdAt as proxy
    });

    // Process replies recursively
    for (const reply of thread.replies) {
      processThread(reply);
    }
  }

  for (const thread of threads) {
    processThread(thread);
  }

  return reviews;
}

/**
 * Handler for pub.chive.review.listForPreprint query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Paginated list of reviews
 *
 * @public
 */
export async function listForPreprintHandler(
  c: Context<ChiveEnv>,
  params: ListReviewsForPreprintParams
): Promise<ReviewsResponse> {
  const logger = c.get('logger');
  const reviewService = c.get('services').review;

  logger.debug('Listing reviews for preprint', {
    preprintUri: params.preprintUri,
    motivation: params.motivation,
    inlineOnly: params.inlineOnly,
    limit: params.limit,
    cursor: params.cursor,
  });

  // Get threaded reviews and flatten them
  const threads = await reviewService.getReviews(params.preprintUri as AtUri);
  const allReviews = flattenThreads(threads);

  // Apply pagination
  const limit = params.limit ?? 50;
  let startIndex = 0;

  // Handle cursor-based pagination (cursor is the index)
  if (params.cursor) {
    startIndex = parseInt(params.cursor, 10) || 0;
  }

  // Get total before any filtering
  const total = allReviews.length;

  // Slice for pagination
  const endIndex = startIndex + limit;
  const paginatedReviews = allReviews.slice(startIndex, endIndex);
  const hasMore = endIndex < allReviews.length;

  const response: ReviewsResponse = {
    reviews: paginatedReviews,
    cursor: hasMore ? String(endIndex) : undefined,
    hasMore,
    total,
  };

  logger.info('Reviews listed for preprint', {
    preprintUri: params.preprintUri,
    count: response.reviews.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.review.listForPreprint.
 *
 * @public
 */
export const listForPreprintEndpoint: XRPCEndpoint<ListReviewsForPreprintParams, ReviewsResponse> =
  {
    method: 'pub.chive.review.listForPreprint' as never,
    type: 'query',
    description: 'List reviews for a preprint',
    inputSchema: listReviewsForPreprintParamsSchema,
    outputSchema: reviewsResponseSchema,
    handler: listForPreprintHandler,
    auth: 'none',
    rateLimit: 'anonymous',
  };
