/**
 * Event stream interface for AT Protocol firehose consumption.
 *
 * @remarks
 * This interface provides access to the AT Protocol firehose, enabling
 * Chive to subscribe to real-time repository events for indexing.
 *
 * **CRITICAL ATProto Compliance**:
 * - Read-only subscription (no publishing)
 * - Cursor persistence for resumption
 * - Graceful handling of disconnections
 *
 * @packageDocumentation
 * @public
 */

import type { CID, DID, NSID } from '../atproto.js';

/**
 * Repository event from firehose.
 *
 * @remarks
 * Union type representing different event types from `com.atproto.sync.subscribeRepos`.
 *
 * @public
 */
export type RepoEvent =
  | {
      /**
       * Repository commit event.
       *
       * @remarks
       * Emitted when a user commits changes to their repository.
       * Contains operations (create, update, delete) performed.
       */
      readonly $type: 'com.atproto.sync.subscribeRepos#commit';

      /**
       * Repository DID.
       */
      readonly repo: DID;

      /**
       * Commit CID.
       */
      readonly commit: CID;

      /**
       * Operations in this commit.
       */
      readonly ops: readonly RepoOp[];

      /**
       * Sequence number (monotonically increasing).
       */
      readonly seq: number;

      /**
       * Event timestamp (ISO 8601).
       */
      readonly time: string;
    }
  | {
      /**
       * Handle change event.
       *
       * @remarks
       * Emitted when a user's handle changes.
       */
      readonly $type: 'com.atproto.sync.subscribeRepos#handle';

      /**
       * User DID.
       */
      readonly did: DID;

      /**
       * New handle.
       */
      readonly handle: string;

      /**
       * Sequence number.
       */
      readonly seq: number;

      /**
       * Event timestamp (ISO 8601).
       */
      readonly time: string;
    }
  | {
      /**
       * Identity event.
       *
       * @remarks
       * Emitted when a user's DID document changes.
       */
      readonly $type: 'com.atproto.sync.subscribeRepos#identity';

      /**
       * User DID.
       */
      readonly did: DID;

      /**
       * Sequence number.
       */
      readonly seq: number;

      /**
       * Event timestamp (ISO 8601).
       */
      readonly time: string;
    };

/**
 * Repository operation (create, update, delete).
 *
 * @remarks
 * Represents a single operation within a commit event.
 *
 * @public
 */
export interface RepoOp {
  /**
   * Operation type.
   */
  readonly action: 'create' | 'update' | 'delete';

  /**
   * Record path in repository.
   *
   * @remarks
   * Format: "collection/rkey" (e.g., "pub.chive.preprint.submission/abc123")
   */
  readonly path: string;

  /**
   * New record CID (for create/update).
   *
   * @remarks
   * Absent for delete operations.
   */
  readonly cid?: CID;
}

/**
 * Subscription options for firehose.
 *
 * @public
 */
export interface SubscriptionOptions {
  /**
   * Relay WebSocket URL.
   *
   * @remarks
   * URL of the AT Protocol relay (e.g., "wss://bsky.network").
   */
  readonly relay: string;

  /**
   * Cursor for resuming subscription.
   *
   * @remarks
   * Sequence number to resume from. If omitted, starts from latest.
   * Use `getCurrentCursor()` to get last processed sequence.
   */
  readonly cursor?: number;

  /**
   * Collection filters.
   *
   * @remarks
   * If provided, only events for these collections are emitted.
   * Reduces network traffic and processing overhead.
   */
  readonly filter?: {
    /**
     * Collections to include (NSIDs).
     *
     * @example ["pub.chive.preprint.submission", "pub.chive.review.comment"]
     */
    readonly collections?: readonly NSID[];
  };
}

/**
 * Event stream consumer interface for firehose subscription.
 *
 * @remarks
 * Provides subscription to AT Protocol firehose for real-time indexing.
 *
 * Implementation notes:
 * - Uses WebSocket connection to relay
 * - Implements exponential backoff for reconnection
 * - Persists cursor in database for resumption
 * - Filters events by collection NSID
 *
 * @public
 */
export interface IEventStreamConsumer {
  /**
   * Subscribes to firehose events.
   *
   * @param options - Subscription configuration
   * @returns Async iterable of events
   *
   * @remarks
   * Returns an async iterable for memory-efficient streaming.
   * Use `for await...of` to process events.
   *
   * Connection is maintained until `disconnect()` is called or an
   * unrecoverable error occurs.
   *
   * @example
   * ```typescript
   * const events = consumer.subscribe({
   *   relay: 'wss://bsky.network',
   *   cursor: await consumer.getCurrentCursor(),
   *   filter: {
   *     collections: [toNSID('pub.chive.preprint.submission')!]
   *   }
   * });
   *
   * for await (const event of events) {
   *   if (event.$type === 'com.atproto.sync.subscribeRepos#commit') {
   *     for (const op of event.ops) {
   *       console.log(`${op.action} ${op.path}`);
   *     }
   *     await consumer.saveCursor(event.seq);
   *   }
   * }
   * ```
   *
   * @public
   */
  subscribe(options: SubscriptionOptions): AsyncIterable<RepoEvent>;

  /**
   * Gets the current cursor position.
   *
   * @returns Sequence number or null if never subscribed
   *
   * @remarks
   * Returns the last successfully processed sequence number.
   * Use this to resume subscription after restart.
   *
   * @example
   * ```typescript
   * const cursor = await consumer.getCurrentCursor();
   * if (cursor) {
   *   console.log('Resuming from sequence:', cursor);
   * }
   * ```
   *
   * @public
   */
  getCurrentCursor(): Promise<number | null>;

  /**
   * Saves cursor position for resumption.
   *
   * @param cursor - Sequence number to save
   * @returns Promise resolving when saved
   *
   * @remarks
   * Persists the cursor position after successfully processing an event.
   * Called after each event or in batches for efficiency.
   *
   * @example
   * ```typescript
   * for await (const event of events) {
   *   await processEvent(event);
   *   await consumer.saveCursor(event.seq);
   * }
   * ```
   *
   * @public
   */
  saveCursor(cursor: number): Promise<void>;

  /**
   * Disconnects from firehose.
   *
   * @returns Promise resolving when disconnected
   *
   * @remarks
   * Gracefully closes WebSocket connection and stops event iteration.
   *
   * @example
   * ```typescript
   * await consumer.disconnect();
   * console.log('Disconnected from firehose');
   * ```
   *
   * @public
   */
  disconnect(): Promise<void>;
}
