/**
 * Unit tests for PluginContextFactory.
 *
 * @remarks
 * Tests context creation, scoped logger/cache/metrics, and cleanup.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PluginEventBus } from '@/plugins/core/event-bus.js';
import { PluginContextFactory } from '@/plugins/core/plugin-context.js';
import { PermissionEnforcer } from '@/plugins/sandbox/permission-enforcer.js';
import type { ICacheProvider } from '@/types/interfaces/cache.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IMetrics } from '@/types/interfaces/metrics.interface.js';
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
 * Creates a mock cache provider for testing.
 *
 * @returns Mock cache provider
 */
const createMockCache = (): ICacheProvider => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  expire: vi.fn().mockResolvedValue(undefined),
});

/**
 * Creates a mock metrics provider for testing.
 *
 * @returns Mock metrics provider
 */
const createMockMetrics = (): IMetrics => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  startTimer: vi.fn().mockReturnValue(() => {
    // Timer end function (no-op for mock)
  }),
});

/**
 * Creates a test plugin manifest.
 *
 * @param id - Plugin ID override
 * @returns Plugin manifest
 */
const createTestManifest = (id = 'pub.chive.plugin.test'): IPluginManifest => ({
  id,
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin for unit testing',
  author: 'Chive Team',
  license: 'MIT',
  permissions: {
    hooks: ['preprint.indexed', 'preprint.updated'],
    network: { allowedDomains: ['api.example.com'] },
    storage: { maxSize: 1024 * 1024 },
  },
  entrypoint: 'dist/index.js',
});

describe('PluginContextFactory', () => {
  let factory: PluginContextFactory;
  let mockLogger: ILogger;
  let mockCache: ICacheProvider;
  let mockMetrics: IMetrics;
  let eventBus: PluginEventBus;
  let permissionEnforcer: PermissionEnforcer;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCache = createMockCache();
    mockMetrics = createMockMetrics();
    eventBus = new PluginEventBus(mockLogger);
    permissionEnforcer = new PermissionEnforcer(mockLogger);

    factory = new PluginContextFactory(
      mockLogger,
      mockCache,
      mockMetrics,
      eventBus,
      permissionEnforcer
    );
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('createContext', () => {
    it('should create context with all dependencies', () => {
      const manifest = createTestManifest();
      const config = { apiKey: 'test-key' };

      const context = factory.createContext(manifest, config);

      expect(context).toHaveProperty('logger');
      expect(context).toHaveProperty('cache');
      expect(context).toHaveProperty('metrics');
      expect(context).toHaveProperty('eventBus');
      expect(context).toHaveProperty('config');
    });

    it('should pass through config', () => {
      const manifest = createTestManifest();
      const config = { apiKey: 'test-key', enabled: true };

      const context = factory.createContext(manifest, config);

      expect(context.config).toEqual(config);
    });

    it('should create scoped logger with plugin context', () => {
      const manifest = createTestManifest();

      factory.createContext(manifest, {});

      expect(mockLogger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: manifest.id,
          pluginVersion: manifest.version,
          component: 'Plugin',
        })
      );
    });
  });

  describe('scoped cache', () => {
    it('should prefix cache keys with plugin ID', async () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});

      await context.cache.get('myKey');

      expect(mockCache.get).toHaveBeenCalledWith('plugin:pub.chive.plugin.test:myKey');
    });

    it('should prefix keys on set', async () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});

      await context.cache.set('myKey', 'value', 3600);

      expect(mockCache.set).toHaveBeenCalledWith(
        'plugin:pub.chive.plugin.test:myKey',
        'value',
        3600
      );
    });

    it('should prefix keys on delete', async () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});

      await context.cache.delete('myKey');

      expect(mockCache.delete).toHaveBeenCalledWith('plugin:pub.chive.plugin.test:myKey');
    });

    it('should prefix keys on exists', async () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});

      await context.cache.exists('myKey');

      expect(mockCache.exists).toHaveBeenCalledWith('plugin:pub.chive.plugin.test:myKey');
    });

    it('should prefix keys on expire', async () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});

      await context.cache.expire('myKey', 3600);

      expect(mockCache.expire).toHaveBeenCalledWith('plugin:pub.chive.plugin.test:myKey', 3600);
    });
  });

  describe('scoped metrics', () => {
    it('should prefix counter names and add plugin_id label', () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});

      context.metrics.incrementCounter('requests', { status: '200' });

      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'plugin_requests',
        expect.objectContaining({
          plugin_id: manifest.id,
          status: '200',
        }),
        undefined
      );
    });

    it('should prefix gauge names', () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});

      context.metrics.setGauge('active_connections', 5);

      expect(mockMetrics.setGauge).toHaveBeenCalledWith(
        'plugin_active_connections',
        5,
        expect.objectContaining({
          plugin_id: manifest.id,
        })
      );
    });

    it('should prefix histogram names', () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});

      context.metrics.observeHistogram('request_duration', 0.5);

      expect(mockMetrics.observeHistogram).toHaveBeenCalledWith(
        'plugin_request_duration',
        0.5,
        expect.objectContaining({
          plugin_id: manifest.id,
        })
      );
    });

    it('should prefix timer names', () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});

      context.metrics.startTimer('operation_time');

      expect(mockMetrics.startTimer).toHaveBeenCalledWith(
        'plugin_operation_time',
        expect.objectContaining({
          plugin_id: manifest.id,
        })
      );
    });
  });

  describe('scoped event bus', () => {
    it('should allow subscribing to permitted hooks', () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});
      const handler = vi.fn();

      expect(() => {
        context.eventBus.on('preprint.indexed', handler);
      }).not.toThrow();
    });

    it('should throw for non-permitted hooks', () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});
      const handler = vi.fn();

      expect(() => {
        context.eventBus.on('system.shutdown', handler);
      }).toThrow('lacks required permission');
    });
  });

  describe('cleanup', () => {
    it('should cleanup scoped event bus', () => {
      const manifest = createTestManifest();
      const context = factory.createContext(manifest, {});
      const handler = vi.fn();

      context.eventBus.on('preprint.indexed', handler);
      expect(eventBus.listenerCount('preprint.indexed')).toBe(1);

      factory.cleanup(manifest.id);

      expect(eventBus.listenerCount('preprint.indexed')).toBe(0);
    });

    it('should be idempotent', () => {
      const manifest = createTestManifest();
      factory.createContext(manifest, {});

      expect(() => {
        factory.cleanup(manifest.id);
        factory.cleanup(manifest.id);
      }).not.toThrow();
    });

    it('should handle cleanup of non-existent plugin', () => {
      expect(() => {
        factory.cleanup('non-existent-plugin');
      }).not.toThrow();
    });
  });

  describe('getScopedEventBus', () => {
    it('should return scoped event bus for plugin', () => {
      const manifest = createTestManifest();
      factory.createContext(manifest, {});

      const scopedBus = factory.getScopedEventBus(manifest.id);

      expect(scopedBus).toBeDefined();
    });

    it('should return undefined for unknown plugin', () => {
      const scopedBus = factory.getScopedEventBus('non-existent');

      expect(scopedBus).toBeUndefined();
    });
  });

  describe('multiple plugins', () => {
    it('should create isolated contexts for different plugins', () => {
      const manifest1 = createTestManifest('pub.chive.plugin.one');
      const manifest2 = createTestManifest('pub.chive.plugin.two');

      const context1 = factory.createContext(manifest1, { plugin: 1 });
      const context2 = factory.createContext(manifest2, { plugin: 2 });

      expect(context1.config).toEqual({ plugin: 1 });
      expect(context2.config).toEqual({ plugin: 2 });
    });

    it('should cleanup only specified plugin', () => {
      const manifest1 = createTestManifest('pub.chive.plugin.one');
      const manifest2 = createTestManifest('pub.chive.plugin.two');

      factory.createContext(manifest1, {});
      factory.createContext(manifest2, {});

      factory.cleanup(manifest1.id);

      expect(factory.getScopedEventBus(manifest1.id)).toBeUndefined();
      expect(factory.getScopedEventBus(manifest2.id)).toBeDefined();
    });
  });
});
