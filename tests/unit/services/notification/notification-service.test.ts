/**
 * Unit tests for NotificationService.
 *
 * @remarks
 * Tests notification creation, retrieval, and delivery functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  NotificationService,
  type CreateNotificationInput,
  type NotificationType,
} from '@/services/notification/notification-service.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

interface MockLogger extends ILogger {
  infoMock: ReturnType<typeof vi.fn>;
}

const createMockLogger = (): MockLogger => {
  const infoMock = vi.fn();
  const logger: MockLogger = {
    debug: vi.fn(),
    info: infoMock,
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(function (this: void) {
      return logger;
    }),
    infoMock,
  };
  return logger;
};

const createMockNotificationInput = (
  overrides?: Partial<CreateNotificationInput>
): CreateNotificationInput => ({
  type: 'new-review',
  recipient: 'did:plc:recipient' as DID,
  subject: 'New review on your preprint',
  message: 'Your preprint received a new review',
  ...overrides,
});

describe('NotificationService', () => {
  let logger: MockLogger;
  let service: NotificationService;

  beforeEach(() => {
    logger = createMockLogger();
    service = new NotificationService({ logger });
  });

  describe('createNotification', () => {
    it('creates notification successfully', async () => {
      const input = createMockNotificationInput();

      const result = await service.createNotification(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe('new-review');
        expect(result.value.recipient).toBe('did:plc:recipient');
        expect(result.value.subject).toBe('New review on your preprint');
        expect(result.value.read).toBe(false);
        expect(result.value.id).toBeDefined();
        expect(result.value.createdAt).toBeDefined();
      }
    });

    it('handles different notification types', async () => {
      const types: NotificationType[] = [
        'new-review',
        'new-endorsement',
        'proposal-approved',
        'proposal-rejected',
        'new-version',
        'mention',
        'citation',
        'system',
      ];

      for (const type of types) {
        const input = createMockNotificationInput({ type });
        const result = await service.createNotification(input);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.type).toBe(type);
        }
      }
    });

    it('handles optional resourceUri and actorDid', async () => {
      const input = createMockNotificationInput({
        resourceUri: 'at://did:plc:author/pub.chive.preprint.submission/abc123' as never,
        actorDid: 'did:plc:reviewer' as DID,
      });

      const result = await service.createNotification(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.resourceUri).toBe(
          'at://did:plc:author/pub.chive.preprint.submission/abc123'
        );
        expect(result.value.actorDid).toBe('did:plc:reviewer');
      }
    });
  });

  describe('registerDeliveryHandler', () => {
    it('registers handler and calls it on notification creation', async () => {
      const handler = vi.fn();
      service.registerDeliveryHandler(handler);

      const input = createMockNotificationInput();
      await service.createNotification(input);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'new-review',
          recipient: 'did:plc:recipient',
        })
      );
    });

    it('unsubscribe removes handler', async () => {
      const handler = vi.fn();
      const unsubscribe = service.registerDeliveryHandler(handler);

      unsubscribe();

      const input = createMockNotificationInput();
      await service.createNotification(input);

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      service.registerDeliveryHandler(handler1);
      service.registerDeliveryHandler(handler2);

      const input = createMockNotificationInput();
      await service.createNotification(input);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('createBatch', () => {
    it('creates multiple notifications', async () => {
      const inputs: CreateNotificationInput[] = [
        createMockNotificationInput({ recipient: 'did:plc:user1' as DID }),
        createMockNotificationInput({ recipient: 'did:plc:user2' as DID }),
        createMockNotificationInput({ recipient: 'did:plc:user3' as DID }),
      ];

      const result = await service.createBatch(inputs);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(3);
        expect(result.value[0]?.recipient).toBe('did:plc:user1');
        expect(result.value[1]?.recipient).toBe('did:plc:user2');
        expect(result.value[2]?.recipient).toBe('did:plc:user3');
      }
    });
  });

  describe('getUnreadCount (without Redis)', () => {
    it('returns 0 when Redis is not configured', async () => {
      const count = await service.getUnreadCount('did:plc:user' as DID);

      expect(count).toBe(0);
    });
  });

  describe('getNotifications (without Redis)', () => {
    it('returns empty array when Redis is not configured', async () => {
      const notifications = await service.getNotifications('did:plc:user' as DID);

      expect(notifications).toEqual([]);
    });
  });
});
