/**
 * WebSocket handler for real-time notification delivery.
 *
 * @remarks
 * Manages WebSocket connections for push notifications. Clients connect
 * and receive notifications in real-time without polling.
 *
 * **Connection Flow**:
 * 1. Client connects with auth token
 * 2. Handler validates token, extracts DID
 * 3. Client registered for notifications
 * 4. Notifications pushed as JSON messages
 *
 * **Message Protocol**:
 * - Server → Client: `{ type: "notification", data: Notification }`
 * - Server → Client: `{ type: "ping" }` (keepalive every 30s)
 * - Client → Server: `{ type: "pong" }` (keepalive response)
 * - Client → Server: `{ type: "mark-read", id: string }` (mark notification as read)
 *
 * **ATProto Compliance**:
 * - WebSocket is AppView-local infrastructure
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
 * WebSocket handler configuration.
 *
 * @public
 */
export interface WebSocketHandlerOptions {
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

  /**
   * Connection timeout in milliseconds.
   *
   * @defaultValue 60000 (60 seconds)
   */
  readonly connectionTimeoutMs?: number;
}

/**
 * Client connection state.
 *
 * @public
 */
export interface ClientConnection {
  /**
   * Unique connection ID.
   */
  readonly id: string;

  /**
   * User DID.
   */
  readonly did: DID;

  /**
   * WebSocket instance.
   */
  readonly socket: WebSocket;

  /**
   * Connection timestamp.
   */
  readonly connectedAt: Date;

  /**
   * Last activity timestamp.
   */
  lastActivityAt: Date;
}

/**
 * WebSocket message from client.
 *
 * @public
 */
export type ClientMessage =
  | { type: 'pong' }
  | { type: 'mark-read'; id: string }
  | { type: 'subscribe'; resourceUri?: string };

/**
 * WebSocket message to client.
 *
 * @public
 */
export type ServerMessage =
  | { type: 'notification'; data: Notification }
  | { type: 'ping' }
  | { type: 'connected'; connectionId: string }
  | { type: 'error'; message: string };

/**
 * WebSocket handler for real-time notifications.
 *
 * @remarks
 * Manages WebSocket connections and delivers notifications in real-time.
 *
 * **Connection Management**:
 * - Tracks active connections per user (DID)
 * - Supports multiple connections per user (different devices)
 * - Automatic cleanup on disconnect
 * - Keepalive pings every 30 seconds
 *
 * **Delivery**:
 * - Registers as delivery handler with NotificationService
 * - Receives all notifications via handler callback
 * - Filters by recipient DID and sends to matching connections
 *
 * @example
 * ```typescript
 * const handler = new WebSocketHandler({
 *   notificationService,
 *   logger,
 * });
 *
 * // Handle WebSocket upgrade in Hono
 * app.get('/ws/notifications', async (c) => {
 *   const token = c.req.header('Authorization');
 *   const did = await validateToken(token);
 *
 *   return handler.handleUpgrade(c.req.raw, did);
 * });
 * ```
 *
 * @public
 */
export class WebSocketHandler {
  private readonly notificationService: NotificationService;
  private readonly logger: ILogger;
  private readonly pingIntervalMs: number;
  private readonly connectionTimeoutMs: number;
  private readonly connections = new Map<string, ClientConnection>();
  private readonly connectionsByDid = new Map<DID, Set<string>>();
  private pingInterval?: ReturnType<typeof setInterval>;
  private unsubscribeDelivery?: () => void;

  constructor(options: WebSocketHandlerOptions) {
    this.notificationService = options.notificationService;
    this.logger = options.logger;
    this.pingIntervalMs = options.pingIntervalMs ?? 30000;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 60000;

    // Register as notification delivery handler
    this.unsubscribeDelivery = this.notificationService.registerDeliveryHandler(
      this.handleNotification.bind(this)
    );

    // Start keepalive ping interval
    this.startPingInterval();
  }

  /**
   * Handles WebSocket upgrade request.
   *
   * @param request - HTTP request to upgrade
   * @param did - Authenticated user DID
   * @returns WebSocket upgrade response
   *
   * @remarks
   * Upgrades HTTP connection to WebSocket. The DID must be validated
   * before calling this method (via auth middleware).
   *
   * @public
   */
  handleUpgrade(request: Request, did: DID): Response {
    const upgradeHeader = request.headers.get('Upgrade');

    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Create WebSocket pair
    type WebSocketPairConstructor = new () => [WebSocket, WebSocket];
    const { 0: client, 1: server } = new (
      globalThis as typeof globalThis & { WebSocketPair: WebSocketPairConstructor }
    ).WebSocketPair();

    // Accept the WebSocket connection
    (server as WebSocket & { accept(): void }).accept();

    // Register connection
    const connectionId = crypto.randomUUID();
    const connection: ClientConnection = {
      id: connectionId,
      did,
      socket: server,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.registerConnection(connection);

    // Set up message handler
    server.addEventListener('message', (event) => {
      this.handleMessage(connection, event.data as string);
    });

    // Set up close handler
    server.addEventListener('close', () => {
      this.unregisterConnection(connectionId);
    });

    // Send connected message
    this.sendMessage(server, { type: 'connected', connectionId });

    this.logger.info('WebSocket connected', { connectionId, did });

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit & { webSocket: WebSocket });
  }

  /**
   * Sends notification to a specific client.
   *
   * @param connectionId - Client connection ID
   * @param notification - Notification to send
   *
   * @public
   */
  sendNotification(connectionId: string, notification: Notification): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.sendMessage(connection.socket, { type: 'notification', data: notification });
    connection.lastActivityAt = new Date();
  }

  /**
   * Broadcasts notification to all connections for a user.
   *
   * @param did - User DID
   * @param notification - Notification to broadcast
   *
   * @public
   */
  broadcast(did: DID, notification: Notification): void {
    const connectionIds = this.connectionsByDid.get(did);
    if (!connectionIds) {
      return;
    }

    for (const connectionId of connectionIds) {
      this.sendNotification(connectionId, notification);
    }
  }

  /**
   * Gets all connected clients.
   *
   * @returns Array of client connections
   *
   * @public
   */
  getConnectedClients(): readonly ClientConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Gets connection count for a user.
   *
   * @param did - User DID
   * @returns Number of active connections
   *
   * @public
   */
  getConnectionCount(did: DID): number {
    return this.connectionsByDid.get(did)?.size ?? 0;
  }

  /**
   * Disconnects a client.
   *
   * @param connectionId - Connection to disconnect
   *
   * @public
   */
  disconnectClient(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      connection.socket.close(1000, 'Disconnected by server');
    } catch {
      // Socket may already be closed
    }

    this.unregisterConnection(connectionId);
  }

  /**
   * Shuts down the handler.
   *
   * @remarks
   * Disconnects all clients and cleans up resources.
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

    // Disconnect all clients
    for (const connectionId of this.connections.keys()) {
      this.disconnectClient(connectionId);
    }

    this.logger.info('WebSocket handler shut down');
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
   * Handles client message.
   *
   * @internal
   */
  private handleMessage(connection: ClientConnection, data: string): void {
    try {
      const message = JSON.parse(data) as ClientMessage;
      connection.lastActivityAt = new Date();

      switch (message.type) {
        case 'pong':
          // Keepalive response, just update activity time
          break;

        case 'mark-read':
          // Mark notification as read
          void this.notificationService.markAsRead(message.id, connection.did);
          break;

        case 'subscribe':
          // Future: subscribe to specific resource updates
          this.logger.debug('Subscribe request', { resourceUri: message.resourceUri });
          break;

        default:
          this.logger.warn('Unknown message type', { data });
      }
    } catch (error) {
      this.logger.error(
        'Failed to parse client message',
        error instanceof Error ? error : undefined
      );
      this.sendMessage(connection.socket, { type: 'error', message: 'Invalid message format' });
    }
  }

  /**
   * Sends message to WebSocket.
   *
   * @internal
   */
  private sendMessage(socket: WebSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(
        'Failed to send WebSocket message',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Registers a new connection.
   *
   * @internal
   */
  private registerConnection(connection: ClientConnection): void {
    this.connections.set(connection.id, connection);

    // Add to DID lookup
    let didConnections = this.connectionsByDid.get(connection.did);
    if (!didConnections) {
      didConnections = new Set();
      this.connectionsByDid.set(connection.did, didConnections);
    }
    didConnections.add(connection.id);

    this.logger.debug('Registered WebSocket connection', {
      connectionId: connection.id,
      did: connection.did,
      totalConnections: this.connections.size,
    });
  }

  /**
   * Unregisters a connection.
   *
   * @internal
   */
  private unregisterConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.connections.delete(connectionId);

    // Remove from DID lookup
    const didConnections = this.connectionsByDid.get(connection.did);
    if (didConnections) {
      didConnections.delete(connectionId);
      if (didConnections.size === 0) {
        this.connectionsByDid.delete(connection.did);
      }
    }

    this.logger.debug('Unregistered WebSocket connection', {
      connectionId,
      did: connection.did,
      totalConnections: this.connections.size,
    });
  }

  /**
   * Starts keepalive ping interval.
   *
   * @internal
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();

      for (const [connectionId, connection] of this.connections) {
        // Check for timed out connections
        if (now - connection.lastActivityAt.getTime() > this.connectionTimeoutMs) {
          this.logger.debug('Connection timed out', { connectionId });
          this.disconnectClient(connectionId);
          continue;
        }

        // Send ping
        this.sendMessage(connection.socket, { type: 'ping' });
      }
    }, this.pingIntervalMs);
  }
}
