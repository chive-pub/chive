/**
 * Unit tests for BasePlugin.
 *
 * @remarks
 * Tests plugin lifecycle, configuration, and helper methods.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BasePlugin } from '@/plugins/builtin/base-plugin.js';
import type { ICacheProvider } from '@/types/interfaces/cache.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IMetrics } from '@/types/interfaces/metrics.interface.js';
import type {
  IPluginContext,
  IPluginManifest,
  IPluginEventBus,
} from '@/types/interfaces/plugin.interface.js';
import { PluginState } from '@/types/interfaces/plugin.interface.js';

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
 * Creates a mock event bus for testing.
 *
 * @returns Mock event bus
 */
const createMockEventBus = (): IPluginEventBus => ({
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  emitAsync: vi.fn().mockResolvedValue(undefined),
  listenerCount: vi.fn().mockReturnValue(0),
  eventNames: vi.fn().mockReturnValue([]),
  removeAllListeners: vi.fn(),
});

/**
 * Creates a mock plugin context for testing.
 *
 * @param config - Plugin configuration
 * @returns Mock plugin context
 */
const createMockContext = (config: Record<string, unknown> = {}): IPluginContext => ({
  logger: createMockLogger(),
  cache: createMockCache(),
  metrics: createMockMetrics(),
  eventBus: createMockEventBus(),
  config,
});

/**
 * Test implementation of BasePlugin.
 */
class TestPlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.test';
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.test',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin for unit testing',
    author: 'Chive Team',
    license: 'MIT',
    permissions: {
      hooks: ['preprint.indexed'],
      network: { allowedDomains: [] },
      storage: { maxSize: 1024 },
    },
    entrypoint: 'test.js',
  };

  initCalled = false;
  shutdownCalled = false;

  protected onInitialize(): Promise<void> {
    this.initCalled = true;
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    this.shutdownCalled = true;
    return Promise.resolve();
  }

  // Expose protected methods for testing
  public testGetConfig<T>(key: string): T | undefined {
    return this.getConfig<T>(key);
  }

  public testGetRequiredConfig<T>(key: string): T {
    return this.getRequiredConfig<T>(key);
  }

  public testRecordCounter(name: string, labels?: Record<string, string>, value?: number): void {
    this.recordCounter(name, labels, value);
  }

  public testRecordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordGauge(name, value, labels);
  }

  public testStartTimer(name: string, labels?: Record<string, string>): () => void {
    return this.startTimer(name, labels);
  }
}

/**
 * Test plugin that throws during initialization.
 */
class FailingPlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.failing';
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.failing',
    name: 'Failing Plugin',
    version: '1.0.0',
    description: 'A plugin that fails initialization',
    author: 'Chive Team',
    license: 'MIT',
    permissions: {
      hooks: [],
      network: { allowedDomains: [] },
      storage: { maxSize: 1024 },
    },
    entrypoint: 'failing.js',
  };

  protected onInitialize(): Promise<void> {
    return Promise.reject(new Error('Initialization failed'));
  }
}

describe('BasePlugin', () => {
  let plugin: TestPlugin;
  let context: IPluginContext;

  beforeEach(() => {
    plugin = new TestPlugin();
    context = createMockContext({ apiKey: 'test-key', enabled: true });
  });

  describe('initialize', () => {
    it('should initialize plugin', async () => {
      await plugin.initialize(context);

      expect(plugin.initCalled).toBe(true);
      expect(plugin.getState()).toBe(PluginState.READY);
    });

    it('should set context properties', async () => {
      await plugin.initialize(context);

      // Verify logger was used
      expect(context.logger.info).toHaveBeenCalledWith(
        'Plugin initialized',
        expect.objectContaining({
          pluginId: plugin.id,
          version: plugin.manifest.version,
        })
      );
    });

    it('should transition through states', async () => {
      expect(plugin.getState()).toBe(PluginState.UNINITIALIZED);

      const promise = plugin.initialize(context);

      await promise;

      expect(plugin.getState()).toBe(PluginState.READY);
    });
  });

  describe('initialize failure', () => {
    it('should set ERROR state when initialization fails', async () => {
      const failingPlugin = new FailingPlugin();
      const failContext = createMockContext();

      await expect(failingPlugin.initialize(failContext)).rejects.toThrow('Initialization failed');
      expect(failingPlugin.getState()).toBe(PluginState.ERROR);
    });

    it('should log error on initialization failure', async () => {
      const failingPlugin = new FailingPlugin();
      const failContext = createMockContext();

      await expect(failingPlugin.initialize(failContext)).rejects.toThrow();

      expect(failContext.logger.error).toHaveBeenCalledWith(
        'Plugin initialization failed',
        expect.any(Error)
      );
    });
  });

  describe('shutdown', () => {
    it('should shutdown plugin', async () => {
      await plugin.initialize(context);
      await plugin.shutdown();

      expect(plugin.shutdownCalled).toBe(true);
      expect(plugin.getState()).toBe(PluginState.SHUTDOWN);
    });

    it('should log shutdown', async () => {
      await plugin.initialize(context);
      await plugin.shutdown();

      expect(context.logger.info).toHaveBeenCalledWith('Plugin shutting down');
    });
  });

  describe('getState', () => {
    it('should return UNINITIALIZED initially', () => {
      expect(plugin.getState()).toBe(PluginState.UNINITIALIZED);
    });

    it('should return READY after initialization', async () => {
      await plugin.initialize(context);
      expect(plugin.getState()).toBe(PluginState.READY);
    });

    it('should return SHUTDOWN after shutdown', async () => {
      await plugin.initialize(context);
      await plugin.shutdown();
      expect(plugin.getState()).toBe(PluginState.SHUTDOWN);
    });
  });

  describe('getConfig', () => {
    it('should return config value', async () => {
      await plugin.initialize(context);

      expect(plugin.testGetConfig<string>('apiKey')).toBe('test-key');
      expect(plugin.testGetConfig<boolean>('enabled')).toBe(true);
    });

    it('should return undefined for missing key', async () => {
      await plugin.initialize(context);

      expect(plugin.testGetConfig<string>('nonExistent')).toBeUndefined();
    });
  });

  describe('getRequiredConfig', () => {
    it('should return required config value', async () => {
      await plugin.initialize(context);

      expect(plugin.testGetRequiredConfig<string>('apiKey')).toBe('test-key');
    });

    it('should throw for missing required config', async () => {
      await plugin.initialize(context);

      expect(() => plugin.testGetRequiredConfig<string>('nonExistent')).toThrow(
        'Missing required config: nonExistent'
      );
    });
  });

  describe('metrics helpers', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should record counter', () => {
      plugin.testRecordCounter('test_counter', { label: 'value' }, 5);

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'test_counter',
        { label: 'value' },
        5
      );
    });

    it('should record gauge', () => {
      plugin.testRecordGauge('test_gauge', 42, { label: 'value' });

      expect(context.metrics.setGauge).toHaveBeenCalledWith('test_gauge', 42, { label: 'value' });
    });

    it('should start timer', () => {
      const stopTimer = plugin.testStartTimer('test_timer', { operation: 'test' });

      expect(context.metrics.startTimer).toHaveBeenCalledWith('test_timer', { operation: 'test' });
      expect(typeof stopTimer).toBe('function');
    });
  });

  describe('plugin properties', () => {
    it('should have correct id', () => {
      expect(plugin.id).toBe('pub.chive.plugin.test');
    });

    it('should have correct manifest', () => {
      expect(plugin.manifest.id).toBe('pub.chive.plugin.test');
      expect(plugin.manifest.name).toBe('Test Plugin');
      expect(plugin.manifest.version).toBe('1.0.0');
    });
  });
});
