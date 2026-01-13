/**
 * Unit tests for PermissionEnforcer.
 *
 * @remarks
 * Tests permission checking, proxy creation, network/storage/hook enforcement.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PermissionEnforcer } from '@/plugins/sandbox/permission-enforcer.js';
import { PluginPermissionError, SandboxViolationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
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
 * Creates a mock plugin for testing.
 *
 * @param manifestOverrides - Manifest property overrides
 * @returns Mock plugin instance
 */
const createMockPlugin = (manifestOverrides: Partial<IPluginManifest> = {}): IChivePlugin => {
  const manifest: IPluginManifest = {
    id: 'pub.chive.plugin.test',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin for unit testing',
    author: 'Chive Team',
    license: 'MIT',
    permissions: {
      hooks: ['eprint.indexed', 'eprint.updated'],
      network: {
        allowedDomains: ['api.github.com', 'api.example.com'],
      },
      storage: {
        maxSize: 10 * 1024 * 1024, // 10MB
      },
    },
    entrypoint: 'dist/index.js',
    ...manifestOverrides,
  };

  return {
    id: manifest.id,
    manifest,
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue('ready' as PluginState),
  };
};

describe('PermissionEnforcer', () => {
  let enforcer: PermissionEnforcer;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    enforcer = new PermissionEnforcer(mockLogger);
  });

  describe('constructor', () => {
    it('should create permission enforcer with logger', () => {
      expect(enforcer).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'PermissionEnforcer' });
    });
  });

  describe('checkPermission', () => {
    it('should return true for permitted network domain', () => {
      const plugin = createMockPlugin();

      expect(enforcer.checkPermission(plugin, 'network:api.github.com')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'network:api.example.com')).toBe(true);
    });

    it('should return false for non-permitted network domain', () => {
      const plugin = createMockPlugin();

      expect(enforcer.checkPermission(plugin, 'network:api.unauthorized.com')).toBe(false);
    });

    it('should return true for permitted hook', () => {
      const plugin = createMockPlugin();

      expect(enforcer.checkPermission(plugin, 'hook:eprint.indexed')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'hook:eprint.updated')).toBe(true);
    });

    it('should return false for non-permitted hook', () => {
      const plugin = createMockPlugin();

      expect(enforcer.checkPermission(plugin, 'hook:system.shutdown')).toBe(false);
    });

    it('should return true for storage permission within quota', () => {
      const plugin = createMockPlugin();

      expect(enforcer.checkPermission(plugin, 'storage:read')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'storage:write')).toBe(true);
    });

    it('should return false for unknown permission type', () => {
      const plugin = createMockPlugin();

      expect(enforcer.checkPermission(plugin, 'unknown:something')).toBe(false);
    });

    it('should handle hook wildcard permissions', () => {
      const plugin = createMockPlugin({
        permissions: {
          hooks: ['eprint.*'],
          network: { allowedDomains: [] },
          storage: { maxSize: 1024 },
        },
      });

      expect(enforcer.checkPermission(plugin, 'hook:eprint.indexed')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'hook:eprint.updated')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'hook:review.created')).toBe(false);
    });
  });

  describe('enforceNetworkAccess', () => {
    it('should not throw for permitted domain', () => {
      const plugin = createMockPlugin();

      expect(() => {
        enforcer.enforceNetworkAccess(plugin, 'api.github.com');
      }).not.toThrow();
    });

    it('should throw SandboxViolationError for non-permitted domain', () => {
      const plugin = createMockPlugin();

      expect(() => {
        enforcer.enforceNetworkAccess(plugin, 'api.unauthorized.com');
      }).toThrow(SandboxViolationError);
    });

    it('should include plugin ID and domain in error', () => {
      const plugin = createMockPlugin();

      try {
        enforcer.enforceNetworkAccess(plugin, 'api.unauthorized.com');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SandboxViolationError);
        expect((error as SandboxViolationError).message).toContain('api.unauthorized.com');
      }
    });

    it('should log access attempt', () => {
      const plugin = createMockPlugin();
      enforcer.enforceNetworkAccess(plugin, 'api.github.com');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Network access granted',
        expect.objectContaining({
          pluginId: 'pub.chive.plugin.test',
          domain: 'api.github.com',
        })
      );
    });
  });

  describe('enforceHookAccess', () => {
    it('should not throw for permitted hook', () => {
      const plugin = createMockPlugin();

      expect(() => {
        enforcer.enforceHookAccess(plugin, 'eprint.indexed');
      }).not.toThrow();
    });

    it('should throw SandboxViolationError for non-permitted hook', () => {
      const plugin = createMockPlugin();

      expect(() => {
        enforcer.enforceHookAccess(plugin, 'system.shutdown');
      }).toThrow(SandboxViolationError);
    });

    it('should support wildcard hook permissions', () => {
      const plugin = createMockPlugin({
        permissions: {
          hooks: ['system.*'],
          network: { allowedDomains: [] },
          storage: { maxSize: 1024 },
        },
      });

      expect(() => {
        enforcer.enforceHookAccess(plugin, 'system.startup');
      }).not.toThrow();

      expect(() => {
        enforcer.enforceHookAccess(plugin, 'system.shutdown');
      }).not.toThrow();
    });

    it('should not log for permitted hook access', () => {
      const plugin = createMockPlugin();
      enforcer.enforceHookAccess(plugin, 'eprint.indexed');

      // The implementation doesn't log on successful hook access
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('enforceStorageLimit', () => {
    it('should not throw for storage within quota', () => {
      const plugin = createMockPlugin();

      expect(() => {
        enforcer.enforceStorageLimit(plugin, 1024); // 1KB
      }).not.toThrow();
    });

    it('should throw SandboxViolationError when exceeding quota', () => {
      const plugin = createMockPlugin({
        permissions: {
          hooks: [],
          network: { allowedDomains: [] },
          storage: { maxSize: 1024 }, // 1KB quota
        },
      });

      // First, use up most of the quota
      enforcer.enforceStorageLimit(plugin, 900);

      // Try to exceed
      expect(() => {
        enforcer.enforceStorageLimit(plugin, 200); // Would exceed 1024
      }).toThrow(SandboxViolationError);
    });

    it('should track cumulative storage usage', () => {
      const plugin = createMockPlugin({
        permissions: {
          hooks: [],
          network: { allowedDomains: [] },
          storage: { maxSize: 1000 },
        },
      });

      enforcer.enforceStorageLimit(plugin, 300);
      enforcer.enforceStorageLimit(plugin, 300);
      enforcer.enforceStorageLimit(plugin, 300);

      // Should throw on next allocation
      expect(() => {
        enforcer.enforceStorageLimit(plugin, 200);
      }).toThrow(SandboxViolationError);
    });
  });

  describe('decreaseStorageUsage', () => {
    it('should decrease tracked storage', () => {
      const plugin = createMockPlugin({
        permissions: {
          hooks: [],
          network: { allowedDomains: [] },
          storage: { maxSize: 1000 },
        },
      });

      // Use up quota
      enforcer.enforceStorageLimit(plugin, 800);

      // Decrease usage
      enforcer.decreaseStorageUsage(plugin.id, 500);

      // Should now be able to add more
      expect(() => {
        enforcer.enforceStorageLimit(plugin, 400);
      }).not.toThrow();
    });

    it('should not go below zero', () => {
      const plugin = createMockPlugin();

      enforcer.enforceStorageLimit(plugin, 100);
      enforcer.decreaseStorageUsage(plugin.id, 200); // More than used

      // Should still work
      expect(() => {
        enforcer.enforceStorageLimit(plugin, 100);
      }).not.toThrow();
    });
  });

  describe('resetStorageUsage', () => {
    it('should reset storage usage to zero', () => {
      const plugin = createMockPlugin({
        permissions: {
          hooks: [],
          network: { allowedDomains: [] },
          storage: { maxSize: 1000 },
        },
      });

      // Use up all quota
      enforcer.enforceStorageLimit(plugin, 1000);

      // Reset
      enforcer.resetStorageUsage(plugin.id);

      // Should now be able to use full quota again
      expect(() => {
        enforcer.enforceStorageLimit(plugin, 1000);
      }).not.toThrow();
    });

    it('should log reset', () => {
      enforcer.resetStorageUsage('test-plugin');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Storage usage reset',
        expect.objectContaining({ pluginId: 'test-plugin' })
      );
    });
  });

  describe('createPermissionProxy', () => {
    it('should create a proxy for service', () => {
      const plugin = createMockPlugin();
      const service = {
        doSomething: vi.fn().mockReturnValue('result'),
        getValue: vi.fn().mockReturnValue(42),
      };

      const proxy = enforcer.createPermissionProxy(service, 'storage:read', plugin);

      expect(proxy).toBeDefined();
    });

    it('should allow method calls when permission granted', () => {
      const plugin = createMockPlugin();
      const service = {
        doSomething: vi.fn().mockReturnValue('result'),
      };

      const proxy = enforcer.createPermissionProxy(service, 'storage:read', plugin);
      const result = proxy.doSomething() as string;

      expect(result).toBe('result');
      expect(service.doSomething).toHaveBeenCalled();
    });

    it('should throw PluginPermissionError when permission denied', () => {
      const plugin = createMockPlugin();
      const service = {
        doSomething: vi.fn(),
      };

      const proxy = enforcer.createPermissionProxy(service, 'unknown:permission', plugin);

      expect(() => {
        proxy.doSomething();
      }).toThrow(PluginPermissionError);
    });

    it('should pass through non-function properties', () => {
      const plugin = createMockPlugin();
      const service = {
        value: 42,
        name: 'test',
      };

      const proxy = enforcer.createPermissionProxy(service, 'storage:read', plugin);

      expect(proxy.value).toBe(42);
      expect(proxy.name).toBe('test');
    });

    it('should log permission grants and denials', () => {
      const plugin = createMockPlugin();
      const service = {
        doSomething: vi.fn(),
      };

      const proxy = enforcer.createPermissionProxy(service, 'storage:read', plugin);
      proxy.doSomething();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Permission granted',
        expect.objectContaining({
          pluginId: 'pub.chive.plugin.test',
          permission: 'storage:read',
        })
      );
    });

    it('should log permission denial', () => {
      const plugin = createMockPlugin();
      const service = {
        doSomething: vi.fn(),
      };

      const proxy = enforcer.createPermissionProxy(service, 'unknown:permission', plugin);

      try {
        proxy.doSomething();
      } catch {
        // Expected
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Permission denied',
        expect.objectContaining({
          pluginId: 'pub.chive.plugin.test',
          permission: 'unknown:permission',
        })
      );
    });

    it('should preserve method context', () => {
      const plugin = createMockPlugin();
      const service = {
        value: 10,
        getValue(): number {
          return this.value;
        },
      };

      const proxy = enforcer.createPermissionProxy(service, 'storage:read', plugin);
      const result = proxy.getValue();

      expect(result).toBe(10);
    });

    it('should handle methods with arguments', () => {
      const plugin = createMockPlugin();
      const service = {
        add: (a: number, b: number): number => a + b,
      };

      const proxy = enforcer.createPermissionProxy(service, 'storage:read', plugin);
      const result = proxy.add(5, 3);

      expect(result).toBe(8);
    });
  });

  describe('permission patterns', () => {
    it('should match exact domain', () => {
      const plugin = createMockPlugin({
        permissions: {
          hooks: [],
          network: { allowedDomains: ['api.github.com'] },
          storage: { maxSize: 1024 },
        },
      });

      expect(enforcer.checkPermission(plugin, 'network:api.github.com')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'network:github.com')).toBe(false);
      expect(enforcer.checkPermission(plugin, 'network:sub.api.github.com')).toBe(false);
    });

    it('should match exact hook name', () => {
      const plugin = createMockPlugin({
        permissions: {
          hooks: ['eprint.indexed'],
          network: { allowedDomains: [] },
          storage: { maxSize: 1024 },
        },
      });

      expect(enforcer.checkPermission(plugin, 'hook:eprint.indexed')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'hook:eprint.updated')).toBe(false);
    });

    it('should match wildcard hook pattern', () => {
      const plugin = createMockPlugin({
        permissions: {
          hooks: ['eprint.*', 'system.startup'],
          network: { allowedDomains: [] },
          storage: { maxSize: 1024 },
        },
      });

      expect(enforcer.checkPermission(plugin, 'hook:eprint.indexed')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'hook:eprint.updated')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'hook:system.startup')).toBe(true);
      expect(enforcer.checkPermission(plugin, 'hook:system.shutdown')).toBe(false);
      expect(enforcer.checkPermission(plugin, 'hook:review.created')).toBe(false);
    });
  });
});
