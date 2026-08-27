/**
 * Unit tests for DeadLetterQueue.
 *
 * @remarks
 * The DLQ is where firehose events go when indexing them fails. If it drops an
 * event, that record is never indexed and nothing says so; if a retry deletes
 * an entry it did not actually reprocess, the same. It had no unit test.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi } from 'vitest';

import { DeadLetterQueue } from '@/services/indexing/dlq-handler.js';
import type { DLQEvent } from '@/services/indexing/dlq-handler.js';

function createDb(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
}

function createAlerts(): { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

const EVENT: DLQEvent = {
  seq: 42,
  repo: 'did:plc:someone',
  $type: 'commit',
} as DLQEvent;

function build(
  db: ReturnType<typeof createDb>,
  alerts: ReturnType<typeof createAlerts>,
  overrides: Record<string, unknown> = {}
): DeadLetterQueue {
  return new DeadLetterQueue({ db: db as never, alerts: alerts as never, ...overrides });
}

describe('DeadLetterQueue', () => {
  describe('add', () => {
    it('records the event, the error and the retry count', async () => {
      const db = createDb();
      const dlq = build(db, createAlerts());

      const id = await dlq.add(EVENT, new Error('indexing blew up'), 2);

      expect(id).toBe(1);
      const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO firehose_dlq');
      expect(params[0]).toBe(42);
      expect(params[1]).toBe('did:plc:someone');
      expect(params[4]).toBe('indexing blew up');
      expect(params[6]).toBe(2);
    });

    it('stores the whole event, so a retry has something to replay', async () => {
      const db = createDb();
      const dlq = build(db, createAlerts());

      await dlq.add(EVENT, new Error('boom'));

      const params = (db.query.mock.calls[0] as [string, unknown[]])[1];
      expect(JSON.parse(params[3] as string)).toMatchObject({ seq: 42, $type: 'commit' });
    });

    it('throws when the insert returns no id rather than reporting success', async () => {
      // A silent failure here loses the event outright: the caller believes it
      // is queued for retry and it is not in the table.
      const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
      const dlq = build(db as never, createAlerts());

      await expect(dlq.add(EVENT, new Error('boom'))).rejects.toThrow(/no ID returned/);
    });

    it('classifies the error so retries can be targeted', async () => {
      const db = createDb();
      const classifier = { classify: vi.fn().mockReturnValue('permanent') };
      const dlq = build(db, createAlerts(), { classifier });

      await dlq.add(EVENT, new Error('bad record'));

      expect(classifier.classify).toHaveBeenCalled();
      expect((db.query.mock.calls[0] as [string, unknown[]])[1][5]).toBe('permanent');
    });
  });

  describe('retry', () => {
    it('removes the entry only after the processor succeeds', async () => {
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ event_data: JSON.stringify(EVENT), retry_count: 0 }] })
          .mockResolvedValue({ rows: [] }),
      };
      const dlq = build(db as never, createAlerts());

      const processor = vi.fn().mockResolvedValue(undefined);
      expect(await dlq.retry(1, processor)).toBe(true);

      expect(processor).toHaveBeenCalledWith(expect.objectContaining({ seq: 42 }));
      expect((db.query.mock.calls[1] as [string])[0]).toContain('DELETE FROM firehose_dlq');
    });

    it('keeps the entry and increments the count when the processor fails', async () => {
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ event_data: JSON.stringify(EVENT), retry_count: 3 }] })
          .mockResolvedValue({ rows: [] }),
      };
      const dlq = build(db as never, createAlerts());

      expect(await dlq.retry(1, vi.fn().mockRejectedValue(new Error('still broken')))).toBe(false);

      const [sql, params] = db.query.mock.calls[1] as [string, unknown[]];
      expect(sql).toContain('UPDATE firehose_dlq');
      expect(sql).not.toContain('DELETE');
      expect(params[0]).toBe(4);
    });

    it('reports a missing entry rather than silently succeeding', async () => {
      const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
      const dlq = build(db as never, createAlerts());

      await expect(dlq.retry(999, vi.fn())).rejects.toThrow();
    });

    it('accepts an already-parsed JSONB column', async () => {
      // The pg driver parses jsonb itself; treating the value as a string would
      // throw and turn every retry into a failure.
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ event_data: EVENT, retry_count: 0 }] })
          .mockResolvedValue({ rows: [] }),
      };
      const dlq = build(db as never, createAlerts());

      const processor = vi.fn().mockResolvedValue(undefined);
      expect(await dlq.retry(1, processor)).toBe(true);
      expect(processor).toHaveBeenCalledWith(expect.objectContaining({ seq: 42 }));
    });
  });
});
