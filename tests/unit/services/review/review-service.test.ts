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
  subject: {
    uri: 'at://did:plc:author/pub.chive.eprint.submission/abc123' as AtUri,
    cid: 'bafyreicid123',
  },
  endorsementType: 'methods',
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
        expect.arrayContaining([metadata.uri, endorsement.endorsementType])
      );
      expect(logger.infoMock).toHaveBeenCalledWith('Indexed endorsement', expect.any(Object));
    });

    it('handles different endorsement types', async () => {
      const types: ('methods' | 'results' | 'overall')[] = ['methods', 'results', 'overall'];

      for (const endorsementType of types) {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

        const endorsement = createMockEndorsement({ endorsementType });
        const metadata = createMockMetadata({
          uri: `at://did:plc:e/pub.chive.review.endorsement/${endorsementType}` as AtUri,
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
            content: 'Root comment',
            parent_review_uri: null,
            created_at: new Date('2024-01-01'),
          },
          {
            uri: 'at://did:plc:r2/pub.chive.review.comment/reply1',
            reviewer_did: 'did:plc:r2',
            content: 'Reply to root',
            parent_review_uri: 'at://did:plc:r1/pub.chive.review.comment/root',
            created_at: new Date('2024-01-02'),
          },
          {
            uri: 'at://did:plc:r3/pub.chive.review.comment/reply2',
            reviewer_did: 'did:plc:r3',
            content: 'Another reply',
            parent_review_uri: 'at://did:plc:r1/pub.chive.review.comment/root',
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
            content: 'Root',
            parent_review_uri: null,
            created_at: new Date('2024-01-01'),
          },
          {
            uri: 'at://did:plc:r/c/level1',
            reviewer_did: 'did:plc:r2',
            content: 'Level 1',
            parent_review_uri: 'at://did:plc:r/c/root',
            created_at: new Date('2024-01-02'),
          },
          {
            uri: 'at://did:plc:r/c/level2',
            reviewer_did: 'did:plc:r3',
            content: 'Level 2',
            parent_review_uri: 'at://did:plc:r/c/level1',
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
            endorsement_type: 'methods',
            comment: 'Good methods',
            created_at: new Date('2024-01-01'),
          },
          {
            uri: 'at://did:plc:e2/e/2',
            endorser_did: 'did:plc:e2',
            eprint_uri: eprintUri,
            endorsement_type: 'results',
            comment: null,
            created_at: new Date('2024-01-02'),
          },
        ],
      });

      const endorsements = await service.getEndorsements(eprintUri);

      expect(endorsements).toHaveLength(2);
      expect(endorsements[0]?.endorsementType).toBe('methods');
      expect(endorsements[0]?.comment).toBe('Good methods');
      expect(endorsements[1]?.endorsementType).toBe('results');
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
});
