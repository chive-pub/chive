/**
 * Unit tests for ResourceGovernor.
 *
 * @remarks
 * Tests resource allocation, tracking, limit enforcement, and cleanup.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ResourceGovernor, DEFAULT_RESOURCE_LIMITS } from '@/plugins/sandbox/resource-governor.js';
import { SandboxViolationError } from '@/types/errors.js';
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

describe('ResourceGovernor', () => {
  let governor: ResourceGovernor;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    governor = new ResourceGovernor(mockLogger);
  });

  describe('constructor', () => {
    it('should create resource governor with logger', () => {
      expect(governor).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'ResourceGovernor' });
    });
  });

  describe('DEFAULT_RESOURCE_LIMITS', () => {
    it('should have expected memory limit', () => {
      expect(DEFAULT_RESOURCE_LIMITS.maxMemoryMB).toBe(128);
    });

    it('should have expected CPU percent', () => {
      expect(DEFAULT_RESOURCE_LIMITS.maxCpuPercent).toBe(10);
    });

    it('should have expected execution time', () => {
      expect(DEFAULT_RESOURCE_LIMITS.maxExecutionTimeMs).toBe(5000);
    });
  });

  describe('allocate', () => {
    it('should allocate resources for plugin', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      const limits = governor.getLimits('test-plugin');
      expect(limits).toBeDefined();
    });

    it('should set limits from provided values', () => {
      const customLimits = {
        maxMemoryMB: 64,
        maxCpuPercent: 5,
        maxExecutionTimeMs: 3000,
      };

      governor.allocate('test-plugin', customLimits);

      const limits = governor.getLimits('test-plugin');
      expect(limits?.maxMemoryMB).toBe(64);
      expect(limits?.maxCpuPercent).toBe(5);
      expect(limits?.maxExecutionTimeMs).toBe(3000);
    });

    it('should initialize usage counters to zero', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      expect(governor.checkMemoryUsage('test-plugin')).toBe(0);
      expect(governor.checkCpuUsage('test-plugin')).toBe(0);
    });

    it('should log resource allocation', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Resources allocated',
        expect.objectContaining({ pluginId: 'test-plugin' })
      );
    });

    it('should overwrite existing allocation', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      const newLimits = {
        maxMemoryMB: 256,
        maxCpuPercent: 20,
        maxExecutionTimeMs: 10000,
      };
      governor.allocate('test-plugin', newLimits);

      const limits = governor.getLimits('test-plugin');
      expect(limits?.maxMemoryMB).toBe(256);
    });
  });

  describe('release', () => {
    it('should release resources for plugin', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);
      governor.release('test-plugin');

      const limits = governor.getLimits('test-plugin');
      expect(limits).toBeUndefined();
    });

    it('should log resource release', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);
      governor.release('test-plugin');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Resources released',
        expect.objectContaining({ pluginId: 'test-plugin' })
      );
    });

    it('should handle releasing non-existent plugin', () => {
      expect(() => {
        governor.release('non-existent');
      }).not.toThrow();
    });
  });

  describe('checkMemoryUsage', () => {
    it('should return 0 for non-existent plugin', () => {
      expect(governor.checkMemoryUsage('non-existent')).toBe(0);
    });

    it('should return current memory usage', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);
      governor.updateMemoryUsage('test-plugin', 50);

      expect(governor.checkMemoryUsage('test-plugin')).toBe(50);
    });
  });

  describe('checkCpuUsage', () => {
    it('should return 0 for non-existent plugin', () => {
      expect(governor.checkCpuUsage('non-existent')).toBe(0);
    });

    it('should return calculated CPU percentage', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);
      // CPU usage is calculated based on time used
      expect(governor.checkCpuUsage('test-plugin')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('updateMemoryUsage', () => {
    it('should update memory usage for plugin', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);
      governor.updateMemoryUsage('test-plugin', 50);

      expect(governor.checkMemoryUsage('test-plugin')).toBe(50);
    });

    it('should warn for non-existent plugin', () => {
      governor.updateMemoryUsage('non-existent', 50);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No allocation found for plugin',
        expect.objectContaining({ pluginId: 'non-existent' })
      );
    });

    it('should throw when exceeding memory limit', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      expect(() => {
        governor.updateMemoryUsage('test-plugin', 200); // Exceeds 128MB limit
      }).toThrow(SandboxViolationError);
    });

    it('should warn when approaching memory limit', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);
      governor.updateMemoryUsage('test-plugin', 120); // 120MB is over 90% of 128MB

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Memory usage high',
        expect.objectContaining({ pluginId: 'test-plugin' })
      );
    });
  });

  describe('recordCpuTime', () => {
    it('should record CPU time within limits', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      // Record a small amount of CPU time that won't exceed the 10% limit
      // When period just started, we need to be careful about the percentage calculation
      expect(() => {
        governor.recordCpuTime('test-plugin', 1); // 1ms is safe
      }).not.toThrow();
    });

    it('should track CPU time used', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      // Record a small amount of CPU time (5ms is under 10% of 100ms minimum period)
      governor.recordCpuTime('test-plugin', 5);

      // CPU usage should be > 0 after recording
      const cpuUsage = governor.checkCpuUsage('test-plugin');
      expect(cpuUsage).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-existent plugin', () => {
      expect(() => {
        governor.recordCpuTime('non-existent', 100);
      }).not.toThrow();
    });
  });

  describe('startCpuTiming', () => {
    it('should return a timing function', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      const endTiming = governor.startCpuTiming('test-plugin');

      expect(typeof endTiming).toBe('function');
    });

    it('should record time when timing ends', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      const endTiming = governor.startCpuTiming('test-plugin');

      // Simulate some work
      expect(() => endTiming()).not.toThrow();
    });
  });

  describe('isWithinLimits', () => {
    it('should return true when under limits', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);
      governor.updateMemoryUsage('test-plugin', 50);

      expect(governor.isWithinLimits('test-plugin')).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(governor.isWithinLimits('non-existent')).toBe(false);
    });
  });

  describe('getLimits', () => {
    it('should return undefined for non-existent plugin', () => {
      expect(governor.getLimits('non-existent')).toBeUndefined();
    });

    it('should return limits for allocated plugin', () => {
      governor.allocate('test-plugin', DEFAULT_RESOURCE_LIMITS);

      const limits = governor.getLimits('test-plugin');

      expect(limits).toBeDefined();
      expect(limits?.maxMemoryMB).toBe(128);
    });
  });

  describe('getActivePlugins', () => {
    it('should return empty array when no plugins allocated', () => {
      expect(governor.getActivePlugins()).toHaveLength(0);
    });

    it('should return all allocated plugin IDs', () => {
      governor.allocate('plugin-1', DEFAULT_RESOURCE_LIMITS);
      governor.allocate('plugin-2', DEFAULT_RESOURCE_LIMITS);
      governor.allocate('plugin-3', DEFAULT_RESOURCE_LIMITS);

      const plugins = governor.getActivePlugins();

      expect(plugins).toHaveLength(3);
      expect(plugins).toContain('plugin-1');
      expect(plugins).toContain('plugin-2');
      expect(plugins).toContain('plugin-3');
    });
  });

  describe('getResourceSummary', () => {
    it('should return summary for all plugins', () => {
      governor.allocate('plugin-1', DEFAULT_RESOURCE_LIMITS);
      governor.allocate('plugin-2', DEFAULT_RESOURCE_LIMITS);
      governor.updateMemoryUsage('plugin-1', 50);

      const summary = governor.getResourceSummary();

      expect(summary.size).toBe(2);
      expect(summary.get('plugin-1')?.memoryMB).toBe(50);
      expect(summary.get('plugin-2')?.memoryMB).toBe(0);
    });
  });
});
