/**
 * The relay-side subscription must request every collection Chive observes.
 *
 * @remarks
 * The relay decides what arrives; the local EventFilter can only narrow that
 * stream, never widen it. So a collection admitted by the filter but absent
 * from the subscription never reaches the process at all. That failure is
 * silent in both directions: the plugin loads and subscribes, the filter says
 * yes, and no record ever comes.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  OBSERVED_COLLECTIONS,
  OBSERVED_COLLECTIONS_HIGH_VOLUME,
} from '@/services/indexing/indexed-collections.js';
import {
  IndexingService,
  type IndexingServiceOptions,
  type EventProcessor,
} from '@/services/indexing/indexing-service.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const subscribe = vi.fn();

vi.mock('@/services/indexing/firehose-consumer.js', () => ({
  FirehoseConsumer: class MockFirehoseConsumer {
    subscribe = (...args: unknown[]): AsyncIterable<never> => {
      subscribe(...args);
      return { [Symbol.asyncIterator]: async function* () {} };
    };
    disconnect = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@/services/indexing/cursor-manager.js', () => ({
  CursorManager: class MockCursorManager {
    getCurrentCursor = vi.fn().mockResolvedValue(null);
    updateCursor = vi.fn().mockResolvedValue(undefined);
    flush = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    getPendingCursor = vi.fn().mockReturnValue(null);
  },
}));

vi.mock('@/services/indexing/event-queue.js', () => ({
  EventQueue: class MockEventQueue {
    add = vi.fn().mockResolvedValue(undefined);
    drain = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
  },
  BackpressureError: class BackpressureError extends Error {},
}));

vi.mock('@/services/indexing/dlq-handler.js', () => ({
  DeadLetterQueue: class MockDeadLetterQueue {
    add = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@/services/indexing/reconnection-manager.js', () => ({
  ReconnectionManager: class MockReconnectionManager {},
}));

function createLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as ILogger;
}

async function subscribedCollections(
  extra: Partial<IndexingServiceOptions>
): Promise<readonly string[]> {
  const service = new IndexingService({
    relays: ['wss://bsky.network'],
    db: {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as IndexingServiceOptions['db'],
    redis: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    } as unknown as IndexingServiceOptions['redis'],
    processor: vi.fn().mockResolvedValue(undefined) as unknown as EventProcessor,
    logger: createLogger(),
    ...extra,
  });

  await service.start();
  await service.stop();

  expect(subscribe).toHaveBeenCalled();
  const options = subscribe.mock.calls[0]?.[0] as { filter?: { collections?: string[] } };
  return options.filter?.collections ?? [];
}

describe('relay subscription filter', () => {
  beforeEach(() => {
    subscribe.mockClear();
  });

  it('requests every observed collection when no Chive collection list is set', async () => {
    const observed = [...OBSERVED_COLLECTIONS];
    const requested = await subscribedCollections({ observedCollections: observed });

    for (const collection of observed) {
      expect(requested).toContain(collection);
    }
  });

  it('requests the Chive namespace by wildcard when no collection list is set', async () => {
    const requested = await subscribedCollections({
      observedCollections: [...OBSERVED_COLLECTIONS],
    });

    expect(requested).toContain('pub.chive.*');
  });

  it('requests observed collections alongside an explicit Chive collection list', async () => {
    const requested = await subscribedCollections({
      collections: [
        'pub.chive.eprint.submission',
      ] as unknown as IndexingServiceOptions['collections'],
      observedCollections: [...OBSERVED_COLLECTIONS],
    });

    expect(requested).toContain('pub.chive.eprint.submission');
    for (const collection of OBSERVED_COLLECTIONS) {
      expect(requested).toContain(collection);
    }
  });

  it('requests the high-volume collections when they are observed', async () => {
    const observed = [...OBSERVED_COLLECTIONS, ...OBSERVED_COLLECTIONS_HIGH_VOLUME];
    const requested = await subscribedCollections({ observedCollections: observed });

    for (const collection of OBSERVED_COLLECTIONS_HIGH_VOLUME) {
      expect(requested).toContain(collection);
    }
  });

  it('always supplies a filter, so the consumer never falls back to its default', async () => {
    await subscribedCollections({ observedCollections: [...OBSERVED_COLLECTIONS] });

    const options = subscribe.mock.calls[0]?.[0] as { filter?: unknown };
    expect(options.filter).toBeDefined();
  });
});
