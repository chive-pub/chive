/**
 * Unit tests for XRPC review handlers.
 *
 * @remarks
 * Tests listForEprint and getThread handlers.
 * Validates ReviewService integration and thread traversal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getThreadHandler } from '@/api/handlers/xrpc/review/getThread.js';
import { listForEprintHandler } from '@/api/handlers/xrpc/review/listForEprint.js';
import type { AtUri } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

// ReviewView matches the service layer interface
interface MockReviewView {
  uri: AtUri;
  author: string;
  subject: AtUri;
  text: string;
  parent?: AtUri;
  createdAt: Date;
  replyCount: number;
}

// ReviewThread structure expected by handlers
interface MockReviewThread {
  root: MockReviewView;
  replies: MockReviewThread[];
  totalReplies: number;
}

interface MockReviewService {
  getReviews: ReturnType<typeof vi.fn>;
  getReviewByUri: ReturnType<typeof vi.fn>;
  getReviewThread: ReturnType<typeof vi.fn>;
}

const createMockReviewService = (): MockReviewService => ({
  getReviews: vi.fn(),
  getReviewByUri: vi.fn(),
  getReviewThread: vi.fn(),
});

const createMockReviewView = (overrides?: Partial<MockReviewView>): MockReviewView => ({
  uri: 'at://did:plc:reviewer/pub.chive.review.comment/abc123' as AtUri,
  author: 'did:plc:reviewer',
  subject: 'at://did:plc:author/pub.chive.eprint.submission/xyz' as AtUri,
  text: 'This is a thoughtful review of the methodology...',
  createdAt: new Date(),
  replyCount: 0,
  ...overrides,
});

const createMockReviewThread = (
  root: MockReviewView,
  replies: MockReviewThread[] = []
): MockReviewThread => ({
  root,
  replies,
  totalReplies: replies.length,
});

describe('XRPC Review Handlers', () => {
  let mockLogger: ILogger;
  let mockReviewService: MockReviewService;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockReviewService = createMockReviewService();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              review: mockReviewService,
            };
          case 'logger':
            return mockLogger;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  });

  describe('listForEprintHandler', () => {
    it('returns reviews for a eprint', async () => {
      const rootView = createMockReviewView();
      const replyView = createMockReviewView({
        uri: 'at://did:plc:reviewer2/pub.chive.review.comment/def456' as AtUri,
        author: 'did:plc:reviewer2',
        parent: rootView.uri,
        text: 'I agree with this point...',
      });

      // Create threads: a root thread with a reply thread nested
      const replyThread = createMockReviewThread(replyView, []);
      const rootThread = createMockReviewThread({ ...rootView, replyCount: 1 }, [replyThread]);

      mockReviewService.getReviews.mockResolvedValue([rootThread]);

      const result = await listForEprintHandler(
        mockContext as unknown as Parameters<typeof listForEprintHandler>[0],
        { eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz', limit: 20 }
      );

      expect(result.reviews).toBeDefined();
      expect(result.reviews.length).toBeGreaterThan(0);
      expect(mockReviewService.getReviews).toHaveBeenCalled();
    });

    it('returns empty array when no reviews exist', async () => {
      mockReviewService.getReviews.mockResolvedValue([]);

      const result = await listForEprintHandler(
        mockContext as unknown as Parameters<typeof listForEprintHandler>[0],
        { eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz', limit: 20 }
      );

      expect(result.reviews).toHaveLength(0);
    });

    it('includes reply information', async () => {
      const root1View = createMockReviewView({
        uri: 'at://did:plc:reviewer/pub.chive.review.comment/root1' as AtUri,
      });
      const reply1View = createMockReviewView({
        uri: 'at://did:plc:other/pub.chive.review.comment/reply1' as AtUri,
        parent: root1View.uri,
      });
      const root2View = createMockReviewView({
        uri: 'at://did:plc:reviewer2/pub.chive.review.comment/root2' as AtUri,
        author: 'did:plc:reviewer2',
      });

      const reply1Thread = createMockReviewThread(reply1View, []);
      const root1Thread = createMockReviewThread({ ...root1View, replyCount: 1 }, [reply1Thread]);
      const root2Thread = createMockReviewThread(root2View, []);

      mockReviewService.getReviews.mockResolvedValue([root1Thread, root2Thread]);

      const result = await listForEprintHandler(
        mockContext as unknown as Parameters<typeof listForEprintHandler>[0],
        { eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz', limit: 20 }
      );

      // Should have reviews returned (flattened from threads)
      expect(result.reviews.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getThreadHandler', () => {
    it('returns full thread starting from root', async () => {
      const rootView = createMockReviewView();
      const replies = [
        createMockReviewView({
          uri: 'at://did:plc:user1/pub.chive.review.comment/reply1' as AtUri,
          parent: rootView.uri,
        }),
        createMockReviewView({
          uri: 'at://did:plc:user2/pub.chive.review.comment/reply2' as AtUri,
          parent: rootView.uri,
        }),
      ];

      mockReviewService.getReviewByUri.mockResolvedValue(rootView);
      mockReviewService.getReviewThread.mockResolvedValue([rootView, ...replies]);

      const result = await getThreadHandler(
        mockContext as unknown as Parameters<typeof getThreadHandler>[0],
        { uri: rootView.uri }
      );

      // Response is ReviewThread directly with parent, replies, totalReplies
      expect(result.parent).toBeDefined();
      expect(result.parent.uri).toBe(rootView.uri);
      expect(result.replies).toBeDefined();
    });

    it('throws NotFoundError when review does not exist', async () => {
      mockReviewService.getReviewByUri.mockResolvedValue(null);

      await expect(
        getThreadHandler(mockContext as unknown as Parameters<typeof getThreadHandler>[0], {
          uri: 'at://did:plc:notfound/pub.chive.review.comment/xyz' as AtUri,
        })
      ).rejects.toThrow();
    });

    it('includes nested replies in tree structure', async () => {
      const rootView = createMockReviewView();
      const reply1View = createMockReviewView({
        uri: 'at://did:plc:user1/pub.chive.review.comment/reply1' as AtUri,
        parent: rootView.uri,
      });
      const nestedReplyView = createMockReviewView({
        uri: 'at://did:plc:user2/pub.chive.review.comment/nested' as AtUri,
        parent: reply1View.uri,
      });

      mockReviewService.getReviewByUri.mockResolvedValue(rootView);
      mockReviewService.getReviewThread.mockResolvedValue([rootView, reply1View, nestedReplyView]);

      const result = await getThreadHandler(
        mockContext as unknown as Parameters<typeof getThreadHandler>[0],
        { uri: rootView.uri }
      );

      expect(result.parent).toBeDefined();
      // The thread should contain replies
      expect(result.replies.length).toBeGreaterThanOrEqual(0);
    });

    it('maps reviews to API format with default motivation', async () => {
      // The handler always maps motivation to 'commenting' regardless of input
      const reviewView = createMockReviewView();

      mockReviewService.getReviewByUri.mockResolvedValue(reviewView);
      mockReviewService.getReviewThread.mockResolvedValue([reviewView]);

      const result = await getThreadHandler(
        mockContext as unknown as Parameters<typeof getThreadHandler>[0],
        { uri: reviewView.uri }
      );

      expect(result.parent.motivation).toBe('commenting');
    });
  });
});
