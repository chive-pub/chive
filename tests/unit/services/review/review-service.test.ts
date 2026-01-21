/**
 * Unit tests for ReviewService.
 *
 * @remarks
 * Tests review comment and endorsement indexing functionality with PostgreSQL.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import type { RecordMetadata } from '@/services/eprint/eprint-service.js';
import { ReviewService } from '@/services/review/review-service.js';
import type { ReviewComment, Endorsement } from '@/services/review/review-service.js';
import type { AtUri, CID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IStorageBackend } from '@/types/interfaces/storage.interface.js';

interface MockLogger extends ILogger {
  debugMock: ReturnType<typeof vi.fn>;
  infoMock: ReturnType<typeof vi.fn>;
  errorMock: ReturnType<typeof vi.fn>;
}

interface MockPool {
  query: Mock;
}

const createMockLogger = (): MockLogger => {
  const debugMock = vi.fn();
  const infoMock = vi.fn();
  const errorMock = vi.fn();
  const logger: MockLogger = {
    debug: debugMock,
    info: infoMock,
    warn: vi.fn(),
    error: errorMock,
    child: vi.fn(function (this: void) {
      return logger;
    }),
    debugMock,
    infoMock,
    errorMock,
  };
  return logger;
};

const createMockPool = (): MockPool => ({
  query: vi.fn(),
});

const createMockStorage = (): IStorageBackend =>
  ({
    storeEprint: vi.fn(),
    getEprint: vi.fn(),
    getEprintsByAuthor: vi.fn(),
    trackPDSSource: vi.fn(),
    getRecordsNotSyncedSince: vi.fn(),
    isStale: vi.fn(),
  }) as unknown as IStorageBackend;

const createMockReviewComment = (overrides?: Partial<ReviewComment>): ReviewComment => ({
  $type: 'pub.chive.review.comment',
  subject: {
    uri: 'at://did:plc:author/pub.chive.eprint.submission/abc123' as AtUri,
    cid: 'bafyreicid123',
  },
  text: 'The treatment of clause-embedding predicates here is thorough, but consider how this analysis extends to control predicates like "try" and "persuade".',
  createdAt: new Date('2020-01-01T00:00:00Z').toISOString(),
  ...overrides,
});

const createMockEndorsement = (overrides?: Partial<Endorsement>): Endorsement => ({
  $type: 'pub.chive.review.endorsement',
  eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/abc123' as AtUri,
  contributions: ['methodological'],
  createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  ...overrides,
});

const createMockMetadata = (overrides?: Partial<RecordMetadata>): RecordMetadata => ({
  uri: 'at://did:plc:reviewer/pub.chive.review.comment/review123' as AtUri,
  cid: 'bafyreireview123' as CID,
  pdsUrl: 'https://pds.host',
  indexedAt: new Date('2024-01-02T00:00:00Z'),
  ...overrides,
});

describe('ReviewService', () => {
  let pool: MockPool;
  let storage: IStorageBackend;
  let logger: MockLogger;
  let service: ReviewService;

  beforeEach(() => {
    pool = createMockPool();
    storage = createMockStorage();
    logger = createMockLogger();
    service = new ReviewService({ pool: pool as unknown as import('pg').Pool, storage, logger });
  });

  describe('indexReview', () => {
    it('indexes review comment successfully', async () => {
      const comment = createMockReviewComment();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.indexReview(comment, metadata);

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reviews_index'),
        expect.arrayContaining([metadata.uri, metadata.cid, comment.subject.uri])
      );
      expect(logger.infoMock).toHaveBeenCalledWith('Indexed review', expect.any(Object));
    });

    it('handles review with parent comment', async () => {
      const parentUri = 'at://did:plc:other/pub.chive.review.comment/parent123' as AtUri;
      const comment = createMockReviewComment({ parent: parentUri });
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.indexReview(comment, metadata);

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reviews_index'),
        expect.arrayContaining([parentUri])
      );
    });

    it('returns error on database failure', async () => {
      const comment = createMockReviewComment();
      const metadata = createMockMetadata();

      pool.query.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.indexReview(comment, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Connection refused');
      }
      expect(logger.errorMock).toHaveBeenCalled();
    });

    it('upserts on conflict', async () => {
      const comment = createMockReviewComment();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexReview(comment, metadata);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (uri) DO UPDATE'),
        expect.any(Array)
      );
    });
  });

  describe('indexEndorsement', () => {
    it('indexes endorsement successfully', async () => {
      const endorsement = createMockEndorsement();
      const metadata = createMockMetadata({
        uri: 'at://did:plc:endorser/pub.chive.review.endorsement/e123' as AtUri,
      });

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.indexEndorsement(endorsement, metadata);

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO endorsements_index'),
        expect.arrayContaining([metadata.uri, endorsement.contributions])
      );
      expect(logger.infoMock).toHaveBeenCalledWith('Indexed endorsement', expect.any(Object));
    });

    it('handles different contribution types', async () => {
      const contributionLists = [['methodological'], ['empirical'], ['reproducibility']];

      for (const contributions of contributionLists) {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

        const endorsement = createMockEndorsement({ contributions });
        const metadata = createMockMetadata({
          uri: `at://did:plc:e/pub.chive.review.endorsement/${contributions.join('-')}` as AtUri,
        });

        const result = await service.indexEndorsement(endorsement, metadata);

        expect(result.ok).toBe(true);
      }
    });

    it('includes optional comment', async () => {
      const endorsement = createMockEndorsement({ comment: 'Well-designed study' });
      const metadata = createMockMetadata({
        uri: 'at://did:plc:e/pub.chive.review.endorsement/e1' as AtUri,
      });

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexEndorsement(endorsement, metadata);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Well-designed study'])
      );
    });

    it('returns error on database failure', async () => {
      const endorsement = createMockEndorsement();
      const metadata = createMockMetadata();

      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.indexEndorsement(endorsement, metadata);

      expect(result.ok).toBe(false);
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });

  describe('getReviews', () => {
    it('returns empty array for eprint without reviews', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      const threads = await service.getReviews(eprintUri);

      expect(threads).toEqual([]);
    });

    it('builds threaded discussions from flat list', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:r1/pub.chive.review.comment/root',
            reviewer_did: 'did:plc:r1',
            text: 'Root comment',
            parent_comment: null,
            created_at: new Date('2024-01-01'),
          },
          {
            uri: 'at://did:plc:r2/pub.chive.review.comment/reply1',
            reviewer_did: 'did:plc:r2',
            text: 'Reply to root',
            parent_comment: 'at://did:plc:r1/pub.chive.review.comment/root',
            created_at: new Date('2024-01-02'),
          },
          {
            uri: 'at://did:plc:r3/pub.chive.review.comment/reply2',
            reviewer_did: 'did:plc:r3',
            text: 'Another reply',
            parent_comment: 'at://did:plc:r1/pub.chive.review.comment/root',
            created_at: new Date('2024-01-03'),
          },
        ],
      });

      const threads = await service.getReviews(eprintUri);

      expect(threads).toHaveLength(1);
      expect(threads[0]?.root.text).toBe('Root comment');
      expect(threads[0]?.replies).toHaveLength(2);
      expect(threads[0]?.totalReplies).toBe(2);
    });

    it('handles deeply nested threads', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:r/c/root',
            reviewer_did: 'did:plc:r1',
            text: 'Root',
            parent_comment: null,
            created_at: new Date('2024-01-01'),
          },
          {
            uri: 'at://did:plc:r/c/level1',
            reviewer_did: 'did:plc:r2',
            text: 'Level 1',
            parent_comment: 'at://did:plc:r/c/root',
            created_at: new Date('2024-01-02'),
          },
          {
            uri: 'at://did:plc:r/c/level2',
            reviewer_did: 'did:plc:r3',
            text: 'Level 2',
            parent_comment: 'at://did:plc:r/c/level1',
            created_at: new Date('2024-01-03'),
          },
        ],
      });

      const threads = await service.getReviews(eprintUri);

      expect(threads).toHaveLength(1);
      expect(threads[0]?.replies).toHaveLength(1);
      expect(threads[0]?.replies[0]?.replies).toHaveLength(1);
      expect(threads[0]?.totalReplies).toBe(2);
    });

    it('handles multiple root comments', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:r1/c/root1',
            reviewer_did: 'did:plc:r1',
            content: 'Root 1',
            parent_review_uri: null,
            created_at: new Date('2024-01-01'),
          },
          {
            uri: 'at://did:plc:r2/c/root2',
            reviewer_did: 'did:plc:r2',
            content: 'Root 2',
            parent_review_uri: null,
            created_at: new Date('2024-01-02'),
          },
        ],
      });

      const threads = await service.getReviews(eprintUri);

      expect(threads).toHaveLength(2);
    });

    it('returns empty array on database error', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockRejectedValueOnce(new Error('Query failed'));

      const threads = await service.getReviews(eprintUri);

      expect(threads).toEqual([]);
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });

  describe('getEndorsements', () => {
    it('returns empty array for eprint without endorsements', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      const endorsements = await service.getEndorsements(eprintUri);

      expect(endorsements).toEqual([]);
    });

    it('returns endorsement views for eprint', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:e1/e/1',
            endorser_did: 'did:plc:e1',
            eprint_uri: eprintUri,
            contributions: ['methodological'],
            comment: 'Good methods',
            created_at: new Date('2024-01-01'),
          },
          {
            uri: 'at://did:plc:e2/e/2',
            endorser_did: 'did:plc:e2',
            eprint_uri: eprintUri,
            contributions: ['empirical'],
            comment: null,
            created_at: new Date('2024-01-02'),
          },
        ],
      });

      const endorsements = await service.getEndorsements(eprintUri);

      expect(endorsements).toHaveLength(2);
      expect(endorsements[0]?.contributions).toEqual(['methodological']);
      expect(endorsements[0]?.comment).toBe('Good methods');
      expect(endorsements[1]?.contributions).toEqual(['empirical']);
      expect(endorsements[1]?.comment).toBeUndefined();
    });

    it('returns empty array on database error', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockRejectedValueOnce(new Error('Query failed'));

      const endorsements = await service.getEndorsements(eprintUri);

      expect(endorsements).toEqual([]);
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });

  describe('listReviewsOnAuthorPapers', () => {
    it('returns empty result when author has no papers with reviews', async () => {
      const authorDid = 'did:plc:author123' as import('@/types/atproto.js').DID;

      // Count query returns 0
      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Main query returns empty
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.listReviewsOnAuthorPapers(authorDid);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('returns review notifications on author papers', async () => {
      const authorDid = 'did:plc:author123' as import('@/types/atproto.js').DID;

      // Count query
      pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // Main query
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:reviewer1/pub.chive.review.comment/r1',
            reviewer_did: 'did:plc:reviewer1',
            eprint_uri: 'at://did:plc:author123/pub.chive.eprint.submission/paper1',
            text: 'Great paper!',
            parent_comment: null,
            created_at: new Date('2024-01-01'),
            eprint_title: 'My Paper Title',
            reviewer_handle: 'reviewer1.bsky.social',
            reviewer_display_name: 'Reviewer One',
          },
          {
            uri: 'at://did:plc:reviewer2/pub.chive.review.comment/r2',
            reviewer_did: 'did:plc:reviewer2',
            eprint_uri: 'at://did:plc:author123/pub.chive.eprint.submission/paper1',
            text: 'Interesting methods',
            parent_comment: 'at://did:plc:reviewer1/pub.chive.review.comment/r1',
            created_at: new Date('2024-01-02'),
            eprint_title: 'My Paper Title',
            reviewer_handle: null,
            reviewer_display_name: null,
          },
        ],
      });

      const result = await service.listReviewsOnAuthorPapers(authorDid);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0]?.reviewerDisplayName).toBe('Reviewer One');
      expect(result.items[0]?.isReply).toBe(false);
      expect(result.items[1]?.isReply).toBe(true);
    });

    it('excludes self-reviews from results', async () => {
      const authorDid = 'did:plc:author123' as import('@/types/atproto.js').DID;

      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.listReviewsOnAuthorPapers(authorDid);

      // Verify the query includes reviewer_did != author exclusion
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('reviewer_did != $2'),
        expect.arrayContaining([authorDid])
      );
    });

    it('returns empty result on database error', async () => {
      const authorDid = 'did:plc:author123' as import('@/types/atproto.js').DID;

      pool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.listReviewsOnAuthorPapers(authorDid);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });

  describe('listEndorsementsOnAuthorPapers', () => {
    it('returns empty result when author has no papers with endorsements', async () => {
      const authorDid = 'did:plc:author123' as import('@/types/atproto.js').DID;

      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.listEndorsementsOnAuthorPapers(authorDid);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('returns endorsement notifications on author papers', async () => {
      const authorDid = 'did:plc:author123' as import('@/types/atproto.js').DID;

      pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:endorser1/pub.chive.review.endorsement/e1',
            endorser_did: 'did:plc:endorser1',
            eprint_uri: 'at://did:plc:author123/pub.chive.eprint.submission/paper1',
            contributions: ['methodological'],
            comment: 'Excellent methodology',
            created_at: new Date('2024-01-01'),
            eprint_title: 'My Paper Title',
            endorser_handle: 'endorser1.bsky.social',
            endorser_display_name: 'Endorser One',
          },
          {
            uri: 'at://did:plc:endorser2/pub.chive.review.endorsement/e2',
            endorser_did: 'did:plc:endorser2',
            eprint_uri: 'at://did:plc:author123/pub.chive.eprint.submission/paper1',
            contributions: ['conceptual'],
            comment: null,
            created_at: new Date('2024-01-02'),
            eprint_title: 'My Paper Title',
            endorser_handle: null,
            endorser_display_name: null,
          },
        ],
      });

      const result = await service.listEndorsementsOnAuthorPapers(authorDid);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0]?.endorserDisplayName).toBe('Endorser One');
      expect(result.items[0]?.contributions).toEqual(['methodological']);
      expect(result.items[0]?.comment).toBe('Excellent methodology');
      expect(result.items[1]?.contributions).toEqual(['conceptual']);
      expect(result.items[1]?.comment).toBeUndefined();
    });

    it('excludes self-endorsements from results', async () => {
      const authorDid = 'did:plc:author123' as import('@/types/atproto.js').DID;

      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.listEndorsementsOnAuthorPapers(authorDid);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('endorser_did != $2'),
        expect.arrayContaining([authorDid])
      );
    });

    it('returns empty result on database error', async () => {
      const authorDid = 'did:plc:author123' as import('@/types/atproto.js').DID;

      pool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.listEndorsementsOnAuthorPapers(authorDid);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(logger.errorMock).toHaveBeenCalled();
    });

    it('handles pagination with cursor', async () => {
      const authorDid = 'did:plc:author123' as import('@/types/atproto.js').DID;
      const cursor = '2024-01-01T00:00:00.000Z::at://did:plc:e/e/1';

      pool.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.listEndorsementsOnAuthorPapers(authorDid, { cursor, limit: 5 });

      // Verify cursor is parsed and used in query
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('(en.created_at, en.uri) < ($3, $4)'),
        expect.any(Array)
      );
    });
  });
});
