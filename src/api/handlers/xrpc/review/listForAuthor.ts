/**
 * XRPC handler for pub.chive.review.listForAuthor.
 *
 * @remarks
 * Lists reviews created by a specific author with optional filtering.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { DID } from '../../../../types/atproto.js';
import {
  listReviewsForAuthorParamsSchema,
  reviewsResponseSchema,
  type ListReviewsForAuthorParams,
  type ReviewsResponse,
  type Review,
} from '../../../schemas/review.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.review.listForAuthor query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Paginated list of reviews by the author
 *
 * @public
 */
export async function listForAuthorHandler(
  c: Context<ChiveEnv>,
  params: ListReviewsForAuthorParams
): Promise<ReviewsResponse> {
  const logger = c.get('logger');
  const reviewService = c.get('services').review;

  logger.debug('Listing reviews for author', {
    reviewerDid: params.reviewerDid,
    motivation: params.motivation,
    inlineOnly: params.inlineOnly,
    limit: params.limit,
    cursor: params.cursor,
  });

  const result = await reviewService.listReviewsByAuthor(params.reviewerDid as DID, {
    limit: params.limit,
    cursor: params.cursor,
  });

  // Convert service ReviewView to API Review
  const reviews: Review[] = result.items.map((item) => ({
    uri: item.uri as string,
    cid: '', // CID is not stored in the service layer
    author: {
      did: item.author,
      handle: 'unknown', // Handle would need DID resolution
    },
    preprintUri: item.subject as string,
    content: item.text,
    body: undefined,
    target: undefined,
    motivation: 'commenting' as const,
    parentReviewUri: item.parent ?? undefined,
    replyCount: item.replyCount,
    createdAt: item.createdAt.toISOString(),
    indexedAt: item.createdAt.toISOString(), // Use createdAt as proxy
  }));

  const response: ReviewsResponse = {
    reviews,
    cursor: result.cursor,
    hasMore: result.hasMore,
    total: result.total,
  };

  logger.info('Reviews listed for author', {
    reviewerDid: params.reviewerDid,
    count: response.reviews.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.review.listForAuthor.
 *
 * @public
 */
export const listForAuthorEndpoint: XRPCEndpoint<ListReviewsForAuthorParams, ReviewsResponse> = {
  method: 'pub.chive.review.listForAuthor' as never,
  type: 'query',
  description: 'List reviews created by an author',
  inputSchema: listReviewsForAuthorParamsSchema,
  outputSchema: reviewsResponseSchema,
  handler: listForAuthorHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
