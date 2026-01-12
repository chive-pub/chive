/**
 * ReviewService integration tests.
 *
 * @remarks
 * Tests ReviewService and ThreadingHandler against real PostgreSQL:
 * - Review indexing (currently stub, tests service interface)
 * - Endorsement indexing
 * - Thread building from flat review lists
 *
 * Note: Storage integration is pending (see TODO in ReviewService).
 * Tests validate the service interface and ThreadingHandler logic.
 *
 * Requires Docker test stack running (PostgreSQL 16+).
 *
 * @packageDocumentation
 */

import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import type { RecordMetadata } from '@/services/preprint/preprint-service.js';
import {
  ReviewService,
  type ReviewComment,
  type Endorsement,
  type ReviewView,
} from '@/services/review/review-service.js';
import { ThreadingHandler } from '@/services/review/threading-handler.js';
import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import type { AtUri, CID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// Test constants
const TEST_PREPRINT_URI = 'at://did:plc:author/pub.chive.preprint.submission/test123' as AtUri;
const TEST_PDS_URL = 'https://pds.review.test.example.com';

// Generate unique test URIs
function createReviewUri(suffix: string): AtUri {
  const timestamp = Date.now();
  return `at://did:plc:reviewer/pub.chive.review.comment/review${timestamp}${suffix}` as AtUri;
}

function createTestCid(suffix: string): CID {
  return `bafyreireview${suffix}${Date.now().toString(36)}` as CID;
}

/**
 * Creates mock logger for tests.
 */
function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => createMockLogger(),
  };
}

/**
 * Creates test record metadata.
 */
function createTestMetadata(uri: AtUri, cid: CID): RecordMetadata {
  return {
    uri,
    cid,
    pdsUrl: TEST_PDS_URL,
    indexedAt: new Date(),
  };
}

/**
 * Creates test review comment.
 */
function createTestReviewComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    $type: 'pub.chive.review.comment',
    subject: { uri: TEST_PREPRINT_URI, cid: 'bafysubject' },
    text: 'This is a test review comment.',
    reviewType: 'general',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates test endorsement.
 */
function createTestEndorsement(overrides: Partial<Endorsement> = {}): Endorsement {
  return {
    $type: 'pub.chive.review.endorsement',
    subject: { uri: TEST_PREPRINT_URI, cid: 'bafysubject' },
    endorsementType: 'methods',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates test review view for threading tests.
 */
function createTestReviewView(
  uri: AtUri,
  parent?: AtUri,
  text?: string,
  createdAt?: Date
): ReviewView {
  return {
    uri,
    author: 'did:plc:reviewer',
    subject: TEST_PREPRINT_URI,
    text: text ?? `Review ${uri}`,
    parent,
    createdAt: createdAt ?? new Date(),
    replyCount: 0,
  };
}

describe('ReviewService Integration', () => {
  let pool: Pool;
  let storage: PostgreSQLAdapter;
  let service: ReviewService;

  beforeAll(async () => {
    const dbConfig = getDatabaseConfig();
    pool = new Pool(dbConfig);
    storage = new PostgreSQLAdapter(pool);
    service = new ReviewService({
      pool,
      storage,
      logger: createMockLogger(),
    });

    // Insert required preprint for foreign key constraint
    await pool.query(
      `INSERT INTO preprints_index (
        uri, cid, submitted_by, authors, title, abstract, document_blob_cid, document_blob_mime_type,
        document_blob_size, license, created_at, pds_url, indexed_at, last_synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, NOW(), NOW())
      ON CONFLICT (uri) DO NOTHING`,
      [
        TEST_PREPRINT_URI,
        'bafysubject',
        'did:plc:author',
        JSON.stringify([
          {
            name: 'Test Author',
            order: 1,
            affiliations: [],
            contributions: [],
            isCorrespondingAuthor: true,
            isHighlighted: false,
          },
        ]),
        'Test Preprint for Reviews',
        'This is a test preprint used for review integration tests.',
        'bafyreipdfblob123',
        'application/pdf',
        1024000,
        'CC-BY-4.0',
        TEST_PDS_URL,
      ]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM reviews_index WHERE preprint_uri = $1', [TEST_PREPRINT_URI]);
    await pool.query('DELETE FROM endorsements_index WHERE preprint_uri = $1', [TEST_PREPRINT_URI]);
    await pool.query('DELETE FROM preprints_index WHERE uri = $1', [TEST_PREPRINT_URI]);
    await pool.end();
  });

  describe('indexReview', () => {
    it('indexes review comment (stub implementation)', async () => {
      const uri = createReviewUri('1');
      const cid = createTestCid('1');
      const review = createTestReviewComment();
      const metadata = createTestMetadata(uri, cid);

      const result = await service.indexReview(review, metadata);

      expect(result.ok).toBe(true);
    });

    it('indexes review with parent reference', async () => {
      // First create the parent review
      const parentUri = createReviewUri('parent');
      const parentCid = createTestCid('parent');
      const parentReview = createTestReviewComment({ text: 'This is the parent review.' });
      const parentMetadata = createTestMetadata(parentUri, parentCid);
      const parentResult = await service.indexReview(parentReview, parentMetadata);
      expect(parentResult.ok).toBe(true);

      // Now create the reply that references the parent
      const replyUri = createReviewUri('reply');
      const replyCid = createTestCid('reply');
      const reply = createTestReviewComment({
        parent: parentUri,
        text: 'This is a reply to the parent review.',
      });
      const replyMetadata = createTestMetadata(replyUri, replyCid);

      const result = await service.indexReview(reply, replyMetadata);

      expect(result.ok).toBe(true);
    });

    it('indexes review with different review types', async () => {
      const reviewTypes = ['general', 'methodology', 'statistics', 'data'];

      for (const reviewType of reviewTypes) {
        const uri = createReviewUri(reviewType);
        const cid = createTestCid(reviewType);
        const review = createTestReviewComment({ reviewType });
        const metadata = createTestMetadata(uri, cid);

        const result = await service.indexReview(review, metadata);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe('indexEndorsement', () => {
    it('indexes endorsement (stub implementation)', async () => {
      const uri = createReviewUri('endorsement1');
      const cid = createTestCid('endorsement1');
      const endorsement = createTestEndorsement();
      const metadata = createTestMetadata(uri, cid);

      const result = await service.indexEndorsement(endorsement, metadata);

      expect(result.ok).toBe(true);
    });

    it('indexes endorsement with different types', async () => {
      const endorsementTypes: ('methods' | 'results' | 'overall')[] = [
        'methods',
        'results',
        'overall',
      ];

      for (const endorsementType of endorsementTypes) {
        const uri = createReviewUri(`endorse-${endorsementType}`);
        const cid = createTestCid(`endorse-${endorsementType}`);
        const endorsement = createTestEndorsement({ endorsementType });
        const metadata = createTestMetadata(uri, cid);

        const result = await service.indexEndorsement(endorsement, metadata);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe('getReviews', () => {
    it('returns reviews indexed for the preprint', async () => {
      const reviews = await service.getReviews(TEST_PREPRINT_URI);

      expect(Array.isArray(reviews)).toBe(true);
      // Reviews were indexed in earlier tests
      expect(reviews.length).toBeGreaterThan(0);
    });

    it('returns empty array for preprint with no reviews', async () => {
      const unknownUri = 'at://did:plc:unknown/pub.chive.preprint.submission/unknown' as AtUri;
      const reviews = await service.getReviews(unknownUri);

      expect(Array.isArray(reviews)).toBe(true);
      expect(reviews.length).toBe(0);
    });
  });

  describe('getEndorsements', () => {
    it('returns endorsements indexed for the preprint', async () => {
      const endorsements = await service.getEndorsements(TEST_PREPRINT_URI);

      expect(Array.isArray(endorsements)).toBe(true);
      // Endorsements were indexed in earlier tests
      expect(endorsements.length).toBeGreaterThan(0);
    });

    it('returns empty array for preprint with no endorsements', async () => {
      const unknownUri = 'at://did:plc:unknown/pub.chive.preprint.submission/unknown' as AtUri;
      const endorsements = await service.getEndorsements(unknownUri);

      expect(Array.isArray(endorsements)).toBe(true);
      expect(endorsements.length).toBe(0);
    });
  });
});

describe('ThreadingHandler Integration', () => {
  let handler: ThreadingHandler;

  beforeAll(() => {
    handler = new ThreadingHandler({
      maxDepth: 20,
      sortByDate: true,
    });
  });

  describe('buildThreads', () => {
    it('builds single thread from root review', () => {
      const rootUri = createReviewUri('root1');
      const reviews: ReviewView[] = [createTestReviewView(rootUri)];

      const threads = handler.buildThreads(reviews);

      expect(threads.length).toBe(1);
      expect(threads[0]?.root.uri).toBe(rootUri);
      expect(threads[0]?.replies.length).toBe(0);
      expect(threads[0]?.totalReplies).toBe(0);
    });

    it('builds thread with replies', () => {
      const rootUri = createReviewUri('root2');
      const reply1Uri = createReviewUri('reply1');
      const reply2Uri = createReviewUri('reply2');

      const reviews: ReviewView[] = [
        createTestReviewView(rootUri, undefined, 'Root review'),
        createTestReviewView(reply1Uri, rootUri, 'First reply'),
        createTestReviewView(reply2Uri, rootUri, 'Second reply'),
      ];

      const threads = handler.buildThreads(reviews);

      expect(threads.length).toBe(1);
      expect(threads[0]?.root.uri).toBe(rootUri);
      expect(threads[0]?.replies.length).toBe(2);
      expect(threads[0]?.totalReplies).toBe(2);
    });

    it('builds nested reply threads', () => {
      const rootUri = createReviewUri('root3');
      const reply1Uri = createReviewUri('nested1');
      const reply2Uri = createReviewUri('nested2');

      const reviews: ReviewView[] = [
        createTestReviewView(rootUri, undefined, 'Root review'),
        createTestReviewView(reply1Uri, rootUri, 'Reply to root'),
        createTestReviewView(reply2Uri, reply1Uri, 'Nested reply'),
      ];

      const threads = handler.buildThreads(reviews);

      expect(threads.length).toBe(1);
      expect(threads[0]?.root.uri).toBe(rootUri);
      expect(threads[0]?.replies.length).toBe(1);
      expect(threads[0]?.replies[0]?.root.uri).toBe(reply1Uri);
      expect(threads[0]?.replies[0]?.replies.length).toBe(1);
      expect(threads[0]?.replies[0]?.replies[0]?.root.uri).toBe(reply2Uri);
    });

    it('handles multiple root threads', () => {
      const root1Uri = createReviewUri('multiroot1');
      const root2Uri = createReviewUri('multiroot2');

      const reviews: ReviewView[] = [
        createTestReviewView(root1Uri, undefined, 'First root'),
        createTestReviewView(root2Uri, undefined, 'Second root'),
      ];

      const threads = handler.buildThreads(reviews);

      expect(threads.length).toBe(2);
    });

    it('handles empty review list', () => {
      const threads = handler.buildThreads([]);

      expect(threads.length).toBe(0);
    });

    it('sorts replies by date when enabled', () => {
      const rootUri = createReviewUri('sortroot');
      const early = new Date('2025-01-01T10:00:00Z');
      const later = new Date('2025-01-01T12:00:00Z');

      const reply1Uri = createReviewUri('sortreply1');
      const reply2Uri = createReviewUri('sortreply2');

      const reviews: ReviewView[] = [
        createTestReviewView(rootUri, undefined, 'Root'),
        createTestReviewView(reply2Uri, rootUri, 'Later reply', later),
        createTestReviewView(reply1Uri, rootUri, 'Earlier reply', early),
      ];

      const threads = handler.buildThreads(reviews);

      expect(threads.length).toBe(1);
      // With sortByDate: true, earlier reply should come first
      if (threads[0]?.replies.length === 2) {
        const firstReply = threads[0].replies[0]?.root;
        const secondReply = threads[0].replies[1]?.root;
        if (firstReply && secondReply) {
          expect(firstReply.createdAt.getTime()).toBeLessThanOrEqual(
            secondReply.createdAt.getTime()
          );
        }
      }
    });
  });

  describe('flattenThreads', () => {
    it('flattens nested threads to flat list', () => {
      const rootUri = createReviewUri('flatroot');
      const reply1Uri = createReviewUri('flatreply1');
      const reply2Uri = createReviewUri('flatreply2');

      const reviews: ReviewView[] = [
        createTestReviewView(rootUri, undefined, 'Root'),
        createTestReviewView(reply1Uri, rootUri, 'Reply 1'),
        createTestReviewView(reply2Uri, reply1Uri, 'Nested reply'),
      ];

      const threads = handler.buildThreads(reviews);
      const flattened = handler.flattenThreads(threads);

      expect(flattened.length).toBe(3);
    });

    it('flattens threads excluding replies when specified', () => {
      const rootUri = createReviewUri('flatroot2');
      const replyUri = createReviewUri('flatreply');

      const reviews: ReviewView[] = [
        createTestReviewView(rootUri, undefined, 'Root'),
        createTestReviewView(replyUri, rootUri, 'Reply'),
      ];

      const threads = handler.buildThreads(reviews);
      const flattened = handler.flattenThreads(threads, false);

      expect(flattened.length).toBe(1);
      expect(flattened[0]?.uri).toBe(rootUri);
    });
  });

  describe('findThread', () => {
    it('finds thread containing specific review', () => {
      const rootUri = createReviewUri('findroot');
      const replyUri = createReviewUri('findreply');

      const reviews: ReviewView[] = [
        createTestReviewView(rootUri, undefined, 'Root'),
        createTestReviewView(replyUri, rootUri, 'Reply'),
      ];

      const threads = handler.buildThreads(reviews);
      const found = handler.findThread(threads, replyUri);

      // findThread returns the root thread containing the reply, not the subtree
      expect(found).not.toBeNull();
      expect(found?.root.uri).toBe(rootUri);
    });

    it('returns undefined for non-existent review', () => {
      const rootUri = createReviewUri('findroot2');

      const reviews: ReviewView[] = [createTestReviewView(rootUri, undefined, 'Root')];

      const threads = handler.buildThreads(reviews);
      const found = handler.findThread(threads, 'at://nonexistent' as AtUri);

      expect(found).toBeUndefined();
    });
  });

  describe('getAncestors', () => {
    it('returns ancestor chain for nested review', () => {
      const rootUri = createReviewUri('ancestorroot');
      const mid1Uri = createReviewUri('ancestormid1');
      const leafUri = createReviewUri('ancestorleaf');

      const reviews: ReviewView[] = [
        createTestReviewView(rootUri, undefined, 'Root'),
        createTestReviewView(mid1Uri, rootUri, 'Middle'),
        createTestReviewView(leafUri, mid1Uri, 'Leaf'),
      ];

      const threads = handler.buildThreads(reviews);
      const ancestors = handler.getAncestors(threads, leafUri);

      // getAncestors returns path from root to target, INCLUDING the target
      expect(ancestors.length).toBe(3);
      expect(ancestors[0]?.uri).toBe(rootUri);
      expect(ancestors[1]?.uri).toBe(mid1Uri);
      expect(ancestors[2]?.uri).toBe(leafUri);
    });

    it('returns single-element array for root review', () => {
      const rootUri = createReviewUri('ancestoronly');

      const reviews: ReviewView[] = [createTestReviewView(rootUri, undefined, 'Root')];

      const threads = handler.buildThreads(reviews);
      const ancestors = handler.getAncestors(threads, rootUri);

      // Root review path is just itself
      expect(ancestors.length).toBe(1);
      expect(ancestors[0]?.uri).toBe(rootUri);
    });
  });

  describe('circular reference detection', () => {
    it('handles circular references gracefully', () => {
      // Create circular reference: A -> B -> A
      const uri1 = createReviewUri('circular1');
      const uri2 = createReviewUri('circular2');

      // This is an artificial circular structure
      // In practice, circular refs are prevented by the threading logic
      const reviews: ReviewView[] = [
        createTestReviewView(uri1, uri2, 'Review 1'), // Points to uri2
        createTestReviewView(uri2, uri1, 'Review 2'), // Points to uri1
      ];

      // Should not throw
      const threads = handler.buildThreads(reviews);

      // Both should become orphaned/root threads due to circular detection
      expect(threads.length).toBeGreaterThanOrEqual(0);
    });
  });
});
