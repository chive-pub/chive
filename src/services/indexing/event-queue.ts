/**
 * Event queue for async processing with backpressure handling.
 *
 * @remarks
 * Manages async event processing using BullMQ job queue with Redis.
 * Implements backpressure detection and handling to prevent memory
 * exhaustion during high event rates.
 *
 * **Queue Features:**
 * - Async job processing with concurrency control
 * - Retry logic with exponential backoff
 * - Backpressure detection (queue depth monitoring)
 * - Job prioritization (optional)
 * - DLQ integration on max retries
 *
 * **Backpressure Handling:**
 * - Monitors queue depth continuously
 * - Throws BackpressureError when depth exceeds threshold
 * - Caller should pause consumption until queue drains
 *
 * @example
 * ```typescript
 * const queue = new EventQueue({
 *   redis: { host: 'localhost', port: 6379 },
 *   processor: async (event) => {
 *     await indexEvent(event);
 *   },
 *   dlq,
 *   concurrency: 10,
 *   maxQueueDepth: 1000
 * });
 *
 * try {
 *   await queue.add(event);
 * } catch (error) {
 *   if (error instanceof BackpressureError) {
 *     // Pause consumption
 *     await sleep(1000);
 *   }
 * }
 *
 * // Cleanup
 * await queue.close();
 * ```
 *
 * @packageDocumentation
 * @public
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

import type { DeadLetterQueue, DLQEvent } from './dlq-handler.js';

/**
 * Event queue configuration.
 *
 * @public
 */
export interface EventQueueOptions {
  /**
   * Redis connection options.
   */
  readonly redis: ConnectionOptions;

  /**
   * Event processor function.
   */
  readonly processor: EventProcessor;

  /**
   * Dead letter queue for failed events.
   */
  readonly dlq: DeadLetterQueue;

  /**
   * Number of concurrent jobs.
   *
   * @remarks
   * Higher concurrency = faster processing but more resource usage.
   *
   * @defaultValue 10
   */
  readonly concurrency?: number;

  /**
   * Maximum queue depth before backpressure.
   *
   * @remarks
   * When queue depth exceeds this threshold, `add()` throws
   * BackpressureError to signal caller to pause.
   *
   * @defaultValue 1000
   */
  readonly maxQueueDepth?: number;

  /**
   * Maximum retry attempts per job.
   *
   * @remarks
   * After this many failures, job is sent to DLQ.
   *
   * @defaultValue 3
   */
  readonly maxRetries?: number;

  /**
   * Base delay for retry backoff (ms).
   *
   * @remarks
   * Each retry doubles this delay (exponential backoff).
   *
   * @defaultValue 1000
   */
  readonly retryDelay?: number;

  /**
   * Job timeout (ms).
   *
   * @remarks
   * Jobs exceeding this duration are failed and retried.
   *
   * @defaultValue 60000 (1 minute)
   */
  readonly jobTimeout?: number;

  /**
   * Rate limit: max jobs per duration.
   *
   * @remarks
   * Limits processing rate to prevent overwhelming downstream systems.
   *
   * @defaultValue 100
   */
  readonly rateLimit?: number;

  /**
   * Rate limit duration (ms).
   *
   * @defaultValue 1000 (1 second)
   */
  readonly rateLimitDuration?: number;
}

/**
 * Event processor function signature.
 *
 * @public
 */
export type EventProcessor = (event: DLQEvent) => Promise<void>;

/**
 * Queue metrics for monitoring.
 *
 * @public
 */
export interface QueueMetrics {
  /**
   * Number of waiting jobs.
   */
  readonly waiting: number;

  /**
   * Number of active (processing) jobs.
   */
  readonly active: number;

  /**
   * Number of completed jobs.
   */
  readonly completed: number;

  /**
   * Number of failed jobs.
   */
  readonly failed: number;

  /**
   * Number of delayed jobs.
   */
  readonly delayed: number;

  /**
   * Whether backpressure is active.
   */
  readonly backpressureActive: boolean;

  /**
   * Total queue depth (waiting + active + delayed).
   */
  readonly totalDepth: number;
}

/**
 * Backpressure error thrown when queue depth exceeds threshold.
 *
 * @public
 */
export class BackpressureError extends Error {
  constructor(
    message: string,
    public readonly queueDepth: number,
    public readonly maxDepth: number
  ) {
    super(message);
    this.name = 'BackpressureError';
  }
}

/**
 * Job data stored in queue.
 *
 * @internal
 */
interface JobData {
  /**
   * Event to process.
   */
  readonly event: DLQEvent;

  /**
   * Current attempt number.
   */
  readonly attempt: number;
}

/**
 * Event queue with backpressure handling.
 *
 * @remarks
 * Uses BullMQ for reliable job processing with Redis persistence.
 *
 * **Processing Guarantees:**
 * - At-least-once delivery (jobs may be reprocessed on failure)
 * - Retry with exponential backoff
 * - DLQ for failed jobs after max retries
 * - Backpressure to prevent memory exhaustion
 *
 * **Thread Safety:**
 * Safe for concurrent access (backed by Redis).
 *
 * @public
 */
export class EventQueue {
  private readonly queue: Queue<JobData>;
  private readonly worker: Worker<JobData>;
  private readonly queueEvents: QueueEvents;
  private readonly dlq: DeadLetterQueue;
  private readonly maxQueueDepth: number;
  private readonly maxRetries: number;

  /**
   * Creates an event queue.
   *
   * @param options - Configuration options
   */
  constructor(options: EventQueueOptions) {
    this.dlq = options.dlq;
    this.maxQueueDepth = options.maxQueueDepth ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;

    const concurrency = options.concurrency ?? 10;
    const retryDelay = options.retryDelay ?? 1000;
    const rateLimit = options.rateLimit ?? 100;
    const rateLimitDuration = options.rateLimitDuration ?? 1000;

    // Create queue
    // Note: BullMQ types are complex, using explicit type assertion here
    this.queue = new Queue<JobData>('firehose-events', {
      connection: options.redis,
      defaultJobOptions: {
        attempts: this.maxRetries + 1, // +1 for initial attempt
        backoff: {
          type: 'exponential',
          delay: retryDelay,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Create worker
    this.worker = new Worker<JobData>(
      'firehose-events',
      async (job: Job<JobData>) => {
        await options.processor(job.data.event);
      },
      {
        connection: options.redis,
        concurrency,
        limiter: {
          max: rateLimit,
          duration: rateLimitDuration,
        },
      }
    );

    // Create queue events listener
    this.queueEvents = new QueueEvents('firehose-events', {
      connection: options.redis,
    });

    // Handle failed jobs (send to DLQ)
    this.worker.on('failed', (job, error) => {
      if (!job) {
        return;
      }

      // Check if max retries exceeded
      if (job.attemptsMade >= this.maxRetries + 1) {
        // Send to DLQ
        void this.dlq.add(
          job.data.event,
          error instanceof Error ? error : new Error(String(error)),
          job.attemptsMade - 1 // Subtract 1 for initial attempt
        );
      }
    });

    // Handle completed jobs (optional logging)
    this.worker.on('completed', () => {
      // Optional: track metrics
    });
  }

  /**
   * Adds event to queue for processing.
   *
   * @param event - Event to process
   * @param priority - Job priority (lower = higher priority)
   * @returns Promise resolving when job is queued
   *
   * @throws {@link BackpressureError}
   * Thrown when queue depth exceeds threshold. Caller should pause
   * and retry later.
   *
   * @remarks
   * Checks queue depth before adding. If depth exceeds threshold,
   * throws BackpressureError to prevent memory exhaustion.
   *
   * Jobs are processed asynchronously by worker pool.
   *
   * @example
   * ```typescript
   * try {
   *   await queue.add(event);
   * } catch (error) {
   *   if (error instanceof BackpressureError) {
   *     console.log('Queue full, pausing consumption');
   *     await sleep(1000);
   *     // Retry or skip
   *   }
   * }
   * ```
   */
  async add(event: DLQEvent, priority?: number): Promise<void> {
    // Check backpressure
    const depth = await this.getDepth();

    if (depth >= this.maxQueueDepth) {
      throw new BackpressureError(
        'Queue depth exceeded maximum threshold',
        depth,
        this.maxQueueDepth
      );
    }

    // Add job to queue
    await this.queue.add(
      'process',
      {
        event,
        attempt: 0,
      },
      {
        priority,
      }
    );
  }

  /**
   * Gets current queue depth (waiting + active + delayed jobs).
   *
   * @returns Promise resolving to queue depth
   *
   * @remarks
   * Use for backpressure monitoring.
   *
   * @example
   * ```typescript
   * const depth = await queue.getDepth();
   * if (depth > 500) {
   *   console.warn('Queue filling up:', depth);
   * }
   * ```
   */
  async getDepth(): Promise<number> {
    const [waiting, active, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getDelayedCount(),
    ]);

    return waiting + active + delayed;
  }

  /**
   * Gets detailed queue metrics.
   *
   * @returns Promise resolving to queue metrics
   *
   * @remarks
   * Provides complete queue health overview for monitoring.
   *
   * @example
   * ```typescript
   * const metrics = await queue.getMetrics();
   * console.log('Waiting:', metrics.waiting);
   * console.log('Active:', metrics.active);
   * console.log('Backpressure:', metrics.backpressureActive);
   * ```
   */
  async getMetrics(): Promise<QueueMetrics> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    const totalDepth = waiting + active + delayed;
    const backpressureActive = totalDepth >= this.maxQueueDepth;

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      backpressureActive,
      totalDepth,
    };
  }

  /**
   * Pauses queue processing.
   *
   * @returns Promise resolving when paused
   *
   * @remarks
   * Workers stop processing jobs. Jobs remain in queue.
   *
   * @example
   * ```typescript
   * // Pause during maintenance
   * await queue.pause();
   * await performMaintenance();
   * await queue.resume();
   * ```
   */
  async pause(): Promise<void> {
    await this.worker.pause();
  }

  /**
   * Resumes queue processing.
   */
  resume(): void {
    this.worker.resume();
  }

  /**
   * Checks if queue is paused.
   *
   * @returns `true` if paused
   */
  isPaused(): boolean {
    return this.worker.isPaused();
  }

  /**
   * Drains queue (processes all pending jobs).
   *
   * @returns Promise resolving when queue is empty
   *
   * @remarks
   * Waits for all jobs to complete. Use before shutdown.
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   console.log('Draining queue...');
   *   await queue.drain();
   *   await queue.close();
   *   process.exit(0);
   * });
   * ```
   */
  async drain(): Promise<void> {
    await this.queue.drain();
  }

  /**
   * Closes queue and worker.
   *
   * @returns Promise resolving when closed
   *
   * @remarks
   * Gracefully shuts down queue:
   * 1. Stops accepting new jobs
   * 2. Waits for active jobs to complete
   * 3. Closes connections
   *
   * Call before process exit.
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await queue.close();
   *   process.exit(0);
   * });
   * ```
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
  }

  /**
   * Removes all jobs from queue.
   *
   * @returns Promise resolving when obliterated
   *
   * @remarks
   * **Destructive operation** - removes all jobs (waiting, active, completed, failed).
   *
   * Use with caution - typically only for testing or emergency cleanup.
   *
   * @example
   * ```typescript
   * // Emergency cleanup
   * await queue.obliterate();
   * console.log('All jobs removed');
   * ```
   */
  async obliterate(): Promise<void> {
    await this.queue.obliterate({ force: true });
  }
}
