/**
 * Unit tests for IsolatedVmSandbox.
 *
 * @remarks
 * Tests isolate creation, execution, memory management, and disposal.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { IsolatedVmSandbox } from '@/plugins/sandbox/isolated-vm-sandbox.js';
import { SandboxViolationError } from '@/types/errors.js';
import type { ICacheProvider } from '@/types/interfaces/cache.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IMetrics } from '@/types/interfaces/metrics.interface.js';
import type { IPluginManifest, SandboxContext } from '@/types/interfaces/plugin.interface.js';

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
 * Creates a test plugin manifest.
 *
 * @param id - Plugin ID
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
    hooks: ['preprint.indexed'],
    network: { allowedDomains: ['api.example.com'] },
    storage: { maxSize: 1024 * 1024 },
  },
  entrypoint: 'dist/index.js',
});

/**
 * Creates a mock cache provider.
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
 * Creates a mock metrics provider.
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
 * Creates a mock sandbox context.
 *
 * @returns Mock sandbox context
 */
const createMockContext = (): SandboxContext => ({
  logger: createMockLogger(),
  cache: createMockCache(),
  metrics: createMockMetrics(),
  config: {},
  allowedDomains: ['api.example.com'],
});

describe('IsolatedVmSandbox', () => {
  let sandbox: IsolatedVmSandbox;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    sandbox = new IsolatedVmSandbox(mockLogger);
  });

  describe('constructor', () => {
    it('should create sandbox with logger', () => {
      expect(sandbox).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'IsolatedVmSandbox' });
    });
  });

  describe('createIsolate', () => {
    it('should create isolate for plugin', async () => {
      const manifest = createTestManifest();
      const isolate = await sandbox.createIsolate(manifest);

      expect(isolate).toBeDefined();
      expect(isolate.id).toContain('pub.chive.plugin.test');
      expect(isolate.pluginId).toBe('pub.chive.plugin.test');
      expect(isolate.memoryLimit).toBe(128);
      expect(isolate.cpuLimit).toBe(5000);
    });

    it('should create unique isolate IDs', async () => {
      const manifest = createTestManifest();

      const isolate1 = await sandbox.createIsolate(manifest);
      const isolate2 = await sandbox.createIsolate(manifest);

      expect(isolate1.id).not.toBe(isolate2.id);
    });

    it('should log isolate creation', async () => {
      const manifest = createTestManifest();
      await sandbox.createIsolate(manifest);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating isolate',
        expect.objectContaining({
          pluginId: 'pub.chive.plugin.test',
        })
      );
    });
  });

  describe('executeInSandbox', () => {
    it('should execute code in isolate', async () => {
      const manifest = createTestManifest();
      const isolate = await sandbox.createIsolate(manifest);
      const context = createMockContext();

      // Scripts return the value of the last expression (not using 'return')
      const result = await sandbox.executeInSandbox(isolate, '42', context);

      expect(result).toBe(42);
    });

    it('should throw when isolate not found', async () => {
      const context = createMockContext();
      const fakeIsolate = {
        id: 'non-existent',
        pluginId: 'test',
        memoryLimit: 128,
        cpuLimit: 5000,
      };

      await expect(sandbox.executeInSandbox(fakeIsolate, '1', context)).rejects.toThrow(
        'Isolate not found'
      );
    });

    it('should throw SandboxViolationError when memory limit exceeded', async () => {
      const manifest = createTestManifest();
      const isolate = await sandbox.createIsolate(manifest);
      const context = createMockContext();

      // Simulate memory usage at the limit
      sandbox.updateMemoryUsage(isolate.id, 128);

      await expect(sandbox.executeInSandbox(isolate, '1', context)).rejects.toThrow(
        SandboxViolationError
      );
    });

    it('should warn when memory usage is high', async () => {
      const manifest = createTestManifest();
      const isolate = await sandbox.createIsolate(manifest);
      const context = createMockContext();

      // Set memory at 90%+ of limit
      sandbox.updateMemoryUsage(isolate.id, 120);

      await sandbox.executeInSandbox(isolate, '1', context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Memory usage high',
        expect.objectContaining({
          isolateId: isolate.id,
        })
      );
    });

    it('should log code execution', async () => {
      const manifest = createTestManifest();
      const isolate = await sandbox.createIsolate(manifest);
      const context = createMockContext();

      await sandbox.executeInSandbox(isolate, '1', context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Code executed',
        expect.objectContaining({
          isolateId: isolate.id,
        })
      );
    });
  });

  describe('dispose', () => {
    it('should dispose isolate', async () => {
      const manifest = createTestManifest();
      const isolate = await sandbox.createIsolate(manifest);

      expect(sandbox.getActiveIsolateCount()).toBe(1);

      sandbox.dispose(isolate);

      expect(sandbox.getActiveIsolateCount()).toBe(0);
    });

    it('should log isolate disposal', async () => {
      const manifest = createTestManifest();
      const isolate = await sandbox.createIsolate(manifest);

      sandbox.dispose(isolate);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Isolate disposed',
        expect.objectContaining({
          isolateId: isolate.id,
          pluginId: isolate.pluginId,
        })
      );
    });

    it('should handle disposing non-existent isolate', () => {
      const fakeIsolate = {
        id: 'non-existent',
        pluginId: 'test',
        memoryLimit: 128,
        cpuLimit: 5000,
      };

      expect(() => sandbox.dispose(fakeIsolate)).not.toThrow();
    });
  });

  describe('disposeAll', () => {
    it('should dispose all isolates', async () => {
      const manifest1 = createTestManifest('pub.chive.plugin.one');
      const manifest2 = createTestManifest('pub.chive.plugin.two');

      await sandbox.createIsolate(manifest1);
      await sandbox.createIsolate(manifest2);

      expect(sandbox.getActiveIsolateCount()).toBe(2);

      sandbox.disposeAll();

      expect(sandbox.getActiveIsolateCount()).toBe(0);
    });

    it('should log when all isolates disposed', async () => {
      const manifest = createTestManifest();
      await sandbox.createIsolate(manifest);

      sandbox.disposeAll();

      expect(mockLogger.info).toHaveBeenCalledWith('All isolates disposed', { count: 1 });
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage for isolate', async () => {
      const manifest = createTestManifest();
      const isolate = await sandbox.createIsolate(manifest);

      sandbox.updateMemoryUsage(isolate.id, 50);

      const usage = sandbox.getMemoryUsage(isolate);
      expect(usage).toBe(50 * 1024 * 1024);
    });

    it('should return 0 for non-existent isolate', () => {
      const fakeIsolate = {
        id: 'non-existent',
        pluginId: 'test',
        memoryLimit: 128,
        cpuLimit: 5000,
      };

      expect(sandbox.getMemoryUsage(fakeIsolate)).toBe(0);
    });
  });

  describe('updateMemoryUsage', () => {
    it('should update memory usage', async () => {
      const manifest = createTestManifest();
      const isolate = await sandbox.createIsolate(manifest);

      sandbox.updateMemoryUsage(isolate.id, 64);

      expect(sandbox.getMemoryUsage(isolate)).toBe(64 * 1024 * 1024);
    });

    it('should handle non-existent isolate', () => {
      expect(() => sandbox.updateMemoryUsage('non-existent', 64)).not.toThrow();
    });
  });

  describe('getActiveIsolateCount', () => {
    it('should return 0 when no isolates', () => {
      expect(sandbox.getActiveIsolateCount()).toBe(0);
    });

    it('should return correct count', async () => {
      const manifest = createTestManifest();

      await sandbox.createIsolate(manifest);
      expect(sandbox.getActiveIsolateCount()).toBe(1);

      await sandbox.createIsolate(manifest);
      expect(sandbox.getActiveIsolateCount()).toBe(2);
    });
  });

  describe('getActiveIsolates', () => {
    it('should return empty array when no isolates', () => {
      expect(sandbox.getActiveIsolates()).toHaveLength(0);
    });

    it('should return all active isolates', async () => {
      const manifest1 = createTestManifest('pub.chive.plugin.one');
      const manifest2 = createTestManifest('pub.chive.plugin.two');

      await sandbox.createIsolate(manifest1);
      await sandbox.createIsolate(manifest2);

      const isolates = sandbox.getActiveIsolates();

      expect(isolates).toHaveLength(2);
      expect(isolates.map((i) => i.pluginId)).toContain('pub.chive.plugin.one');
      expect(isolates.map((i) => i.pluginId)).toContain('pub.chive.plugin.two');
    });
  });
});
