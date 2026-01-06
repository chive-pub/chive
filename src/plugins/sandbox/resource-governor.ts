/**
 * Resource limits management for plugins.
 *
 * @remarks
 * This module tracks and enforces CPU and memory limits per plugin.
 * It works in conjunction with the sandbox to ensure plugins don't
 * consume excessive resources.
 *
 * @packageDocumentation
 * @public
 */

import { singleton, inject } from 'tsyringe';

import { SandboxViolationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IResourceGovernor, ResourceLimits } from '../../types/interfaces/plugin.interface.js';

/**
 * Resource allocation entry for a plugin.
 *
 * @internal
 */
interface ResourceAllocation {
  /**
   * Plugin ID.
   */
  pluginId: string;

  /**
   * Configured resource limits.
   */
  limits: ResourceLimits;

  /**
   * Current memory usage in MB.
   */
  currentMemoryMB: number;

  /**
   * CPU usage start time for current operation.
   */
  cpuStartTime: number;

  /**
   * Total CPU time used in current period (ms).
   */
  cpuTimeUsedMs: number;

  /**
   * Period start time for CPU tracking.
   */
  periodStartTime: number;
}

/**
 * Default resource limits for plugins.
 *
 * @public
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  /**
   * Default memory limit in megabytes.
   */
  maxMemoryMB: 128,

  /**
   * Default CPU percentage limit.
   */
  maxCpuPercent: 10,

  /**
   * Default execution time limit in milliseconds.
   */
  maxExecutionTimeMs: 5000,
} as const;

/**
 * CPU tracking period in milliseconds (1 minute).
 *
 * @internal
 */
const CPU_PERIOD_MS = 60_000;

/**
 * Minimum elapsed time for CPU percentage calculation.
 *
 * @remarks
 * When the period has just started, CPU usage calculations can be misleading.
 * For example, using 1ms of CPU in the first 1ms gives 100% usage.
 * We require at least this much elapsed time before enforcing CPU limits.
 *
 * @internal
 */
const MIN_PERIOD_FOR_CPU_CHECK_MS = 100;

/**
 * Resource governor implementation.
 *
 * @remarks
 * Tracks and enforces resource limits per plugin:
 * - Memory: Hard limit enforced per plugin
 * - CPU: Percentage of time limit over rolling period
 * - Execution time: Per-request timeout
 *
 * @example
 * ```typescript
 * const governor = container.resolve(ResourceGovernor);
 *
 * // Allocate resources for plugin
 * governor.allocate('my-plugin', {
 *   maxMemoryMB: 128,
 *   maxCpuPercent: 10,
 *   maxExecutionTimeMs: 5000,
 * });
 *
 * // Check if within limits
 * if (governor.isWithinLimits('my-plugin')) {
 *   // Safe to execute
 * }
 *
 * // Update usage
 * governor.updateMemoryUsage('my-plugin', 64);
 *
 * // Release when done
 * governor.release('my-plugin');
 * ```
 *
 * @public
 */
@singleton()
export class ResourceGovernor implements IResourceGovernor {
  /**
   * Resource allocations per plugin.
   */
  private readonly allocations = new Map<string, ResourceAllocation>();

  /**
   * Logger instance.
   */
  private readonly logger: ILogger;

  /**
   * Creates a new ResourceGovernor.
   *
   * @param logger - Logger instance
   */
  constructor(@inject('ILogger') logger: ILogger) {
    this.logger = logger.child({ component: 'ResourceGovernor' });
  }

  /**
   * Allocates resources for a plugin.
   *
   * @param pluginId - Plugin ID
   * @param limits - Resource limits to apply
   *
   * @example
   * ```typescript
   * governor.allocate('my-plugin', {
   *   maxMemoryMB: 128,
   *   maxCpuPercent: 10,
   *   maxExecutionTimeMs: 5000,
   * });
   * ```
   *
   * @public
   */
  allocate(pluginId: string, limits: ResourceLimits): void {
    const now = Date.now();

    this.allocations.set(pluginId, {
      pluginId,
      limits,
      currentMemoryMB: 0,
      cpuStartTime: now,
      cpuTimeUsedMs: 0,
      periodStartTime: now,
    });

    this.logger.debug('Resources allocated', {
      pluginId,
      limits,
    });
  }

  /**
   * Gets current memory usage for a plugin.
   *
   * @param pluginId - Plugin ID
   * @returns Memory usage in MB
   *
   * @public
   */
  checkMemoryUsage(pluginId: string): number {
    return this.allocations.get(pluginId)?.currentMemoryMB ?? 0;
  }

  /**
   * Gets current CPU usage for a plugin.
   *
   * @param pluginId - Plugin ID
   * @returns CPU usage percentage
   *
   * @remarks
   * CPU usage is calculated as percentage of time used over the
   * current period (1 minute rolling window).
   *
   * @public
   */
  checkCpuUsage(pluginId: string): number {
    const allocation = this.allocations.get(pluginId);
    if (!allocation) {
      return 0;
    }

    this.refreshPeriod(allocation);

    const periodElapsed = Date.now() - allocation.periodStartTime;

    // Use minimum period for calculation to avoid false positives
    // when the period has just started
    const effectivePeriod = Math.max(periodElapsed, MIN_PERIOD_FOR_CPU_CHECK_MS);

    return (allocation.cpuTimeUsedMs / effectivePeriod) * 100;
  }

  /**
   * Releases resources for a plugin.
   *
   * @param pluginId - Plugin ID
   *
   * @public
   */
  release(pluginId: string): void {
    const allocation = this.allocations.get(pluginId);
    if (allocation) {
      this.allocations.delete(pluginId);

      this.logger.debug('Resources released', {
        pluginId,
        finalMemoryMB: allocation.currentMemoryMB,
        totalCpuTimeMs: allocation.cpuTimeUsedMs,
      });
    }
  }

  /**
   * Checks if a plugin is within its resource limits.
   *
   * @param pluginId - Plugin ID
   * @returns True if within limits
   *
   * @public
   */
  isWithinLimits(pluginId: string): boolean {
    const allocation = this.allocations.get(pluginId);
    if (!allocation) {
      return false;
    }

    // Check memory
    if (allocation.currentMemoryMB > allocation.limits.maxMemoryMB) {
      return false;
    }

    // Check CPU
    const cpuPercent = this.checkCpuUsage(pluginId);
    if (cpuPercent > allocation.limits.maxCpuPercent) {
      return false;
    }

    return true;
  }

  /**
   * Updates memory usage for a plugin.
   *
   * @param pluginId - Plugin ID
   * @param memoryMB - Current memory usage in MB
   * @throws {SandboxViolationError} If limit exceeded
   *
   * @public
   */
  updateMemoryUsage(pluginId: string, memoryMB: number): void {
    const allocation = this.allocations.get(pluginId);
    if (!allocation) {
      this.logger.warn('No allocation found for plugin', { pluginId });
      return;
    }

    allocation.currentMemoryMB = memoryMB;

    // Check if limit exceeded
    if (memoryMB > allocation.limits.maxMemoryMB) {
      this.logger.warn('Memory limit exceeded', {
        pluginId,
        memoryMB,
        limit: allocation.limits.maxMemoryMB,
      });

      throw new SandboxViolationError(
        pluginId,
        'MEMORY',
        `Memory limit exceeded: ${memoryMB}MB > ${allocation.limits.maxMemoryMB}MB`
      );
    }

    // Warn if approaching limit (90%)
    const threshold = allocation.limits.maxMemoryMB * 0.9;
    if (memoryMB > threshold) {
      this.logger.warn('Memory usage high', {
        pluginId,
        memoryMB,
        threshold,
        limit: allocation.limits.maxMemoryMB,
      });
    }
  }

  /**
   * Records CPU time for a plugin operation.
   *
   * @param pluginId - Plugin ID
   * @param durationMs - Duration of operation in milliseconds
   *
   * @remarks
   * Call this after each operation to track CPU time usage.
   *
   * @public
   */
  recordCpuTime(pluginId: string, durationMs: number): void {
    const allocation = this.allocations.get(pluginId);
    if (!allocation) {
      return;
    }

    this.refreshPeriod(allocation);
    allocation.cpuTimeUsedMs += durationMs;

    // Check if limit exceeded
    const cpuPercent = this.checkCpuUsage(pluginId);
    if (cpuPercent > allocation.limits.maxCpuPercent) {
      this.logger.warn('CPU limit exceeded', {
        pluginId,
        cpuPercent,
        limit: allocation.limits.maxCpuPercent,
      });

      throw new SandboxViolationError(
        pluginId,
        'CPU',
        `CPU limit exceeded: ${cpuPercent.toFixed(1)}% > ${allocation.limits.maxCpuPercent}%`
      );
    }
  }

  /**
   * Starts timing a CPU operation.
   *
   * @param pluginId - Plugin ID
   * @returns Function to call when operation completes
   *
   * @example
   * ```typescript
   * const endTiming = governor.startCpuTiming('my-plugin');
   * // ... do work ...
   * endTiming(); // Records CPU time
   * ```
   *
   * @public
   */
  startCpuTiming(pluginId: string): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.recordCpuTime(pluginId, duration);
    };
  }

  /**
   * Gets resource limits for a plugin.
   *
   * @param pluginId - Plugin ID
   * @returns Resource limits or undefined if not allocated
   *
   * @public
   */
  getLimits(pluginId: string): ResourceLimits | undefined {
    return this.allocations.get(pluginId)?.limits;
  }

  /**
   * Gets all plugin IDs with active allocations.
   *
   * @returns Array of plugin IDs
   *
   * @public
   */
  getActivePlugins(): readonly string[] {
    return Array.from(this.allocations.keys());
  }

  /**
   * Gets resource summary for all plugins.
   *
   * @returns Map of plugin ID to resource usage
   *
   * @public
   */
  getResourceSummary(): Map<string, { memoryMB: number; cpuPercent: number }> {
    const summary = new Map<string, { memoryMB: number; cpuPercent: number }>();

    for (const [pluginId, allocation] of this.allocations) {
      summary.set(pluginId, {
        memoryMB: allocation.currentMemoryMB,
        cpuPercent: this.checkCpuUsage(pluginId),
      });
    }

    return summary;
  }

  /**
   * Refreshes the CPU tracking period if needed.
   *
   * @param allocation - Resource allocation to refresh
   *
   * @internal
   */
  private refreshPeriod(allocation: ResourceAllocation): void {
    const now = Date.now();
    const periodAge = now - allocation.periodStartTime;

    // Reset period if older than CPU_PERIOD_MS
    if (periodAge >= CPU_PERIOD_MS) {
      allocation.periodStartTime = now;
      allocation.cpuTimeUsedMs = 0;
    }
  }
}
