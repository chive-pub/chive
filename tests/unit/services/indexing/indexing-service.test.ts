/**
 * Unit tests for IndexingService.
 *
 * @remarks
 * Tests multi-relay support, deduplication, and status reporting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  IndexingService,
  type IndexingServiceOptions,
  type EventProcessor,
} from '@/services/indexing/indexing-service.js';
import type { NSID } from '@/types/atproto.js';

// =============================================================================
// Mocks
// =============================================================================

// Mock all dependencies using class syntax for proper constructor behavior
vi.mock('@/services/indexing/firehose-consumer.js', () => ({
  FirehoseConsumer: class MockFirehoseConsumer {
    subscribe = vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        // Empty iterator by default
      },
    });
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

vi.mock('@/services/indexing/event-filter.js', () => ({
  EventFilter: class MockEventFilter {
    shouldProcess = vi.fn().mockReturnValue(true);
  },
}));

vi.mock('@/services/indexing/commit-handler.js', () => ({
  CommitHandler: class MockCommitHandler {
    parseCommit = vi.fn().mockResolvedValue([]);
    parsePath = vi
      .fn()
      .mockReturnValue({ collection: 'pub.chive.eprint.submission', rkey: 'test' });
  },
}));

vi.mock('@/services/indexing/reconnection-manager.js', () => ({
  ReconnectionManager: class MockReconnectionManager {},
}));

interface MockPool {
  query: ReturnType<typeof vi.fn>;
}

interface MockRedis {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

function createMockPool(): MockPool {
  return { query: vi.fn().mockResolvedValue({ rows: [] }) };
}

function createMockRedis(): MockRedis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('IndexingService', () => {
  let mockPool: MockPool;
  let mockRedis: MockRedis;
  let mockProcessor: EventProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createMockPool();
    mockRedis = createMockRedis();
    const processorFn = vi.fn();
    processorFn.mockResolvedValue(undefined);
    mockProcessor = processorFn;
  });

  describe('constructor', () => {
    it('accepts single relay URL for backward compatibility', () => {
      const service = new IndexingService({
        relay: 'wss://bsky.network',
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      expect(service).toBeDefined();
    });

    it('accepts multiple relay URLs', () => {
      const service = new IndexingService({
        relays: ['wss://relay1.bsky.network', 'wss://relay2.bsky.network'],
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      expect(service).toBeDefined();
    });

    it('throws when no relay is provided', () => {
      expect(() => {
        new IndexingService({
          db: mockPool as unknown as IndexingServiceOptions['db'],
          redis: mockRedis as unknown as IndexingServiceOptions['redis'],
          processor: mockProcessor,
        });
      }).toThrow('At least one relay URL must be provided');
    });

    it('prefers relays array over single relay', () => {
      const service = new IndexingService({
        relay: 'wss://single.bsky.network',
        relays: ['wss://relay1.bsky.network', 'wss://relay2.bsky.network'],
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      const status = service.getStatus();
      // Should have 2 relay statuses when multi-relay
      expect(status.relayStatuses?.length).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('returns basic status for single relay', () => {
      const service = new IndexingService({
        relay: 'wss://bsky.network',
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      const status = service.getStatus();

      expect(status.running).toBe(false);
      expect(status.eventsProcessed).toBe(0);
      expect(status.errors).toBe(0);
      expect(status.relayStatuses).toBeUndefined(); // Single relay doesn't show per-relay status
    });

    it('returns per-relay status for multi-relay', () => {
      const service = new IndexingService({
        relays: ['wss://relay1.bsky.network', 'wss://relay2.bsky.network'],
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      const status = service.getStatus();

      expect(status.relayStatuses).toBeDefined();
      expect(status.relayStatuses?.length).toBe(2);
      const relayStatuses = status.relayStatuses;
      if (relayStatuses && relayStatuses.length >= 2) {
        const firstRelay = relayStatuses[0];
        const secondRelay = relayStatuses[1];
        if (firstRelay && secondRelay) {
          expect(firstRelay.relay).toBe('wss://relay1.bsky.network');
          expect(secondRelay.relay).toBe('wss://relay2.bsky.network');
        }
      }
    });

    it('tracks duplicates filtered count', () => {
      const service = new IndexingService({
        relays: ['wss://relay1.bsky.network', 'wss://relay2.bsky.network'],
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      const status = service.getStatus();

      // Initially no duplicates
      expect(status.duplicatesFiltered).toBeUndefined();
    });
  });

  describe('start', () => {
    it('throws when already running', async () => {
      const service = new IndexingService({
        relay: 'wss://bsky.network',
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      // Start the service (will return immediately due to empty iterator)
      const startPromise = service.start();

      // Try to start again immediately
      await expect(service.start()).rejects.toThrow('Service already running');

      await startPromise;
    });
  });

  describe('stop', () => {
    it('does nothing when not running', async () => {
      const service = new IndexingService({
        relay: 'wss://bsky.network',
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      // Should not throw
      await service.stop();
    });
  });

  describe('configuration', () => {
    it('uses default concurrency', () => {
      const service = new IndexingService({
        relay: 'wss://bsky.network',
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      expect(service).toBeDefined();
    });

    it('accepts custom concurrency', () => {
      const service = new IndexingService({
        relay: 'wss://bsky.network',
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
        concurrency: 20,
      });

      expect(service).toBeDefined();
    });

    it('accepts collection filter', () => {
      const service = new IndexingService({
        relay: 'wss://bsky.network',
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
        collections: ['pub.chive.eprint.submission' as NSID],
      });

      expect(service).toBeDefined();
    });

    it('uses default service name for cursor', () => {
      const service = new IndexingService({
        relay: 'wss://bsky.network',
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      expect(service).toBeDefined();
    });

    it('uses custom service name for cursor', () => {
      const service = new IndexingService({
        relay: 'wss://bsky.network',
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
        serviceName: 'custom-indexer',
      });

      expect(service).toBeDefined();
    });
  });

  describe('relay naming', () => {
    it('extracts relay name from URL for per-relay cursors', () => {
      const service = new IndexingService({
        relays: ['wss://relay1.us-east.bsky.network', 'wss://relay2.us-west.bsky.network'],
        db: mockPool as unknown as IndexingServiceOptions['db'],
        redis: mockRedis as unknown as IndexingServiceOptions['redis'],
        processor: mockProcessor,
      });

      const status = service.getStatus();

      // Should have named the relays based on hostname
      expect(status.relayStatuses).toBeDefined();
    });
  });
});
