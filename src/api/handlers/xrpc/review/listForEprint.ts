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
 * Author info resolved from authors_index.
 */
interface AuthorInfo {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Flattens a review thread tree into a list of reviews with author info lookup.
 *
 * @internal
 */
function flattenThreads(
  threads: readonly ServiceReviewThread[],
  authorMap: Map<string, AuthorInfo>
): ReviewView[] {
  const reviews: ReviewView[] = [];

  function processThread(thread: ServiceReviewThread): void {
    const root = thread.root;

    // Map anchor to target format expected by frontend
    let target: ReviewView['target'] = undefined;
    if (root.anchor) {
      target = {
        source: root.anchor.source ?? root.subject,
        // TextQuoteSelector requires type literal and exact string
        selector: root.anchor.selector?.exact
          ? {
              type: 'TextQuoteSelector' as const,
              exact: root.anchor.selector.exact,
              prefix: root.anchor.selector.prefix,
              suffix: root.anchor.selector.suffix,
            }
          : undefined,
        // TextPositionSelector requires type, start, end - pageNumber is optional
        // Use page field for backwards compatibility, or embed in refinedBy
        refinedBy: root.anchor.pageNumber
          ? {
              type: 'TextPositionSelector' as const,
              start: 0,
              end: 0,
              pageNumber: root.anchor.pageNumber,
            }
          : undefined,
        // Deprecated page field for backwards compatibility
        page: root.anchor.pageNumber,
      };
    }

    // Resolve author info from map
    const authorInfo = authorMap.get(root.author);

    reviews.push({
      uri: root.uri,
      cid: '', // CID is not stored in the service layer
      author: {
        did: root.author,
        handle: authorInfo?.handle ?? root.author.split(':').pop() ?? 'unknown',
        displayName: authorInfo?.displayName,
        avatar: authorInfo?.avatar,
      },
      eprintUri: root.subject,
      content: root.text,
      body: undefined,
      target,
      motivation: (root.motivation as ReviewView['motivation']) ?? 'commenting',
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
 * Collects all unique author DIDs from review threads.
 *
 * @internal
 */
function collectAuthorDids(threads: readonly ServiceReviewThread[]): Set<string> {
  const dids = new Set<string>();

  function processThread(thread: ServiceReviewThread): void {
    dids.add(thread.root.author);
    for (const reply of thread.replies) {
      processThread(reply);
    }
  }

  for (const thread of threads) {
    processThread(thread);
  }

  return dids;
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

    // Get threaded reviews
    const threads = await reviewService.getReviews(params.eprintUri as AtUri);

    // Collect unique author DIDs and batch resolve their info
    const authorDids = collectAuthorDids(threads);
    const authorInfoMap = await reviewService.getAuthorInfoByDids(authorDids);

    // Convert to AuthorInfo format
    const authorMap = new Map<string, AuthorInfo>();
    for (const entry of Array.from(authorInfoMap.entries())) {
      const [did, info] = entry;
      authorMap.set(did, {
        did,
        handle: info.handle,
        displayName: info.displayName,
        avatar: info.avatar,
      });
    }

    // Flatten threads with author info
    let allReviews = flattenThreads(threads, authorMap);

    // Filter to inline annotations only if requested
    if (params.inlineOnly) {
      allReviews = allReviews.filter((review) => review.target !== undefined);
    }

    // Filter by motivation if specified
    if (params.motivation) {
      allReviews = allReviews.filter((review) => review.motivation === params.motivation);
    }

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
