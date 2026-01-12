/**
 * Unit tests for ActivityService.
 *
 * @remarks
 * Tests activity logging with firehose correlation.
 *
 * @packageDocumentation
 */

import type { Pool, QueryResult, QueryResultRow } from 'pg';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

import { ActivityService } from '@/services/activity/activity-service.js';
import type { DID, NSID, AtUri, CID } from '@/types/atproto.js';
import { DatabaseError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// MOCKS
// =============================================================================

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
 * Creates a properly typed mock QueryResult.
 */
function createQueryResult<T extends QueryResultRow>(rows: T[], rowCount?: number): QueryResult<T> {
  return {
    rows,
    command: 'SELECT',
    rowCount: rowCount ?? rows.length,
    oid: 0,
    fields: [],
  };
}

/**
 * Mock PoolClient interface matching pg.PoolClient usage.
 */
interface MockPoolClient {
  query: Mock;
  release: Mock;
}

/**
 * Mock Pool interface matching pg.Pool usage.
 * Note: This is a partial mock for testing purposes.
 */
interface MockPool {
  query: Mock;
  connect: Mock;
}

function createMockPool(): MockPool {
  const mockClient: MockPoolClient = {
    query: vi.fn().mockResolvedValue(createQueryResult([])),
    release: vi.fn(),
  };

  return {
    query: vi.fn().mockResolvedValue(createQueryResult([])),
    connect: vi.fn().mockResolvedValue(mockClient),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('ActivityService', () => {
  let service: ActivityService;
  let mockPool: MockPool;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockPool = createMockPool();
    mockLogger = createMockLogger();

    // Cast mockPool to Pool via unknown - MockPool is a partial mock that
    // provides the interface methods used by ActivityService
    service = new ActivityService({
      pool: mockPool as unknown as Pool,
      logger: mockLogger,
      timeoutInterval: '1 hour',
    });
  });

  describe('logActivity', () => {
    it('logs a new activity successfully', async () => {
      const activityId = 'test-activity-id';
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ id: activityId }]));

      const result = await service.logActivity({
        actorDid: 'did:plc:testuser' as DID,
        collection: 'pub.chive.eprint.submission' as NSID,
        rkey: 'abc123',
        action: 'create',
        category: 'eprint_submit',
        targetUri: 'at://did:plc:target/pub.chive.eprint.submission/xyz' as AtUri,
        targetTitle: 'Test Eprint',
        traceId: 'trace123',
        spanId: 'span456',
        sessionId: 'session789',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(activityId);
      }

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activities'),
        expect.arrayContaining(['did:plc:testuser', 'pub.chive.eprint.submission', 'abc123'])
      );
    });

    it('returns error when insert fails', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.logActivity({
        actorDid: 'did:plc:testuser' as DID,
        collection: 'pub.chive.eprint.submission' as NSID,
        rkey: 'abc123',
        action: 'create',
        category: 'eprint_submit',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
      }

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('returns error when no row returned', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const result = await service.logActivity({
        actorDid: 'did:plc:testuser' as DID,
        collection: 'pub.chive.review.endorsement' as NSID,
        rkey: 'def456',
        action: 'create',
        category: 'endorsement_create',
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('correlateWithFirehose', () => {
    it('correlates activity with firehose event', async () => {
      const activityId = 'correlated-activity-id';
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ correlate_activity: activityId }]));

      const result = await service.correlateWithFirehose({
        repo: 'did:plc:testuser' as DID,
        collection: 'pub.chive.eprint.submission' as NSID,
        rkey: 'abc123',
        seq: 12345,
        uri: 'at://did:plc:testuser/pub.chive.eprint.submission/abc123' as AtUri,
        cid: 'bafyreiabc123' as CID,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(activityId);
      }

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT correlate_activity'),
        expect.arrayContaining(['did:plc:testuser', 'pub.chive.eprint.submission', 'abc123'])
      );
    });

    it('returns null when no pending activity found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ correlate_activity: null }]));

      const result = await service.correlateWithFirehose({
        repo: 'did:plc:testuser' as DID,
        collection: 'pub.chive.eprint.submission' as NSID,
        rkey: 'nonexistent',
        seq: 12345,
        uri: 'at://did:plc:testuser/pub.chive.eprint.submission/nonexistent' as AtUri,
        cid: 'bafyreiabc123' as CID,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('handles correlation errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Correlation failed'));

      const result = await service.correlateWithFirehose({
        repo: 'did:plc:testuser' as DID,
        collection: 'pub.chive.eprint.submission' as NSID,
        rkey: 'abc123',
        seq: 12345,
        uri: 'at://did:plc:testuser/pub.chive.eprint.submission/abc123' as AtUri,
        cid: 'bafyreiabc123' as CID,
      });

      expect(result.ok).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('markFailed', () => {
    it('marks activity as failed', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([], 1));

      const result = await service.markFailed(
        'did:plc:testuser' as DID,
        'pub.chive.eprint.submission' as NSID,
        'abc123',
        'PDS_WRITE_FAILED',
        'Failed to write to PDS'
      );

      expect(result.ok).toBe(true);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'failed'"),
        expect.arrayContaining(['did:plc:testuser', 'pub.chive.eprint.submission', 'abc123'])
      );
    });

    it('handles mark failed errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Update failed'));

      const result = await service.markFailed(
        'did:plc:testuser' as DID,
        'pub.chive.eprint.submission' as NSID,
        'abc123',
        'ERROR_CODE',
        'Error message'
      );

      expect(result.ok).toBe(false);
    });
  });

  describe('timeoutStaleActivities', () => {
    it('times out stale pending activities', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ timeout_stale_activities: 5 }]));

      const result = await service.timeoutStaleActivities();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(5);
      }

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT timeout_stale_activities'),
        expect.arrayContaining(['1 hour'])
      );
    });

    it('logs when activities are timed out', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ timeout_stale_activities: 3 }]));

      await service.timeoutStaleActivities();

      expect(mockLogger.info).toHaveBeenCalledWith('Timed out stale activities', { count: 3 });
    });

    it('does not log when no activities timed out', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ timeout_stale_activities: 0 }]));

      await service.timeoutStaleActivities();

      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('getActivityFeed', () => {
    it('returns paginated activity feed', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          actor_did: 'did:plc:user1',
          collection: 'pub.chive.eprint.submission',
          rkey: 'abc123',
          action: 'create',
          action_category: 'eprint_submit',
          status: 'confirmed',
          initiated_at: new Date('2024-01-01T12:00:00Z'),
          confirmed_at: new Date('2024-01-01T12:00:05Z'),
          firehose_seq: '12345',
          firehose_uri: 'at://did:plc:user1/pub.chive.eprint.submission/abc123',
          firehose_cid: 'bafyreiabc123',
          target_uri: null,
          target_title: null,
          trace_id: null,
          span_id: null,
          session_id: null,
          error_code: null,
          error_message: null,
        },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockActivities));

      const result = await service.getActivityFeed({
        actorDid: 'did:plc:user1' as DID,
        limit: 10,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.activities).toHaveLength(1);
        const firstActivity = result.value.activities[0];
        expect(firstActivity).toBeDefined();
        if (firstActivity) {
          expect(firstActivity.id).toBe('activity-1');
          expect(firstActivity.status).toBe('confirmed');
        }
        expect(result.value.cursor).toBeNull();
      }
    });

    it('applies category filter', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await service.getActivityFeed({
        actorDid: 'did:plc:user1' as DID,
        category: 'endorsement_create',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('action_category ='),
        expect.arrayContaining(['did:plc:user1', 'endorsement_create'])
      );
    });

    it('applies status filter', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await service.getActivityFeed({
        actorDid: 'did:plc:user1' as DID,
        status: 'pending',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status ='),
        expect.arrayContaining(['did:plc:user1', 'pending'])
      );
    });
  });

  describe('getPendingCount', () => {
    it('returns count of pending activities', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ count: '42' }]));

      const result = await service.getPendingCount();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("status = 'pending'"));
    });
  });

  describe('batchCorrelate', () => {
    it('correlates multiple activities in batch', async () => {
      const mockClient: MockPoolClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce(createQueryResult([])) // BEGIN
          .mockResolvedValueOnce(createQueryResult([{ correlate_activity: 'activity-1' }]))
          .mockResolvedValueOnce(createQueryResult([{ correlate_activity: null }]))
          .mockResolvedValueOnce(createQueryResult([{ correlate_activity: 'activity-3' }]))
          .mockResolvedValueOnce(createQueryResult([])), // COMMIT
        release: vi.fn(),
      };
      mockPool.connect.mockResolvedValueOnce(mockClient);

      const inputs = [
        {
          repo: 'did:plc:user1' as DID,
          collection: 'pub.chive.eprint.submission' as NSID,
          rkey: 'rkey1',
          seq: 1,
          uri: 'at://did:plc:user1/pub.chive.eprint.submission/rkey1' as AtUri,
          cid: 'cid1' as CID,
        },
        {
          repo: 'did:plc:user2' as DID,
          collection: 'pub.chive.review.endorsement' as NSID,
          rkey: 'rkey2',
          seq: 2,
          uri: 'at://did:plc:user2/pub.chive.review.endorsement/rkey2' as AtUri,
          cid: 'cid2' as CID,
        },
        {
          repo: 'did:plc:user3' as DID,
          collection: 'pub.chive.eprint.userTag' as NSID,
          rkey: 'rkey3',
          seq: 3,
          uri: 'at://did:plc:user3/pub.chive.eprint.userTag/rkey3' as AtUri,
          cid: 'cid3' as CID,
        },
      ];

      const result = await service.batchCorrelate(inputs);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(2); // 2 were correlated
        expect(result.value.get('rkey1')).toBe('activity-1');
        expect(result.value.get('rkey3')).toBe('activity-3');
        expect(result.value.has('rkey2')).toBe(false);
      }

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns empty map for empty input', async () => {
      const result = await service.batchCorrelate([]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(0);
      }

      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('rolls back on error', async () => {
      const mockClient: MockPoolClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce(createQueryResult([])) // BEGIN
          .mockRejectedValueOnce(new Error('Correlation failed')), // First correlation
        release: vi.fn(),
      };
      mockPool.connect.mockResolvedValueOnce(mockClient);

      const inputs = [
        {
          repo: 'did:plc:user1' as DID,
          collection: 'pub.chive.eprint.submission' as NSID,
          rkey: 'rkey1',
          seq: 1,
          uri: 'at://did:plc:user1/pub.chive.eprint.submission/rkey1' as AtUri,
          cid: 'cid1' as CID,
        },
      ];

      const result = await service.batchCorrelate(inputs);

      expect(result.ok).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getActivity', () => {
    it('returns activity by ID', async () => {
      const mockActivity = {
        id: 'activity-1',
        actor_did: 'did:plc:user1',
        collection: 'pub.chive.eprint.submission',
        rkey: 'abc123',
        action: 'create',
        action_category: 'eprint_submit',
        status: 'confirmed',
        initiated_at: new Date('2024-01-01T12:00:00Z'),
        confirmed_at: new Date('2024-01-01T12:00:05Z'),
        firehose_seq: '12345',
        firehose_uri: 'at://did:plc:user1/pub.chive.eprint.submission/abc123',
        firehose_cid: 'bafyreiabc123',
        target_uri: null,
        target_title: null,
        trace_id: 'trace123',
        span_id: 'span456',
        session_id: 'session789',
        error_code: null,
        error_message: null,
      };

      mockPool.query.mockResolvedValueOnce(createQueryResult([mockActivity]));

      const result = await service.getActivity('activity-1');

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.id).toBe('activity-1');
        expect(result.value.traceId).toBe('trace123');
        expect(result.value.firehoseSeq).toBe(12345);
      }
    });

    it('returns null for non-existent activity', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const result = await service.getActivity('nonexistent');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });
});
