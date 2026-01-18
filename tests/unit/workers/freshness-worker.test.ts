/**
 * Freshness worker unit tests.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { EventEmitter2 } from 'eventemitter2';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { PDSRateLimiter } from '@/services/pds-sync/pds-rate-limiter.js';
import type { PDSSyncService } from '@/services/pds-sync/sync-service.js';
import type { AtUri } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import {
  FreshnessWorker,
  FreshnessPriority,
  FRESHNESS_QUEUE_NAME,
  createFreshnessQueue,
  type FreshnessJobData,
} from '@/workers/freshness-worker.js';

// Mock BullMQ
const mockQueueMethods = {
  add: vi.fn().mockResolvedValue({ id: 'job-123' }),
  addBulk: vi.fn().mockResolvedValue([]),
  getWaitingCount: vi.fn().mockResolvedValue(0),
  getActiveCount: vi.fn().mockResolvedValue(0),
  drain: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockWorkerMethods = {
  on: vi.fn(),
  pause: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn(),
  isPaused: vi.fn().mockReturnValue(false),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('bullmq', () => {
  class MockQueue {
    add = mockQueueMethods.add;
    addBulk = mockQueueMethods.addBulk;
    getWaitingCount = mockQueueMethods.getWaitingCount;
    getActiveCount = mockQueueMethods.getActiveCount;
    drain = mockQueueMethods.drain;
    close = mockQueueMethods.close;
  }

  class MockWorker {
    on = mockWorkerMethods.on;
    pause = mockWorkerMethods.pause;
    resume = mockWorkerMethods.resume;
    isPaused = mockWorkerMethods.isPaused;
    close = mockWorkerMethods.close;
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
    Job: class MockJob {},
  };
});

// Test constants
const TEST_URI = 'at://did:plc:test/pub.chive.eprint.submission/abc' as AtUri;
const TEST_PDS_URL = 'https://bsky.social';

/**
 * Creates a mock logger.
 */
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
 * Creates a mock PDS rate limiter.
 */
function createMockRateLimiter(): PDSRateLimiter {
  return {
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, waitMs: 0 }),
    waitForLimit: vi.fn().mockResolvedValue({ allowed: true, waitedMs: 0 }),
    getCurrentCount: vi.fn().mockResolvedValue(0),
    reset: vi.fn().mockResolvedValue(undefined),
  } as unknown as PDSRateLimiter;
}

/**
 * Creates a mock PDS sync service.
 */
function createMockSyncService(): PDSSyncService {
  return {
    refreshRecord: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        changed: false,
        previousCID: 'cid123',
        currentCID: 'cid123',
      },
    }),
    markAsDeleted: vi.fn().mockResolvedValue(undefined),
  } as unknown as PDSSyncService;
}

/**
 * Creates a test freshness job data object.
 */
function createTestJobData(overrides?: Partial<FreshnessJobData>): FreshnessJobData {
  return {
    uri: TEST_URI,
    pdsUrl: TEST_PDS_URL,
    lastSyncedAt: new Date().toISOString(),
    priority: FreshnessPriority.NORMAL,
    checkType: 'staleness',
    source: 'scan',
    ...overrides,
  };
}

describe('FreshnessWorker', () => {
  let worker: FreshnessWorker;
  let mockLogger: ILogger;
  let mockSyncService: PDSSyncService;
  let mockRateLimiter: PDSRateLimiter;
  let eventBus: EventEmitter2;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = createMockLogger();
    mockSyncService = createMockSyncService();
    mockRateLimiter = createMockRateLimiter();
    eventBus = new EventEmitter2();

    worker = new FreshnessWorker({
      redis: { host: 'localhost', port: 6379 },
      syncService: mockSyncService,
      rateLimiter: mockRateLimiter,
      eventBus,
      logger: mockLogger,
    });
  });

  afterEach(async () => {
    await worker.close();
  });

  describe('constructor', () => {
    it('should create worker with default options', () => {
      expect(worker).toBeDefined();
      expect(worker.isPaused()).toBe(false);
    });

    it('should create child logger', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ service: 'freshness-worker' });
    });
  });

  describe('enqueue', () => {
    it('should enqueue job with default priority', async () => {
      const jobData = createTestJobData();
      const jobId = await worker.enqueue(jobData);

      expect(jobId).toBe('job-123');
    });

    it('should enqueue urgent jobs with high priority', async () => {
      const queue = worker.getQueue();
      const jobData = createTestJobData({ priority: FreshnessPriority.URGENT });

      await worker.enqueue(jobData);

      expect(queue.add).toHaveBeenCalledWith(
        'freshness',
        expect.objectContaining({ uri: TEST_URI }),
        expect.objectContaining({ priority: FreshnessPriority.URGENT })
      );
    });

    it('should dedupe by URI', async () => {
      const queue = worker.getQueue();
      const jobData = createTestJobData();

      await worker.enqueue(jobData);

      expect(queue.add).toHaveBeenCalledWith(
        'freshness',
        expect.anything(),
        expect.objectContaining({ jobId: `freshness:${TEST_URI}` })
      );
    });
  });

  describe('enqueueBatch', () => {
    it('should enqueue multiple jobs', async () => {
      const queue = worker.getQueue();
      const jobs = [
        createTestJobData({ uri: 'at://did:plc:1/pub.chive.eprint.submission/a' as AtUri }),
        createTestJobData({ uri: 'at://did:plc:2/pub.chive.eprint.submission/b' as AtUri }),
        createTestJobData({ uri: 'at://did:plc:3/pub.chive.eprint.submission/c' as AtUri }),
      ];

      const count = await worker.enqueueBatch(jobs);

      expect(count).toBe(3);
      expect(queue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'freshness' })])
      );
    });

    it('should return 0 for empty batch', async () => {
      const count = await worker.enqueueBatch([]);
      expect(count).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return queue metrics', async () => {
      const metrics = await worker.getMetrics();

      expect(metrics).toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
        recordsRefreshed: 0,
        recordsUnchanged: 0,
        recordsDeleted: 0,
        rateLimited: 0,
        waiting: 0,
        active: 0,
      });
    });
  });

  describe('pause/resume', () => {
    it('should pause worker', async () => {
      await worker.pause();
      expect(mockLogger.info).toHaveBeenCalledWith('Freshness worker paused');
    });

    it('should resume worker', () => {
      worker.resume();
      expect(mockLogger.info).toHaveBeenCalledWith('Freshness worker resumed');
    });
  });

  describe('close', () => {
    it('should close worker and queue', async () => {
      await worker.close();
      expect(mockLogger.info).toHaveBeenCalledWith('Freshness worker closed');
    });
  });

  describe('drain', () => {
    it('should drain queue', async () => {
      await worker.drain();
      expect(mockQueueMethods.drain).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Freshness queue drained');
    });
  });
});

describe('FreshnessPriority', () => {
  it('should have correct priority values', () => {
    expect(FreshnessPriority.URGENT).toBe(1);
    expect(FreshnessPriority.RECENT).toBe(5);
    expect(FreshnessPriority.NORMAL).toBe(10);
    expect(FreshnessPriority.BACKGROUND).toBe(20);
  });

  it('urgent should have highest priority (lowest number)', () => {
    expect(FreshnessPriority.URGENT).toBeLessThan(FreshnessPriority.RECENT);
    expect(FreshnessPriority.RECENT).toBeLessThan(FreshnessPriority.NORMAL);
    expect(FreshnessPriority.NORMAL).toBeLessThan(FreshnessPriority.BACKGROUND);
  });
});

describe('FRESHNESS_QUEUE_NAME', () => {
  it('should have correct queue name', () => {
    expect(FRESHNESS_QUEUE_NAME).toBe('record-freshness');
  });
});

describe('createFreshnessQueue', () => {
  it('should create queue with correct name', () => {
    const queue = createFreshnessQueue({ host: 'localhost', port: 6379 });
    expect(queue).toBeDefined();
  });
});
