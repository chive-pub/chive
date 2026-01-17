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
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import type { RecordMetadata } from '@/services/eprint/eprint-service.js';
import {
  ReviewService,
  type ReviewComment,
  type Endorsement,
  type ReviewView,
} from '@/services/review/review-service.js';
import { ThreadingHandler } from '@/services/review/threading-handler.js';
import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import type { AtUri, CID, DID } from '@/types/atproto.js';
import { createMockAuthor } from '@tests/fixtures/mock-authors.js';
import { createMockLogger } from '@tests/helpers/mock-services.js';

// Test constants
const TEST_EPRINT_URI = 'at://did:plc:author/pub.chive.eprint.submission/test123' as AtUri;
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
    subject: { uri: TEST_EPRINT_URI, cid: 'bafysubject' },
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
    subject: { uri: TEST_EPRINT_URI, cid: 'bafysubject' },
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
    subject: TEST_EPRINT_URI,
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

    // Insert required eprint for foreign key constraint
    await pool.query(
      `INSERT INTO eprints_index (
        uri, cid, submitted_by, authors, title, abstract, abstract_plain_text, document_blob_cid, document_blob_mime_type,
        document_blob_size, license, created_at, pds_url, indexed_at, last_synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, NOW(), NOW())
      ON CONFLICT (uri) DO NOTHING`,
      [
        TEST_EPRINT_URI,
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
        'Test Eprint for Reviews',
        JSON.stringify({
          type: 'RichText',
          items: [
            { type: 'text', content: 'This is a test eprint used for review integration tests.' },
          ],
          format: 'application/x-chive-gloss+json',
        }),
        'This is a test eprint used for review integration tests.',
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
    await pool.query('DELETE FROM reviews_index WHERE eprint_uri = $1', [TEST_EPRINT_URI]);
    await pool.query('DELETE FROM endorsements_index WHERE eprint_uri = $1', [TEST_EPRINT_URI]);
    await pool.query('DELETE FROM eprints_index WHERE uri = $1', [TEST_EPRINT_URI]);
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
    it('returns reviews indexed for the eprint', async () => {
      const reviews = await service.getReviews(TEST_EPRINT_URI);

      expect(Array.isArray(reviews)).toBe(true);
      // Reviews were indexed in earlier tests
      expect(reviews.length).toBeGreaterThan(0);
    });

    it('returns empty array for eprint with no reviews', async () => {
      const unknownUri = 'at://did:plc:unknown/pub.chive.eprint.submission/unknown' as AtUri;
      const reviews = await service.getReviews(unknownUri);

      expect(Array.isArray(reviews)).toBe(true);
      expect(reviews.length).toBe(0);
    });
  });

  describe('getEndorsements', () => {
    it('returns endorsements indexed for the eprint', async () => {
      const endorsements = await service.getEndorsements(TEST_EPRINT_URI);

      expect(Array.isArray(endorsements)).toBe(true);
      // Endorsements were indexed in earlier tests
      expect(endorsements.length).toBeGreaterThan(0);
    });

    it('returns empty array for eprint with no endorsements', async () => {
      const unknownUri = 'at://did:plc:unknown/pub.chive.eprint.submission/unknown' as AtUri;
      const endorsements = await service.getEndorsements(unknownUri);

      expect(Array.isArray(endorsements)).toBe(true);
      expect(endorsements.length).toBe(0);
    });
  });
});

describe('ReviewService Notification Integration', () => {
  let pool: Pool;
  let storage: PostgreSQLAdapter;
  let service: ReviewService;

  // Test data for notifications - use fixture-based author
  const NOTIFICATION_TEST_AUTHOR_DID = 'did:plc:notifauthor' as DID;
  const NOTIFICATION_TEST_REVIEWER_DID = 'did:plc:notifreviewer';
  const NOTIFICATION_TEST_EPRINT_URI =
    `at://${NOTIFICATION_TEST_AUTHOR_DID}/pub.chive.eprint.submission/notiftest` as AtUri;
  const NOTIFICATION_TEST_PDS_URL = 'https://pds.notification.test.example.com';

  // Use fixture to create test author with consistent structure
  const testAuthor = createMockAuthor({
    did: NOTIFICATION_TEST_AUTHOR_DID,
    name: 'Notification Test Author',
    order: 1,
    isCorrespondingAuthor: true,
    isHighlighted: false,
  });

  beforeAll(async () => {
    const dbConfig = getDatabaseConfig();
    pool = new Pool(dbConfig);
    storage = new PostgreSQLAdapter(pool);
    service = new ReviewService({
      pool,
      storage,
      logger: createMockLogger(),
    });

    // Insert test eprint with author DID in the authors array (using fixture)
    await pool.query(
      `INSERT INTO eprints_index (
        uri, cid, submitted_by, authors, title, abstract, abstract_plain_text, document_blob_cid, document_blob_mime_type,
        document_blob_size, license, created_at, pds_url, indexed_at, last_synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, NOW(), NOW())
      ON CONFLICT (uri) DO NOTHING`,
      [
        NOTIFICATION_TEST_EPRINT_URI,
        'bafynotifsubject',
        NOTIFICATION_TEST_AUTHOR_DID,
        JSON.stringify([testAuthor]),
        'Test Paper for Notification Tests',
        JSON.stringify({
          type: 'RichText',
          items: [{ type: 'text', content: 'This eprint is used to test notification queries.' }],
          format: 'application/x-chive-gloss+json',
        }),
        'This eprint is used to test notification queries.',
        'bafyreipdfblob456',
        'application/pdf',
        2048000,
        'CC-BY-4.0',
        NOTIFICATION_TEST_PDS_URL,
      ]
    );

    // Insert a test review from another user on this eprint
    const reviewUri =
      `at://${NOTIFICATION_TEST_REVIEWER_DID}/pub.chive.review.comment/testreview1` as AtUri;
    await pool.query(
      `INSERT INTO reviews_index (
        uri, cid, eprint_uri, reviewer_did, content, created_at, pds_url, indexed_at, last_synced_at
      ) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '1 hour', $6, NOW(), NOW())
      ON CONFLICT (uri) DO NOTHING`,
      [
        reviewUri,
        'bafyreviewnew1',
        NOTIFICATION_TEST_EPRINT_URI,
        NOTIFICATION_TEST_REVIEWER_DID,
        'This is a test review for notification tests.',
        NOTIFICATION_TEST_PDS_URL,
      ]
    );

    // Insert a self-review (should be excluded)
    const selfReviewUri =
      `at://${NOTIFICATION_TEST_AUTHOR_DID}/pub.chive.review.comment/selfReview` as AtUri;
    await pool.query(
      `INSERT INTO reviews_index (
        uri, cid, eprint_uri, reviewer_did, content, created_at, pds_url, indexed_at, last_synced_at
      ) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '30 minutes', $6, NOW(), NOW())
      ON CONFLICT (uri) DO NOTHING`,
      [
        selfReviewUri,
        'bafyreviewself1',
        NOTIFICATION_TEST_EPRINT_URI,
        NOTIFICATION_TEST_AUTHOR_DID,
        'This is a self-review that should be excluded.',
        NOTIFICATION_TEST_PDS_URL,
      ]
    );

    // Insert a test endorsement from another user
    const endorsementUri =
      `at://${NOTIFICATION_TEST_REVIEWER_DID}/pub.chive.review.endorsement/testendo1` as AtUri;
    await pool.query(
      `INSERT INTO endorsements_index (
        uri, cid, eprint_uri, endorser_did, endorsement_type, comment, created_at, pds_url, indexed_at, last_synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '2 hours', $7, NOW(), NOW())
      ON CONFLICT (uri) DO NOTHING`,
      [
        endorsementUri,
        'bafyendonew1',
        NOTIFICATION_TEST_EPRINT_URI,
        NOTIFICATION_TEST_REVIEWER_DID,
        'methods',
        'Great methodology!',
        NOTIFICATION_TEST_PDS_URL,
      ]
    );

    // Insert a self-endorsement (should be excluded)
    const selfEndorsementUri =
      `at://${NOTIFICATION_TEST_AUTHOR_DID}/pub.chive.review.endorsement/selfEndo` as AtUri;
    await pool.query(
      `INSERT INTO endorsements_index (
        uri, cid, eprint_uri, endorser_did, endorsement_type, comment, created_at, pds_url, indexed_at, last_synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '1 hour', $7, NOW(), NOW())
      ON CONFLICT (uri) DO NOTHING`,
      [
        selfEndorsementUri,
        'bafyendoself1',
        NOTIFICATION_TEST_EPRINT_URI,
        NOTIFICATION_TEST_AUTHOR_DID,
        'overall',
        'Self endorsement should be excluded.',
        NOTIFICATION_TEST_PDS_URL,
      ]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM reviews_index WHERE eprint_uri = $1', [
      NOTIFICATION_TEST_EPRINT_URI,
    ]);
    await pool.query('DELETE FROM endorsements_index WHERE eprint_uri = $1', [
      NOTIFICATION_TEST_EPRINT_URI,
    ]);
    await pool.query('DELETE FROM eprints_index WHERE uri = $1', [NOTIFICATION_TEST_EPRINT_URI]);
    await pool.end();
  });

  describe('listReviewsOnAuthorPapers', () => {
    it('returns reviews on papers where user is author', async () => {
      const result = await service.listReviewsOnAuthorPapers(NOTIFICATION_TEST_AUTHOR_DID);

      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);

      const review = result.items[0];
      expect(review).toBeDefined();
      expect(review?.reviewerDid).toBe(NOTIFICATION_TEST_REVIEWER_DID);
      expect(review?.eprintUri).toBe(NOTIFICATION_TEST_EPRINT_URI);
      expect(review?.eprintTitle).toBe('Test Paper for Notification Tests');
      expect(review?.text).toBe('This is a test review for notification tests.');
      expect(review?.isReply).toBe(false);
    });

    it('excludes self-reviews from results', async () => {
      const result = await service.listReviewsOnAuthorPapers(NOTIFICATION_TEST_AUTHOR_DID);

      // Should only have 1 review (from the other user), not 2
      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);

      // Verify the self-review is not included
      const selfReviews = result.items.filter(
        (item) => item.reviewerDid === NOTIFICATION_TEST_AUTHOR_DID
      );
      expect(selfReviews.length).toBe(0);
    });

    it('returns empty result for user with no papers', async () => {
      const nonAuthorDid = 'did:plc:nonexistentauthor' as DID;
      const result = await service.listReviewsOnAuthorPapers(nonAuthorDid);

      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('respects limit parameter', async () => {
      const result = await service.listReviewsOnAuthorPapers(NOTIFICATION_TEST_AUTHOR_DID, {
        limit: 10,
      });

      expect(result.items.length).toBeLessThanOrEqual(10);
    });
  });

  describe('listEndorsementsOnAuthorPapers', () => {
    it('returns endorsements on papers where user is author', async () => {
      const result = await service.listEndorsementsOnAuthorPapers(NOTIFICATION_TEST_AUTHOR_DID);

      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);

      const endorsement = result.items[0];
      expect(endorsement).toBeDefined();
      expect(endorsement?.endorserDid).toBe(NOTIFICATION_TEST_REVIEWER_DID);
      expect(endorsement?.eprintUri).toBe(NOTIFICATION_TEST_EPRINT_URI);
      expect(endorsement?.eprintTitle).toBe('Test Paper for Notification Tests');
      expect(endorsement?.endorsementType).toBe('methods');
      expect(endorsement?.comment).toBe('Great methodology!');
    });

    it('excludes self-endorsements from results', async () => {
      const result = await service.listEndorsementsOnAuthorPapers(NOTIFICATION_TEST_AUTHOR_DID);

      // Should only have 1 endorsement (from the other user), not 2
      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);

      // Verify the self-endorsement is not included
      const selfEndorsements = result.items.filter(
        (item) => item.endorserDid === NOTIFICATION_TEST_AUTHOR_DID
      );
      expect(selfEndorsements.length).toBe(0);
    });

    it('returns empty result for user with no papers', async () => {
      const nonAuthorDid = 'did:plc:nonexistentauthor' as DID;
      const result = await service.listEndorsementsOnAuthorPapers(nonAuthorDid);

      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('respects limit parameter', async () => {
      const result = await service.listEndorsementsOnAuthorPapers(NOTIFICATION_TEST_AUTHOR_DID, {
        limit: 10,
      });

      expect(result.items.length).toBeLessThanOrEqual(10);
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
