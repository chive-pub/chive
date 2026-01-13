/**
 * Main indexing service orchestrating firehose consumption.
 *
 * @remarks
 * Coordinates all indexing components to consume AT Protocol firehose
 * and index pub.chive.* records.
 *
 * **Service Responsibilities:**
 * - Subscribe to firehose via FirehoseConsumer
 * - Filter events by collection (pub.chive.*)
 * - Parse commit events (CAR files)
 * - Queue events for async processing
 * - Persist cursor for resumption
 * - Handle errors and DLQ
 * - Graceful shutdown
 *
 * **ATProto Compliance:**
 * - Read-only consumption
 * - Cursor persistence enables complete rebuild
 * - No event drops (backpressure + DLQ)
 * - PDS source tracking (handled by downstream processors)
 *
 * @example
 * ```typescript
 * const service = new IndexingService({
 *   relay: 'wss://bsky.network',
 *   db,
 *   redis
 * });
 *
 * // Start consuming
 * await service.start();
 *
 * // Monitor status
 * const status = service.getStatus();
 * console.log('Processed:', status.eventsProcessed);
 *
 * // Graceful shutdown
 * process.on('SIGTERM', async () => {
 *   await service.stop();
 *   process.exit(0);
 * });
 * ```
 *
 * @packageDocumentation
 * @public
 */

import type { ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';

import type { NSID } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';
import type { RepoEvent } from '../../types/interfaces/event-stream.interface.js';

import { CommitHandler } from './commit-handler.js';
import { CursorManager } from './cursor-manager.js';
import { DeadLetterQueue, type AlertService, type DLQEvent } from './dlq-handler.js';
import { EventFilter } from './event-filter.js';
import { EventQueue, BackpressureError } from './event-queue.js';
import { FirehoseConsumer } from './firehose-consumer.js';
import { ReconnectionManager } from './reconnection-manager.js';

/**
 * Indexing service configuration.
 *
 * @public
 */
export interface IndexingServiceOptions {
  /**
   * Relay WebSocket URL.
   *
   * @example "wss://bsky.network"
   */
  readonly relay: string;

  /**
   * PostgreSQL connection pool.
   */
  readonly db: Pool;

  /**
   * Redis client.
   */
  readonly redis: Redis;

  /**
   * Redis connection options for BullMQ.
   *
   * @remarks
   * BullMQ requires connection options to create its own Redis connections
   * for job queue management.
   *
   * @defaultValue { host: 'localhost', port: 6379 }
   */
  readonly redisConnection?: ConnectionOptions;

  /**
   * Service name for cursor tracking.
   *
   * @defaultValue "firehose-consumer"
   */
  readonly serviceName?: string;

  /**
   * Collections to filter (NSIDs).
   *
   * @remarks
   * If omitted, all pub.chive.* collections are processed.
   *
   * @example ["pub.chive.eprint.submission", "pub.chive.review.comment"]
   */
  readonly collections?: readonly NSID[];

  /**
   * Event processor function.
   *
   * @remarks
   * Called for each filtered event. Should handle record validation
   * and storage.
   */
  readonly processor: EventProcessor;

  /**
   * Alert service for notifications.
   */
  readonly alerts?: AlertService;

  /**
   * Queue concurrency.
   *
   * @defaultValue 10
   */
  readonly concurrency?: number;

  /**
   * Maximum queue depth.
   *
   * @defaultValue 1000
   */
  readonly maxQueueDepth?: number;

  /**
   * Cursor batch size.
   *
   * @defaultValue 100
   */
  readonly cursorBatchSize?: number;

  /**
   * Cursor flush interval (ms).
   *
   * @defaultValue 5000
   */
  readonly cursorFlushInterval?: number;
}

/**
 * Event processor function.
 *
 * @public
 */
export type EventProcessor = (event: ProcessedEvent) => Promise<void>;

/**
 * Processed event with decoded record.
 *
 * @remarks
 * Extends DLQEvent to ensure type compatibility with the dead letter queue.
 * All processed events can be safely stored in the DLQ if processing fails.
 *
 * @public
 */
export interface ProcessedEvent extends DLQEvent {
  /**
   * Event type discriminator (from DLQEvent).
   *
   * @remarks
   * Always set to "commit" for repository commit events.
   */
  readonly $type: 'commit';

  /**
   * Event timestamp.
   */
  readonly time: string;

  /**
   * Operation action.
   */
  readonly action: 'create' | 'update' | 'delete';

  /**
   * Collection NSID.
   */
  readonly collection: string;

  /**
   * Record key.
   */
  readonly rkey: string;

  /**
   * Record CID (for create/update).
   */
  readonly cid?: string;

  /**
   * Decoded record data (for create/update).
   */
  readonly record?: unknown;
}

/**
 * Indexing service status.
 *
 * @public
 */
export interface IndexingStatus {
  /**
   * Whether service is running.
   */
  readonly running: boolean;

  /**
   * Current cursor position.
   */
  readonly currentCursor: number | null;

  /**
   * Number of events processed.
   */
  readonly eventsProcessed: number;

  /**
   * Events processed per second (rolling average).
   */
  readonly eventsPerSecond: number;

  /**
   * Queue depth.
   */
  readonly queueDepth: number;

  /**
   * DLQ size.
   */
  readonly dlqSize: number;

  /**
   * Number of errors encountered.
   */
  readonly errors: number;

  /**
   * Last event timestamp.
   */
  readonly lastEvent: Date | null;

  /**
   * Service start time.
   */
  readonly startedAt: Date | null;
}

/**
 * Main indexing service.
 *
 * @remarks
 * Orchestrates all indexing components for firehose consumption.
 *
 * **Component Flow:**
 * ```
 * FirehoseConsumer → EventFilter → CommitHandler → EventQueue → Processor
 *                                                              ↓
 *                                                            DLQ (on error)
 * ```
 *
 * **Lifecycle:**
 * 1. `start()` - Begin consuming firehose
 * 2. Events processed asynchronously via queue
 * 3. `stop()` - Graceful shutdown (drain queue, flush cursor)
 *
 * **Error Handling:**
 * - Parse errors: Send to DLQ
 * - Processing errors: Retry with backoff, then DLQ
 * - Network errors: Reconnect with exponential backoff
 *
 * @public
 */
export class IndexingService {
  private readonly relay: string;
  private readonly collections?: readonly NSID[];
  private readonly processor: EventProcessor;

  private readonly consumer: FirehoseConsumer;
  private readonly cursorManager: CursorManager;
  private readonly filter: EventFilter;
  private readonly commitHandler: CommitHandler;
  private readonly queue: EventQueue;
  private readonly dlq: DeadLetterQueue;

  private running = false;
  private eventsProcessed = 0;
  private errors = 0;
  private lastEvent: Date | null = null;
  private startedAt: Date | null = null;

  /**
   * Creates an indexing service.
   *
   * @param options - Configuration options
   */
  constructor(options: IndexingServiceOptions) {
    this.relay = options.relay;
    this.collections = options.collections;
    this.processor = options.processor;

    const serviceName = options.serviceName ?? 'firehose-consumer';

    // Initialize cursor manager
    this.cursorManager = new CursorManager({
      db: options.db,
      redis: options.redis,
      serviceName,
      batchSize: options.cursorBatchSize ?? 100,
      flushInterval: options.cursorFlushInterval ?? 5000,
    });

    // Initialize DLQ
    this.dlq = new DeadLetterQueue({
      db: options.db,
      alerts: options.alerts,
    });

    // Initialize event queue
    this.queue = new EventQueue({
      redis: options.redisConnection ?? {
        host: 'localhost',
        port: 6379,
      },
      processor: async (event: DLQEvent) => {
        // Type guard to ensure event is a ProcessedEvent
        if (this.isProcessedEvent(event)) {
          await this.processEvent(event);
        } else {
          throw new ValidationError(
            `Invalid event type: expected ProcessedEvent, got ${event.$type}`,
            'event.$type',
            'type'
          );
        }
      },
      dlq: this.dlq,
      concurrency: options.concurrency ?? 10,
      maxQueueDepth: options.maxQueueDepth ?? 1000,
    });

    // Initialize consumer
    const reconnectionManager = new ReconnectionManager({
      maxAttempts: 10,
      baseDelay: 1000,
      maxDelay: 30000,
      enableJitter: true,
    });

    this.consumer = new FirehoseConsumer({
      cursorManager: this.cursorManager,
      reconnectionManager,
    });

    // Initialize filter
    this.filter = new EventFilter({
      collections: this.collections,
      strictValidation: true,
    });

    // Initialize commit handler
    this.commitHandler = new CommitHandler();
  }

  /**
   * Starts indexing service.
   *
   * @returns Promise resolving when service starts
   *
   * @remarks
   * Begins consuming firehose from last cursor position. If no cursor
   * exists (first run), starts from latest events.
   *
   * The service runs until `stop()` is called or an unrecoverable
   * error occurs.
   *
   * **Important:** Call `stop()` before process exit to ensure
   * graceful shutdown.
   *
   * @throws {Error}
   * Thrown if already running or connection fails.
   *
   * @example
   * ```typescript
   * const service = new IndexingService({ ... });
   *
   * // Start service
   * await service.start();
   * console.log('Indexing service started');
   *
   * // Service runs until stop() is called
   * ```
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new ValidationError('Service already running', 'running', 'already_running');
    }

    this.running = true;
    this.startedAt = new Date();

    // Get last cursor
    const cursorInfo = await this.cursorManager.getCurrentCursor();
    const cursor = cursorInfo?.seq;

    console.warn(cursor ? `Starting from cursor: ${cursor}` : 'Starting from latest events');

    // Subscribe to firehose
    const events = this.consumer.subscribe({
      relay: this.relay,
      cursor,
      filter: this.collections ? { collections: this.collections } : undefined,
    });

    // Process events
    try {
      for await (const event of events) {
        if (!this.running) {
          break;
        }

        try {
          await this.handleEvent(event);
        } catch (error) {
          this.errors++;
          console.error('Event handling failed:', error);

          // Send to DLQ
          // Extract repo/did based on event type
          const repo =
            event.$type === 'com.atproto.sync.subscribeRepos#commit' ? event.repo : event.did;

          const dlqEvent: DLQEvent = {
            seq: event.seq,
            repo,
            $type: event.$type,
          };
          await this.dlq.add(dlqEvent, error instanceof Error ? error : new Error(String(error)));
        }
      }
    } catch (error) {
      console.error('Fatal error in event stream:', error);
      throw error;
    }
  }

  /**
   * Stops indexing service.
   *
   * @returns Promise resolving when service stops
   *
   * @remarks
   * Performs graceful shutdown:
   * 1. Stops consuming new events
   * 2. Drains event queue (processes pending jobs)
   * 3. Flushes cursor
   * 4. Closes connections
   *
   * **Important:** Always call before process exit to avoid losing
   * cursor position or pending events.
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   console.log('Shutting down...');
   *   await service.stop();
   *   console.log('Shutdown complete');
   *   process.exit(0);
   * });
   * ```
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.warn('Stopping indexing service...');
    this.running = false;

    // Disconnect consumer
    await this.consumer.disconnect();

    // Drain queue (process pending jobs)
    console.warn('Draining event queue...');
    await this.queue.drain();

    // Flush cursor
    console.warn('Flushing cursor...');
    await this.cursorManager.flush();

    // Close queue
    await this.queue.close();

    // Close cursor manager
    await this.cursorManager.close();

    console.warn('Indexing service stopped');
  }

  /**
   * Gets service status.
   *
   * @returns Service status
   *
   * @remarks
   * Provides overview of service health and performance.
   *
   * @example
   * ```typescript
   * const status = service.getStatus();
   * console.log('Events processed:', status.eventsProcessed);
   * console.log('Events/sec:', status.eventsPerSecond);
   * console.log('Queue depth:', status.queueDepth);
   * console.log('DLQ size:', status.dlqSize);
   * ```
   */
  getStatus(): IndexingStatus {
    const currentCursor = this.cursorManager.getPendingCursor();

    // Calculate events per second
    const eventsPerSecond = this.calculateEventsPerSecond();

    return {
      running: this.running,
      currentCursor,
      eventsProcessed: this.eventsProcessed,
      eventsPerSecond,
      queueDepth: 0, // Updated async: would need to fetch
      dlqSize: 0, // Updated async: would need to fetch
      errors: this.errors,
      lastEvent: this.lastEvent,
      startedAt: this.startedAt,
    };
  }

  /**
   * Handles a firehose event.
   *
   * @internal
   */
  private async handleEvent(event: RepoEvent): Promise<void> {
    this.lastEvent = new Date();

    // Only process commit events
    if (event.$type !== 'com.atproto.sync.subscribeRepos#commit') {
      // Update cursor for non-commit events
      await this.cursorManager.updateCursor(event.seq);
      return;
    }

    // TypeScript type narrowing: event is now commit variant of RepoEvent
    // CommitEvent and RepoEvent commit types are compatible (both use branded types)
    const commitEvent = event;

    // Parse commit
    let ops;
    try {
      ops = await this.commitHandler.parseCommit(commitEvent);
    } catch (error) {
      console.error('Failed to parse commit:', error);
      this.errors++;

      // Send to DLQ
      const dlqEvent: DLQEvent = {
        seq: commitEvent.seq,
        repo: commitEvent.repo,
        $type: commitEvent.$type,
      };
      await this.dlq.add(dlqEvent, error instanceof Error ? error : new Error(String(error)));

      // Update cursor anyway (skip this event)
      await this.cursorManager.updateCursor(commitEvent.seq);
      return;
    }

    // Filter ops
    const filteredOps = ops.filter((op) =>
      this.filter.shouldProcess({
        action: op.action,
        path: op.path,
        // CID is branded string type, safe cast as strings are compatible at runtime
        cid: op.cid,
      })
    );

    if (filteredOps.length === 0) {
      // No Chive ops: just update cursor
      await this.cursorManager.updateCursor(commitEvent.seq);
      return;
    }

    // Queue ops for processing
    for (const op of filteredOps) {
      const { collection, rkey } = this.commitHandler.parsePath(op.path);

      const processedEvent: ProcessedEvent = {
        $type: 'commit',
        seq: commitEvent.seq,
        repo: commitEvent.repo,
        time: commitEvent.time,
        action: op.action,
        collection,
        rkey,
        cid: op.cid,
        record: op.record,
      };

      try {
        // Queue event (ProcessedEvent already has all required fields)
        await this.queue.add(processedEvent);
      } catch (error) {
        if (error instanceof BackpressureError) {
          // Backpressure detected: pause and retry
          console.warn('Backpressure detected, pausing...');
          await this.sleep(1000);

          // Retry once
          try {
            await this.queue.add(processedEvent);
          } catch (retryError) {
            // Still failing after retry: send to DLQ
            console.error('Failed to queue event after backpressure retry');
            await this.dlq.add(
              processedEvent,
              retryError instanceof Error ? retryError : new Error(String(retryError))
            );
          }
        } else {
          throw error;
        }
      }
    }

    // Update cursor after queuing
    await this.cursorManager.updateCursor(commitEvent.seq);
    this.eventsProcessed++;
  }

  /**
   * Processes a queued event.
   *
   * @internal
   */
  private async processEvent(event: ProcessedEvent): Promise<void> {
    await this.processor(event);
  }

  /**
   * Calculates events per second.
   *
   * @internal
   */
  private calculateEventsPerSecond(): number {
    if (!this.startedAt || this.eventsProcessed === 0) {
      return 0;
    }

    const elapsed = Date.now() - this.startedAt.getTime();
    const seconds = elapsed / 1000;

    return Math.round(this.eventsProcessed / seconds);
  }

  /**
   * Type guard to check if a DLQEvent is a ProcessedEvent.
   *
   * @param event - Event to check
   * @returns True if event is a ProcessedEvent
   *
   * @remarks
   * Validates that the event has all required ProcessedEvent fields.
   * Since ProcessedEvent extends DLQEvent, this ensures type safety
   * when processing events from the queue.
   *
   * @internal
   */
  private isProcessedEvent(event: DLQEvent): event is ProcessedEvent {
    return (
      event.$type === 'commit' &&
      'time' in event &&
      'action' in event &&
      'collection' in event &&
      'rkey' in event &&
      typeof event.time === 'string' &&
      (event.action === 'create' || event.action === 'update' || event.action === 'delete') &&
      typeof event.collection === 'string' &&
      typeof event.rkey === 'string'
    );
  }

  /**
   * Sleep utility.
   *
   * @internal
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
