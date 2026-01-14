/**
 * XRPC handler for pub.chive.notification.listReviewsOnMyPapers.
 *
 * @remarks
 * Lists reviews on papers where the authenticated user is an author.
 * Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  listReviewNotificationsParamsSchema,
  reviewNotificationsResponseSchema,
  type ListReviewNotificationsParams,
  type ReviewNotificationsResponse,
} from '../../../schemas/notification.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.notification.listReviewsOnMyPapers query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Paginated list of review notifications
 *
 * @public
 */
export async function listReviewsOnMyPapersHandler(
  c: Context<ChiveEnv>,
  params: ListReviewNotificationsParams
): Promise<ReviewNotificationsResponse> {
  const logger = c.get('logger');
  const reviewService = c.get('services').review;
  const user = c.get('user');

  if (!user?.did) {
    throw new Error('Authentication required');
  }

  logger.debug('Listing review notifications for author', {
    authorDid: user.did,
    limit: params.limit,
    cursor: params.cursor,
  });

  const result = await reviewService.listReviewsOnAuthorPapers(user.did, {
    limit: params.limit,
    cursor: params.cursor,
  });

  const response: ReviewNotificationsResponse = {
    notifications: result.items.map((item) => ({
      uri: item.uri,
      reviewerDid: item.reviewerDid,
      reviewerHandle: item.reviewerHandle,
      reviewerDisplayName: item.reviewerDisplayName,
      eprintUri: item.eprintUri,
      eprintTitle: item.eprintTitle,
      text: item.text,
      isReply: item.isReply,
      createdAt: item.createdAt.toISOString(),
    })),
    cursor: result.cursor,
    hasMore: result.hasMore,
    total: result.total,
  };

  logger.info('Review notifications listed', {
    authorDid: user.did,
    count: response.notifications.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.notification.listReviewsOnMyPapers.
 *
 * @public
 */
export const listReviewsOnMyPapersEndpoint: XRPCEndpoint<
  ListReviewNotificationsParams,
  ReviewNotificationsResponse
> = {
  method: 'pub.chive.notification.listReviewsOnMyPapers' as never,
  type: 'query',
  description: 'List reviews on papers where authenticated user is an author',
  inputSchema: listReviewNotificationsParamsSchema,
  outputSchema: reviewNotificationsResponseSchema,
  handler: listReviewsOnMyPapersHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
