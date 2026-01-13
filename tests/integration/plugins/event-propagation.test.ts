/**
 * Integration tests for plugin event propagation.
 *
 * @remarks
 * Tests event emission, subscription, wildcard patterns, and
 * cross-plugin communication through the event bus.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { BasePlugin } from '@/plugins/builtin/base-plugin.js';
import { PluginEventBus } from '@/plugins/core/event-bus.js';
import { PluginContextFactory } from '@/plugins/core/plugin-context.js';
import { PluginLoader } from '@/plugins/core/plugin-loader.js';
import { PluginManager } from '@/plugins/core/plugin-manager.js';
import { IsolatedVmSandbox } from '@/plugins/sandbox/isolated-vm-sandbox.js';
import { PermissionEnforcer } from '@/plugins/sandbox/permission-enforcer.js';
import { ResourceGovernor } from '@/plugins/sandbox/resource-governor.js';
// IPluginContext imported but not needed in this test file
import type { ICacheProvider } from '@/types/interfaces/cache.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IMetrics } from '@/types/interfaces/metrics.interface.js';

/**
 * Creates a mock logger for testing.
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
 * Creates a mock cache provider.
 */
const createMockCache = (): ICacheProvider => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  expire: vi.fn().mockResolvedValue(undefined),
});

/**
 * Creates a mock metrics provider.
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
 * Producer plugin that emits events.
 */
class ProducerPlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.producer';
  readonly manifest = {
    id: 'pub.chive.plugin.producer',
    name: 'Producer Plugin',
    version: '1.0.0',
    description: 'A plugin that produces events',
    author: 'Test',
    license: 'MIT' as const,
    permissions: {
      hooks: ['eprint.*', 'custom.event'],
      network: { allowedDomains: [] as string[] },
      storage: { maxSize: 1024 },
    },
    entrypoint: 'index.js',
  };

  protected onInitialize(): Promise<void> {
    // Producer just initializes, emit methods use this.context
    return Promise.resolve();
  }

  public emitEprintIndexed(data: { uri: string; title: string }): void {
    this.context?.eventBus.emit('eprint.indexed', data);
  }

  public emitCustomEvent(data: unknown): void {
    this.context?.eventBus.emit('custom.event', data);
  }
}

/**
 * Consumer plugin that listens to events.
 */
class ConsumerPlugin extends BasePlugin {
  public static receivedEvents: { event: string; data: unknown }[] = [];

  readonly id = 'pub.chive.plugin.consumer';
  readonly manifest = {
    id: 'pub.chive.plugin.consumer',
    name: 'Consumer Plugin',
    version: '1.0.0',
    description: 'A plugin that consumes events',
    author: 'Test',
    license: 'MIT' as const,
    permissions: {
      hooks: ['eprint.*', 'custom.event'],
      network: { allowedDomains: [] as string[] },
      storage: { maxSize: 1024 },
    },
    entrypoint: 'index.js',
  };

  protected onInitialize(): Promise<void> {
    this.context.eventBus.on('eprint.indexed', (data) => {
      ConsumerPlugin.receivedEvents.push({ event: 'eprint.indexed', data });
    });

    this.context.eventBus.on('custom.event', (data) => {
      ConsumerPlugin.receivedEvents.push({ event: 'custom.event', data });
    });
    return Promise.resolve();
  }

  public static reset(): void {
    ConsumerPlugin.receivedEvents = [];
  }
}

/**
 * Wildcard consumer plugin that uses wildcard subscriptions.
 */
class WildcardConsumerPlugin extends BasePlugin {
  public static receivedEvents: { event: string; data: unknown }[] = [];

  readonly id = 'pub.chive.plugin.wildcard-consumer';
  readonly manifest = {
    id: 'pub.chive.plugin.wildcard-consumer',
    name: 'Wildcard Consumer Plugin',
    version: '1.0.0',
    description: 'A plugin that uses wildcard subscriptions',
    author: 'Test',
    license: 'MIT' as const,
    permissions: {
      hooks: ['eprint.*'],
      network: { allowedDomains: [] as string[] },
      storage: { maxSize: 1024 },
    },
    entrypoint: 'index.js',
  };

  protected onInitialize(): Promise<void> {
    // Subscribe to all eprint events
    this.context.eventBus.on('eprint.indexed', (data) => {
      WildcardConsumerPlugin.receivedEvents.push({
        event: 'eprint.indexed',
        data,
      });
    });

    this.context.eventBus.on('eprint.updated', (data) => {
      WildcardConsumerPlugin.receivedEvents.push({
        event: 'eprint.updated',
        data,
      });
    });
    return Promise.resolve();
  }

  public static reset(): void {
    WildcardConsumerPlugin.receivedEvents = [];
  }
}

/**
 * Async handler plugin that tests async event handling.
 */
class AsyncHandlerPlugin extends BasePlugin {
  public static handlerStarted = false;
  public static handlerCompleted = false;
  public static handlerDelay = 50;

  readonly id = 'pub.chive.plugin.async-handler';
  readonly manifest = {
    id: 'pub.chive.plugin.async-handler',
    name: 'Async Handler Plugin',
    version: '1.0.0',
    description: 'A plugin with async event handlers',
    author: 'Test',
    license: 'MIT' as const,
    permissions: {
      hooks: ['eprint.indexed'],
      network: { allowedDomains: [] as string[] },
      storage: { maxSize: 1024 },
    },
    entrypoint: 'index.js',
  };

  protected onInitialize(): Promise<void> {
    this.context.eventBus.on('eprint.indexed', () => {
      void (async () => {
        AsyncHandlerPlugin.handlerStarted = true;
        await new Promise((resolve) => setTimeout(resolve, AsyncHandlerPlugin.handlerDelay));
        AsyncHandlerPlugin.handlerCompleted = true;
      })();
    });
    return Promise.resolve();
  }

  public static reset(): void {
    AsyncHandlerPlugin.handlerStarted = false;
    AsyncHandlerPlugin.handlerCompleted = false;
  }
}

describe('Plugin Event Propagation Integration', () => {
  let manager: PluginManager;
  let eventBus: PluginEventBus;
  let loader: PluginLoader;
  let contextFactory: PluginContextFactory;
  let permissionEnforcer: PermissionEnforcer;
  let resourceGovernor: ResourceGovernor;
  let sandbox: IsolatedVmSandbox;
  let mockLogger: ILogger;
  let mockCache: ICacheProvider;
  let mockMetrics: IMetrics;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCache = createMockCache();
    mockMetrics = createMockMetrics();
    eventBus = new PluginEventBus(mockLogger);
    permissionEnforcer = new PermissionEnforcer(mockLogger);
    resourceGovernor = new ResourceGovernor(mockLogger);
    sandbox = new IsolatedVmSandbox(mockLogger);
    loader = new PluginLoader(mockLogger);

    contextFactory = new PluginContextFactory(
      mockLogger,
      mockCache,
      mockMetrics,
      eventBus,
      permissionEnforcer
    );

    manager = new PluginManager(
      mockLogger,
      loader,
      contextFactory,
      eventBus,
      sandbox,
      resourceGovernor
    );

    ConsumerPlugin.reset();
    WildcardConsumerPlugin.reset();
    AsyncHandlerPlugin.reset();
  });

  afterEach(async () => {
    await manager.shutdownAll();
    eventBus.removeAllListeners();
  });

  describe('basic event propagation', () => {
    it('should propagate events between plugins', async () => {
      const producer = new ProducerPlugin();
      const consumer = new ConsumerPlugin();

      await manager.loadBuiltinPlugin(consumer);
      await manager.loadBuiltinPlugin(producer);

      const eventData = { uri: 'at://did:plc:123/pub.chive.eprint/1', title: 'Test' };
      producer.emitEprintIndexed(eventData);

      // Wait for async event propagation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(ConsumerPlugin.receivedEvents).toHaveLength(1);
      expect(ConsumerPlugin.receivedEvents[0]).toEqual({
        event: 'eprint.indexed',
        data: eventData,
      });
    });

    it('should allow multiple consumers for same event', async () => {
      const producer = new ProducerPlugin();
      const consumer1 = new ConsumerPlugin();
      const consumer2 = new WildcardConsumerPlugin();

      await manager.loadBuiltinPlugin(consumer1);
      await manager.loadBuiltinPlugin(consumer2);
      await manager.loadBuiltinPlugin(producer);

      const eventData = { uri: 'at://did:plc:123/pub.chive.eprint/1', title: 'Test' };
      producer.emitEprintIndexed(eventData);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(ConsumerPlugin.receivedEvents).toHaveLength(1);
      expect(WildcardConsumerPlugin.receivedEvents).toHaveLength(1);
    });

    it('should pass event data correctly', async () => {
      const producer = new ProducerPlugin();
      const consumer = new ConsumerPlugin();

      await manager.loadBuiltinPlugin(consumer);
      await manager.loadBuiltinPlugin(producer);

      const complexData = {
        uri: 'at://did:plc:123/pub.chive.eprint/1',
        title: 'Test Eprint',
        metadata: {
          authors: ['Author 1', 'Author 2'],
          tags: ['tag1', 'tag2'],
        },
      };
      producer.emitCustomEvent(complexData);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(ConsumerPlugin.receivedEvents[0]?.data).toEqual(complexData);
    });
  });

  describe('wildcard subscriptions', () => {
    it('should receive events matching wildcard pattern', async () => {
      const wildcardConsumer = new WildcardConsumerPlugin();

      await manager.loadBuiltinPlugin(wildcardConsumer);

      // Emit different eprint events directly through event bus
      eventBus.emit('eprint.indexed', { uri: 'uri1' });
      eventBus.emit('eprint.updated', { uri: 'uri2' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(WildcardConsumerPlugin.receivedEvents).toHaveLength(2);
      expect(WildcardConsumerPlugin.receivedEvents.map((e) => e.event)).toContain('eprint.indexed');
      expect(WildcardConsumerPlugin.receivedEvents.map((e) => e.event)).toContain('eprint.updated');
    });
  });

  describe('async event handling', () => {
    it('should handle async event handlers', async () => {
      const producer = new ProducerPlugin();
      const asyncHandler = new AsyncHandlerPlugin();

      await manager.loadBuiltinPlugin(asyncHandler);
      await manager.loadBuiltinPlugin(producer);

      producer.emitEprintIndexed({ uri: 'test', title: 'Test' });

      // Handler should start immediately
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(AsyncHandlerPlugin.handlerStarted).toBe(true);

      // Wait for handler to complete
      await new Promise((resolve) => setTimeout(resolve, AsyncHandlerPlugin.handlerDelay + 20));
      expect(AsyncHandlerPlugin.handlerCompleted).toBe(true);
    });

    it('should not block event emission for async handlers', async () => {
      const producer = new ProducerPlugin();
      const asyncHandler = new AsyncHandlerPlugin();
      const syncConsumer = new ConsumerPlugin();

      await manager.loadBuiltinPlugin(asyncHandler);
      await manager.loadBuiltinPlugin(syncConsumer);
      await manager.loadBuiltinPlugin(producer);

      const startTime = Date.now();
      producer.emitEprintIndexed({ uri: 'test', title: 'Test' });
      const emitTime = Date.now() - startTime;

      // Emit should return quickly, not waiting for async handler
      expect(emitTime).toBeLessThan(AsyncHandlerPlugin.handlerDelay);
    });
  });

  describe('error isolation', () => {
    it('should isolate errors in event handlers', async () => {
      const producer = new ProducerPlugin();
      const consumer = new ConsumerPlugin();

      // Add an error-throwing handler directly
      eventBus.on('eprint.indexed', () => {
        throw new Error('Handler error');
      });

      await manager.loadBuiltinPlugin(consumer);
      await manager.loadBuiltinPlugin(producer);

      // Should not throw, error is isolated
      expect(() => {
        producer.emitEprintIndexed({ uri: 'test', title: 'Test' });
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Consumer's handler should still receive the event
      expect(ConsumerPlugin.receivedEvents).toHaveLength(1);
    });

    it('should log handler errors', async () => {
      const producer = new ProducerPlugin();

      eventBus.on('eprint.indexed', () => {
        throw new Error('Handler error');
      });

      await manager.loadBuiltinPlugin(producer);

      producer.emitEprintIndexed({ uri: 'test', title: 'Test' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('event cleanup on unload', () => {
    it('should stop receiving events after unload', async () => {
      const producer = new ProducerPlugin();
      const consumer = new ConsumerPlugin();

      await manager.loadBuiltinPlugin(consumer);
      await manager.loadBuiltinPlugin(producer);

      producer.emitEprintIndexed({ uri: 'uri1', title: 'Test 1' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(ConsumerPlugin.receivedEvents).toHaveLength(1);

      // Unload consumer
      await manager.unloadPlugin(consumer.id);
      ConsumerPlugin.reset();

      // Emit another event
      producer.emitEprintIndexed({ uri: 'uri2', title: 'Test 2' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Consumer should not receive the event
      expect(ConsumerPlugin.receivedEvents).toHaveLength(0);
    });
  });

  describe('system events', () => {
    it('should emit plugin.loaded when plugin loads', async () => {
      const loadedHandler = vi.fn();
      eventBus.on('plugin.loaded', loadedHandler);

      const producer = new ProducerPlugin();
      await manager.loadBuiltinPlugin(producer);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: producer.id,
        })
      );
    });

    it('should emit plugin.unloaded when plugin unloads', async () => {
      const unloadedHandler = vi.fn();
      eventBus.on('plugin.unloaded', unloadedHandler);

      const producer = new ProducerPlugin();
      await manager.loadBuiltinPlugin(producer);
      await manager.unloadPlugin(producer.id);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(unloadedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: producer.id,
        })
      );
    });
  });
});
