/**
 * Unit tests for PluginLoader.
 *
 * @remarks
 * Tests plugin manifest validation, directory scanning, and code loading.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PluginLoader } from '@/plugins/core/plugin-loader.js';
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
 * Creates a valid test manifest.
 *
 * @param overrides - Properties to override
 * @returns Valid plugin manifest
 */
const createValidManifest = (overrides: Partial<IPluginManifest> = {}): IPluginManifest => ({
  id: 'pub.chive.plugin.test',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin for unit testing purposes',
  author: 'Chive Team',
  license: 'MIT',
  permissions: {
    hooks: ['preprint.indexed'],
    network: {
      allowedDomains: ['api.example.com'],
    },
    storage: {
      maxSize: 1024 * 1024,
    },
  },
  entrypoint: 'dist/index.js',
  ...overrides,
});

describe('PluginLoader', () => {
  let loader: PluginLoader;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    loader = new PluginLoader(mockLogger);
  });

  describe('constructor', () => {
    it('should create plugin loader with logger', () => {
      expect(loader).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'PluginLoader' });
    });

    it('should log initialization', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith('Plugin loader initialized');
    });
  });

  describe('validateManifest', () => {
    it('should validate a complete valid manifest', async () => {
      const manifest = createValidManifest();
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('pub.chive.plugin.test');
        expect(result.value.name).toBe('Test Plugin');
      }
    });

    it('should reject manifest missing required fields', async () => {
      const manifest = {
        id: 'pub.chive.plugin.test',
        name: 'Test Plugin',
        // Missing version, description, author, license, permissions, entrypoint
      };

      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.validationErrors.length).toBeGreaterThan(0);
      }
    });

    it('should reject manifest with invalid id format', async () => {
      const manifest = createValidManifest({ id: 'invalid-id' });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });

    it('should reject manifest with invalid version format', async () => {
      const manifest = createValidManifest({ version: 'not-semver' });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });

    it('should reject manifest with invalid license', async () => {
      const manifest = createValidManifest({ license: 'InvalidLicense' as 'MIT' });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });

    it('should reject manifest with invalid entrypoint', async () => {
      const manifest = createValidManifest({ entrypoint: 'index.ts' });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });

    it('should accept manifest with .mjs entrypoint', async () => {
      const manifest = createValidManifest({ entrypoint: 'dist/index.mjs' });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(true);
    });

    it('should reject manifest with description too short', async () => {
      const manifest = createValidManifest({ description: 'Short' });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });

    it('should accept manifest with all allowed licenses', async () => {
      const licenses = ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC'] as const;

      for (const license of licenses) {
        const manifest = createValidManifest({ license });
        const result = await loader.validateManifest(manifest);

        expect(result.ok).toBe(true);
      }
    });

    it('should reject manifest with additional properties', async () => {
      const manifest = {
        ...createValidManifest(),
        unknownField: 'should not be here',
      };

      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });

    it('should accept manifest with optional dependencies', async () => {
      const manifest = createValidManifest({
        dependencies: ['pub.chive.plugin.other'],
      });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies).toContain('pub.chive.plugin.other');
      }
    });

    it('should reject manifest with invalid dependency format', async () => {
      const manifest = createValidManifest({
        dependencies: ['invalid-dep'] as unknown as string[],
      });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });

    it('should accept manifest with empty hooks array', async () => {
      const manifest = createValidManifest({
        permissions: {
          hooks: [],
          network: { allowedDomains: [] },
          storage: { maxSize: 1024 },
        },
      });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(true);
    });

    it('should accept manifest with multiple hooks', async () => {
      const manifest = createValidManifest({
        permissions: {
          hooks: ['preprint.indexed', 'preprint.updated', 'system.startup'],
          network: { allowedDomains: [] },
          storage: { maxSize: 1024 },
        },
      });
      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(true);
    });

    it('should reject null manifest', async () => {
      const result = await loader.validateManifest(null);

      expect(result.ok).toBe(false);
    });

    it('should reject undefined manifest', async () => {
      const result = await loader.validateManifest(undefined);

      expect(result.ok).toBe(false);
    });

    it('should reject non-object manifest', async () => {
      const result = await loader.validateManifest('not an object');

      expect(result.ok).toBe(false);
    });

    it('should provide descriptive error messages', async () => {
      const manifest = {
        id: 'pub.chive.plugin.test',
        // Missing other required fields
      };

      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Errors should mention missing fields
        const errorMessages = result.error.validationErrors.join(' ');
        expect(errorMessages.length).toBeGreaterThan(0);
      }
    });
  });

  describe('permissions validation', () => {
    it('should validate network permissions', async () => {
      const manifest = createValidManifest({
        permissions: {
          hooks: [],
          network: {
            allowedDomains: ['api.github.com', 'api.example.com'],
          },
          storage: { maxSize: 1024 },
        },
      });

      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(true);
    });

    it('should validate storage permissions', async () => {
      const manifest = createValidManifest({
        permissions: {
          hooks: [],
          network: { allowedDomains: [] },
          storage: {
            maxSize: 50 * 1024 * 1024, // 50MB
          },
        },
      });

      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(true);
    });

    it('should reject storage size exceeding maximum', async () => {
      const manifest = createValidManifest({
        permissions: {
          hooks: [],
          network: { allowedDomains: [] },
          storage: {
            maxSize: 200 * 1024 * 1024, // 200MB (exceeds 100MB max)
          },
        },
      });

      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });

    it('should reject too many allowed domains', async () => {
      const domains = Array.from({ length: 25 }, (_, i) => `domain${i}.com`);
      const manifest = createValidManifest({
        permissions: {
          hooks: [],
          network: { allowedDomains: domains },
          storage: { maxSize: 1024 },
        },
      });

      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });

    it('should reject too many hooks', async () => {
      const hooks = Array.from({ length: 55 }, (_, i) => `event.hook${i}`);
      const manifest = createValidManifest({
        permissions: {
          hooks,
          network: { allowedDomains: [] },
          storage: { maxSize: 1024 },
        },
      });

      const result = await loader.validateManifest(manifest);

      expect(result.ok).toBe(false);
    });
  });

  describe('scanDirectory', () => {
    it('should return empty array for non-existent directory', async () => {
      const manifests = await loader.scanDirectory('/non/existent/path');

      expect(manifests).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalled();
      const warnCall = vi.mocked(mockLogger.warn).mock.calls[0];
      expect(warnCall?.[0]).toBe('Plugin directory does not exist');
      const logData = warnCall?.[1] as { path?: string } | undefined;
      expect(logData?.path).toContain('/non/existent/path');
    });

    it('should log scan start', async () => {
      await loader.scanDirectory('/any/path');

      expect(mockLogger.info).toHaveBeenCalledWith('Scanning plugin directory', expect.anything());
    });

    it('should log scan completion', async () => {
      await loader.scanDirectory('/any/path');

      expect(mockLogger.info).toHaveBeenCalled();
      const infoCalls = vi.mocked(mockLogger.info).mock.calls;
      const scanCompleteCall = infoCalls.find((call) => call[0] === 'Scan complete');
      expect(scanCompleteCall).toBeDefined();
      const logData = scanCompleteCall?.[1] as { pluginCount?: number } | undefined;
      expect(typeof logData?.pluginCount).toBe('number');
    });
  });
});
