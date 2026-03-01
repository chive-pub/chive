/**
 * Unit tests for CollectionService.getCollectionFeed.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CollectionService } from '../../../../src/services/collection/collection-service.js';
import type { AtUri } from '../../../../src/types/atproto.js';
import { DatabaseError } from '../../../../src/types/errors.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import { isErr, isOk } from '../../../../src/types/result.js';

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLogger = (): ILogger => {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
};

interface MockDatabasePool {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
}

interface MockDatabaseClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

const createMockClient = (): MockDatabaseClient => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  release: vi.fn(),
});

const createMockPool = (): MockDatabasePool => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  connect: vi.fn().mockResolvedValue(createMockClient()),
});

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_COLLECTION_URI = 'at://did:plc:aswhite/pub.chive.graph.node/nlp-reading-list' as AtUri;

const makeFeedRow = (
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> => ({
  type: 'eprint_by_author',
  event_uri: 'at://did:plc:author/pub.chive.eprint.submission/some-eprint',
  event_at: new Date('2025-06-20T12:00:00Z'),
  collection_item_uri: 'at://did:plc:aswhite/pub.chive.graph.node/some-person',
  collection_item_subkind: 'person',
  payload: {
    eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/some-eprint',
    eprintTitle: 'Test Paper',
  },
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('CollectionService', () => {
  let service: CollectionService;
  let logger: ILogger;
  let pool: MockDatabasePool;

  beforeEach(() => {
    logger = createMockLogger();
    pool = createMockPool();
    service = new CollectionService({
      pool: pool as unknown as never,
      logger,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // getCollectionFeed
  // ==========================================================================

  describe('getCollectionFeed', () => {
    it('returns empty events and hasMore=false for an empty collection', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getCollectionFeed(SAMPLE_COLLECTION_URI);

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;
      expect(result.value.events).toEqual([]);
      expect(result.value.hasMore).toBe(false);
      expect(result.value.cursor).toBeUndefined();
    });

    it('returns feed events with correct shape and type fields', async () => {
      const rows = [
        makeFeedRow({
          type: 'eprint_by_author',
          event_uri: 'at://did:plc:author/pub.chive.eprint.submission/ep-a',
          event_at: new Date('2025-06-20T14:00:00Z'),
          collection_item_uri: 'at://did:plc:aswhite/pub.chive.graph.node/person-a',
          collection_item_subkind: 'person',
          payload: {
            eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/ep-a',
            eprintTitle: 'Paper A',
          },
        }),
        makeFeedRow({
          type: 'review_on_eprint',
          event_uri: 'at://did:plc:reviewer/pub.chive.review.comment/r1',
          event_at: new Date('2025-06-20T13:00:00Z'),
          collection_item_uri: 'at://did:plc:aswhite/pub.chive.graph.node/item-b',
          collection_item_subkind: 'eprint',
          payload: { reviewerDid: 'did:plc:reviewer', snippet: 'Good paper' },
        }),
      ];
      pool.query.mockResolvedValueOnce({ rows });

      const result = await service.getCollectionFeed(SAMPLE_COLLECTION_URI, {
        limit: 10,
      });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      expect(result.value.events).toHaveLength(2);

      const first = result.value.events[0];
      expect(first?.type).toBe('eprint_by_author');
      expect(first?.eventUri).toBe('at://did:plc:author/pub.chive.eprint.submission/ep-a');
      expect(first?.eventAt).toBeInstanceOf(Date);
      expect(first?.collectionItemUri).toBe('at://did:plc:aswhite/pub.chive.graph.node/person-a');
      expect(first?.collectionItemSubkind).toBe('person');
      expect(first?.payload).toEqual({
        eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/ep-a',
        eprintTitle: 'Paper A',
      });

      const second = result.value.events[1];
      expect(second?.type).toBe('review_on_eprint');
      expect(second?.payload).toEqual({
        reviewerDid: 'did:plc:reviewer',
        snippet: 'Good paper',
      });
    });

    it('parses a valid compound cursor and passes it to the query', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const cursor = '2025-06-20T12:00:00.000Z::at://did:plc:x/pub.chive.review.comment/abc';
      await service.getCollectionFeed(SAMPLE_COLLECTION_URI, { cursor });

      const call = pool.query.mock.calls[0] as [string, unknown[]];
      const sql = call[0];
      const params = call[1];

      // The query should include a WHERE clause for cursor pagination
      expect(sql).toContain('event_at');
      expect(sql).toContain('event_uri');
      // The cursor timestamp and URI should be in the params
      expect(params).toContainEqual(expect.any(Date));
      expect(params).toContain('at://did:plc:x/pub.chive.review.comment/abc');
    });

    it('ignores an invalid cursor without separator', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      // A cursor without "::" should be ignored (no cursor filtering applied)
      const cursor = 'invalid-cursor-no-separator';
      const result = await service.getCollectionFeed(SAMPLE_COLLECTION_URI, { cursor });

      expect(isOk(result)).toBe(true);
      const params = (pool.query.mock.calls[0] as [string, unknown[]])[1];
      // Only the collection URI should be a param (no cursor params added)
      expect(params).toHaveLength(2); // collectionUri + limit
    });

    it('sets hasMore=true when result count exceeds limit', async () => {
      // Request limit=2, return 3 rows so the service detects hasMore
      const rows = [
        makeFeedRow({
          event_uri: 'at://a/pub.chive.graph.node/1',
          event_at: new Date('2025-06-20T15:00:00Z'),
        }),
        makeFeedRow({
          event_uri: 'at://a/pub.chive.graph.node/2',
          event_at: new Date('2025-06-20T14:00:00Z'),
        }),
        makeFeedRow({
          event_uri: 'at://a/pub.chive.graph.node/3',
          event_at: new Date('2025-06-20T13:00:00Z'),
        }),
      ];
      pool.query.mockResolvedValueOnce({ rows });

      const result = await service.getCollectionFeed(SAMPLE_COLLECTION_URI, {
        limit: 2,
      });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      expect(result.value.events).toHaveLength(2);
      expect(result.value.hasMore).toBe(true);
      expect(result.value.cursor).toBeDefined();
      // Cursor should be a compound format: "{ISO timestamp}::{eventUri}"
      expect(result.value.cursor).toContain('::');
    });

    it('sets hasMore=false when result count is within limit', async () => {
      const rows = [makeFeedRow()];
      pool.query.mockResolvedValueOnce({ rows });

      const result = await service.getCollectionFeed(SAMPLE_COLLECTION_URI, {
        limit: 10,
      });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      expect(result.value.events).toHaveLength(1);
      expect(result.value.hasMore).toBe(false);
      expect(result.value.cursor).toBeUndefined();
    });

    it('caps limit at 100', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getCollectionFeed(SAMPLE_COLLECTION_URI, { limit: 999 });

      const params = (pool.query.mock.calls[0] as [string, unknown[]])[1];
      // The last param is the LIMIT value (limit + 1 for hasMore detection)
      const limitParam = params[params.length - 1] as number;
      expect(limitParam).toBe(101); // capped at 100, plus 1 for hasMore check
    });

    it('uses default limit of 30 when none provided', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getCollectionFeed(SAMPLE_COLLECTION_URI);

      const params = (pool.query.mock.calls[0] as [string, unknown[]])[1];
      const limitParam = params[params.length - 1] as number;
      expect(limitParam).toBe(31); // default 30 + 1 for hasMore check
    });

    it('returns Err(DatabaseError) on query failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('connection refused'));

      const result = await service.getCollectionFeed(SAMPLE_COLLECTION_URI);

      expect(isErr(result)).toBe(true);
      if (result.ok) return;
      expect(result.error).toBeInstanceOf(DatabaseError);
      expect(result.error.message).toContain('Failed to get collection feed');
      expect(logger.error).toHaveBeenCalled();
    });

    it('handles null payload gracefully', async () => {
      const rows = [makeFeedRow({ payload: null })];
      pool.query.mockResolvedValueOnce({ rows });

      const result = await service.getCollectionFeed(SAMPLE_COLLECTION_URI);

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;
      expect(result.value.events[0]?.payload).toEqual({});
    });

    it('builds cursor from the last row when hasMore is true', async () => {
      const lastEventAt = new Date('2025-06-18T09:30:00.000Z');
      const lastEventUri = 'at://did:plc:aswhite/pub.chive.graph.node/last-item';

      const rows = [
        makeFeedRow({
          event_uri: 'at://did:plc:aswhite/pub.chive.graph.node/first-item',
          event_at: new Date('2025-06-20T12:00:00Z'),
        }),
        makeFeedRow({
          event_uri: lastEventUri,
          event_at: lastEventAt,
        }),
        // Extra row triggers hasMore
        makeFeedRow({
          event_uri: 'at://did:plc:aswhite/pub.chive.graph.node/overflow',
          event_at: new Date('2025-06-17T09:00:00Z'),
        }),
      ];
      pool.query.mockResolvedValueOnce({ rows });

      const result = await service.getCollectionFeed(SAMPLE_COLLECTION_URI, {
        limit: 2,
      });

      expect(isOk(result)).toBe(true);
      if (!result.ok) return;

      expect(result.value.cursor).toBe(`${lastEventAt.toISOString()}::${lastEventUri}`);
    });
  });
});
