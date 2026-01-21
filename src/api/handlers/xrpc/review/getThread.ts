/**
 * XRPC handler for pub.chive.review.getThread.
 *
 * @remarks
 * Gets a review thread including replies.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  ReviewView as LexiconReviewView,
} from '../../../../lexicons/generated/types/pub/chive/review/getThread.js';
import type { ReviewView } from '../../../../services/review/review-service.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Maps a service ReviewView to API Review format.
 *
 * @internal
 */
function mapToApiReview(review: ReviewView): LexiconReviewView {
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
 * XRPC method for pub.chive.review.getThread.
 *
 * @remarks
 * Returns a review thread with all replies.
 *
 * @public
 */
export const getThread: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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

    const response: OutputSchema = {
      parent: mapToApiReview(rootReview),
      replies: replies.map(mapToApiReview),
      totalReplies: replies.length,
    };

    logger.info('Review thread retrieved', {
      uri: params.uri,
      totalReplies: response.totalReplies,
    });

    return { encoding: 'application/json', body: response };
  },
};
