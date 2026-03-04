/**
 * BackfillManager unit tests.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  BackfillManager,
  type BackfillOperation,
  type BackfillOperationType,
} from '@/services/admin/backfill-manager.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// ---------------------------------------------------------------------------
// Mock the prometheus-registry module so no real counters/histograms fire.
// ---------------------------------------------------------------------------
vi.mock('@/observability/prometheus-registry.js', () => ({
  backfillMetrics: {
    operationsTotal: { inc: vi.fn() },
    recordsProcessed: { inc: vi.fn() },
    duration: { startTimer: vi.fn(() => vi.fn()) },
  },
}));

// Re-import after mock so we can make assertions against the stubs.
type BackfillMetrics = typeof import('@/observability/prometheus-registry.js').backfillMetrics;
let backfillMetrics: BackfillMetrics;

beforeEach(async () => {
  const mod = await import('@/observability/prometheus-registry.js');
  backfillMetrics = mod.backfillMetrics;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * In-memory Redis mock backed by a Map.
 *
 * Supports get, setex, sadd, smembers, srem, and del.
 */
interface MockRedis {
  store: Map<string, string>;
  sets: Map<string, Set<string>>;
  get: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  sadd: ReturnType<typeof vi.fn>;
  smembers: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
}

function createMockRedis(): MockRedis {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  return {
    store,
    sets,

    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),

    setex: vi.fn((_key: string, _ttl: number, value: string) => {
      store.set(_key, value);
      return Promise.resolve('OK');
    }),

    sadd: vi.fn((key: string, member: string) => {
      const existing = sets.get(key) ?? new Set<string>();
      existing.add(member);
      sets.set(key, existing);
      return Promise.resolve(1);
    }),

    smembers: vi.fn((key: string) => {
      const s = sets.get(key);
      return Promise.resolve(s ? [...s] : []);
    }),

    srem: vi.fn((key: string, member: string) => {
      const s = sets.get(key);
      if (s) s.delete(member);
      return Promise.resolve(1);
    }),

    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
  };
}

function createMockLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

/**
 * Retrieves the child logger created by BackfillManager's constructor.
 *
 * @param parentLogger - the mock logger passed to BackfillManager
 * @returns the child ILogger mock
 */
function getChildLogger(parentLogger: ILogger): ILogger {
  const results = (parentLogger.child as ReturnType<typeof vi.fn>).mock.results;
  const first = results[0];
  expect(first).toBeDefined();
  return first.value as ILogger;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BackfillManager', () => {
  let manager: BackfillManager;
  let redis: MockRedis;
  let logger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();

    redis = createMockRedis();
    logger = createMockLogger();
    manager = new BackfillManager(redis as unknown as import('ioredis').Redis, logger);
  });

  // -----------------------------------------------------------------------
  // constructor
  // -----------------------------------------------------------------------

  describe('constructor', () => {
    it('creates a child logger with service context', () => {
      expect(logger.child).toHaveBeenCalledWith({ service: 'BackfillManager' });
    });
  });

  // -----------------------------------------------------------------------
  // startOperation
  // -----------------------------------------------------------------------

  describe('startOperation', () => {
    it('returns an operation record with initial status', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      expect(operation.id).toBeDefined();
      expect(operation.type).toBe('pdsScan');
      expect(operation.status).toBe('running');
      expect(operation.progress).toBe(0);
      expect(operation.recordsProcessed).toBe(0);
      expect(operation.startedAt).toBeDefined();
    });

    it('returns an AbortSignal that is not aborted initially', async () => {
      const { signal } = await manager.startOperation('pdsScan');

      expect(signal.aborted).toBe(false);
    });

    it('stores the operation in Redis with TTL', async () => {
      const { operation } = await manager.startOperation('freshnessScan');

      expect(redis.setex).toHaveBeenCalledWith(
        `chive:admin:backfill:${operation.id}`,
        86400,
        expect.any(String)
      );

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stored = JSON.parse(redis.store.get(`chive:admin:backfill:${operation.id}`)!);
      expect(stored.type).toBe('freshnessScan');
      expect(stored.status).toBe('running');
    });

    it('adds the operation ID to the operations set', async () => {
      const { operation } = await manager.startOperation('citationExtraction');

      expect(redis.sadd).toHaveBeenCalledWith('chive:admin:backfill:operations', operation.id);
    });

    it('stores optional metadata', async () => {
      const metadata = { pdsUrl: 'https://bsky.social', batchSize: 100 };
      const { operation } = await manager.startOperation('pdsScan', metadata);

      expect(operation.metadata).toEqual(metadata);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stored = JSON.parse(redis.store.get(`chive:admin:backfill:${operation.id}`)!);
      expect(stored.metadata).toEqual(metadata);
    });

    it('generates unique IDs for each operation', async () => {
      const { operation: op1 } = await manager.startOperation('pdsScan');
      const { operation: op2 } = await manager.startOperation('pdsScan');

      expect(op1.id).not.toBe(op2.id);
    });

    it('increments the started metrics counter', async () => {
      await manager.startOperation('fullReindex');

      expect(backfillMetrics.operationsTotal.inc).toHaveBeenCalledWith({
        type: 'fullReindex',
        status: 'started',
      });
    });

    it('starts a duration timer for metrics', async () => {
      await manager.startOperation('governanceSync');

      expect(backfillMetrics.duration.startTimer).toHaveBeenCalledWith({
        type: 'governanceSync',
      });
    });

    it('logs the start event', async () => {
      const { operation } = await manager.startOperation('didSync');

      // The logger is the child logger returned by child()
      const childLogger = getChildLogger(logger);
      expect(childLogger.info).toHaveBeenCalledWith('Backfill operation started', {
        id: operation.id,
        type: 'didSync',
      });
    });

    it.each<BackfillOperationType>([
      'pdsScan',
      'freshnessScan',
      'citationExtraction',
      'fullReindex',
      'governanceSync',
      'didSync',
    ])('accepts operation type "%s"', async (type) => {
      const { operation } = await manager.startOperation(type);
      expect(operation.type).toBe(type);
    });
  });

  // -----------------------------------------------------------------------
  // getStatus
  // -----------------------------------------------------------------------

  describe('getStatus', () => {
    it('returns the operation when it exists in Redis', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      const status = await manager.getStatus(operation.id);

      expect(status).not.toBeNull();
      expect(status!.id).toBe(operation.id);
      expect(status!.type).toBe('pdsScan');
      expect(status!.status).toBe('running');
    });

    it('returns null for a nonexistent operation ID', async () => {
      const status = await manager.getStatus('nonexistent-id');
      expect(status).toBeNull();
    });

    it('parses JSON from Redis correctly', async () => {
      const { operation } = await manager.startOperation('citationExtraction', {
        batchSize: 50,
      });

      const status = await manager.getStatus(operation.id);

      expect(status!.metadata).toEqual({ batchSize: 50 });
      expect(status!.progress).toBe(0);
      expect(status!.recordsProcessed).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // updateProgress
  // -----------------------------------------------------------------------

  describe('updateProgress', () => {
    it('updates progress and recordsProcessed', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      await manager.updateProgress(operation.id, 50, 250);

      const status = await manager.getStatus(operation.id);
      expect(status!.progress).toBe(50);
      expect(status!.recordsProcessed).toBe(250);
    });

    it('preserves existing operation fields', async () => {
      const metadata = { source: 'relay' };
      const { operation } = await manager.startOperation('freshnessScan', metadata);

      await manager.updateProgress(operation.id, 75, 1500);

      const status = await manager.getStatus(operation.id);
      expect(status!.type).toBe('freshnessScan');
      expect(status!.status).toBe('running');
      expect(status!.metadata).toEqual(metadata);
      expect(status!.startedAt).toBe(operation.startedAt);
    });

    it('does nothing when the operation does not exist', async () => {
      await manager.updateProgress('nonexistent-id', 50, 100);

      // setex should only have been called if the operation existed;
      // since no operation was started, no additional setex calls are made.
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('does nothing when the operation is not running', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.completeOperation(operation.id, 100);

      // Clear call counts after completeOperation
      redis.setex.mockClear();

      await manager.updateProgress(operation.id, 50, 50);

      // setex should not be called because the operation status is "completed"
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('allows updating progress to 100', async () => {
      const { operation } = await manager.startOperation('citationExtraction');

      await manager.updateProgress(operation.id, 100, 5000);

      const status = await manager.getStatus(operation.id);
      expect(status!.progress).toBe(100);
      expect(status!.recordsProcessed).toBe(5000);
      // Status remains running until explicitly completed
      expect(status!.status).toBe('running');
    });

    it('allows updating progress to 0', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      await manager.updateProgress(operation.id, 0, 0);

      const status = await manager.getStatus(operation.id);
      expect(status!.progress).toBe(0);
      expect(status!.recordsProcessed).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // completeOperation
  // -----------------------------------------------------------------------

  describe('completeOperation', () => {
    it('marks the operation as completed with progress 100', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      await manager.completeOperation(operation.id, 500);

      const status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('completed');
      expect(status!.progress).toBe(100);
      expect(status!.recordsProcessed).toBe(500);
      expect(status!.completedAt).toBeDefined();
    });

    it('uses the existing recordsProcessed when none provided', async () => {
      const { operation } = await manager.startOperation('freshnessScan');
      await manager.updateProgress(operation.id, 80, 400);

      await manager.completeOperation(operation.id);

      const status = await manager.getStatus(operation.id);
      expect(status!.recordsProcessed).toBe(400);
    });

    it('overrides recordsProcessed when explicitly provided', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.updateProgress(operation.id, 80, 400);

      await manager.completeOperation(operation.id, 999);

      const status = await manager.getStatus(operation.id);
      expect(status!.recordsProcessed).toBe(999);
    });

    it('does nothing when the operation does not exist', async () => {
      redis.setex.mockClear();

      await manager.completeOperation('nonexistent-id', 100);

      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('removes the abort controller', async () => {
      const { operation, signal } = await manager.startOperation('pdsScan');

      await manager.completeOperation(operation.id, 100);

      // Attempting to cancel after completion should return false
      const cancelled = await manager.cancelOperation(operation.id);
      expect(cancelled).toBe(false);
      // Signal should not be aborted (no cancel was called)
      expect(signal.aborted).toBe(false);
    });

    it('increments the completed metrics counter', async () => {
      const { operation } = await manager.startOperation('fullReindex');
      vi.mocked(backfillMetrics.operationsTotal.inc).mockClear();

      await manager.completeOperation(operation.id, 1000);

      expect(backfillMetrics.operationsTotal.inc).toHaveBeenCalledWith({
        type: 'fullReindex',
        status: 'completed',
      });
    });

    it('increments the recordsProcessed metrics counter', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      await manager.completeOperation(operation.id, 750);

      expect(backfillMetrics.recordsProcessed.inc).toHaveBeenCalledWith({ type: 'pdsScan' }, 750);
    });

    it('does not increment recordsProcessed metrics when count is zero', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      vi.mocked(backfillMetrics.recordsProcessed.inc).mockClear();

      await manager.completeOperation(operation.id, 0);

      // 0 is falsy, so the conditional guard prevents the call
      expect(backfillMetrics.recordsProcessed.inc).not.toHaveBeenCalled();
    });

    it('ends the duration timer', async () => {
      const mockEndTimer = vi.fn();
      vi.mocked(backfillMetrics.duration.startTimer).mockReturnValue(mockEndTimer);

      const { operation } = await manager.startOperation('governanceSync');

      await manager.completeOperation(operation.id, 10);

      expect(mockEndTimer).toHaveBeenCalled();
    });

    it('logs the completion event', async () => {
      const { operation } = await manager.startOperation('didSync');
      const childLogger = getChildLogger(logger);

      await manager.completeOperation(operation.id, 42);

      expect(childLogger.info).toHaveBeenCalledWith('Backfill operation completed', {
        id: operation.id,
        recordsProcessed: 42,
      });
    });
  });

  // -----------------------------------------------------------------------
  // failOperation
  // -----------------------------------------------------------------------

  describe('failOperation', () => {
    it('marks the operation as failed with an error message', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      await manager.failOperation(operation.id, 'Connection timeout');

      const status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('failed');
      expect(status!.error).toBe('Connection timeout');
      expect(status!.completedAt).toBeDefined();
    });

    it('preserves original operation data', async () => {
      const metadata = { retryCount: 3 };
      const { operation } = await manager.startOperation('citationExtraction', metadata);
      await manager.updateProgress(operation.id, 25, 100);

      await manager.failOperation(operation.id, 'GROBID service unavailable');

      const status = await manager.getStatus(operation.id);
      expect(status!.type).toBe('citationExtraction');
      expect(status!.metadata).toEqual(metadata);
      expect(status!.progress).toBe(25);
      expect(status!.recordsProcessed).toBe(100);
    });

    it('does nothing when the operation does not exist', async () => {
      redis.setex.mockClear();

      await manager.failOperation('nonexistent-id', 'Some error');

      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('removes the abort controller', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      await manager.failOperation(operation.id, 'Error');

      const cancelled = await manager.cancelOperation(operation.id);
      expect(cancelled).toBe(false);
    });

    it('increments the failed metrics counter', async () => {
      const { operation } = await manager.startOperation('freshnessScan');
      vi.mocked(backfillMetrics.operationsTotal.inc).mockClear();

      await manager.failOperation(operation.id, 'timeout');

      expect(backfillMetrics.operationsTotal.inc).toHaveBeenCalledWith({
        type: 'freshnessScan',
        status: 'failed',
      });
    });

    it('ends the duration timer', async () => {
      const mockEndTimer = vi.fn();
      vi.mocked(backfillMetrics.duration.startTimer).mockReturnValue(mockEndTimer);

      const { operation } = await manager.startOperation('pdsScan');

      await manager.failOperation(operation.id, 'crash');

      expect(mockEndTimer).toHaveBeenCalled();
    });

    it('logs the failure event', async () => {
      const { operation } = await manager.startOperation('didSync');
      const childLogger = getChildLogger(logger);

      await manager.failOperation(operation.id, 'DID resolution failed');

      expect(childLogger.error).toHaveBeenCalledWith('Backfill operation failed', undefined, {
        id: operation.id,
        error: 'DID resolution failed',
      });
    });
  });

  // -----------------------------------------------------------------------
  // cancelOperation
  // -----------------------------------------------------------------------

  describe('cancelOperation', () => {
    it('returns true and aborts the signal for a running operation', async () => {
      const { operation, signal } = await manager.startOperation('pdsScan');

      const result = await manager.cancelOperation(operation.id);

      expect(result).toBe(true);
      expect(signal.aborted).toBe(true);
    });

    it('marks the operation as cancelled with completedAt', async () => {
      const { operation } = await manager.startOperation('freshnessScan');

      await manager.cancelOperation(operation.id);

      const status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('cancelled');
      expect(status!.completedAt).toBeDefined();
    });

    it('returns false for a nonexistent operation', async () => {
      const result = await manager.cancelOperation('nonexistent-id');
      expect(result).toBe(false);
    });

    it('returns false for a completed operation', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.completeOperation(operation.id, 100);

      const result = await manager.cancelOperation(operation.id);
      expect(result).toBe(false);
    });

    it('returns false for a failed operation', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.failOperation(operation.id, 'error');

      const result = await manager.cancelOperation(operation.id);
      expect(result).toBe(false);
    });

    it('returns false for an already-cancelled operation', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.cancelOperation(operation.id);

      const result = await manager.cancelOperation(operation.id);
      expect(result).toBe(false);
    });

    it('removes the abort controller after cancellation', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      await manager.cancelOperation(operation.id);

      // A second cancel should return false because the controller was removed
      const result = await manager.cancelOperation(operation.id);
      expect(result).toBe(false);
    });

    it('increments the cancelled metrics counter', async () => {
      const { operation } = await manager.startOperation('fullReindex');
      vi.mocked(backfillMetrics.operationsTotal.inc).mockClear();

      await manager.cancelOperation(operation.id);

      expect(backfillMetrics.operationsTotal.inc).toHaveBeenCalledWith({
        type: 'fullReindex',
        status: 'cancelled',
      });
    });

    it('ends the duration timer', async () => {
      const mockEndTimer = vi.fn();
      vi.mocked(backfillMetrics.duration.startTimer).mockReturnValue(mockEndTimer);

      const { operation } = await manager.startOperation('citationExtraction');

      await manager.cancelOperation(operation.id);

      expect(mockEndTimer).toHaveBeenCalled();
    });

    it('logs the cancellation event', async () => {
      const { operation } = await manager.startOperation('governanceSync');
      const childLogger = getChildLogger(logger);

      await manager.cancelOperation(operation.id);

      expect(childLogger.info).toHaveBeenCalledWith('Backfill operation cancelled', {
        id: operation.id,
      });
    });
  });

  // -----------------------------------------------------------------------
  // listOperations
  // -----------------------------------------------------------------------

  describe('listOperations', () => {
    it('returns an empty list when no operations exist', async () => {
      const ops = await manager.listOperations();
      expect(ops).toEqual([]);
    });

    it('returns all operations across statuses', async () => {
      await manager.startOperation('pdsScan');
      const { operation: op2 } = await manager.startOperation('freshnessScan');
      await manager.completeOperation(op2.id, 50);

      const ops = await manager.listOperations();

      expect(ops).toHaveLength(2);
      const types = ops.map((o) => o.type);
      expect(types).toContain('pdsScan');
      expect(types).toContain('freshnessScan');
    });

    it('filters by status when provided', async () => {
      const { operation: opPds } = await manager.startOperation('pdsScan');
      await manager.startOperation('freshnessScan');
      await manager.completeOperation(opPds.id, 100);

      const running = await manager.listOperations('running');
      expect(running).toHaveLength(1);
      expect(running[0]!.type).toBe('freshnessScan');

      const completed = await manager.listOperations('completed');
      expect(completed).toHaveLength(1);
      expect(completed[0]!.type).toBe('pdsScan');
    });

    it('returns an empty list when no operations match the filter', async () => {
      await manager.startOperation('pdsScan');

      const failed = await manager.listOperations('failed');
      expect(failed).toEqual([]);
    });

    it('sorts operations by startedAt descending', async () => {
      // Insert operations with explicit, deterministic timestamps by writing
      // directly to the mock Redis store so ordering is guaranteed.
      const ids = ['aaa', 'bbb', 'ccc'];
      const timestamps = [
        '2025-01-01T00:00:00.000Z', // oldest
        '2025-06-01T00:00:00.000Z', // middle
        '2025-12-01T00:00:00.000Z', // newest
      ];

      for (let i = 0; i < ids.length; i++) {
        const op: BackfillOperation = {
          id: ids[i]!,
          type: 'pdsScan',
          status: 'running',
          startedAt: timestamps[i]!,
          progress: 0,
          recordsProcessed: 0,
        };
        redis.store.set(`chive:admin:backfill:${ids[i]}`, JSON.stringify(op));
        if (!redis.sets.has('chive:admin:backfill:operations')) {
          redis.sets.set('chive:admin:backfill:operations', new Set());
        }
        redis.sets.get('chive:admin:backfill:operations')!.add(ids[i]!);
      }

      const ops = await manager.listOperations();

      // Most recent first
      expect(ops[0]!.id).toBe('ccc');
      expect(ops[1]!.id).toBe('bbb');
      expect(ops[2]!.id).toBe('aaa');
    });

    it('cleans up stale set entries when Redis key has expired', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      // Simulate the key expiring in Redis while the ID remains in the set
      redis.store.delete(`chive:admin:backfill:${operation.id}`);

      const ops = await manager.listOperations();

      expect(ops).toEqual([]);
      expect(redis.srem).toHaveBeenCalledWith('chive:admin:backfill:operations', operation.id);
    });

    it('handles a mix of valid and expired entries', async () => {
      const { operation: op1 } = await manager.startOperation('pdsScan');
      const { operation: op2 } = await manager.startOperation('freshnessScan');

      // Expire only op1
      redis.store.delete(`chive:admin:backfill:${op1.id}`);

      const ops = await manager.listOperations();

      expect(ops).toHaveLength(1);
      expect(ops[0]!.id).toBe(op2.id);
    });
  });

  // -----------------------------------------------------------------------
  // Full lifecycle scenarios
  // -----------------------------------------------------------------------

  describe('full lifecycle', () => {
    it('supports start -> progress -> complete lifecycle', async () => {
      const { operation } = await manager.startOperation('citationExtraction', {
        batchSize: 100,
      });

      // Progress updates
      await manager.updateProgress(operation.id, 25, 250);
      let status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('running');
      expect(status!.progress).toBe(25);

      await manager.updateProgress(operation.id, 50, 500);
      status = await manager.getStatus(operation.id);
      expect(status!.progress).toBe(50);

      await manager.updateProgress(operation.id, 75, 750);
      status = await manager.getStatus(operation.id);
      expect(status!.progress).toBe(75);

      // Complete
      await manager.completeOperation(operation.id, 1000);
      status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('completed');
      expect(status!.progress).toBe(100);
      expect(status!.recordsProcessed).toBe(1000);
    });

    it('supports start -> progress -> fail lifecycle', async () => {
      const { operation } = await manager.startOperation('fullReindex');

      await manager.updateProgress(operation.id, 10, 100);
      await manager.failOperation(operation.id, 'Elasticsearch cluster red');

      const status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('failed');
      expect(status!.error).toBe('Elasticsearch cluster red');
      expect(status!.progress).toBe(10);
    });

    it('supports start -> cancel lifecycle', async () => {
      const { operation, signal } = await manager.startOperation('governanceSync');

      await manager.updateProgress(operation.id, 30, 150);
      const cancelled = await manager.cancelOperation(operation.id);

      expect(cancelled).toBe(true);
      expect(signal.aborted).toBe(true);

      const status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('cancelled');
    });

    it('prevents progress updates after completion', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.completeOperation(operation.id, 500);

      await manager.updateProgress(operation.id, 50, 250);

      const status = await manager.getStatus(operation.id);
      // Progress should remain at 100 (completed), not 50
      expect(status!.progress).toBe(100);
      expect(status!.recordsProcessed).toBe(500);
    });

    it('prevents progress updates after failure', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.failOperation(operation.id, 'timeout');

      await manager.updateProgress(operation.id, 50, 250);

      const status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('failed');
    });

    it('prevents progress updates after cancellation', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.cancelOperation(operation.id);

      await manager.updateProgress(operation.id, 50, 250);

      const status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('cancelled');
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent operations
  // -----------------------------------------------------------------------

  describe('concurrent operations', () => {
    it('tracks multiple operations of different types simultaneously', async () => {
      const { operation: op1 } = await manager.startOperation('pdsScan');
      const { operation: op2 } = await manager.startOperation('citationExtraction');
      const { operation: op3 } = await manager.startOperation('fullReindex');

      const ops = await manager.listOperations();
      expect(ops).toHaveLength(3);

      // Each operation has independent state
      await manager.updateProgress(op1.id, 50, 500);
      await manager.completeOperation(op2.id, 1000);
      await manager.failOperation(op3.id, 'OOM');

      const s1 = await manager.getStatus(op1.id);
      const s2 = await manager.getStatus(op2.id);
      const s3 = await manager.getStatus(op3.id);

      expect(s1!.status).toBe('running');
      expect(s1!.progress).toBe(50);
      expect(s2!.status).toBe('completed');
      expect(s3!.status).toBe('failed');
    });

    it('cancels one operation without affecting others', async () => {
      const { operation: op1, signal: sig1 } = await manager.startOperation('pdsScan');
      const { operation: op2, signal: sig2 } = await manager.startOperation('freshnessScan');

      await manager.cancelOperation(op1.id);

      expect(sig1.aborted).toBe(true);
      expect(sig2.aborted).toBe(false);

      const s1 = await manager.getStatus(op1.id);
      const s2 = await manager.getStatus(op2.id);
      expect(s1!.status).toBe('cancelled');
      expect(s2!.status).toBe('running');
    });

    it('allows multiple operations of the same type', async () => {
      const { operation: op1 } = await manager.startOperation('pdsScan');
      const { operation: op2 } = await manager.startOperation('pdsScan');

      expect(op1.id).not.toBe(op2.id);

      const running = await manager.listOperations('running');
      expect(running).toHaveLength(2);
      expect(running.every((o) => o.type === 'pdsScan')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles completing an already-completed operation idempotently', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.completeOperation(operation.id, 100);

      // Calling completeOperation again should still work (it reads the stored record)
      await manager.completeOperation(operation.id, 200);

      const status = await manager.getStatus(operation.id);
      // The second completion overwrites the first
      expect(status!.status).toBe('completed');
      expect(status!.recordsProcessed).toBe(200);
    });

    it('handles failing an already-failed operation idempotently', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.failOperation(operation.id, 'first error');

      await manager.failOperation(operation.id, 'second error');

      const status = await manager.getStatus(operation.id);
      expect(status!.status).toBe('failed');
      expect(status!.error).toBe('second error');
    });

    it('preserves startedAt timestamp across updates', async () => {
      const { operation } = await manager.startOperation('freshnessScan');
      const originalStartedAt = operation.startedAt;

      await manager.updateProgress(operation.id, 50, 100);
      await manager.completeOperation(operation.id, 200);

      const status = await manager.getStatus(operation.id);
      expect(status!.startedAt).toBe(originalStartedAt);
    });

    it('handles operation with undefined metadata', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      const status = await manager.getStatus(operation.id);
      expect(status!.metadata).toBeUndefined();
    });

    it('handles empty metadata object', async () => {
      const { operation } = await manager.startOperation('pdsScan', {});

      const status = await manager.getStatus(operation.id);
      expect(status!.metadata).toEqual({});
    });

    it('handles Redis get returning null for expired keys', async () => {
      const { operation } = await manager.startOperation('pdsScan');

      // Simulate Redis key expiration
      redis.store.delete(`chive:admin:backfill:${operation.id}`);

      const status = await manager.getStatus(operation.id);
      expect(status).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Metrics integration
  // -----------------------------------------------------------------------

  describe('metrics integration', () => {
    it('does not end duration timer if it was not tracked', async () => {
      // Start an operation so a timer is tracked for it.
      await manager.startOperation('pdsScan');

      // Now mock startTimer to return a fresh mock for the next operation.
      const mockEndTimer = vi.fn();
      vi.mocked(backfillMetrics.duration.startTimer).mockReturnValue(mockEndTimer);

      // A new operation with the mocked timer
      const { operation: op2 } = await manager.startOperation('freshnessScan');
      await manager.completeOperation(op2.id, 100);

      expect(mockEndTimer).toHaveBeenCalledTimes(1);
    });

    it('tracks recordsProcessed metrics using existing count when not provided', async () => {
      const { operation } = await manager.startOperation('pdsScan');
      await manager.updateProgress(operation.id, 80, 400);

      vi.mocked(backfillMetrics.recordsProcessed.inc).mockClear();

      await manager.completeOperation(operation.id);

      expect(backfillMetrics.recordsProcessed.inc).toHaveBeenCalledWith({ type: 'pdsScan' }, 400);
    });
  });
});
