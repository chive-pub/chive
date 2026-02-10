/**
 * XRPC handler for pub.chive.review.listForAuthor.
 *
 * @remarks
 * Lists reviews created by a specific author with optional filtering.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  ReviewView,
} from '../../../../lexicons/generated/types/pub/chive/review/listForAuthor.js';
import type { DID } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.review.listForAuthor.
 *
 * @remarks
 * Returns a paginated list of reviews created by an author.
 *
 * @public
 */
export const listForAuthor: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const reviewService = c.get('services').review;

    logger.debug('Listing reviews for author', {
      reviewerDid: params.reviewerDid,
      limit: params.limit,
      cursor: params.cursor,
    });

    const result = await reviewService.listReviewsByAuthor(params.reviewerDid as DID, {
      limit: params.limit,
      cursor: params.cursor,
    });

    // Convert service ReviewView to API ReviewView
    const reviews: ReviewView[] = result.items.map((item) => ({
      uri: item.uri as string,
      cid: '', // CID is not stored in the service layer
      author: {
        did: item.author,
        handle: 'unknown', // Handle would need DID resolution
      },
      eprintUri: item.subject as string,
      content: item.text,
      body: undefined,
      target: undefined,
      motivation: 'commenting' as const,
      parentReviewUri: item.parent ?? undefined,
      replyCount: item.replyCount,
      createdAt: item.createdAt.toISOString(),
      indexedAt: item.createdAt.toISOString(), // Use createdAt as proxy
    }));

    const response: OutputSchema = {
      reviews,
      cursor: result.cursor,
      hasMore: result.hasMore,
      total: result.total,
    };

    logger.info('Reviews listed for author', {
      reviewerDid: params.reviewerDid,
      count: response.reviews.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
