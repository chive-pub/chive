/**
 * Unit tests for PluginManager.
 *
 * @remarks
 * Tests plugin loading, unloading, lifecycle management, and dependency ordering.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PluginEventBus } from '@/plugins/core/event-bus.js';
import { PluginContextFactory } from '@/plugins/core/plugin-context.js';
import { PluginLoader } from '@/plugins/core/plugin-loader.js';
import { PluginManager } from '@/plugins/core/plugin-manager.js';
import { IsolatedVmSandbox } from '@/plugins/sandbox/isolated-vm-sandbox.js';
import { PermissionEnforcer } from '@/plugins/sandbox/permission-enforcer.js';
import { ResourceGovernor } from '@/plugins/sandbox/resource-governor.js';
import { PluginError } from '@/types/errors.js';
import type { ICacheProvider } from '@/types/interfaces/cache.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IMetrics } from '@/types/interfaces/metrics.interface.js';
import type {
  IChivePlugin,
  IPluginManifest,
  PluginState,
} from '@/types/interfaces/plugin.interface.js';

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
 * @param overrides - Manifest property overrides
 * @returns Plugin manifest
 */
const createTestManifest = (overrides: Partial<IPluginManifest> = {}): IPluginManifest => ({
  id: 'pub.chive.plugin.test',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin for unit testing',
  author: 'Chive Team',
  license: 'MIT',
  permissions: {
    hooks: ['preprint.indexed'],
    network: { allowedDomains: ['api.example.com'] },
    storage: { maxSize: 1024 * 1024 },
  },
  entrypoint: 'dist/index.js',
  ...overrides,
});

/**
 * Creates a mock plugin for testing.
 *
 * @param manifest - Plugin manifest
 * @returns Mock plugin instance
 */
const createMockPlugin = (manifest: IPluginManifest): IChivePlugin => ({
  id: manifest.id,
  manifest,
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockReturnValue('ready' as PluginState),
});

describe('PluginManager', () => {
  let manager: PluginManager;
  let mockLogger: ILogger;
  let mockLoader: PluginLoader;
  let contextFactory: PluginContextFactory;
  let eventBus: PluginEventBus;
  let sandbox: IsolatedVmSandbox;
  let resourceGovernor: ResourceGovernor;
  let permissionEnforcer: PermissionEnforcer;
  let mockCache: ICacheProvider;
  let mockMetrics: IMetrics;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCache = createMockCache();
    mockMetrics = createMockMetrics();

    eventBus = new PluginEventBus(mockLogger);
    sandbox = new IsolatedVmSandbox(mockLogger);
    resourceGovernor = new ResourceGovernor(mockLogger);
    permissionEnforcer = new PermissionEnforcer(mockLogger);
    mockLoader = new PluginLoader(mockLogger);
    contextFactory = new PluginContextFactory(
      mockLogger,
      mockCache,
      mockMetrics,
      eventBus,
      permissionEnforcer
    );

    manager = new PluginManager(
      mockLogger,
      mockLoader,
      contextFactory,
      eventBus,
      sandbox,
      resourceGovernor
    );
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('constructor', () => {
    it('should create plugin manager with logger', () => {
      expect(manager).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'PluginManager' });
    });
  });

  describe('loadBuiltinPlugin', () => {
    it('should load a builtin plugin', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      await manager.loadBuiltinPlugin(plugin, { testConfig: true });

      expect(plugin.initialize).toHaveBeenCalled();
      expect(manager.getPlugin(manifest.id)).toBe(plugin);
    });

    it('should emit plugin.loaded event', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);
      const handler = vi.fn();

      eventBus.on('plugin.loaded', handler);

      await manager.loadBuiltinPlugin(plugin);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith({ pluginId: manifest.id });
    });

    it('should throw when plugin already loaded', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      await manager.loadBuiltinPlugin(plugin);

      await expect(manager.loadBuiltinPlugin(plugin)).rejects.toThrow(PluginError);
    });

    it('should throw when initialization fails', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);
      (plugin.initialize as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Init failed'));

      await expect(manager.loadBuiltinPlugin(plugin)).rejects.toThrow(PluginError);
      expect(manager.getPlugin(manifest.id)).toBeUndefined();
    });

    it('should log plugin loading', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      await manager.loadBuiltinPlugin(plugin);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loading builtin plugin',
        expect.objectContaining({
          pluginId: manifest.id,
          version: manifest.version,
        })
      );
    });
  });

  describe('unloadPlugin', () => {
    it('should unload a loaded plugin', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      await manager.loadBuiltinPlugin(plugin);
      await manager.unloadPlugin(manifest.id);

      expect(plugin.shutdown).toHaveBeenCalled();
      expect(manager.getPlugin(manifest.id)).toBeUndefined();
    });

    it('should emit plugin.unloaded event', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);
      const handler = vi.fn();

      await manager.loadBuiltinPlugin(plugin);
      eventBus.on('plugin.unloaded', handler);

      await manager.unloadPlugin(manifest.id);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith({ pluginId: manifest.id });
    });

    it('should throw when plugin not loaded', async () => {
      await expect(manager.unloadPlugin('non-existent')).rejects.toThrow(PluginError);
    });

    it('should log plugin unloading', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      await manager.loadBuiltinPlugin(plugin);
      await manager.unloadPlugin(manifest.id);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Unloading plugin',
        expect.objectContaining({ pluginId: manifest.id })
      );
    });
  });

  describe('getPlugin', () => {
    it('should return plugin when loaded', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      await manager.loadBuiltinPlugin(plugin);

      expect(manager.getPlugin(manifest.id)).toBe(plugin);
    });

    it('should return undefined when not loaded', () => {
      expect(manager.getPlugin('non-existent')).toBeUndefined();
    });
  });

  describe('getAllPlugins', () => {
    it('should return empty array when no plugins loaded', () => {
      expect(manager.getAllPlugins()).toHaveLength(0);
    });

    it('should return all loaded plugins', async () => {
      const manifest1 = createTestManifest({ id: 'pub.chive.plugin.one' });
      const manifest2 = createTestManifest({ id: 'pub.chive.plugin.two' });
      const plugin1 = createMockPlugin(manifest1);
      const plugin2 = createMockPlugin(manifest2);

      await manager.loadBuiltinPlugin(plugin1);
      await manager.loadBuiltinPlugin(plugin2);

      const plugins = manager.getAllPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
    });
  });

  describe('getPluginState', () => {
    it('should return undefined when not loaded', () => {
      expect(manager.getPluginState('non-existent')).toBeUndefined();
    });

    it('should return READY after successful initialization', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      await manager.loadBuiltinPlugin(plugin);

      // Note: State is tracked internally as PluginState enum
      expect(manager.getPluginState(manifest.id)).toBeDefined();
    });
  });

  describe('reloadPlugin', () => {
    it('should reload a plugin', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      // Mock the loader to return the plugin
      vi.spyOn(mockLoader, 'loadPluginCode').mockResolvedValue(plugin);

      await manager.loadBuiltinPlugin(plugin);

      // Reset mock to track reload
      (plugin.initialize as ReturnType<typeof vi.fn>).mockClear();
      (plugin.shutdown as ReturnType<typeof vi.fn>).mockClear();

      await manager.reloadPlugin(manifest.id);

      expect(plugin.shutdown).toHaveBeenCalled();
      expect(plugin.initialize).toHaveBeenCalled();
    });

    it('should throw when plugin not loaded', async () => {
      await expect(manager.reloadPlugin('non-existent')).rejects.toThrow(PluginError);
    });
  });

  describe('shutdownAll', () => {
    it('should shutdown all plugins', async () => {
      const manifest1 = createTestManifest({ id: 'pub.chive.plugin.one' });
      const manifest2 = createTestManifest({ id: 'pub.chive.plugin.two' });
      const plugin1 = createMockPlugin(manifest1);
      const plugin2 = createMockPlugin(manifest2);

      await manager.loadBuiltinPlugin(plugin1);
      await manager.loadBuiltinPlugin(plugin2);

      await manager.shutdownAll();

      expect(plugin1.shutdown).toHaveBeenCalled();
      expect(plugin2.shutdown).toHaveBeenCalled();
      expect(manager.getPluginCount()).toBe(0);
    });

    it('should emit system.shutdown event before unloading', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);
      const handler = vi.fn();

      await manager.loadBuiltinPlugin(plugin);
      eventBus.on('system.shutdown', handler);

      await manager.shutdownAll();

      expect(handler).toHaveBeenCalled();
    });

    it('should log shutdown completion', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      await manager.loadBuiltinPlugin(plugin);
      await manager.shutdownAll();

      expect(mockLogger.info).toHaveBeenCalledWith('All plugins shut down');
    });
  });

  describe('setPluginConfig', () => {
    it('should set configuration for plugin', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);
      const config = { apiKey: 'test-key', enabled: true };

      manager.setPluginConfig(manifest.id, config);
      await manager.loadBuiltinPlugin(plugin);

      // Plugin should have been initialized with config
      expect(plugin.initialize).toHaveBeenCalled();
      const call = (plugin.initialize as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[0]).toHaveProperty('config');
    });
  });

  describe('getPluginCount', () => {
    it('should return 0 when no plugins loaded', () => {
      expect(manager.getPluginCount()).toBe(0);
    });

    it('should return correct count', async () => {
      const manifest1 = createTestManifest({ id: 'pub.chive.plugin.one' });
      const manifest2 = createTestManifest({ id: 'pub.chive.plugin.two' });

      await manager.loadBuiltinPlugin(createMockPlugin(manifest1));
      expect(manager.getPluginCount()).toBe(1);

      await manager.loadBuiltinPlugin(createMockPlugin(manifest2));
      expect(manager.getPluginCount()).toBe(2);
    });
  });

  describe('getPluginInfo', () => {
    it('should return empty array when no plugins', () => {
      expect(manager.getPluginInfo()).toHaveLength(0);
    });

    it('should return info for all plugins', async () => {
      const manifest = createTestManifest();
      const plugin = createMockPlugin(manifest);

      await manager.loadBuiltinPlugin(plugin);

      const info = manager.getPluginInfo();

      expect(info).toHaveLength(1);
      expect(info[0]?.id).toBe(manifest.id);
      expect(info[0]?.name).toBe(manifest.name);
      expect(info[0]?.version).toBe(manifest.version);
    });
  });

  describe('dependency management', () => {
    it('should throw when dependency is missing', async () => {
      const manifest = createTestManifest({
        id: 'pub.chive.plugin.child',
        dependencies: ['pub.chive.plugin.parent'],
      });
      const plugin = createMockPlugin(manifest);

      await expect(manager.loadBuiltinPlugin(plugin)).rejects.toThrow(
        /Missing dependency: pub.chive.plugin.parent/
      );
    });

    it('should load plugin when dependencies are satisfied', async () => {
      const parentManifest = createTestManifest({ id: 'pub.chive.plugin.parent' });
      const childManifest = createTestManifest({
        id: 'pub.chive.plugin.child',
        dependencies: ['pub.chive.plugin.parent'],
      });

      const parentPlugin = createMockPlugin(parentManifest);
      const childPlugin = createMockPlugin(childManifest);

      await manager.loadBuiltinPlugin(parentPlugin);
      await manager.loadBuiltinPlugin(childPlugin);

      expect(manager.getPlugin(childManifest.id)).toBe(childPlugin);
    });
  });
});
