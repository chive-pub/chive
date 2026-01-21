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

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/notification/listReviewsOnMyPapers.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.notification.listReviewsOnMyPapers.
 *
 * @remarks
 * Returns paginated list of review notifications for the authenticated user's papers.
 *
 * @public
 */
export const listReviewsOnMyPapers: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const reviewService = c.get('services').review;
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
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

    const response: OutputSchema = {
      notifications: result.items.map((item) => ({
        uri: item.uri,
        eprintUri: item.eprintUri,
        eprintTitle: item.eprintTitle,
        reviewer: {
          did: item.reviewerDid,
          handle: item.reviewerHandle,
          displayName: item.reviewerDisplayName,
        },
        preview: item.text,
        createdAt: item.createdAt.toISOString(),
      })),
      cursor: result.cursor,
      unreadCount: result.total,
    };

    logger.info('Review notifications listed', {
      authorDid: user.did,
      count: response.notifications.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
