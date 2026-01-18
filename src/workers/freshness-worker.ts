/**
 * Freshness worker for background record verification.
 *
 * @remarks
 * Background worker using BullMQ for async freshness checking.
 * Verifies indexed records against source PDSes, detecting:
 * - Stale records (CID mismatch)
 * - Deleted records (PDS 404)
 * - PDS errors (connectivity issues)
 *
 * **Processing Flow:**
 * 1. Receive freshness job with record URI and PDS URL
 * 2. Apply per-PDS rate limiting
 * 3. Fetch current record from PDS
 * 4. Compare CIDs with indexed version
 * 5. Re-index if changed, mark deleted if 404
 * 6. Emit appropriate events
 *
 * **ATProto Compliance:**
 * - READ-ONLY from user PDSes
 * - Respects PDS rate limits
 * - All indexes rebuildable from source
 *
 * @packageDocumentation
 * @public
 */

import { Queue, Worker, Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import type { EventEmitter2 as EventEmitter2Type } from 'eventemitter2';

import type { PDSRateLimiter } from '../services/pds-sync/pds-rate-limiter.js';
import type { PDSSyncService } from '../services/pds-sync/sync-service.js';
import type { AtUri } from '../types/atproto.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Queue name.
 */
export const FRESHNESS_QUEUE_NAME = 'record-freshness';

/**
 * Job priority levels.
 *
 * @remarks
 * Lower numbers = higher priority in BullMQ.
 *
 * @public
 */
export const FreshnessPriority = {
  /** Admin-triggered verification */
  URGENT: 1,
  /** Records synced < 24h ago */
  RECENT: 5,
  /** Records synced 1-7 days ago */
  NORMAL: 10,
  /** Records synced > 7 days ago */
  BACKGROUND: 20,
} as const;

/**
 * Check type for freshness jobs.
 *
 * @public
 */
export type FreshnessCheckType = 'staleness' | 'deletion' | 'full';

/**
 * Freshness job data.
 *
 * @public
 */
export interface FreshnessJobData {
  /**
   * AT-URI of the record to check.
   */
  readonly uri: AtUri;

  /**
   * PDS URL where the record lives.
   */
  readonly pdsUrl: string;

  /**
   * When the record was last synced.
   */
  readonly lastSyncedAt: string;

  /**
   * Job priority level.
   */
  readonly priority: number;

  /**
   * Type of freshness check.
   */
  readonly checkType: FreshnessCheckType;

  /**
   * Job source for logging.
   */
  readonly source?: 'scan' | 'admin' | 'user' | 'recheck';
}

/**
 * Freshness check result.
 *
 * @public
 */
export interface FreshnessCheckResult {
  /**
   * Record URI.
   */
  readonly uri: AtUri;

  /**
   * Whether check was successful.
   */
  readonly success: boolean;

  /**
   * Whether record content changed.
   */
  readonly changed: boolean;

  /**
   * Whether record was deleted from PDS.
   */
  readonly deleted: boolean;

  /**
   * Previous CID (if available).
   */
  readonly previousCid?: string;

  /**
   * Current CID (if available).
   */
  readonly currentCid?: string;

  /**
   * Error message (if check failed).
   */
  readonly error?: string;
}

/**
 * Freshness worker configuration.
 *
 * @public
 */
export interface FreshnessWorkerOptions {
  /**
   * Redis connection options.
   */
  readonly redis: ConnectionOptions;

  /**
   * PDS sync service for refresh operations.
   */
  readonly syncService: PDSSyncService;

  /**
   * Per-PDS rate limiter.
   */
  readonly rateLimiter: PDSRateLimiter;

  /**
   * Event bus for emitting events.
   */
  readonly eventBus: EventEmitter2Type;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Number of concurrent jobs.
   *
   * @defaultValue 5
   */
  readonly concurrency?: number;

  /**
   * Maximum retry attempts.
   *
   * @defaultValue 3
   */
  readonly maxRetries?: number;

  /**
   * Base delay for retry backoff (ms).
   *
   * @defaultValue 5000
   */
  readonly retryDelay?: number;

  /**
   * Maximum wait time for rate limiting (ms).
   *
   * @defaultValue 120000
   */
  readonly maxRateLimitWait?: number;
}

/**
 * Freshness worker metrics.
 *
 * @public
 */
export interface FreshnessMetrics {
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly recordsRefreshed: number;
  readonly recordsUnchanged: number;
  readonly recordsDeleted: number;
  readonly rateLimited: number;
  readonly waiting: number;
  readonly active: number;
}

/**
 * Freshness worker for background record verification.
 *
 * @remarks
 * Processes freshness jobs asynchronously using BullMQ.
 * Respects per-PDS rate limits and handles failures gracefully.
 *
 * **Key Features:**
 * - Async job processing with BullMQ
 * - Per-PDS rate limiting
 * - Retry with exponential backoff
 * - Priority queue (urgent jobs first)
 * - Deletion detection (PDS 404)
 * - Event emission on completion
 *
 * @public
 */
export class FreshnessWorker {
  private readonly worker: Worker<FreshnessJobData>;
  private readonly queue: Queue<FreshnessJobData>;
  private readonly logger: ILogger;
  private readonly syncService: PDSSyncService;
  private readonly rateLimiter: PDSRateLimiter;
  private readonly eventBus: EventEmitter2Type;
  private readonly maxRateLimitWait: number;

  private processedCount = 0;
  private succeededCount = 0;
  private failedCount = 0;
  private refreshedCount = 0;
  private unchangedCount = 0;
  private deletedCount = 0;
  private rateLimitedCount = 0;

  /**
   * Creates a freshness worker.
   *
   * @param options - Worker configuration
   */
  constructor(options: FreshnessWorkerOptions) {
    this.logger = options.logger.child({ service: 'freshness-worker' });
    this.syncService = options.syncService;
    this.rateLimiter = options.rateLimiter;
    this.eventBus = options.eventBus;
    this.maxRateLimitWait = options.maxRateLimitWait ?? 120_000;

    const concurrency = options.concurrency ?? 5;
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 5000;

    // Create queue
    this.queue = new Queue<FreshnessJobData>(FRESHNESS_QUEUE_NAME, {
      connection: options.redis,
      defaultJobOptions: {
        attempts: maxRetries + 1,
        backoff: {
          type: 'exponential',
          delay: retryDelay,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 50000,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    });

    // Create worker
    this.worker = new Worker<FreshnessJobData>(
      FRESHNESS_QUEUE_NAME,
      async (job: Job<FreshnessJobData>) => {
        return this.processJob(job);
      },
      {
        connection: options.redis,
        concurrency,
      }
    );

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Sets up worker event handlers.
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job, result: FreshnessCheckResult) => {
      this.processedCount++;
      this.succeededCount++;

      if (result.deleted) {
        this.deletedCount++;
        this.eventBus.emit('record.deleted', {
          uri: job.data.uri,
          source: 'freshness_check',
        });
      } else if (result.changed) {
        this.refreshedCount++;
        this.eventBus.emit('record.refreshed', {
          uri: job.data.uri,
          previousCid: result.previousCid,
          currentCid: result.currentCid,
        });
      } else {
        this.unchangedCount++;
      }

      this.logger.debug('Freshness job completed', {
        uri: job.data.uri,
        changed: result.changed,
        deleted: result.deleted,
      });
    });

    this.worker.on('failed', (job, error) => {
      this.processedCount++;
      this.failedCount++;

      this.logger.warn('Freshness job failed', {
        uri: job?.data.uri,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('error', (error) => {
      this.logger.error('Worker error', error);
    });
  }

  /**
   * Processes a single freshness job.
   *
   * @param job - BullMQ job
   * @returns Freshness check result
   */
  private async processJob(job: Job<FreshnessJobData>): Promise<FreshnessCheckResult> {
    const { uri, pdsUrl, checkType, source } = job.data;

    this.logger.debug('Processing freshness job', {
      uri,
      pdsUrl,
      checkType,
      source,
      attempt: job.attemptsMade,
    });

    // Apply rate limiting
    const rateLimitResult = await this.rateLimiter.waitForLimit(pdsUrl, this.maxRateLimitWait);

    if (!rateLimitResult.allowed) {
      this.rateLimitedCount++;
      throw new Error(`Rate limited for PDS ${pdsUrl}, exceeded max wait time`);
    }

    // Perform the refresh
    const refreshResult = await this.syncService.refreshRecord(uri);

    if (refreshResult.ok === false) {
      const error = refreshResult.error;

      // Check if this is a 404 (record deleted from PDS)
      if (error.name === 'NotFoundError') {
        // Mark as deleted
        this.markAsDeleted(uri, 'pds_404');

        return {
          uri,
          success: true,
          changed: false,
          deleted: true,
        };
      }

      // Other error
      return {
        uri,
        success: false,
        changed: false,
        deleted: false,
        error: error.message,
      };
    }

    return {
      uri,
      success: true,
      changed: refreshResult.value.changed,
      deleted: false,
      previousCid: refreshResult.value.previousCID,
      currentCid: refreshResult.value.currentCID,
    };
  }

  /**
   * Marks a record as deleted.
   *
   * @param uri - Record URI
   * @param source - Deletion source
   */
  private markAsDeleted(uri: AtUri, source: string): void {
    // This would call a method on PDSSyncService or storage to mark deleted
    // For now, emit event for handler to process
    this.eventBus.emit('record.deletion_detected', {
      uri,
      source,
      detectedAt: new Date().toISOString(),
    });

    this.logger.info('Record deletion detected', { uri, source });
  }

  /**
   * Enqueues a record for freshness checking.
   *
   * @param job - Freshness job data
   * @returns Job ID
   *
   * @example
   * ```typescript
   * const jobId = await worker.enqueue({
   *   uri: 'at://did:plc:abc/pub.chive.eprint.submission/xyz',
   *   pdsUrl: 'https://bsky.social',
   *   lastSyncedAt: new Date().toISOString(),
   *   priority: FreshnessPriority.NORMAL,
   *   checkType: 'staleness',
   *   source: 'scan',
   * });
   * ```
   */
  async enqueue(job: FreshnessJobData): Promise<string> {
    const bullJob = await this.queue.add('freshness', job, {
      priority: job.priority,
      jobId: `freshness:${job.uri}`, // Dedupe by URI
    });

    this.logger.debug('Enqueued freshness job', {
      uri: job.uri,
      jobId: bullJob.id,
      priority: job.priority,
    });

    return bullJob.id ?? '';
  }

  /**
   * Enqueues multiple records for freshness checking.
   *
   * @param jobs - Array of freshness job data
   * @returns Number of jobs enqueued
   */
  async enqueueBatch(jobs: FreshnessJobData[]): Promise<number> {
    if (jobs.length === 0) return 0;

    const bulkJobs = jobs.map((job) => ({
      name: 'freshness',
      data: job,
      opts: {
        priority: job.priority,
        jobId: `freshness:${job.uri}`,
      },
    }));

    await this.queue.addBulk(bulkJobs);

    this.logger.debug('Enqueued freshness batch', { count: jobs.length });

    return jobs.length;
  }

  /**
   * Gets worker metrics.
   *
   * @returns Current metrics
   */
  async getMetrics(): Promise<FreshnessMetrics> {
    const [waiting, active] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
    ]);

    return {
      processed: this.processedCount,
      succeeded: this.succeededCount,
      failed: this.failedCount,
      recordsRefreshed: this.refreshedCount,
      recordsUnchanged: this.unchangedCount,
      recordsDeleted: this.deletedCount,
      rateLimited: this.rateLimitedCount,
      waiting,
      active,
    };
  }

  /**
   * Pauses the worker.
   */
  async pause(): Promise<void> {
    await this.worker.pause();
    this.logger.info('Freshness worker paused');
  }

  /**
   * Resumes the worker.
   */
  resume(): void {
    this.worker.resume();
    this.logger.info('Freshness worker resumed');
  }

  /**
   * Checks if worker is paused.
   */
  isPaused(): boolean {
    return this.worker.isPaused();
  }

  /**
   * Gets the queue instance.
   */
  getQueue(): Queue<FreshnessJobData> {
    return this.queue;
  }

  /**
   * Closes the worker and queue.
   */
  async close(): Promise<void> {
    this.logger.info('Closing freshness worker...');
    await this.worker.close();
    await this.queue.close();
    this.logger.info('Freshness worker closed');
  }

  /**
   * Drains the queue (waits for all jobs to complete).
   */
  async drain(): Promise<void> {
    this.logger.info('Draining freshness queue...');
    await this.queue.drain();
    this.logger.info('Freshness queue drained');
  }
}

/**
 * Creates a freshness queue for external enqueueing.
 *
 * @param redis - Redis connection options
 * @returns Configured queue
 *
 * @example
 * ```typescript
 * const queue = createFreshnessQueue({ host: 'localhost', port: 6379 });
 *
 * // Enqueue from scan job
 * await queue.add('freshness', {
 *   uri: eprintUri,
 *   pdsUrl: 'https://bsky.social',
 *   lastSyncedAt: lastSynced.toISOString(),
 *   priority: FreshnessPriority.NORMAL,
 *   checkType: 'staleness',
 *   source: 'scan',
 * });
 * ```
 */
export function createFreshnessQueue(redis: ConnectionOptions): Queue<FreshnessJobData> {
  return new Queue<FreshnessJobData>(FRESHNESS_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 86400,
        count: 50000,
      },
      removeOnFail: {
        age: 604800,
      },
    },
  });
}
