/**
 * Threading handler for building hierarchical review discussion trees.
 *
 * @remarks
 * Builds threaded discussion trees from flat review lists. Handles parent-child
 * relationships, reply counting, and circular reference detection.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';

import type { ReviewThread, ReviewView } from './review-service.js';

/**
 * Threading handler configuration.
 *
 * @public
 */
export interface ThreadingHandlerOptions {
  /**
   * Maximum tree depth to prevent infinite recursion.
   *
   * @defaultValue 20
   */
  readonly maxDepth?: number;

  /**
   * Whether to sort replies by date (oldest first).
   *
   * @defaultValue true
   */
  readonly sortByDate?: boolean;
}

/**
 * Threading handler for review discussion trees.
 *
 * @remarks
 * Converts flat review lists into threaded tree structures. Top-level reviews
 * (no parent) become root nodes. Replies are nested under parents.
 *
 * Prevents circular references by tracking visited nodes. Limits depth to
 * prevent stack overflow.
 *
 * @example
 * ```typescript
 * const handler = new ThreadingHandler({ maxDepth: 20, sortByDate: true });
 *
 * const flatReviews: ReviewView[] = [
 *   { uri: 'at://did:plc:a/review/1', parent: undefined, ... },
 *   { uri: 'at://did:plc:b/review/2', parent: 'at://did:plc:a/review/1', ... },
 *   { uri: 'at://did:plc:c/review/3', parent: 'at://did:plc:a/review/1', ... }
 * ];
 *
 * const threads = handler.buildThreads(flatReviews);
 * // Returns 1 thread with 2 replies
 * ```
 *
 * @public
 */
export class ThreadingHandler {
  private readonly maxDepth: number;
  private readonly sortByDate: boolean;

  constructor(options: ThreadingHandlerOptions = {}) {
    this.maxDepth = options.maxDepth ?? 20;
    this.sortByDate = options.sortByDate ?? true;
  }

  /**
   * Builds threaded discussion trees from flat review list.
   *
   * @param reviews - Flat list of reviews
   * @returns Top-level threads (reviews with no parent)
   *
   * @remarks
   * Tree building process:
   * 1. Group reviews by parent URI
   * 2. Identify top-level reviews (no parent)
   * 3. Recursively build subtrees for each top-level review
   * 4. Calculate total reply counts
   * 5. Sort by date if enabled
   *
   * Circular references are detected and treated as top-level reviews.
   *
   * @example
   * ```typescript
   * const threads = handler.buildThreads(reviews);
   *
   * threads.forEach(thread => {
   *   console.log(`${thread.root.text} (${thread.totalReplies} replies)`);
   *   thread.replies.forEach(reply => {
   *     console.log(`  - ${reply.root.text}`);
   *   });
   * });
   * ```
   *
   * @public
   */
  buildThreads(reviews: readonly ReviewView[]): readonly ReviewThread[] {
    if (reviews.length === 0) {
      return [];
    }

    // Build lookup maps
    const reviewMap = new Map<AtUri, ReviewView>();
    const childrenMap = new Map<AtUri, ReviewView[]>();

    for (const review of reviews) {
      reviewMap.set(review.uri, review);

      if (review.parent) {
        const siblings = childrenMap.get(review.parent) ?? [];
        siblings.push(review);
        childrenMap.set(review.parent, siblings);
      }
    }

    // Find top-level reviews (no parent or parent not in list)
    const topLevel: ReviewView[] = [];

    for (const review of reviews) {
      if (!review.parent || !reviewMap.has(review.parent)) {
        topLevel.push(review);
      }
    }

    // Build threads for top-level reviews
    const threads: ReviewThread[] = [];
    const visited = new Set<AtUri>();

    for (const root of topLevel) {
      const thread = this.buildThread(root, childrenMap, visited, 0);
      threads.push(thread);
    }

    // Sort threads by date if enabled
    if (this.sortByDate) {
      threads.sort((a, b) => a.root.createdAt.getTime() - b.root.createdAt.getTime());
    }

    return threads;
  }

  /**
   * Builds single thread recursively.
   *
   * @param root - Root review of thread
   * @param childrenMap - Map of parent URI to child reviews
   * @param visited - Set of visited URIs (circular reference detection)
   * @param depth - Current depth (stack overflow protection)
   * @returns Thread with nested replies
   *
   * @throws {@link ValidationError}
   * When circular reference is detected.
   *
   * @private
   */
  private buildThread(
    root: ReviewView,
    childrenMap: Map<AtUri, ReviewView[]>,
    visited: Set<AtUri>,
    depth: number
  ): ReviewThread {
    // Check depth limit
    if (depth >= this.maxDepth) {
      return {
        root,
        replies: [],
        totalReplies: 0,
      };
    }

    // Check circular reference
    if (visited.has(root.uri)) {
      throw new ValidationError('Circular reference detected in review thread', 'parent');
    }

    visited.add(root.uri);

    // Get children
    const children = childrenMap.get(root.uri) ?? [];

    // Sort children by date if enabled
    const sortedChildren = this.sortByDate
      ? [...children].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      : children;

    // Build subtrees recursively
    const replies: ReviewThread[] = [];
    let totalReplies = children.length;

    for (const child of sortedChildren) {
      const childThread = this.buildThread(child, childrenMap, visited, depth + 1);
      replies.push(childThread);
      totalReplies += childThread.totalReplies;
    }

    visited.delete(root.uri);

    return {
      root,
      replies,
      totalReplies,
    };
  }

  /**
   * Flattens thread tree into ordered list.
   *
   * @param threads - Thread trees
   * @param includeReplies - Whether to include nested replies
   * @returns Flat list of reviews in tree order
   *
   * @remarks
   * Performs depth-first traversal of thread tree. Useful for:
   * - Exporting discussions
   * - Searching within threads
   * - Pagination of nested discussions
   *
   * @example
   * ```typescript
   * const flat = handler.flattenThreads(threads, true);
   * // Returns [root1, reply1, reply1.1, root2, reply2, ...]
   * ```
   *
   * @public
   */
  flattenThreads(threads: readonly ReviewThread[], includeReplies = true): readonly ReviewView[] {
    const result: ReviewView[] = [];

    for (const thread of threads) {
      result.push(thread.root);

      if (includeReplies) {
        const nested = this.flattenThreads(thread.replies, true);
        result.push(...nested);
      }
    }

    return result;
  }

  /**
   * Finds thread containing specific review.
   *
   * @param threads - Thread trees to search
   * @param reviewUri - URI of review to find
   * @returns Thread containing review, or undefined
   *
   * @remarks
   * Searches recursively through all threads and replies. Returns the
   * entire thread tree containing the review, not just the review itself.
   *
   * @example
   * ```typescript
   * const thread = handler.findThread(threads, replyUri);
   * if (thread) {
   *   console.log(`Found in thread: ${thread.root.uri}`);
   * }
   * ```
   *
   * @public
   */
  findThread(threads: readonly ReviewThread[], reviewUri: AtUri): ReviewThread | undefined {
    for (const thread of threads) {
      if (thread.root.uri === reviewUri) {
        return thread;
      }

      const found = this.findThread(thread.replies, reviewUri);
      if (found) {
        return thread; // Return root thread, not subtree
      }
    }

    return undefined;
  }

  /**
   * Gets thread ancestors (path from root to review).
   *
   * @param threads - Thread trees
   * @param reviewUri - URI of target review
   * @returns Array of ancestor reviews from root to target
   *
   * @remarks
   * Returns empty array if review not found. Useful for breadcrumb
   * navigation in threaded discussions.
   *
   * @example
   * ```typescript
   * const path = handler.getAncestors(threads, deepReplyUri);
   * // Returns [rootReview, parentReview, targetReview]
   * ```
   *
   * @public
   */
  getAncestors(threads: readonly ReviewThread[], reviewUri: AtUri): readonly ReviewView[] {
    for (const thread of threads) {
      if (thread.root.uri === reviewUri) {
        return [thread.root];
      }

      const path = this.getAncestors(thread.replies, reviewUri);
      if (path.length > 0) {
        return [thread.root, ...path];
      }
    }

    return [];
  }
}
