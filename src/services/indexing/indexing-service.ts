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
 *   relays: ['wss://bsky.network'],
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
import type { ILogger } from '../../types/interfaces/logger.interface.js';

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
   * Relay WebSocket URLs.
   *
   * @remarks
   * Subscribes to all relays simultaneously and deduplicates events.
   * This ensures records from all relay-connected PDSes are captured,
   * even if some relays have different PDS subscriptions.
   *
   * @example ["wss://bsky.network", "wss://relay1.us-east.bsky.network"]
   */
  readonly relays: readonly string[];

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
   * Logger instance.
   */
  readonly logger: ILogger;

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
/**
 * Per-relay status information.
 *
 * @public
 */
export interface RelayStatus {
  /**
   * Relay URL.
   */
  readonly relay: string;

  /**
   * Whether connected to this relay.
   */
  readonly connected: boolean;

  /**
   * Current cursor position for this relay.
   */
  readonly cursor: number | null;

  /**
   * Events received from this relay.
   */
  readonly eventsReceived: number;

  /**
   * Last event timestamp from this relay.
   */
  readonly lastEvent: Date | null;
}

export interface IndexingStatus {
  /**
   * Whether service is running.
   */
  readonly running: boolean;

  /**
   * Current cursor position (from primary relay).
   */
  readonly currentCursor: number | null;

  /**
   * Number of events processed (after deduplication).
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

  /**
   * Per-relay status (multi-relay mode).
   */
  readonly relayStatuses?: readonly RelayStatus[];

  /**
   * Number of duplicate events filtered out.
   */
  readonly duplicatesFiltered?: number;
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
/**
 * Per-relay consumer state.
 */
interface RelayConsumerState {
  readonly relay: string;
  readonly consumer: FirehoseConsumer;
  readonly cursorManager: CursorManager;
  connected: boolean;
  eventsReceived: number;
  lastEvent: Date | null;
}

export class IndexingService {
  private readonly relays: readonly string[];
  private readonly collections?: readonly NSID[];
  private readonly processor: EventProcessor;
  private readonly logger: ILogger;

  private readonly relayStates = new Map<string, RelayConsumerState>();
  private readonly filter: EventFilter;
  private readonly commitHandler: CommitHandler;
  private readonly queue: EventQueue;
  private readonly dlq: DeadLetterQueue;

  // Deduplication: track recently seen events by URI
  private readonly seenEvents = new Map<string, number>();
  private readonly seenEventsTTL = 60_000; // 1 minute TTL for dedup

  private running = false;
  private eventsProcessed = 0;
  private duplicatesFiltered = 0;
  private errors = 0;
  private lastEvent: Date | null = null;
  private startedAt: Date | null = null;

  /**
   * Creates an indexing service.
   *
   * @param options - Configuration options
   */
  constructor(options: IndexingServiceOptions) {
    if (options.relays.length === 0) {
      throw new ValidationError('At least one relay URL must be provided', 'relays', 'required');
    }

    this.relays = options.relays;

    this.collections = options.collections;
    this.processor = options.processor;
    this.logger = options.logger;

    const baseServiceName = options.serviceName ?? 'firehose-consumer';

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

    // Initialize per-relay consumers and cursor managers
    for (const relay of this.relays) {
      const relayName = this.getRelayName(relay);
      const serviceName =
        this.relays.length > 1 ? `${baseServiceName}:${relayName}` : baseServiceName;

      const cursorManager = new CursorManager({
        db: options.db,
        redis: options.redis,
        serviceName,
        batchSize: options.cursorBatchSize ?? 100,
        flushInterval: options.cursorFlushInterval ?? 5000,
        logger: this.logger,
      });

      const reconnectionManager = new ReconnectionManager({
        maxAttempts: 10,
        baseDelay: 1000,
        maxDelay: 30000,
        enableJitter: true,
      });

      const consumer = new FirehoseConsumer({
        cursorManager,
        reconnectionManager,
        logger: this.logger,
      });

      this.relayStates.set(relay, {
        relay,
        consumer,
        cursorManager,
        connected: false,
        eventsReceived: 0,
        lastEvent: null,
      });
    }

    // Initialize filter
    this.filter = new EventFilter({
      collections: this.collections,
      strictValidation: true,
    });

    // Initialize commit handler
    this.commitHandler = new CommitHandler();

    // Start dedup cleanup interval
    setInterval(() => this.cleanupSeenEvents(), 30_000).unref();
  }

  /**
   * Extracts a short name from relay URL for service naming.
   */
  private getRelayName(relay: string): string {
    try {
      const url = new URL(relay);
      // Extract hostname and take first segment
      const parts = url.hostname.split('.');
      return parts[0] ?? 'relay';
    } catch {
      return 'relay';
    }
  }

  /**
   * Cleans up old entries from the deduplication map.
   */
  private cleanupSeenEvents(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.seenEvents) {
      if (now - timestamp > this.seenEventsTTL) {
        this.seenEvents.delete(key);
      }
    }
  }

  /**
   * Checks if an event has already been processed (deduplication).
   *
   * @param uri - Event URI (did + collection + rkey)
   * @returns True if already seen
   */
  private isDuplicateEvent(uri: string): boolean {
    if (this.seenEvents.has(uri)) {
      this.duplicatesFiltered++;
      return true;
    }
    this.seenEvents.set(uri, Date.now());
    return false;
  }

  /**
   * Starts indexing service.
   *
   * @returns Promise resolving when service starts
   *
   * @remarks
   * Begins consuming firehose from all configured relays. Each relay
   * resumes from its last cursor position. Events are deduplicated
   * across relays.
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

    this.logger.info('Starting indexing service', { relayCount: this.relays.length });

    // Start consuming from all relays in parallel
    const relayPromises: Promise<void>[] = [];

    for (const [relay, state] of this.relayStates) {
      relayPromises.push(this.startRelayConsumer(relay, state));
    }

    // Wait for all relays (they run until stop() or fatal error)
    await Promise.all(relayPromises);
  }

  /**
   * Starts consuming from a single relay.
   *
   * @internal
   */
  private async startRelayConsumer(relay: string, state: RelayConsumerState): Promise<void> {
    // Get last cursor for this relay
    const cursorInfo = await state.cursorManager.getCurrentCursor();
    const cursor = cursorInfo?.seq;

    const relayName = this.getRelayName(relay);
    if (cursor) {
      this.logger.info('Starting from cursor', { relay: relayName, cursor });
    } else {
      this.logger.info('Starting from latest events', { relay: relayName });
    }

    // Subscribe to firehose
    const events = state.consumer.subscribe({
      relay,
      cursor,
      filter: this.collections ? { collections: this.collections } : undefined,
    });

    state.connected = true;

    // Process events from this relay
    try {
      for await (const event of events) {
        if (!this.running) {
          break;
        }

        state.eventsReceived++;
        state.lastEvent = new Date();

        try {
          await this.handleEvent(event, state);
        } catch (error) {
          this.errors++;
          this.logger.error('Event handling failed', error instanceof Error ? error : undefined, {
            relay: relayName,
            details: error instanceof Error ? undefined : String(error),
          });

          // Send to DLQ
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
      state.connected = false;
      this.logger.error('Fatal error in event stream', error instanceof Error ? error : undefined, {
        relay: relayName,
        details: error instanceof Error ? undefined : String(error),
      });
      // Don't throw - let other relays continue
    } finally {
      state.connected = false;
    }
  }

  /**
   * Stops indexing service.
   *
   * @returns Promise resolving when service stops
   *
   * @remarks
   * Performs graceful shutdown:
   * 1. Stops consuming new events from all relays
   * 2. Drains event queue (processes pending jobs)
   * 3. Flushes cursors for all relays
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

    this.logger.info('Stopping indexing service');
    this.running = false;

    // Disconnect all relay consumers
    this.logger.debug('Disconnecting from relays');
    const disconnectPromises: Promise<void>[] = [];
    for (const [relay, state] of this.relayStates) {
      const relayName = this.getRelayName(relay);
      this.logger.debug('Disconnecting from relay', { relay: relayName });
      disconnectPromises.push(state.consumer.disconnect());
    }
    await Promise.all(disconnectPromises);

    // Drain queue (process pending jobs)
    this.logger.debug('Draining event queue');
    await this.queue.drain();

    // Flush cursors for all relays
    this.logger.debug('Flushing cursors');
    const flushPromises: Promise<void>[] = [];
    for (const state of this.relayStates.values()) {
      flushPromises.push(state.cursorManager.flush());
    }
    await Promise.all(flushPromises);

    // Close queue
    await this.queue.close();

    // Close cursor managers
    const closePromises: Promise<void>[] = [];
    for (const state of this.relayStates.values()) {
      closePromises.push(state.cursorManager.close());
    }
    await Promise.all(closePromises);

    this.logger.info('Indexing service stopped');
  }

  /**
   * Gets service status.
   *
   * @returns Service status
   *
   * @remarks
   * Provides overview of service health and performance, including
   * per-relay status in multi-relay mode.
   *
   * @example
   * ```typescript
   * const status = service.getStatus();
   * console.log('Events processed:', status.eventsProcessed);
   * console.log('Events/sec:', status.eventsPerSecond);
   * console.log('Queue depth:', status.queueDepth);
   * console.log('DLQ size:', status.dlqSize);
   *
   * // Multi-relay mode
   * if (status.relayStatuses) {
   *   for (const rs of status.relayStatuses) {
   *     console.log(`[${rs.relay}] Connected: ${rs.connected}, Events: ${rs.eventsReceived}`);
   *   }
   * }
   * ```
   */
  getStatus(): IndexingStatus {
    // Get cursor from first/primary relay
    let currentCursor: number | null = null;
    const firstState = this.relayStates.values().next().value;
    if (firstState) {
      currentCursor = firstState.cursorManager.getPendingCursor();
    }

    // Calculate events per second
    const eventsPerSecond = this.calculateEventsPerSecond();

    // Build per-relay status
    const relayStatuses: RelayStatus[] = [];
    for (const state of this.relayStates.values()) {
      relayStatuses.push({
        relay: state.relay,
        connected: state.connected,
        cursor: state.cursorManager.getPendingCursor(),
        eventsReceived: state.eventsReceived,
        lastEvent: state.lastEvent,
      });
    }

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
      relayStatuses: relayStatuses.length > 1 ? relayStatuses : undefined,
      duplicatesFiltered: this.duplicatesFiltered > 0 ? this.duplicatesFiltered : undefined,
    };
  }

  /**
   * Handles a firehose event.
   *
   * @param event - Firehose event
   * @param state - Relay consumer state (for cursor updates)
   *
   * @internal
   */
  private async handleEvent(event: RepoEvent, state: RelayConsumerState): Promise<void> {
    this.lastEvent = new Date();

    // Only process commit events
    if (event.$type !== 'com.atproto.sync.subscribeRepos#commit') {
      // Update cursor for non-commit events
      await state.cursorManager.updateCursor(event.seq);
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
      this.logger.error('Failed to parse commit', error instanceof Error ? error : undefined, {
        details: error instanceof Error ? undefined : String(error),
      });
      this.errors++;

      // Send to DLQ
      const dlqEvent: DLQEvent = {
        seq: commitEvent.seq,
        repo: commitEvent.repo,
        $type: commitEvent.$type,
      };
      await this.dlq.add(dlqEvent, error instanceof Error ? error : new Error(String(error)));

      // Update cursor anyway (skip this event)
      await state.cursorManager.updateCursor(commitEvent.seq);
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
      await state.cursorManager.updateCursor(commitEvent.seq);
      return;
    }

    // Queue ops for processing
    for (const op of filteredOps) {
      const { collection, rkey } = this.commitHandler.parsePath(op.path);

      // Build event URI for deduplication
      const eventUri = `at://${commitEvent.repo}/${collection}/${rkey}`;

      // Deduplicate across relays (multi-relay mode)
      if (this.relays.length > 1 && this.isDuplicateEvent(eventUri)) {
        // Already seen this event from another relay, skip it
        continue;
      }

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
          this.logger.warn('Backpressure detected, pausing', { delayMs: 1000 });
          await this.sleep(1000);

          // Retry once
          try {
            await this.queue.add(processedEvent);
          } catch (retryError) {
            // Still failing after retry: send to DLQ
            this.logger.error('Failed to queue event after backpressure retry');
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
    await state.cursorManager.updateCursor(commitEvent.seq);
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
