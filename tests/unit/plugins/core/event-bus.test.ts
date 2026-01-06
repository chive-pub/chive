/**
 * Unit tests for PluginEventBus.
 *
 * @remarks
 * Tests event subscription, emission, wildcard patterns, and error isolation.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PluginEventBus } from '@/plugins/core/event-bus.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

/**
 * Creates a mock logger for testing.
 *
 * @returns Mock logger instance
 */
const createMockLogger = (): ILogger => {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
};

describe('PluginEventBus', () => {
  let eventBus: PluginEventBus;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    eventBus = new PluginEventBus(mockLogger);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('constructor', () => {
    it('should create event bus with logger', () => {
      expect(eventBus).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'PluginEventBus' });
    });
  });

  describe('on', () => {
    it('should register event handler', () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);

      expect(eventBus.listenerCount('test.event')).toBe(1);
    });

    it('should allow multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test.event', handler1);
      eventBus.on('test.event', handler2);

      expect(eventBus.listenerCount('test.event')).toBe(2);
    });

    it('should call handler when event is emitted', async () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);

      eventBus.emit('test.event', { data: 'test' });

      // Wait for async handler execution
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should support wildcard event patterns', async () => {
      const handler = vi.fn();
      eventBus.on('preprint.*', handler);

      eventBus.emit('preprint.indexed', { uri: 'test-uri' });
      eventBus.emit('preprint.updated', { uri: 'test-uri-2' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should isolate errors in handlers', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = vi.fn();

      eventBus.on('test.event', errorHandler);
      eventBus.on('test.event', successHandler);

      eventBus.emit('test.event', { data: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Both handlers should be called, error should be logged
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle async handlers', async () => {
      const handler = vi.fn(() => {
        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        })();
      });

      eventBus.on('test.event', handler);
      eventBus.emit('test.event', {});

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalled();
    });

    it('should log handler registration', () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Handler registered',
        expect.objectContaining({ event: 'test.event' })
      );
    });
  });

  describe('once', () => {
    it('should register one-time handler', async () => {
      const handler = vi.fn();
      eventBus.once('test.event', handler);

      eventBus.emit('test.event', { count: 1 });
      eventBus.emit('test.event', { count: 2 });

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ count: 1 });
    });

    it('should clean up handler after execution', async () => {
      const handler = vi.fn();
      eventBus.once('test.event', handler);

      expect(eventBus.listenerCount('test.event')).toBe(1);

      eventBus.emit('test.event', {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventBus.listenerCount('test.event')).toBe(0);
    });

    it('should isolate errors in one-time handlers', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('One-time handler error');
      });

      eventBus.once('test.event', errorHandler);
      eventBus.emit('test.event', {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalled();
      expect(eventBus.listenerCount('test.event')).toBe(0);
    });
  });

  describe('emit', () => {
    it('should emit event with arguments', async () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);

      eventBus.emit('test.event', 'arg1', 'arg2', 'arg3');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should log event emission', () => {
      eventBus.emit('test.event', { data: 'test' });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Emitting event',
        expect.objectContaining({ event: 'test.event', argCount: 1 })
      );
    });

    it('should handle events with no listeners', () => {
      expect(() => {
        eventBus.emit('unknown.event', {});
      }).not.toThrow();
    });
  });

  describe('emitAsync', () => {
    it('should wait for all handlers to complete', async () => {
      const results: number[] = [];

      eventBus.on('test.event', () => {
        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          results.push(1);
        })();
      });

      eventBus.on('test.event', () => {
        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          results.push(2);
        })();
      });

      await eventBus.emitAsync('test.event');

      // Give handlers time to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toContain(1);
      expect(results).toContain(2);
    });

    it('should log async event emission', async () => {
      await eventBus.emitAsync('test.event', { data: 'test' });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Emitting async event',
        expect.objectContaining({ event: 'test.event' })
      );
    });
  });

  describe('off', () => {
    it('should remove event handler', () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);

      expect(eventBus.listenerCount('test.event')).toBe(1);

      eventBus.off('test.event', handler);

      expect(eventBus.listenerCount('test.event')).toBe(0);
    });

    it('should not call removed handler', async () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);
      eventBus.off('test.event', handler);

      eventBus.emit('test.event', {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should only remove specific handler', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test.event', handler1);
      eventBus.on('test.event', handler2);
      eventBus.off('test.event', handler1);

      eventBus.emit('test.event', {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should handle removing non-existent handler', () => {
      const handler = vi.fn();

      expect(() => {
        eventBus.off('test.event', handler);
      }).not.toThrow();
    });

    it('should log handler removal', () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);
      eventBus.off('test.event', handler);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Handler removed',
        expect.objectContaining({ event: 'test.event' })
      );
    });
  });

  describe('listenerCount', () => {
    it('should return correct count for event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test.event', handler1);
      eventBus.on('test.event', handler2);

      expect(eventBus.listenerCount('test.event')).toBe(2);
    });

    it('should return 0 for event with no listeners', () => {
      expect(eventBus.listenerCount('unknown.event')).toBe(0);
    });
  });

  describe('eventNames', () => {
    it('should return all registered event names', () => {
      eventBus.on('event.one', vi.fn());
      eventBus.on('event.two', vi.fn());
      eventBus.on('event.three', vi.fn());

      const names = eventBus.eventNames();

      expect(names).toContain('event.one');
      expect(names).toContain('event.two');
      expect(names).toContain('event.three');
    });

    it('should return empty array when no events registered', () => {
      expect(eventBus.eventNames()).toHaveLength(0);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners', () => {
      eventBus.on('event.one', vi.fn());
      eventBus.on('event.two', vi.fn());

      eventBus.removeAllListeners();

      expect(eventBus.listenerCount('event.one')).toBe(0);
      expect(eventBus.listenerCount('event.two')).toBe(0);
      expect(eventBus.eventNames()).toHaveLength(0);
    });

    it('should log removal', () => {
      eventBus.on('test.event', vi.fn());
      eventBus.removeAllListeners();

      expect(mockLogger.info).toHaveBeenCalledWith('All event listeners removed');
    });
  });

  describe('removeAllListenersForEvent', () => {
    it('should remove listeners for specific event only', () => {
      eventBus.on('event.one', vi.fn());
      eventBus.on('event.two', vi.fn());

      eventBus.removeAllListenersForEvent('event.one');

      expect(eventBus.listenerCount('event.one')).toBe(0);
      expect(eventBus.listenerCount('event.two')).toBe(1);
    });

    it('should log removal for specific event', () => {
      eventBus.on('test.event', vi.fn());
      eventBus.removeAllListenersForEvent('test.event');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Listeners removed for event',
        expect.objectContaining({ event: 'test.event' })
      );
    });
  });

  describe('wildcard event patterns', () => {
    it('should match single-level wildcard', async () => {
      const handler = vi.fn();
      eventBus.on('plugin.*', handler);

      eventBus.emit('plugin.loaded', { pluginId: 'test' });
      eventBus.emit('plugin.unloaded', { pluginId: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should not match different namespace', async () => {
      const handler = vi.fn();
      eventBus.on('preprint.*', handler);

      eventBus.emit('review.created', {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
