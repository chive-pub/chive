/**
 * Unit tests for EventQueue.
 *
 * @remarks
 * The queue sits between the firehose and the indexer. Two of its properties
 * decide whether events are lost: backpressure, which stops an unbounded queue
 * exhausting memory, and the hand-off to the dead letter queue when a job has
 * exhausted its retries. Neither had a test.
 *
 * BullMQ is mocked because it opens a Redis connection in its constructor; what
 * is under test is Chive's logic around it, not BullMQ.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const queueState = {
  waiting: 0,
  active: 0,
  delayed: 0,
  added: [] as { name: string; data: unknown; opts: unknown }[],
};

const workerHandlers = new Map<string, (job: unknown, error: unknown) => void>();

vi.mock('bullmq', () => ({
  Queue: class {
    add(name: string, data: unknown, opts: unknown): Promise<void> {
      queueState.added.push({ name, data, opts });
      return Promise.resolve();
    }
    getWaitingCount(): Promise<number> {
      return Promise.resolve(queueState.waiting);
    }
    getActiveCount(): Promise<number> {
      return Promise.resolve(queueState.active);
    }
    getDelayedCount(): Promise<number> {
      return Promise.resolve(queueState.delayed);
    }
    getCompletedCount(): Promise<number> {
      return Promise.resolve(0);
    }
    getFailedCount(): Promise<number> {
      return Promise.resolve(0);
    }
    pause(): Promise<void> {
      return Promise.resolve();
    }
    resume(): Promise<void> {
      return Promise.resolve();
    }
    drain(): Promise<void> {
      return Promise.resolve();
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
    obliterate(): Promise<void> {
      return Promise.resolve();
    }
  },
  Worker: class {
    on(event: string, handler: (job: unknown, error: unknown) => void): void {
      workerHandlers.set(event, handler);
    }
    pause(): Promise<void> {
      return Promise.resolve();
    }
    resume(): void {
      return;
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
  },
  QueueEvents: class {
    on(): void {
      return;
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

const { EventQueue, BackpressureError } = await import('@/services/indexing/event-queue.js');

function createDlq(): { add: ReturnType<typeof vi.fn> } {
  return { add: vi.fn().mockResolvedValue(1) };
}

function build(dlq: ReturnType<typeof createDlq>, overrides: Record<string, unknown> = {}) {
  return new EventQueue({
    redis: {} as never,
    processor: vi.fn(),
    dlq: dlq as never,
    ...overrides,
  });
}

const EVENT = { seq: 1, repo: 'did:plc:x', $type: 'commit' } as never;

describe('EventQueue', () => {
  beforeEach(() => {
    queueState.waiting = 0;
    queueState.active = 0;
    queueState.delayed = 0;
    queueState.added = [];
    workerHandlers.clear();
  });

  describe('backpressure', () => {
    it('accepts events below the threshold', async () => {
      queueState.waiting = 5;
      const queue = build(createDlq(), { maxQueueDepth: 10 });

      await queue.add(EVENT);

      expect(queueState.added).toHaveLength(1);
    });

    it('refuses events at the threshold rather than growing without bound', async () => {
      queueState.waiting = 10;
      const queue = build(createDlq(), { maxQueueDepth: 10 });

      await expect(queue.add(EVENT)).rejects.toBeInstanceOf(BackpressureError);
      expect(queueState.added).toHaveLength(0);
    });

    it('counts waiting, active and delayed jobs toward the depth', async () => {
      // Counting only waiting jobs would let the queue hold three times the
      // configured maximum before it refused anything.
      queueState.waiting = 4;
      queueState.active = 4;
      queueState.delayed = 4;
      const queue = build(createDlq(), { maxQueueDepth: 10 });

      await expect(queue.add(EVENT)).rejects.toBeInstanceOf(BackpressureError);
    });

    it('reports the depth and the limit on the error', async () => {
      queueState.waiting = 12;
      const queue = build(createDlq(), { maxQueueDepth: 10 });

      await expect(queue.add(EVENT)).rejects.toMatchObject({ queueDepth: 12, maxDepth: 10 });
    });
  });

  describe('dead letter hand-off', () => {
    it('sends a job to the DLQ once its retries are exhausted', () => {
      const dlq = createDlq();
      build(dlq, { maxRetries: 3 });

      const failed = workerHandlers.get('failed');
      expect(failed, 'the queue must subscribe to failed jobs').toBeDefined();

      failed?.({ data: { event: EVENT }, attemptsMade: 4 }, new Error('permanent'));

      expect(dlq.add).toHaveBeenCalledWith(EVENT, expect.any(Error), 3);
    });

    it('leaves a job alone while retries remain', () => {
      // Sending it to the DLQ early would record a permanent failure for an
      // event BullMQ is about to try again.
      const dlq = createDlq();
      build(dlq, { maxRetries: 3 });

      workerHandlers.get('failed')?.(
        { data: { event: EVENT }, attemptsMade: 2 },
        new Error('transient')
      );

      expect(dlq.add).not.toHaveBeenCalled();
    });

    it('ignores a failure with no job rather than throwing inside the handler', () => {
      const dlq = createDlq();
      build(dlq);

      expect(() => workerHandlers.get('failed')?.(null, new Error('x'))).not.toThrow();
      expect(dlq.add).not.toHaveBeenCalled();
    });

    it('wraps a non-Error rejection so the DLQ always records a message', () => {
      const dlq = createDlq();
      build(dlq, { maxRetries: 1 });

      workerHandlers.get('failed')?.({ data: { event: EVENT }, attemptsMade: 2 }, 'a bare string');

      expect(dlq.add).toHaveBeenCalledWith(EVENT, expect.any(Error), 1);
    });
  });
});
