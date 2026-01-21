/**
 * XRPC handler for pub.chive.review.listForEprint.
 *
 * @remarks
 * Lists reviews for a specific eprint with optional filtering.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  ReviewView,
} from '../../../../lexicons/generated/types/pub/chive/review/listForEprint.js';
import type { ReviewThread as ServiceReviewThread } from '../../../../services/review/review-service.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Flattens a review thread tree into a list of reviews.
 *
 * @internal
 */
function flattenThreads(threads: readonly ServiceReviewThread[]): ReviewView[] {
  const reviews: ReviewView[] = [];

  function processThread(thread: ServiceReviewThread): void {
    const root = thread.root;
    reviews.push({
      uri: root.uri,
      cid: '', // CID is not stored in the service layer
      author: {
        did: root.author,
        handle: 'unknown', // Handle would need DID resolution
      },
      eprintUri: root.subject,
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
 * XRPC method for pub.chive.review.listForEprint.
 *
 * @remarks
 * Returns a paginated list of reviews for an eprint.
 *
 * @public
 */
export const listForEprint: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const reviewService = c.get('services').review;

    logger.debug('Listing reviews for eprint', {
      eprintUri: params.eprintUri,
      motivation: params.motivation,
      inlineOnly: params.inlineOnly,
      limit: params.limit,
      cursor: params.cursor,
    });

    // Get threaded reviews and flatten them
    const threads = await reviewService.getReviews(params.eprintUri as AtUri);
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

    const response: OutputSchema = {
      reviews: paginatedReviews,
      cursor: hasMore ? String(endIndex) : undefined,
      hasMore,
      total,
    };

    logger.info('Reviews listed for eprint', {
      eprintUri: params.eprintUri,
      count: response.reviews.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
