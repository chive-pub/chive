/**
 * Unit tests for ThreadingHandler.
 *
 * @remarks
 * Tests thread building, flattening, searching, and ancestor tracking.
 */

import { describe, it, expect } from 'vitest';

import type { ReviewView } from '@/services/review/review-service.js';
import { ThreadingHandler } from '@/services/review/threading-handler.js';
import type { AtUri } from '@/types/atproto.js';

const createMockReview = (overrides?: Partial<ReviewView>): ReviewView => ({
  uri: 'at://did:plc:reviewer/pub.chive.review.comment/r1' as AtUri,
  author: 'did:plc:reviewer',
  subject: 'at://did:plc:author/pub.chive.eprint.submission/p1' as AtUri,
  text: 'Test review',
  parent: undefined,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  replyCount: 0,
  ...overrides,
});

describe('ThreadingHandler', () => {
  describe('buildThreads', () => {
    it('returns empty array for empty input', () => {
      const handler = new ThreadingHandler();
      const threads = handler.buildThreads([]);

      expect(threads).toEqual([]);
    });

    it('builds single thread for review without replies', () => {
      const handler = new ThreadingHandler();
      const review = createMockReview();

      const threads = handler.buildThreads([review]);

      expect(threads).toHaveLength(1);
      const thread = threads[0];
      if (!thread) {
        throw new Error('Expected thread');
      }
      expect(thread.root).toEqual(review);
      expect(thread.replies).toHaveLength(0);
      expect(thread.totalReplies).toBe(0);
    });

    it('builds nested thread for review with replies', () => {
      const handler = new ThreadingHandler();

      const root = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
      });

      const reply1 = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        parent: root.uri,
        createdAt: new Date('2024-01-02T00:00:00Z'),
      });

      const reply2 = createMockReview({
        uri: 'at://did:plc:r3/pub.chive.review.comment/r3' as AtUri,
        parent: root.uri,
        createdAt: new Date('2024-01-03T00:00:00Z'),
      });

      const threads = handler.buildThreads([root, reply1, reply2]);

      expect(threads).toHaveLength(1);
      const thread = threads[0];
      if (!thread) {
        throw new Error('Expected thread');
      }
      expect(thread.root).toEqual(root);
      expect(thread.replies).toHaveLength(2);
      expect(thread.totalReplies).toBe(2);
    });

    it('builds deeply nested threads', () => {
      const handler = new ThreadingHandler();

      const root = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
      });

      const reply1 = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        parent: root.uri,
      });

      const reply1_1 = createMockReview({
        uri: 'at://did:plc:r3/pub.chive.review.comment/r3' as AtUri,
        parent: reply1.uri,
      });

      const threads = handler.buildThreads([root, reply1, reply1_1]);

      expect(threads).toHaveLength(1);
      const thread = threads[0];
      if (!thread) {
        throw new Error('Expected thread');
      }
      expect(thread.totalReplies).toBe(2);
      expect(thread.replies).toHaveLength(1);

      const nestedThread = thread.replies[0];
      if (!nestedThread) {
        throw new Error('Expected nested thread');
      }
      expect(nestedThread.root).toEqual(reply1);
      expect(nestedThread.replies).toHaveLength(1);
      expect(nestedThread.totalReplies).toBe(1);
    });

    it('builds multiple top-level threads', () => {
      const handler = new ThreadingHandler();

      const root1 = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });

      const root2 = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        createdAt: new Date('2024-01-02T00:00:00Z'),
      });

      const threads = handler.buildThreads([root1, root2]);

      expect(threads).toHaveLength(2);
      expect(threads[0]?.root).toEqual(root1);
      expect(threads[1]?.root).toEqual(root2);
    });

    it('treats reviews with non-existent parent as top-level', () => {
      const handler = new ThreadingHandler();

      const orphan = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
        parent: 'at://did:plc:nonexistent/pub.chive.review.comment/missing' as AtUri,
      });

      const threads = handler.buildThreads([orphan]);

      expect(threads).toHaveLength(1);
      expect(threads[0]?.root).toEqual(orphan);
    });

    it('sorts threads by date when enabled', () => {
      const handler = new ThreadingHandler({ sortByDate: true });

      const newer = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
        createdAt: new Date('2024-01-02T00:00:00Z'),
      });

      const older = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });

      const threads = handler.buildThreads([newer, older]);

      expect(threads[0]?.root).toEqual(older);
      expect(threads[1]?.root).toEqual(newer);
    });

    it('respects max depth limit', () => {
      const handler = new ThreadingHandler({ maxDepth: 1 });

      const r1 = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
      });

      const r2 = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        parent: r1.uri,
      });

      const r3 = createMockReview({
        uri: 'at://did:plc:r3/pub.chive.review.comment/r3' as AtUri,
        parent: r2.uri,
      });

      const threads = handler.buildThreads([r1, r2, r3]);

      const thread = threads[0];
      if (!thread) {
        throw new Error('Expected thread');
      }

      expect(thread.replies).toHaveLength(1);
      const nestedThread = thread.replies[0];
      if (!nestedThread) {
        throw new Error('Expected nested thread');
      }
      expect(nestedThread.replies).toHaveLength(0);
    });

    it('returns empty array when all reviews form closed loop', () => {
      const handler = new ThreadingHandler({ maxDepth: 5 });

      const r1 = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
        parent: 'at://did:plc:r3/pub.chive.review.comment/r3' as AtUri,
      });

      const r2 = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        parent: r1.uri,
      });

      const r3 = createMockReview({
        uri: 'at://did:plc:r3/pub.chive.review.comment/r3' as AtUri,
        parent: r2.uri,
      });

      const threads = handler.buildThreads([r1, r2, r3]);

      expect(threads).toEqual([]);
    });
  });

  describe('flattenThreads', () => {
    it('returns empty array for empty input', () => {
      const handler = new ThreadingHandler();
      const flat = handler.flattenThreads([]);

      expect(flat).toEqual([]);
    });

    it('flattens single thread without replies', () => {
      const handler = new ThreadingHandler();
      const review = createMockReview();
      const threads = handler.buildThreads([review]);

      const flat = handler.flattenThreads(threads);

      expect(flat).toEqual([review]);
    });

    it('flattens nested threads in depth-first order', () => {
      const handler = new ThreadingHandler();

      const root = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
      });

      const reply1 = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        parent: root.uri,
      });

      const reply1_1 = createMockReview({
        uri: 'at://did:plc:r3/pub.chive.review.comment/r3' as AtUri,
        parent: reply1.uri,
      });

      const threads = handler.buildThreads([root, reply1, reply1_1]);
      const flat = handler.flattenThreads(threads);

      expect(flat).toHaveLength(3);
      expect(flat[0]).toEqual(root);
      expect(flat[1]).toEqual(reply1);
      expect(flat[2]).toEqual(reply1_1);
    });

    it('excludes replies when includeReplies is false', () => {
      const handler = new ThreadingHandler();

      const root = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
      });

      const reply = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        parent: root.uri,
      });

      const threads = handler.buildThreads([root, reply]);
      const flat = handler.flattenThreads(threads, false);

      expect(flat).toEqual([root]);
    });
  });

  describe('findThread', () => {
    it('returns undefined for empty input', () => {
      const handler = new ThreadingHandler();
      const found = handler.findThread([], 'at://did:plc:r/pub.chive.review.comment/r' as AtUri);

      expect(found).toBeUndefined();
    });

    it('finds root thread', () => {
      const handler = new ThreadingHandler();
      const review = createMockReview();
      const threads = handler.buildThreads([review]);

      const found = handler.findThread(threads, review.uri);

      expect(found?.root).toEqual(review);
    });

    it('finds nested reply and returns root thread', () => {
      const handler = new ThreadingHandler();

      const root = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
      });

      const reply = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        parent: root.uri,
      });

      const threads = handler.buildThreads([root, reply]);
      const found = handler.findThread(threads, reply.uri);

      expect(found?.root).toEqual(root);
    });

    it('returns undefined for non-existent review', () => {
      const handler = new ThreadingHandler();
      const review = createMockReview();
      const threads = handler.buildThreads([review]);

      const found = handler.findThread(
        threads,
        'at://did:plc:nonexistent/pub.chive.review.comment/missing' as AtUri
      );

      expect(found).toBeUndefined();
    });
  });

  describe('getAncestors', () => {
    it('returns empty array for empty input', () => {
      const handler = new ThreadingHandler();
      const ancestors = handler.getAncestors(
        [],
        'at://did:plc:r/pub.chive.review.comment/r' as AtUri
      );

      expect(ancestors).toEqual([]);
    });

    it('returns single ancestor for root review', () => {
      const handler = new ThreadingHandler();
      const review = createMockReview();
      const threads = handler.buildThreads([review]);

      const ancestors = handler.getAncestors(threads, review.uri);

      expect(ancestors).toEqual([review]);
    });

    it('returns full ancestor path for nested reply', () => {
      const handler = new ThreadingHandler();

      const root = createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/r1' as AtUri,
      });

      const reply1 = createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/r2' as AtUri,
        parent: root.uri,
      });

      const reply1_1 = createMockReview({
        uri: 'at://did:plc:r3/pub.chive.review.comment/r3' as AtUri,
        parent: reply1.uri,
      });

      const threads = handler.buildThreads([root, reply1, reply1_1]);
      const ancestors = handler.getAncestors(threads, reply1_1.uri);

      expect(ancestors).toEqual([root, reply1, reply1_1]);
    });

    it('returns empty array for non-existent review', () => {
      const handler = new ThreadingHandler();
      const review = createMockReview();
      const threads = handler.buildThreads([review]);

      const ancestors = handler.getAncestors(
        threads,
        'at://did:plc:nonexistent/pub.chive.review.comment/missing' as AtUri
      );

      expect(ancestors).toEqual([]);
    });
  });
});
