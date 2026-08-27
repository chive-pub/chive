/**
 * Unit tests for CursorManager.
 *
 * @remarks
 * The cursor decides where the firehose resumes after a restart. Losing it
 * means replaying from the beginning; advancing it past unprocessed events
 * means never seeing them again. It had no unit test at all.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { CursorManager } from '@/services/indexing/cursor-manager.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

function createLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

function createDb(rows: Record<string, unknown>[] = []): {
  query: ReturnType<typeof vi.fn>;
} {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

function createRedis(cached: string | null = null): {
  get: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn().mockResolvedValue(cached),
    setex: vi.fn().mockResolvedValue('OK'),
  };
}

function build(
  db: ReturnType<typeof createDb>,
  redis: ReturnType<typeof createRedis>,
  overrides: Record<string, unknown> = {}
): CursorManager {
  return new CursorManager({
    db: db as never,
    redis: redis as never,
    serviceName: 'indexer',
    logger: createLogger(),
    ...overrides,
  });
}

describe('CursorManager', () => {
  let managers: CursorManager[];

  beforeEach(() => {
    managers = [];
  });

  afterEach(async () => {
    // Every instance starts a periodic timer in its constructor; leaving them
    // running leaks handles across the suite.
    for (const m of managers) {
      await m.close().catch(() => {
        // A test that made a flush fail leaves the cursor pending; teardown
        // only needs the timer stopped.
      });
    }
  });

  function track(m: CursorManager): CursorManager {
    managers.push(m);
    return m;
  }

  describe('getCurrentCursor', () => {
    it('returns null on a first run, rather than a zero the caller might resume from', async () => {
      const db = createDb([]);
      const manager = track(build(db, createRedis(null)));

      expect(await manager.getCurrentCursor()).toBeNull();
    });

    it('reads the cache without touching the database', async () => {
      const db = createDb([]);
      const manager = track(build(db, createRedis('4200')));

      const cursor = await manager.getCurrentCursor();

      expect(cursor?.seq).toBe(4200);
      expect(cursor?.fromCache).toBe(true);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('falls back to PostgreSQL, which is authoritative', async () => {
      const updated = new Date('2026-01-01T00:00:00Z');
      const db = createDb([{ cursor_seq: 99, last_updated: updated }]);
      const redis = createRedis(null);
      const manager = track(build(db, redis));

      const cursor = await manager.getCurrentCursor();

      expect(cursor).toMatchObject({ seq: 99, fromCache: false, lastUpdated: updated });
      expect(redis.setex).toHaveBeenCalledWith(expect.stringContaining('indexer'), 3600, '99');
    });

    it('ignores a cache entry that is not a number', async () => {
      // A corrupt cache value must not become a cursor position; resuming from
      // NaN would either replay everything or skip everything.
      const db = createDb([{ cursor_seq: 7, last_updated: new Date() }]);
      const manager = track(build(db, createRedis('not-a-number')));

      const cursor = await manager.getCurrentCursor();

      expect(cursor?.seq).toBe(7);
      expect(cursor?.fromCache).toBe(false);
    });

    it('scopes the cache key to the service', async () => {
      const redis = createRedis(null);
      const manager = track(
        build(createDb([{ cursor_seq: 1, last_updated: new Date() }]), redis, {
          serviceName: 'other-consumer',
        })
      );

      await manager.getCurrentCursor();

      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringContaining('other-consumer'),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('updateCursor', () => {
    it('batches rather than writing on every event', async () => {
      const db = createDb();
      const manager = track(build(db, createRedis(), { batchSize: 10 }));

      for (let i = 1; i <= 5; i += 1) await manager.updateCursor(i);

      expect(db.query).not.toHaveBeenCalled();
      expect(manager.getPendingCursor()).toBe(5);
      expect(manager.getEventCount()).toBe(5);
    });

    it('flushes once the batch size is reached', async () => {
      const db = createDb();
      const manager = track(build(db, createRedis(), { batchSize: 3 }));

      await manager.updateCursor(1);
      await manager.updateCursor(2);
      expect(db.query).not.toHaveBeenCalled();

      await manager.updateCursor(3);
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(manager.getEventCount()).toBe(0);
    });
  });

  describe('flush', () => {
    it('does nothing when there is no pending cursor', async () => {
      const db = createDb();
      const manager = track(build(db, createRedis()));

      await manager.flush();

      expect(db.query).not.toHaveBeenCalled();
    });

    it('does not rewrite an unchanged cursor', async () => {
      const db = createDb();
      const manager = track(build(db, createRedis(), { batchSize: 1000 }));

      await manager.updateCursor(42);
      await manager.flush();
      await manager.flush();

      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('upserts, so a restart cannot duplicate the row', async () => {
      const db = createDb();
      const manager = track(build(db, createRedis(), { batchSize: 1000 }));

      await manager.updateCursor(77);
      await manager.flush();

      const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ON CONFLICT');
      expect(params).toEqual(['indexer', 77]);
    });

    it('writes the database before the cache', async () => {
      // PostgreSQL is authoritative. Caching a position that failed to persist
      // would let a restart resume past events that were never recorded.
      const order: string[] = [];
      const db = {
        query: vi.fn(() => {
          order.push('db');
          return Promise.resolve({ rows: [] });
        }),
      };
      const redis = {
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn(() => {
          order.push('redis');
          return Promise.resolve('OK');
        }),
      };
      const manager = track(build(db as never, redis as never, { batchSize: 1000 }));

      await manager.updateCursor(5);
      await manager.flush();

      expect(order).toEqual(['db', 'redis']);
    });

    it('leaves the cursor unsaved when the database write fails', async () => {
      // Rejects once, then succeeds, so teardown's final flush can complete;
      // the assertions below are about the state left by the failed attempt.
      const db = {
        query: vi
          .fn()
          .mockRejectedValueOnce(new Error('write failed'))
          .mockResolvedValue({ rows: [] }),
      };
      const redis = createRedis();
      const manager = track(build(db as never, redis, { batchSize: 1000 }));

      await manager.updateCursor(11);
      await expect(manager.flush()).rejects.toThrow('write failed');

      // The cache must not advance past a position the database rejected.
      expect(redis.setex).not.toHaveBeenCalled();
      expect(manager.getPendingCursor()).toBe(11);
    });
  });

  describe('close', () => {
    it('flushes the pending cursor, so a shutdown does not lose position', async () => {
      const db = createDb();
      const manager = build(db, createRedis(), { batchSize: 1000 });

      await manager.updateCursor(123);
      await manager.close();

      expect(db.query).toHaveBeenCalledTimes(1);
      expect((db.query.mock.calls[0] as [string, unknown[]])[1]).toEqual(['indexer', 123]);
    });

    it('stops the periodic timer', async () => {
      vi.useFakeTimers();
      try {
        const db = createDb();
        const manager = build(db, createRedis(), { batchSize: 1000, flushInterval: 1000 });

        await manager.updateCursor(1);
        await manager.close();
        db.query.mockClear();

        await vi.advanceTimersByTimeAsync(5000);
        expect(db.query).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
