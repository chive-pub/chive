/**
 * Server-Sent Events (SSE) handler for real-time notification delivery.
 *
 * @remarks
 * Provides an alternative to WebSocket for real-time notifications using
 * standard HTTP long-polling with SSE. Simpler than WebSocket and works
 * through HTTP proxies without special configuration.
 *
 * **SSE vs WebSocket**:
 * - SSE: One-way server→client, simpler, auto-reconnect, HTTP-native
 * - WebSocket: Bidirectional, lower latency, more complex
 *
 * **Event Format**:
 * ```
 * event: notification
 * data: {"id":"...","type":"new-review",...}
 *
 * event: ping
 * data: {"timestamp":1234567890}
 * ```
 *
 * **ATProto Compliance**:
 * - SSE is AppView-local infrastructure
 * - No ATProto records involved
 * - DID used for authentication only
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

import type { Notification, NotificationService } from './notification-service.js';

/**
 * SSE handler configuration.
 *
 * @public
 */
export interface SSEHandlerOptions {
  /**
   * Notification service instance.
   */
  readonly notificationService: NotificationService;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Ping interval in milliseconds.
   *
   * @defaultValue 30000 (30 seconds)
   */
  readonly pingIntervalMs?: number;
}

/**
 * SSE stream state.
 *
 * @internal
 */
interface StreamState {
  /**
   * Unique stream ID.
   */
  readonly id: string;

  /**
   * User DID.
   */
  readonly did: DID;

  /**
   * Stream writer.
   */
  readonly writer: WritableStreamDefaultWriter<Uint8Array>;

  /**
   * Whether stream is active.
   */
  active: boolean;

  /**
   * Connection timestamp.
   */
  readonly connectedAt: Date;
}

/**
 * SSE handler for real-time notifications.
 *
 * @remarks
 * Creates SSE streams for clients to receive notifications in real-time.
 * Each stream is a long-lived HTTP response that sends events as they occur.
 *
 * **Connection Management**:
 * - Tracks active streams per user (DID)
 * - Supports multiple streams per user (different devices)
 * - Automatic cleanup on stream close
 * - Keepalive pings every 30 seconds
 *
 * **Delivery**:
 * - Registers as delivery handler with NotificationService
 * - Receives all notifications via handler callback
 * - Filters by recipient DID and sends to matching streams
 *
 * @example
 * ```typescript
 * const handler = new SSEHandler({
 *   notificationService,
 *   logger,
 * });
 *
 * // Create SSE endpoint in Hono
 * app.get('/events/notifications', async (c) => {
 *   const token = c.req.header('Authorization');
 *   const did = await validateToken(token);
 *
 *   return handler.createStream(did);
 * });
 * ```
 *
 * @public
 */
export class SSEHandler {
  private readonly notificationService: NotificationService;
  private readonly logger: ILogger;
  private readonly pingIntervalMs: number;
  private readonly streams = new Map<string, StreamState>();
  private readonly streamsByDid = new Map<DID, Set<string>>();
  private pingInterval?: ReturnType<typeof setInterval>;
  private unsubscribeDelivery?: () => void;

  constructor(options: SSEHandlerOptions) {
    this.notificationService = options.notificationService;
    this.logger = options.logger;
    this.pingIntervalMs = options.pingIntervalMs ?? 30000;

    // Register as notification delivery handler
    this.unsubscribeDelivery = this.notificationService.registerDeliveryHandler(
      this.handleNotification.bind(this)
    );

    // Start keepalive ping interval
    this.startPingInterval();
  }

  /**
   * Creates an SSE stream for a client.
   *
   * @param did - Authenticated user DID
   * @returns SSE Response with readable stream
   *
   * @remarks
   * Returns a Response with Content-Type: text/event-stream that can be
   * consumed by EventSource in browsers.
   *
   * @example
   * ```typescript
   * // Server (Hono)
   * app.get('/events', (c) => {
   *   const did = c.get('did'); // From auth middleware
   *   return handler.createStream(did);
   * });
   *
   * // Client (Browser)
   * const events = new EventSource('/events', { withCredentials: true });
   * events.addEventListener('notification', (e) => {
   *   const notification = JSON.parse(e.data);
   *   console.log('New notification:', notification);
   * });
   * ```
   *
   * @public
   */
  createStream(did: DID): Response {
    const streamId = crypto.randomUUID();
    const encoder = new TextEncoder();

    // Create transform stream for SSE formatting
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    // Register stream
    const state: StreamState = {
      id: streamId,
      did,
      writer,
      active: true,
      connectedAt: new Date(),
    };

    this.registerStream(state);

    // Send initial connection event
    void this.sendEvent(writer, encoder, 'connected', { streamId });

    // Set up cleanup when stream closes
    void readable
      .pipeTo(
        new WritableStream({
          close: () => {
            this.unregisterStream(streamId);
          },
          abort: () => {
            this.unregisterStream(streamId);
          },
        })
      )
      .catch(() => {
        this.unregisterStream(streamId);
      });

    this.logger.info('SSE stream created', { streamId, did });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Stream-Id': streamId,
      },
    });
  }

  /**
   * Pushes notification to a specific stream.
   *
   * @param streamId - Stream ID
   * @param notification - Notification to send
   *
   * @public
   */
  pushNotification(streamId: string, notification: Notification): void {
    const state = this.streams.get(streamId);
    if (!state?.active) {
      return;
    }

    const encoder = new TextEncoder();
    void this.sendEvent(state.writer, encoder, 'notification', notification);
  }

  /**
   * Broadcasts notification to all streams for a user.
   *
   * @param did - User DID
   * @param notification - Notification to broadcast
   *
   * @public
   */
  broadcast(did: DID, notification: Notification): void {
    const streamIds = this.streamsByDid.get(did);
    if (!streamIds) {
      return;
    }

    for (const streamId of streamIds) {
      this.pushNotification(streamId, notification);
    }
  }

  /**
   * Gets active stream count for a user.
   *
   * @param did - User DID
   * @returns Number of active streams
   *
   * @public
   */
  getStreamCount(did: DID): number {
    return this.streamsByDid.get(did)?.size ?? 0;
  }

  /**
   * Gets total active stream count.
   *
   * @returns Total number of active streams
   *
   * @public
   */
  getTotalStreamCount(): number {
    return this.streams.size;
  }

  /**
   * Closes a stream.
   *
   * @param streamId - Stream to close
   *
   * @public
   */
  closeStream(streamId: string): void {
    const state = this.streams.get(streamId);
    if (!state) {
      return;
    }

    state.active = false;

    try {
      void state.writer.close();
    } catch {
      // Writer may already be closed
    }

    this.unregisterStream(streamId);
  }

  /**
   * Shuts down the handler.
   *
   * @remarks
   * Closes all streams and cleans up resources.
   *
   * @public
   */
  shutdown(): void {
    // Stop ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Unsubscribe from notifications
    if (this.unsubscribeDelivery) {
      this.unsubscribeDelivery();
    }

    // Close all streams
    for (const streamId of this.streams.keys()) {
      this.closeStream(streamId);
    }

    this.logger.info('SSE handler shut down');
  }

  /**
   * Handles incoming notification for delivery.
   *
   * @internal
   */
  private handleNotification(notification: Notification): void {
    this.broadcast(notification.recipient, notification);
  }

  /**
   * Sends SSE event.
   *
   * @internal
   */
  private async sendEvent(
    writer: WritableStreamDefaultWriter<Uint8Array>,
    encoder: InstanceType<typeof TextEncoder>,
    eventType: string,
    data: unknown
  ): Promise<void> {
    try {
      const eventData = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(eventData));
    } catch (error) {
      this.logger.error('Failed to send SSE event', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Registers a new stream.
   *
   * @internal
   */
  private registerStream(state: StreamState): void {
    this.streams.set(state.id, state);

    // Add to DID lookup
    let didStreams = this.streamsByDid.get(state.did);
    if (!didStreams) {
      didStreams = new Set();
      this.streamsByDid.set(state.did, didStreams);
    }
    didStreams.add(state.id);

    this.logger.debug('Registered SSE stream', {
      streamId: state.id,
      did: state.did,
      totalStreams: this.streams.size,
    });
  }

  /**
   * Unregisters a stream.
   *
   * @internal
   */
  private unregisterStream(streamId: string): void {
    const state = this.streams.get(streamId);
    if (!state) {
      return;
    }

    state.active = false;
    this.streams.delete(streamId);

    // Remove from DID lookup
    const didStreams = this.streamsByDid.get(state.did);
    if (didStreams) {
      didStreams.delete(streamId);
      if (didStreams.size === 0) {
        this.streamsByDid.delete(state.did);
      }
    }

    this.logger.debug('Unregistered SSE stream', {
      streamId,
      did: state.did,
      totalStreams: this.streams.size,
    });
  }

  /**
   * Starts keepalive ping interval.
   *
   * @internal
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const encoder = new TextEncoder();
      const pingData = { timestamp: Date.now() };

      for (const state of this.streams.values()) {
        if (!state.active) {
          continue;
        }

        void this.sendEvent(state.writer, encoder, 'ping', pingData);
      }
    }, this.pingIntervalMs);
  }
}
