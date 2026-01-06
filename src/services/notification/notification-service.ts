/**
 * Notification service for event-driven notifications.
 *
 * @remarks
 * Handles notifications for reviews, endorsements, proposal status changes.
 * Supports both persistent storage (for read/unread tracking) and real-time
 * delivery via WebSocket/SSE handlers.
 *
 * **Architecture**:
 * - Notifications stored in Redis (fast lookup) with PostgreSQL backup
 * - Real-time delivery to connected WebSocket/SSE clients
 * - Batch notification support for bulk operations
 * - Per-user unread counts for UI badges
 *
 * **ATProto Compliance**:
 * - Notifications are AppView-local (not ATProto records)
 * - Reference preprints via AT-URI (never local IDs)
 * - Notification data never written to user PDSes
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';

import type { AtUri, DID, Timestamp } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { Result } from '../../types/result.js';

/**
 * Notification types supported by Chive.
 *
 * @public
 */
export type NotificationType =
  | 'new-review'
  | 'new-endorsement'
  | 'proposal-approved'
  | 'proposal-rejected'
  | 'new-version'
  | 'mention'
  | 'citation'
  | 'system';

/**
 * Notification record.
 *
 * @remarks
 * Represents a notification sent to a user. Notifications are ephemeral
 * and stored locally in the AppView, not in user PDSes.
 *
 * @public
 */
export interface Notification {
  /**
   * Unique notification ID.
   */
  readonly id: string;

  /**
   * Notification type.
   */
  readonly type: NotificationType;

  /**
   * Recipient DID.
   */
  readonly recipient: DID;

  /**
   * Notification subject line.
   */
  readonly subject: string;

  /**
   * Notification message body.
   */
  readonly message: string;

  /**
   * AT URI of the related resource (preprint, review, proposal).
   */
  readonly resourceUri?: AtUri;

  /**
   * DID of the actor who triggered the notification.
   */
  readonly actorDid?: DID;

  /**
   * Whether the notification has been read.
   */
  readonly read: boolean;

  /**
   * Creation timestamp.
   */
  readonly createdAt: Timestamp;
}

/**
 * Notification creation input.
 *
 * @public
 */
export interface CreateNotificationInput {
  /**
   * Notification type.
   */
  readonly type: NotificationType;

  /**
   * Recipient DID.
   */
  readonly recipient: DID;

  /**
   * Notification subject line.
   */
  readonly subject: string;

  /**
   * Notification message body.
   */
  readonly message: string;

  /**
   * AT URI of the related resource.
   */
  readonly resourceUri?: AtUri;

  /**
   * DID of the actor who triggered the notification.
   */
  readonly actorDid?: DID;
}

/**
 * Notification service configuration.
 *
 * @public
 */
export interface NotificationServiceOptions {
  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Redis client for notification storage and pub/sub.
   */
  readonly redis?: Redis;

  /**
   * Notification TTL in seconds.
   *
   * @defaultValue 2592000 (30 days)
   */
  readonly notificationTtlSeconds?: number;

  /**
   * Maximum notifications to keep per user.
   *
   * @defaultValue 1000
   */
  readonly maxNotificationsPerUser?: number;
}

/**
 * Handler for real-time notification delivery.
 *
 * @public
 */
export type NotificationDeliveryHandler = (notification: Notification) => void | Promise<void>;

/**
 * Notification service implementation.
 *
 * @remarks
 * Provides notification storage, retrieval, and real-time delivery.
 *
 * **Storage**:
 * - Per-user notification lists in Redis sorted sets (by timestamp)
 * - Notification details in Redis hashes
 * - Unread counts in Redis strings
 *
 * **Real-Time Delivery**:
 * - Register handlers for WebSocket/SSE delivery
 * - Handlers called on notification creation
 * - Supports multiple handlers (WebSocket + SSE simultaneously)
 *
 * **Keys**:
 * - `chive:notifications:{did}` - Sorted set of notification IDs
 * - `chive:notification:{id}` - Hash of notification details
 * - `chive:unread:{did}` - Unread count string
 *
 * @example
 * ```typescript
 * const service = new NotificationService({ logger, redis });
 *
 * // Create notification
 * const result = await service.createNotification({
 *   type: 'new-review',
 *   recipient: authorDid,
 *   subject: 'New review on your preprint',
 *   message: 'Your preprint received a new review',
 *   resourceUri: preprintUri,
 *   actorDid: reviewerDid,
 * });
 *
 * // Get user notifications
 * const notifications = await service.getNotifications(authorDid, { limit: 20 });
 *
 * // Get unread count
 * const unread = await service.getUnreadCount(authorDid);
 * ```
 *
 * @public
 */
export class NotificationService {
  private readonly logger: ILogger;
  private readonly redis?: Redis;
  private readonly notificationTtlSeconds: number;
  private readonly maxNotificationsPerUser: number;
  private readonly deliveryHandlers = new Set<NotificationDeliveryHandler>();

  constructor(options: NotificationServiceOptions) {
    this.logger = options.logger;
    this.redis = options.redis;
    this.notificationTtlSeconds = options.notificationTtlSeconds ?? 2592000;
    this.maxNotificationsPerUser = options.maxNotificationsPerUser ?? 1000;
  }

  /**
   * Creates a notification.
   *
   * @param input - Notification creation input
   * @returns Result with notification ID
   *
   * @remarks
   * Creates notification, stores in Redis, increments unread count,
   * and triggers real-time delivery handlers.
   *
   * @public
   */
  async createNotification(
    input: CreateNotificationInput
  ): Promise<Result<Notification, DatabaseError>> {
    try {
      const id = crypto.randomUUID();
      const now = Date.now() as Timestamp;

      const notification: Notification = {
        id,
        type: input.type,
        recipient: input.recipient,
        subject: input.subject,
        message: input.message,
        resourceUri: input.resourceUri,
        actorDid: input.actorDid,
        read: false,
        createdAt: now,
      };

      if (this.redis) {
        const pipeline = this.redis.pipeline();

        // Store notification details
        pipeline.hset(
          this.notificationKey(id),
          'id',
          notification.id,
          'type',
          notification.type,
          'recipient',
          notification.recipient,
          'subject',
          notification.subject,
          'message',
          notification.message,
          'resourceUri',
          notification.resourceUri ?? '',
          'actorDid',
          notification.actorDid ?? '',
          'read',
          '0',
          'createdAt',
          String(notification.createdAt)
        );
        pipeline.expire(this.notificationKey(id), this.notificationTtlSeconds);

        // Add to user's notification list (sorted by timestamp)
        pipeline.zadd(this.userNotificationsKey(input.recipient), now, id);

        // Trim to max notifications
        pipeline.zremrangebyrank(
          this.userNotificationsKey(input.recipient),
          0,
          -(this.maxNotificationsPerUser + 1)
        );

        // Increment unread count
        pipeline.incr(this.unreadKey(input.recipient));

        await pipeline.exec();
      }

      this.logger.info('Created notification', {
        id,
        type: input.type,
        recipient: input.recipient,
      });

      // Trigger real-time delivery
      await this.deliverNotification(notification);

      return { ok: true, value: notification };
    } catch (error) {
      this.logger.error(
        'Failed to create notification',
        error instanceof Error ? error : undefined
      );

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : `Failed to create notification: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Gets notifications for a user.
   *
   * @param did - User DID
   * @param options - List options
   * @returns Array of notifications
   *
   * @public
   */
  async getNotifications(
    did: DID,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean }
  ): Promise<readonly Notification[]> {
    if (!this.redis) {
      return [];
    }

    try {
      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;

      // Get notification IDs (newest first)
      const ids = await this.redis.zrevrange(
        this.userNotificationsKey(did),
        offset,
        offset + limit - 1
      );

      if (ids.length === 0) {
        return [];
      }

      // Fetch notification details
      const notifications: Notification[] = [];
      const pipeline = this.redis.pipeline();

      for (const id of ids) {
        pipeline.hgetall(this.notificationKey(id));
      }

      const results = await pipeline.exec();

      if (!results) {
        return [];
      }

      for (const result of results) {
        if (result[0] !== null || !result[1]) {
          continue;
        }

        const data = result[1] as Record<string, string>;
        if (!data.id) {
          continue;
        }

        const notification: Notification = {
          id: data.id,
          type: data.type as NotificationType,
          recipient: data.recipient as DID,
          subject: data.subject ?? '',
          message: data.message ?? '',
          resourceUri: data.resourceUri ? (data.resourceUri as AtUri) : undefined,
          actorDid: data.actorDid ? (data.actorDid as DID) : undefined,
          read: data.read === '1',
          createdAt: parseInt(data.createdAt ?? '0', 10) as Timestamp,
        };

        if (options?.unreadOnly && notification.read) {
          continue;
        }

        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      this.logger.error('Failed to get notifications', error instanceof Error ? error : undefined, {
        did,
      });
      return [];
    }
  }

  /**
   * Marks a notification as read.
   *
   * @param id - Notification ID
   * @param did - User DID (for validation)
   * @returns Result indicating success
   *
   * @public
   */
  async markAsRead(id: string, did: DID): Promise<Result<void, DatabaseError>> {
    if (!this.redis) {
      return { ok: true, value: undefined };
    }

    try {
      // Verify notification belongs to user
      const recipient = await this.redis.hget(this.notificationKey(id), 'recipient');
      if (recipient !== did) {
        return {
          ok: false,
          error: new DatabaseError('READ', 'Notification not found or unauthorized'),
        };
      }

      // Check if already read
      const currentRead = await this.redis.hget(this.notificationKey(id), 'read');
      if (currentRead === '1') {
        return { ok: true, value: undefined };
      }

      // Mark as read and decrement unread count
      const pipeline = this.redis.pipeline();
      pipeline.hset(this.notificationKey(id), 'read', '1');
      pipeline.decr(this.unreadKey(did));
      await pipeline.exec();

      this.logger.debug('Marked notification as read', { id, did });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error(
        'Failed to mark notification as read',
        error instanceof Error ? error : undefined,
        { id }
      );

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : `Failed to mark as read: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Marks all notifications as read for a user.
   *
   * @param did - User DID
   * @returns Result with count of marked notifications
   *
   * @public
   */
  async markAllAsRead(did: DID): Promise<Result<number, DatabaseError>> {
    if (!this.redis) {
      return { ok: true, value: 0 };
    }

    try {
      // Get all unread notification IDs
      const ids = await this.redis.zrange(this.userNotificationsKey(did), 0, -1);

      if (ids.length === 0) {
        return { ok: true, value: 0 };
      }

      let markedCount = 0;
      const pipeline = this.redis.pipeline();

      for (const id of ids) {
        pipeline.hget(this.notificationKey(id), 'read');
      }

      const readResults = await pipeline.exec();

      if (readResults) {
        const updatePipeline = this.redis.pipeline();

        for (let i = 0; i < ids.length; i++) {
          const readResult = readResults[i];
          const notificationId = ids[i];
          if (readResult?.[0] === null && readResult?.[1] === '0' && notificationId) {
            updatePipeline.hset(this.notificationKey(notificationId), 'read', '1');
            markedCount++;
          }
        }

        await updatePipeline.exec();
      }

      // Reset unread count to 0
      await this.redis.set(this.unreadKey(did), '0');

      this.logger.info('Marked all notifications as read', { did, count: markedCount });

      return { ok: true, value: markedCount };
    } catch (error) {
      this.logger.error('Failed to mark all as read', error instanceof Error ? error : undefined, {
        did,
      });

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : `Failed to mark all as read: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Gets unread notification count for a user.
   *
   * @param did - User DID
   * @returns Unread count
   *
   * @public
   */
  async getUnreadCount(did: DID): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    try {
      const count = await this.redis.get(this.unreadKey(did));
      const parsed = count ? parseInt(count, 10) : 0;
      return Math.max(0, parsed); // Ensure non-negative
    } catch (error) {
      this.logger.error('Failed to get unread count', error instanceof Error ? error : undefined, {
        did,
      });
      return 0;
    }
  }

  /**
   * Creates notifications in batch.
   *
   * @param inputs - Array of notification inputs
   * @returns Result with created notifications
   *
   * @remarks
   * Batch creates notifications for efficiency. Used when sending
   * notifications to multiple recipients (e.g., all co-authors).
   *
   * @public
   */
  async createBatch(
    inputs: readonly CreateNotificationInput[]
  ): Promise<Result<readonly Notification[], DatabaseError>> {
    try {
      const notifications: Notification[] = [];

      for (const input of inputs) {
        const result = await this.createNotification(input);
        if (result.ok) {
          notifications.push(result.value);
        }
      }

      return { ok: true, value: notifications };
    } catch (error) {
      this.logger.error(
        'Failed to create batch notifications',
        error instanceof Error ? error : undefined
      );

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : `Failed to create batch: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Registers a handler for real-time notification delivery.
   *
   * @param handler - Delivery handler function
   * @returns Unsubscribe function
   *
   * @remarks
   * Register WebSocket or SSE handlers to receive notifications in real-time.
   * Handlers are called when notifications are created.
   *
   * @example
   * ```typescript
   * const unsubscribe = service.registerDeliveryHandler(async (notification) => {
   *   // Send via WebSocket
   *   wsServer.send(notification.recipient, notification);
   * });
   *
   * // Later, unsubscribe
   * unsubscribe();
   * ```
   *
   * @public
   */
  registerDeliveryHandler(handler: NotificationDeliveryHandler): () => void {
    this.deliveryHandlers.add(handler);
    this.logger.debug('Registered notification delivery handler');

    return () => {
      this.deliveryHandlers.delete(handler);
      this.logger.debug('Unregistered notification delivery handler');
    };
  }

  /**
   * Delivers notification to registered handlers.
   *
   * @internal
   */
  private async deliverNotification(notification: Notification): Promise<void> {
    for (const handler of this.deliveryHandlers) {
      try {
        await handler(notification);
      } catch (error) {
        this.logger.error('Delivery handler error', error instanceof Error ? error : undefined);
      }
    }
  }

  /**
   * Builds notification key.
   *
   * @internal
   */
  private notificationKey(id: string): string {
    return `chive:notification:${id}`;
  }

  /**
   * Builds user notifications list key.
   *
   * @internal
   */
  private userNotificationsKey(did: DID): string {
    return `chive:notifications:${did}`;
  }

  /**
   * Builds unread count key.
   *
   * @internal
   */
  private unreadKey(did: DID): string {
    return `chive:unread:${did}`;
  }
}
