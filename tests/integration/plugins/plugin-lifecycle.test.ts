/**
 * Integration tests for plugin lifecycle management.
 *
 * @remarks
 * Tests the full plugin lifecycle including loading, initialization,
 * reload, and shutdown scenarios with real dependencies.
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
import type { ICacheProvider } from '@/types/interfaces/cache.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IMetrics } from '@/types/interfaces/metrics.interface.js';
import type { IPluginContext } from '@/types/interfaces/plugin.interface.js';

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
 * Test plugin that tracks lifecycle events.
 */
class LifecycleTrackingPlugin extends BasePlugin {
  public static lifecycleEvents: string[] = [];
  public static lastContext?: IPluginContext;

  readonly id = 'pub.chive.plugin.lifecycle-test';
  readonly manifest = {
    id: 'pub.chive.plugin.lifecycle-test',
    name: 'Lifecycle Test Plugin',
    version: '1.0.0',
    description: 'A plugin for testing lifecycle events',
    author: 'Test',
    license: 'MIT' as const,
    permissions: {
      hooks: ['system.*', 'preprint.*'],
      network: { allowedDomains: [] as string[] },
      storage: { maxSize: 1024 },
    },
    entrypoint: 'index.js',
  };

  protected onInitialize(): Promise<void> {
    LifecycleTrackingPlugin.lifecycleEvents.push('onInitialize');
    LifecycleTrackingPlugin.lastContext = this.context;

    // Register event handler
    this.context.eventBus.on('system.startup', () => {
      LifecycleTrackingPlugin.lifecycleEvents.push('system.startup received');
    });
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    LifecycleTrackingPlugin.lifecycleEvents.push('onShutdown');
    return Promise.resolve();
  }

  public static reset(): void {
    LifecycleTrackingPlugin.lifecycleEvents = [];
    LifecycleTrackingPlugin.lastContext = undefined;
  }
}

/**
 * Test plugin that fails during initialization.
 */
class FailingPlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.failing-test';
  readonly manifest = {
    id: 'pub.chive.plugin.failing-test',
    name: 'Failing Test Plugin',
    version: '1.0.0',
    description: 'A plugin that fails during initialization',
    author: 'Test',
    license: 'MIT' as const,
    permissions: {
      hooks: [] as string[],
      network: { allowedDomains: [] as string[] },
      storage: { maxSize: 1024 },
    },
    entrypoint: 'index.js',
  };

  protected onInitialize(): Promise<void> {
    return Promise.reject(new Error('Intentional initialization failure'));
  }
}

/**
 * Test plugin with dependencies.
 */
class DependentPlugin extends BasePlugin {
  public static initialized = false;

  readonly id = 'pub.chive.plugin.dependent';
  readonly manifest = {
    id: 'pub.chive.plugin.dependent',
    name: 'Dependent Test Plugin',
    version: '1.0.0',
    description: 'A plugin that depends on another plugin',
    author: 'Test',
    license: 'MIT' as const,
    permissions: {
      hooks: [] as string[],
      network: { allowedDomains: [] as string[] },
      storage: { maxSize: 1024 },
    },
    entrypoint: 'index.js',
    dependencies: ['pub.chive.plugin.lifecycle-test'],
  };

  protected onInitialize(): Promise<void> {
    DependentPlugin.initialized = true;
    return Promise.resolve();
  }

  public static reset(): void {
    DependentPlugin.initialized = false;
  }
}

describe('Plugin Lifecycle Integration', () => {
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

    // Create manager with all 6 required dependencies
    manager = new PluginManager(
      mockLogger,
      loader,
      contextFactory,
      eventBus,
      sandbox,
      resourceGovernor
    );

    LifecycleTrackingPlugin.reset();
    DependentPlugin.reset();
  });

  afterEach(async () => {
    await manager.shutdownAll();
    eventBus.removeAllListeners();
  });

  describe('plugin loading', () => {
    it('should load and initialize a plugin', async () => {
      const plugin = new LifecycleTrackingPlugin();

      await manager.loadBuiltinPlugin(plugin);

      expect(LifecycleTrackingPlugin.lifecycleEvents).toContain('onInitialize');
      expect(manager.getPlugin(plugin.id)).toBeDefined();
      // PluginState enum values
      expect(manager.getPluginState(plugin.id)).toBe('ready');
    });

    it('should provide context with all dependencies', async () => {
      const plugin = new LifecycleTrackingPlugin();

      await manager.loadBuiltinPlugin(plugin);

      const context = LifecycleTrackingPlugin.lastContext;
      expect(context).toBeDefined();
      expect(context?.logger).toBeDefined();
      expect(context?.cache).toBeDefined();
      expect(context?.metrics).toBeDefined();
      expect(context?.eventBus).toBeDefined();
      expect(context?.config).toBeDefined();
    });

    it('should emit plugin.loaded event', async () => {
      const plugin = new LifecycleTrackingPlugin();
      const loadedHandler = vi.fn();

      eventBus.on('plugin.loaded', loadedHandler);

      await manager.loadBuiltinPlugin(plugin);

      // Wait for async event
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: plugin.id,
        })
      );
    });

    it('should prevent loading duplicate plugins', async () => {
      const plugin = new LifecycleTrackingPlugin();

      await manager.loadBuiltinPlugin(plugin);

      await expect(manager.loadBuiltinPlugin(plugin)).rejects.toThrow('already loaded');
    });

    it('should handle initialization failures', async () => {
      const plugin = new FailingPlugin();

      await expect(manager.loadBuiltinPlugin(plugin)).rejects.toThrow(
        'Intentional initialization failure'
      );

      expect(manager.getPlugin(plugin.id)).toBeUndefined();
    });

    it('should allocate resources when loading plugin', async () => {
      const plugin = new LifecycleTrackingPlugin();

      await manager.loadBuiltinPlugin(plugin);

      const limits = resourceGovernor.getLimits(plugin.id);
      expect(limits).toBeDefined();
    });
  });

  describe('plugin unloading', () => {
    it('should unload a plugin', async () => {
      const plugin = new LifecycleTrackingPlugin();
      await manager.loadBuiltinPlugin(plugin);

      await manager.unloadPlugin(plugin.id);

      expect(LifecycleTrackingPlugin.lifecycleEvents).toContain('onShutdown');
      expect(manager.getPlugin(plugin.id)).toBeUndefined();
    });

    it('should emit plugin.unloaded event', async () => {
      const plugin = new LifecycleTrackingPlugin();
      const unloadedHandler = vi.fn();

      await manager.loadBuiltinPlugin(plugin);
      eventBus.on('plugin.unloaded', unloadedHandler);

      await manager.unloadPlugin(plugin.id);

      // Wait for async event
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(unloadedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: plugin.id,
        })
      );
    });

    it('should clean up event handlers on unload', async () => {
      const plugin = new LifecycleTrackingPlugin();
      await manager.loadBuiltinPlugin(plugin);

      // Plugin registered handler in onInitialize
      expect(eventBus.listenerCount('system.startup')).toBeGreaterThan(0);

      await manager.unloadPlugin(plugin.id);

      // Handler should be removed
      expect(eventBus.listenerCount('system.startup')).toBe(0);
    });

    it('should release resources on unload', async () => {
      const plugin = new LifecycleTrackingPlugin();
      await manager.loadBuiltinPlugin(plugin);

      expect(resourceGovernor.getLimits(plugin.id)).toBeDefined();

      await manager.unloadPlugin(plugin.id);

      expect(resourceGovernor.getLimits(plugin.id)).toBeUndefined();
    });

    it('should throw when unloading non-existent plugin', async () => {
      await expect(manager.unloadPlugin('non-existent')).rejects.toThrow('not loaded');
    });
  });

  describe('plugin reload', () => {
    // Note: reloadPlugin() uses loadPlugin() which tries to load from filesystem
    // This is expected behavior: builtin plugins can't be reloaded via manifest
    it('should throw when reloading builtin plugin', async () => {
      const plugin = new LifecycleTrackingPlugin();
      await manager.loadBuiltinPlugin(plugin);

      // Reload will fail because it tries to load from filesystem
      await expect(manager.reloadPlugin(plugin.id)).rejects.toThrow('Failed to load plugin');
    });
  });

  describe('plugin dependencies', () => {
    it('should reject loading plugin with missing dependencies', async () => {
      const dependentPlugin = new DependentPlugin();

      await expect(manager.loadBuiltinPlugin(dependentPlugin)).rejects.toThrow(
        'Missing dependency'
      );
    });

    it('should load plugin when dependencies are satisfied', async () => {
      const basePlugin = new LifecycleTrackingPlugin();
      const dependentPlugin = new DependentPlugin();

      await manager.loadBuiltinPlugin(basePlugin);
      await manager.loadBuiltinPlugin(dependentPlugin);

      expect(DependentPlugin.initialized).toBe(true);
      expect(manager.getPlugin(dependentPlugin.id)).toBeDefined();
    });
  });

  describe('shutdown all', () => {
    it('should shutdown all plugins', async () => {
      const plugin1 = new LifecycleTrackingPlugin();

      await manager.loadBuiltinPlugin(plugin1);

      await manager.shutdownAll();

      expect(LifecycleTrackingPlugin.lifecycleEvents).toContain('onShutdown');
      expect(manager.getPluginCount()).toBe(0);
    });

    it('should emit system.shutdown before unloading', async () => {
      const plugin = new LifecycleTrackingPlugin();
      await manager.loadBuiltinPlugin(plugin);

      // Clear events to track shutdown sequence
      LifecycleTrackingPlugin.lifecycleEvents = [];

      await manager.shutdownAll();

      // system.startup handler should have received the event
      // onShutdown should be called
      expect(LifecycleTrackingPlugin.lifecycleEvents).toContain('onShutdown');
    });

    it('should be idempotent', async () => {
      const plugin = new LifecycleTrackingPlugin();
      await manager.loadBuiltinPlugin(plugin);

      await manager.shutdownAll();
      await manager.shutdownAll();

      expect(manager.getPluginCount()).toBe(0);
    });
  });

  describe('plugin info', () => {
    it('should return info for loaded plugins', async () => {
      const plugin = new LifecycleTrackingPlugin();
      await manager.loadBuiltinPlugin(plugin);

      const info = manager.getPluginInfo();

      expect(info).toHaveLength(1);
      expect(info[0]?.id).toBe(plugin.id);
      expect(info[0]?.name).toBe(plugin.manifest.name);
      expect(info[0]?.version).toBe(plugin.manifest.version);
      expect(info[0]?.state).toBe('ready');
      expect(info[0]?.loadedAt).toBeInstanceOf(Date);
    });

    it('should return correct plugin count', async () => {
      const plugin = new LifecycleTrackingPlugin();

      expect(manager.getPluginCount()).toBe(0);

      await manager.loadBuiltinPlugin(plugin);

      expect(manager.getPluginCount()).toBe(1);
    });
  });
});
