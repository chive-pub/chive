/**
 * XRPC handler for pub.chive.review.getThread.
 *
 * @remarks
 * Gets a review thread including replies.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { ReviewView } from '../../../../services/review/review-service.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
import {
  getReviewThreadParamsSchema,
  reviewThreadSchema,
  type GetReviewThreadParams,
  type ReviewThread,
  type Review,
} from '../../../schemas/review.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Maps a service ReviewView to API Review format.
 *
 * @internal
 */
function mapToApiReview(review: ReviewView): Review {
  return {
    uri: review.uri,
    cid: '', // CID is not stored in the service layer
    author: {
      did: review.author,
      handle: 'unknown', // Handle would need DID resolution
    },
    eprintUri: review.subject,
    content: review.text,
    body: undefined,
    target: undefined,
    motivation: 'commenting' as const,
    parentReviewUri: review.parent ?? undefined,
    replyCount: review.replyCount,
    createdAt: review.createdAt.toISOString(),
    indexedAt: review.createdAt.toISOString(), // Use createdAt as proxy
  };
}

/**
 * Handler for pub.chive.review.getThread query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Review thread with replies
 *
 * @public
 */
export async function getThreadHandler(
  c: Context<ChiveEnv>,
  params: GetReviewThreadParams
): Promise<ReviewThread> {
  const logger = c.get('logger');
  const reviewService = c.get('services').review;

  logger.debug('Getting review thread', {
    uri: params.uri,
  });

  // Get the root review first
  const rootReview = await reviewService.getReviewByUri(params.uri as AtUri);

  if (!rootReview) {
    throw new NotFoundError('Review', params.uri);
  }

  // Get the full thread (root + all replies)
  const threadReviews = await reviewService.getReviewThread(params.uri as AtUri, 10);

  // The first item is the root, rest are replies
  const replies = threadReviews.slice(1);

  const response: ReviewThread = {
    parent: mapToApiReview(rootReview),
    replies: replies.map(mapToApiReview),
    totalReplies: replies.length,
  };

  logger.info('Review thread retrieved', {
    uri: params.uri,
    totalReplies: response.totalReplies,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.review.getThread.
 *
 * @public
 */
export const getThreadEndpoint: XRPCEndpoint<GetReviewThreadParams, ReviewThread> = {
  method: 'pub.chive.review.getThread' as never,
  type: 'query',
  description: 'Get a review thread with replies',
  inputSchema: getReviewThreadParamsSchema,
  outputSchema: reviewThreadSchema,
  handler: getThreadHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
