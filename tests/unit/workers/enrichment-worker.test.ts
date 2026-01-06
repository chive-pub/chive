/**
 * Enrichment worker unit tests.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import type { Queue } from 'bullmq';
import { EventEmitter2 } from 'eventemitter2';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { AtUri } from '@/types/atproto.js';
import type {
  IDiscoveryService,
  EnrichmentResult,
} from '@/types/interfaces/discovery.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import {
  EnrichmentWorker,
  EnrichmentPriority,
  ENRICHMENT_QUEUE_NAME,
  createEnrichmentQueue,
  type EnrichmentJobData,
} from '@/workers/enrichment-worker.js';

// Mock BullMQ
const mockQueueMethods = {
  add: vi.fn().mockResolvedValue({ id: 'job-123' }),
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
const TEST_URI = 'at://did:plc:test/pub.chive.preprint.submission/abc' as AtUri;

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
 * Creates a mock discovery service.
 */
function createMockDiscoveryService(): IDiscoveryService {
  return {
    enrichPreprint: vi.fn().mockResolvedValue({
      uri: TEST_URI,
      success: true,
      semanticScholarId: 's2-123',
      openAlexId: 'W123',
      citationCount: 42,
      chiveCitationsIndexed: 3,
    } as EnrichmentResult),
    lookupPaper: vi.fn().mockResolvedValue(null),
    findRelatedPreprints: vi.fn().mockResolvedValue([]),
    getRecommendationsForUser: vi.fn().mockResolvedValue({ recommendations: [], hasMore: false }),
    recordInteraction: vi.fn().mockResolvedValue(undefined),
    getCitingPapers: vi.fn().mockResolvedValue({ citations: [], hasMore: false }),
    getReferences: vi.fn().mockResolvedValue({ citations: [], hasMore: false }),
    getCitationCounts: vi.fn().mockResolvedValue({
      citedByCount: 0,
      referencesCount: 0,
      influentialCitedByCount: 0,
    }),
    getEnrichment: vi.fn().mockResolvedValue(null),
    setPluginManager: vi.fn(),
  } as unknown as IDiscoveryService;
}

describe('EnrichmentWorker', () => {
  let worker: EnrichmentWorker;
  let mockLogger: ILogger;
  let mockDiscoveryService: IDiscoveryService;
  let eventBus: EventEmitter2;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = createMockLogger();
    mockDiscoveryService = createMockDiscoveryService();
    eventBus = new EventEmitter2();

    worker = new EnrichmentWorker({
      redis: { host: 'localhost', port: 6379 },
      discoveryService: mockDiscoveryService,
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
      expect(mockLogger.child).toHaveBeenCalledWith({ service: 'enrichment-worker' });
    });
  });

  describe('enqueue', () => {
    it('should enqueue job with default priority', async () => {
      const jobId = await worker.enqueue({
        uri: TEST_URI,
        doi: '10.1234/test',
        source: 'indexed',
      });

      expect(jobId).toBe('job-123');
    });

    it('should enqueue claimed papers with high priority', async () => {
      const queue = worker.getQueue();

      await worker.enqueue({
        uri: TEST_URI,
        doi: '10.1234/test',
        source: 'claimed',
        priority: EnrichmentPriority.CLAIMED,
      });

      expect(queue.add).toHaveBeenCalledWith(
        'enrich',
        expect.objectContaining({ uri: TEST_URI }),
        expect.objectContaining({ priority: EnrichmentPriority.CLAIMED })
      );
    });

    it('should dedupe by URI', async () => {
      const queue = worker.getQueue();

      await worker.enqueue({ uri: TEST_URI });

      expect(queue.add).toHaveBeenCalledWith(
        'enrich',
        expect.anything(),
        expect.objectContaining({ jobId: `enrich:${TEST_URI}` })
      );
    });
  });

  describe('getMetrics', () => {
    it('should return queue metrics', async () => {
      const metrics = await worker.getMetrics();

      expect(metrics).toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
        waiting: 0,
        active: 0,
      });
    });
  });

  describe('pause/resume', () => {
    it('should pause worker', async () => {
      await worker.pause();
      expect(mockLogger.info).toHaveBeenCalledWith('Enrichment worker paused');
    });

    it('should resume worker', () => {
      worker.resume();
      expect(mockLogger.info).toHaveBeenCalledWith('Enrichment worker resumed');
    });
  });

  describe('close', () => {
    it('should close worker and queue', async () => {
      await worker.close();
      expect(mockLogger.info).toHaveBeenCalledWith('Enrichment worker closed');
    });
  });
});

describe('EnrichmentPriority', () => {
  it('should have correct priority values', () => {
    expect(EnrichmentPriority.CLAIMED).toBe(1);
    expect(EnrichmentPriority.INDEXED).toBe(5);
    expect(EnrichmentPriority.BACKGROUND).toBe(10);
  });

  it('claimed should have highest priority (lowest number)', () => {
    expect(EnrichmentPriority.CLAIMED).toBeLessThan(EnrichmentPriority.INDEXED);
    expect(EnrichmentPriority.INDEXED).toBeLessThan(EnrichmentPriority.BACKGROUND);
  });
});

describe('ENRICHMENT_QUEUE_NAME', () => {
  it('should have correct queue name', () => {
    expect(ENRICHMENT_QUEUE_NAME).toBe('preprint-enrichment');
  });
});

describe('createEnrichmentQueue', () => {
  it('should create queue with correct name', () => {
    const queue = createEnrichmentQueue({ host: 'localhost', port: 6379 });
    expect(queue).toBeDefined();
  });
});

describe('EnrichmentWorker.enqueueJob (static)', () => {
  it('should enqueue job via static method', async () => {
    const mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'static-job-123' }),
    } as unknown as Queue<EnrichmentJobData>;

    const jobId = await EnrichmentWorker.enqueueJob(mockQueue, {
      uri: TEST_URI,
      doi: '10.1234/test',
    });

    expect(jobId).toBe('static-job-123');
    expect(mockQueue.add).toHaveBeenCalledWith(
      'enrich',
      expect.objectContaining({ uri: TEST_URI }),
      expect.objectContaining({ jobId: `enrich:${TEST_URI}` })
    );
  });
});
