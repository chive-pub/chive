/**
 * Unit tests for ScopedPluginEventBus.
 *
 * @remarks
 * Tests scoped event emission, hook restrictions, and automatic cleanup.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PluginEventBus } from '@/plugins/core/event-bus.js';
import { ScopedPluginEventBus } from '@/plugins/core/scoped-event-bus.js';
import { PluginPermissionError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IPluginManifest } from '@/types/interfaces/plugin.interface.js';

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

/**
 * Creates a test manifest with specified hooks.
 *
 * @param hooks - Allowed hooks for the plugin
 * @returns Plugin manifest
 */
const createTestManifest = (hooks: string[] = []): IPluginManifest => ({
  id: 'pub.chive.plugin.test',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin for unit testing',
  author: 'Chive Team',
  license: 'MIT',
  permissions: {
    hooks,
    network: {
      allowedDomains: [],
    },
    storage: {
      maxSize: 1024 * 1024,
    },
  },
  entrypoint: 'index.js',
});

describe('ScopedPluginEventBus', () => {
  let mainEventBus: PluginEventBus;
  let scopedEventBus: ScopedPluginEventBus;
  let mockLogger: ILogger;
  let manifest: IPluginManifest;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mainEventBus = new PluginEventBus(mockLogger);
    manifest = createTestManifest(['preprint.indexed', 'preprint.updated', 'system.*']);
    scopedEventBus = new ScopedPluginEventBus(mainEventBus, manifest);
  });

  afterEach(() => {
    scopedEventBus.cleanup();
    mainEventBus.removeAllListeners();
  });

  describe('constructor', () => {
    it('should create scoped event bus', () => {
      expect(scopedEventBus).toBeDefined();
    });
  });

  describe('on', () => {
    it('should allow subscribing to permitted hooks', () => {
      const handler = vi.fn();
      scopedEventBus.on('preprint.indexed', handler);

      expect(mainEventBus.listenerCount('preprint.indexed')).toBe(1);
    });

    it('should throw PluginPermissionError for non-permitted hooks', () => {
      const handler = vi.fn();

      expect(() => {
        scopedEventBus.on('review.created', handler);
      }).toThrow(PluginPermissionError);
    });

    it('should allow wildcard patterns matching permissions', () => {
      const handler = vi.fn();
      scopedEventBus.on('system.startup', handler);

      expect(mainEventBus.listenerCount('system.startup')).toBe(1);
    });

    it('should track subscriptions for cleanup', () => {
      const handler = vi.fn();
      scopedEventBus.on('preprint.indexed', handler);

      expect(scopedEventBus.getHandlerCount()).toBe(1);

      scopedEventBus.cleanup();

      expect(mainEventBus.listenerCount('preprint.indexed')).toBe(0);
      expect(scopedEventBus.getHandlerCount()).toBe(0);
    });
  });

  describe('emit', () => {
    it('should emit events through main event bus', async () => {
      const handler = vi.fn();
      mainEventBus.on('preprint.indexed', handler);

      scopedEventBus.emit('preprint.indexed', { uri: 'test-uri' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith({ uri: 'test-uri' });
    });

    it('should throw PluginPermissionError for non-permitted event emission', () => {
      const handler = vi.fn();
      mainEventBus.on('any.event', handler);

      // Emit should be restricted to declared hooks
      expect(() => {
        scopedEventBus.emit('any.event', { data: 'test' });
      }).toThrow(PluginPermissionError);
    });

    it('should allow emitting permitted events', async () => {
      const handler = vi.fn();
      mainEventBus.on('preprint.indexed', handler);

      scopedEventBus.emit('preprint.indexed', { data: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('off', () => {
    it('should unsubscribe handler from main event bus', () => {
      const handler = vi.fn();
      scopedEventBus.on('preprint.indexed', handler);

      expect(mainEventBus.listenerCount('preprint.indexed')).toBe(1);

      scopedEventBus.off('preprint.indexed', handler);

      expect(mainEventBus.listenerCount('preprint.indexed')).toBe(0);
    });

    it('should remove from tracked subscriptions', () => {
      const handler = vi.fn();
      scopedEventBus.on('preprint.indexed', handler);
      expect(scopedEventBus.getHandlerCount()).toBe(1);

      scopedEventBus.off('preprint.indexed', handler);
      expect(scopedEventBus.getHandlerCount()).toBe(0);

      // Cleanup should not attempt to remove already removed handler
      expect(() => scopedEventBus.cleanup()).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove all subscriptions for this plugin', () => {
      scopedEventBus.on('preprint.indexed', vi.fn());
      scopedEventBus.on('preprint.updated', vi.fn());
      scopedEventBus.on('system.startup', vi.fn());

      scopedEventBus.cleanup();

      expect(mainEventBus.listenerCount('preprint.indexed')).toBe(0);
      expect(mainEventBus.listenerCount('preprint.updated')).toBe(0);
      expect(mainEventBus.listenerCount('system.startup')).toBe(0);
    });

    it('should be idempotent', () => {
      scopedEventBus.on('preprint.indexed', vi.fn());

      scopedEventBus.cleanup();
      scopedEventBus.cleanup();

      expect(mainEventBus.listenerCount('preprint.indexed')).toBe(0);
    });
  });

  describe('getHandlerCount', () => {
    it('should return count of registered handlers', () => {
      expect(scopedEventBus.getHandlerCount()).toBe(0);

      scopedEventBus.on('preprint.indexed', vi.fn());
      expect(scopedEventBus.getHandlerCount()).toBe(1);

      scopedEventBus.on('preprint.updated', vi.fn());
      expect(scopedEventBus.getHandlerCount()).toBe(2);
    });
  });

  describe('getAllowedHooks', () => {
    it('should return allowed hooks', () => {
      const hooks = scopedEventBus.getAllowedHooks();

      expect(hooks).toContain('preprint.indexed');
      expect(hooks).toContain('preprint.updated');
      expect(hooks).toContain('system.*');
    });
  });

  describe('isHookAllowed', () => {
    it('should return true for exact matches', () => {
      expect(scopedEventBus.isHookAllowed('preprint.indexed')).toBe(true);
    });

    it('should return true for wildcard matches', () => {
      expect(scopedEventBus.isHookAllowed('system.startup')).toBe(true);
      expect(scopedEventBus.isHookAllowed('system.shutdown')).toBe(true);
    });

    it('should return false for non-allowed hooks', () => {
      expect(scopedEventBus.isHookAllowed('review.created')).toBe(false);
    });
  });

  describe('hook permission matching', () => {
    it('should match exact hook name', () => {
      const handler = vi.fn();

      expect(() => {
        scopedEventBus.on('preprint.indexed', handler);
      }).not.toThrow();
    });

    it('should match wildcard patterns', () => {
      const handler = vi.fn();

      expect(() => {
        scopedEventBus.on('system.startup', handler);
        scopedEventBus.on('system.shutdown', handler);
      }).not.toThrow();
    });

    it('should reject hooks not in permissions', () => {
      const handler = vi.fn();

      expect(() => {
        scopedEventBus.on('review.created', handler);
      }).toThrow(PluginPermissionError);

      expect(() => {
        scopedEventBus.on('plugin.loaded', handler);
      }).toThrow(PluginPermissionError);
    });
  });

  describe('multiple plugins', () => {
    it('should isolate subscriptions between plugins', () => {
      const manifest2 = createTestManifest(['review.*']);
      const scopedBus2 = new ScopedPluginEventBus(mainEventBus, manifest2);

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      scopedEventBus.on('preprint.indexed', handler1);
      scopedBus2.on('review.created', handler2);

      expect(mainEventBus.listenerCount('preprint.indexed')).toBe(1);
      expect(mainEventBus.listenerCount('review.created')).toBe(1);

      scopedEventBus.cleanup();

      expect(mainEventBus.listenerCount('preprint.indexed')).toBe(0);
      expect(mainEventBus.listenerCount('review.created')).toBe(1);

      scopedBus2.cleanup();
    });
  });
});
