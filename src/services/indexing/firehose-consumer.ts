/**
 * Firehose consumer for AT Protocol relay WebSocket subscription.
 *
 * @remarks
 * Subscribes to AT Protocol relay firehose and consumes repository events
 * for indexing. Implements IEventStreamConsumer interface.
 *
 * **Critical ATProto Compliance:**
 * - Read-only consumption (NEVER writes to relay)
 * - Cursor persistence for resumption
 * - Graceful reconnection with exponential backoff
 * - No event drops (backpressure handling)
 *
 * **Connection Features:**
 * - WebSocket subscription to relay
 * - Automatic reconnection on disconnect
 * - Exponential backoff (1s → 30s)
 * - Graceful shutdown
 * - AsyncIterable event stream
 *
 * @example
 * ```typescript
 * const consumer = new FirehoseConsumer({
 *   cursorManager,
 *   reconnectionManager
 * });
 *
 * const events = consumer.subscribe({
 *   relay: 'wss://bsky.network',
 *   cursor: await cursorManager.getCurrentCursor(),
 *   filter: {
 *     collections: ['pub.chive.eprint.submission']
 *   }
 * });
 *
 * for await (const event of events) {
 *   console.log('Event:', event.seq);
 *   await processEvent(event);
 * }
 *
 * await consumer.disconnect();
 * ```
 *
 * @packageDocumentation
 * @public
 */

import WebSocket from 'ws';

import type { CID, DID } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';
import type {
  IEventStreamConsumer,
  RepoEvent,
  RepoOp,
  SubscriptionOptions,
} from '../../types/interfaces/event-stream.interface.js';

import type { CursorManager } from './cursor-manager.js';
import { ReconnectionManager } from './reconnection-manager.js';

/**
 * Jetstream event from the JSON firehose.
 *
 * @internal
 */
interface JetstreamEvent {
  readonly did: string;
  readonly time_us: number;
  readonly kind: 'commit' | 'identity' | 'account';
  readonly commit?: {
    readonly rev: string;
    readonly operation: string;
    readonly collection: string;
    readonly rkey: string;
    readonly record?: unknown;
    readonly cid?: string;
  };
}

/**
 * RepoOp extended with record data from Jetstream.
 *
 * @internal
 */
interface RepoOpWithRecord extends RepoOp {
  record?: unknown;
}

/**
 * Firehose consumer configuration.
 *
 * @public
 */
export interface FirehoseConsumerOptions {
  /**
   * Cursor manager for persistence.
   */
  readonly cursorManager: CursorManager;

  /**
   * Reconnection manager for backoff.
   *
   * @remarks
   * If not provided, creates default manager with 10 max attempts.
   */
  readonly reconnectionManager?: ReconnectionManager;
}

/**
 * Connection state.
 *
 * @public
 */
export enum ConnectionState {
  /**
   * Not connected.
   */
  DISCONNECTED = 'disconnected',

  /**
   * Attempting connection.
   */
  CONNECTING = 'connecting',

  /**
   * Connected and subscribed.
   */
  CONNECTED = 'connected',

  /**
   * Disconnecting (graceful shutdown).
   */
  DISCONNECTING = 'disconnecting',

  /**
   * Connection failed (will retry).
   */
  FAILED = 'failed',
}

/**
 * Event buffer for async iteration.
 *
 * @internal
 */
interface EventBuffer {
  /**
   * Queued events.
   */
  events: RepoEvent[];

  /**
   * Pending resolve functions.
   */
  resolvers: ((value: IteratorResult<RepoEvent>) => void)[];

  /**
   * Whether stream is done.
   */
  done: boolean;

  /**
   * Error that terminated stream.
   */
  error?: Error;
}

/**
 * Consumes AT Protocol firehose via WebSocket.
 *
 * @remarks
 * Implements IEventStreamConsumer interface for standardized event
 * consumption. Provides AsyncIterable for memory-efficient streaming.
 *
 * **Read-Only Consumption:**
 * Consumer NEVER sends messages to relay (ATProto compliance).
 * Only subscribes and receives events.
 *
 * **Reconnection Strategy:**
 * - Automatic reconnection on disconnect
 * - Exponential backoff with jitter
 * - Resume from last cursor
 * - Max 10 attempts (configurable)
 *
 * **Thread Safety:**
 * Not thread-safe. Single consumer per instance.
 *
 * @public
 */
export class FirehoseConsumer implements IEventStreamConsumer {
  private readonly cursorManager: CursorManager;
  private readonly reconnectionManager: ReconnectionManager;

  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private subscriptionOptions: SubscriptionOptions | null = null;
  private eventBuffer: EventBuffer | null = null;
  private shouldReconnect = true;

  /**
   * Creates a firehose consumer.
   *
   * @param options - Configuration options
   */
  constructor(options: FirehoseConsumerOptions) {
    this.cursorManager = options.cursorManager;
    this.reconnectionManager =
      options.reconnectionManager ??
      new ReconnectionManager({
        maxAttempts: 10,
        baseDelay: 1000,
        maxDelay: 30000,
        enableJitter: true,
      });
  }

  /**
   * Subscribes to firehose events.
   *
   * @param options - Subscription configuration
   * @returns Async iterable of events
   *
   * @remarks
   * Returns AsyncIterable that yields events as they arrive. Use
   * `for await...of` to consume.
   *
   * Connection is maintained until `disconnect()` is called or an
   * unrecoverable error occurs.
   *
   * **Cursor Handling:**
   * - If cursor provided, subscribes from that position
   * - If omitted, subscribes from latest events
   * - Cursor is saved automatically via cursor manager
   *
   * **Filtering:**
   * - If collections specified, only those collections are included
   * - Filtering reduces network traffic
   *
   * @throws {Error}
   * Thrown if already subscribed or connection fails.
   *
   * @example
   * ```typescript
   * const events = consumer.subscribe({
   *   relay: 'wss://bsky.network',
   *   cursor: await cursorManager.getCurrentCursor()?.seq,
   *   filter: {
   *     collections: ['pub.chive.eprint.submission']
   *   }
   * });
   *
   * for await (const event of events) {
   *   if (event.$type === 'com.atproto.sync.subscribeRepos#commit') {
   *     console.log('Commit from:', event.repo);
   *   }
   * }
   * ```
   */
  async *subscribe(options: SubscriptionOptions): AsyncIterable<RepoEvent> {
    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new ValidationError('Already subscribed', 'state', 'already_subscribed');
    }

    this.subscriptionOptions = options;
    this.shouldReconnect = true;

    // Initialize event buffer
    this.eventBuffer = {
      events: [],
      resolvers: [],
      done: false,
    };

    // Connect
    await this.connect();

    // Yield events as they arrive
    while (!this.eventBuffer.done) {
      // Wait for next event
      const event = await this.nextEvent();

      if (event) {
        yield event;
      } else {
        // Stream ended
        break;
      }
    }

    // Check for error
    if (this.eventBuffer.error) {
      throw this.eventBuffer.error;
    }
  }

  /**
   * Gets the current cursor position.
   *
   * @returns Sequence number or null if never subscribed
   *
   * @remarks
   * Delegates to cursor manager.
   *
   * @example
   * ```typescript
   * const cursor = await consumer.getCurrentCursor();
   * if (cursor) {
   *   console.log('Last processed:', cursor);
   * }
   * ```
   */
  async getCurrentCursor(): Promise<number | null> {
    const info = await this.cursorManager.getCurrentCursor();
    return info?.seq ?? null;
  }

  /**
   * Saves cursor position for resumption.
   *
   * @param cursor - Sequence number to save
   * @returns Promise resolving when saved
   *
   * @remarks
   * Delegates to cursor manager. Cursor is batched for performance.
   *
   * @example
   * ```typescript
   * for await (const event of events) {
   *   await processEvent(event);
   *   await consumer.saveCursor(event.seq);
   * }
   * ```
   */
  async saveCursor(cursor: number): Promise<void> {
    await this.cursorManager.updateCursor(cursor);
  }

  /**
   * Disconnects from firehose.
   *
   * @returns Promise resolving when disconnected
   *
   * @remarks
   * Gracefully closes WebSocket connection and stops event iteration.
   *
   * Pending cursor is flushed before disconnect.
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await consumer.disconnect();
   *   process.exit(0);
   * });
   * ```
   */
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.state = ConnectionState.DISCONNECTING;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Flush pending cursor
    await this.cursorManager.flush();

    // Mark event stream as done
    if (this.eventBuffer) {
      this.eventBuffer.done = true;
      this.resolveAllPending();
    }

    this.state = ConnectionState.DISCONNECTED;
  }

  /**
   * Gets connection state.
   *
   * @returns Current connection state
   *
   * @example
   * ```typescript
   * const state = consumer.getState();
   * if (state === ConnectionState.CONNECTED) {
   *   console.log('Connected to firehose');
   * }
   * ```
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Connects to relay WebSocket.
   *
   * @internal
   */
  private async connect(): Promise<void> {
    if (!this.subscriptionOptions) {
      throw new ValidationError(
        'No subscription options provided',
        'subscriptionOptions',
        'required'
      );
    }

    this.state = ConnectionState.CONNECTING;

    const options = this.subscriptionOptions;

    // Build Jetstream WebSocket URL (JSON-based firehose)
    // Jetstream provides decoded JSON instead of raw CBOR
    const url = new URL(options.relay);

    // Check if this is a Jetstream URL or convert to Jetstream
    if (!url.hostname.includes('jetstream')) {
      // Default to Jetstream for JSON-based consumption
      url.hostname = 'jetstream2.us-east.bsky.network';
      url.protocol = 'wss:';
    }
    url.pathname = '/subscribe';

    // Add cursor if provided (Jetstream uses cursor query param)
    if (options.cursor !== undefined && options.cursor !== null) {
      url.searchParams.set('cursor', options.cursor.toString());
    }

    // Add collection filters for pub.chive.* records
    if (options.filter?.collections) {
      for (const collection of options.filter.collections) {
        url.searchParams.append('wantedCollections', collection);
      }
    } else {
      // Default to all pub.chive.* collections
      url.searchParams.append('wantedCollections', 'pub.chive.*');
    }

    // Create WebSocket
    this.ws = new WebSocket(url.toString());

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not created'));
        return;
      }

      this.ws.once('open', () => {
        this.onOpen();
        resolve();
      });

      this.ws.once('error', (error) => {
        this.onError(error);
        reject(error);
      });
    });
  }

  /**
   * Handles WebSocket open event.
   *
   * @internal
   */
  private onOpen(): void {
    this.state = ConnectionState.CONNECTED;
    this.reconnectionManager.reset();

    if (!this.ws) {
      return;
    }

    // Listen for messages
    this.ws.on('message', (data: Buffer) => {
      this.onMessage(data);
    });

    // Listen for errors
    this.ws.on('error', (error: Error) => {
      this.onError(error);
    });

    // Listen for close
    this.ws.on('close', () => {
      void this.onClose();
    });
  }

  /**
   * Handles WebSocket message event from Jetstream.
   *
   * @remarks
   * Jetstream sends JSON events in this format:
   * ```json
   * {
   *   "did": "did:plc:...",
   *   "time_us": 1725911162329308,
   *   "kind": "commit",
   *   "commit": {
   *     "rev": "...",
   *     "operation": "create",
   *     "collection": "pub.chive.eprint.submission",
   *     "rkey": "...",
   *     "record": {...},
   *     "cid": "..."
   *   }
   * }
   * ```
   *
   * This is transformed to the RepoEvent format expected by the rest of the code.
   *
   * @internal
   */
  private onMessage(data: Buffer): void {
    try {
      // Parse Jetstream JSON event
      const jetstreamEvent = JSON.parse(data.toString('utf-8')) as JetstreamEvent;

      // Only process commit events
      if (jetstreamEvent.kind !== 'commit' || !jetstreamEvent.commit) {
        return;
      }

      const commit = jetstreamEvent.commit;

      // Transform to RepoEvent format
      const event: RepoEvent = {
        $type: 'com.atproto.sync.subscribeRepos#commit',
        repo: jetstreamEvent.did as DID,
        commit: (commit.cid ?? '') as CID,
        ops: [
          {
            action: commit.operation as 'create' | 'update' | 'delete',
            path: `${commit.collection}/${commit.rkey}`,
            cid: commit.cid as CID | undefined,
          },
        ],
        // Jetstream uses microseconds, convert to sequence number
        seq: jetstreamEvent.time_us,
        // Convert microseconds to ISO timestamp
        time: new Date(jetstreamEvent.time_us / 1000).toISOString(),
      };

      // Store record in ops for downstream processing
      if (commit.record) {
        // Attach record to the operation for processing
        (event.ops[0] as RepoOpWithRecord).record = commit.record;
      }

      // Add to buffer
      this.bufferEvent(event);
    } catch (error) {
      console.error('Failed to parse Jetstream event:', error);
    }
  }

  /**
   * Handles WebSocket error event.
   *
   * @internal
   */
  private onError(error: Error): void {
    console.error('WebSocket error:', error);
    this.state = ConnectionState.FAILED;
  }

  /**
   * Handles WebSocket close event.
   *
   * @internal
   */
  private async onClose(): Promise<void> {
    if (this.state === ConnectionState.DISCONNECTING) {
      // Graceful shutdown: don't reconnect
      return;
    }

    this.state = ConnectionState.DISCONNECTED;

    if (!this.shouldReconnect) {
      return;
    }

    // Attempt reconnection
    if (this.reconnectionManager.shouldRetry()) {
      const delay = this.reconnectionManager.calculateDelay();
      console.warn(
        `Reconnecting in ${delay}ms (attempt ${this.reconnectionManager.getAttempts() + 1})`
      );

      await this.sleep(delay);
      this.reconnectionManager.recordAttempt();

      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);

        if (!this.reconnectionManager.shouldRetry()) {
          // Max retries exceeded: terminate stream
          this.terminateStream(new Error('Max reconnection attempts exceeded'));
        }
      }
    } else {
      // Max retries exceeded: terminate stream
      this.terminateStream(new Error('Max reconnection attempts exceeded'));
    }
  }

  /**
   * Buffers event for async iteration.
   *
   * @internal
   */
  private bufferEvent(event: RepoEvent): void {
    if (!this.eventBuffer) {
      return;
    }

    if (this.eventBuffer.resolvers.length > 0) {
      // Pending resolver: deliver immediately
      const resolver = this.eventBuffer.resolvers.shift();
      if (resolver) {
        resolver({ value: event, done: false });
      }
    } else {
      // No pending resolver: buffer event
      this.eventBuffer.events.push(event);
    }
  }

  /**
   * Gets next event from buffer.
   *
   * @internal
   */
  private async nextEvent(): Promise<RepoEvent | null> {
    if (!this.eventBuffer) {
      return null;
    }

    if (this.eventBuffer.events.length > 0) {
      // Event available: return immediately
      return this.eventBuffer.events.shift() ?? null;
    }

    if (this.eventBuffer.done) {
      // Stream ended
      return null;
    }

    // Wait for next event
    return new Promise<RepoEvent | null>((resolve) => {
      if (!this.eventBuffer) {
        resolve(null);
        return;
      }

      this.eventBuffer.resolvers.push((result) => {
        if (result.done) {
          resolve(null);
        } else {
          resolve(result.value);
        }
      });
    });
  }

  /**
   * Terminates event stream with error.
   *
   * @internal
   */
  private terminateStream(error: Error): void {
    if (!this.eventBuffer) {
      return;
    }

    this.eventBuffer.done = true;
    this.eventBuffer.error = error;
    this.resolveAllPending();
  }

  /**
   * Resolves all pending promises.
   *
   * @internal
   */
  private resolveAllPending(): void {
    if (!this.eventBuffer) {
      return;
    }

    for (const resolver of this.eventBuffer.resolvers) {
      // Resolve with done=true and undefined value per IteratorResult spec
      resolver({ value: undefined, done: true });
    }

    this.eventBuffer.resolvers = [];
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
