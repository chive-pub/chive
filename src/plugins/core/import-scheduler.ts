/**
 * Import scheduler for periodic eprint imports from external sources.
 *
 * @remarks
 * This module provides scheduling infrastructure for plugins that require
 * periodic bulk imports (sources without search APIs like LingBuzz and
 * Semantics Archive).
 *
 * Search-enabled plugins (arXiv, OpenReview, PsyArXiv) do NOT use this
 * scheduler as they support on-demand search via the SearchablePlugin interface.
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { PluginError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { ImportingPlugin as IImportingPlugin } from '../../types/interfaces/plugin.interface.js';

import type { ImportingPlugin } from './importing-plugin.js';
import type { ImportCycleResult } from './importing-plugin.js';

/**
 * Configuration for scheduling a plugin's import cycles.
 *
 * @public
 */
export interface PluginScheduleConfig {
  /**
   * The importing plugin instance to schedule.
   *
   * @remarks
   * Must implement the ImportingPlugin abstract class with fetchEprints().
   */
  readonly plugin: ImportingPlugin;

  /**
   * Interval between import cycles in milliseconds.
   *
   * @remarks
   * Recommended intervals:
   * - 12 hours (43200000ms) for sources with infrequent updates
   * - 6 hours (21600000ms) for sources with moderate updates
   * - 1 hour (3600000ms) for high-frequency sources
   *
   * Consider the source's rate limits and update frequency.
   * Minimum value: 60000ms (1 minute).
   */
  readonly intervalMs: number;

  /**
   * Whether to run an import cycle immediately on schedule registration.
   *
   * @remarks
   * Set to true for system startup to populate initial data.
   * Set to false if data was recently imported.
   *
   * @defaultValue false
   */
  readonly runOnStart?: boolean;

  /**
   * Maximum duration for an import cycle before timeout.
   *
   * @remarks
   * If an import cycle exceeds this duration, it will be marked as failed
   * but not forcibly terminated. The next scheduled cycle will run on time.
   *
   * @defaultValue 3600000 (1 hour)
   */
  readonly timeoutMs?: number;
}

/**
 * State of a scheduled plugin's import cycles.
 *
 * @public
 */
export interface ScheduledPluginState {
  /**
   * Plugin identifier.
   */
  readonly pluginId: string;

  /**
   * Timestamp of the last completed import cycle.
   */
  lastRunAt: Date | null;

  /**
   * Timestamp of the next scheduled import cycle.
   */
  nextRunAt: Date;

  /**
   * Whether an import cycle is currently running.
   */
  isRunning: boolean;

  /**
   * Total number of import cycles completed.
   */
  cyclesCompleted: number;

  /**
   * Total number of import cycles that failed.
   */
  cyclesFailed: number;

  /**
   * Result of the last import cycle.
   */
  lastResult: ImportCycleResult | null;
}

/**
 * Options for initializing the ImportScheduler.
 *
 * @public
 */
export interface ImportSchedulerOptions {
  /**
   * Logger instance for structured logging.
   */
  readonly logger: ILogger;
}

/**
 * Import scheduler for periodic eprint imports.
 *
 * @remarks
 * Manages scheduled import cycles for plugins that require periodic bulk
 * imports (plugins without search API support).
 *
 * Features:
 * - Configurable per-plugin intervals
 * - Prevents overlapping import cycles for the same plugin
 * - Tracks import statistics and state
 * - Graceful shutdown with cycle completion
 *
 * @example
 * Basic usage with LingBuzz and Semantics Archive plugins:
 * ```typescript
 * const scheduler = new ImportScheduler({ logger });
 *
 * scheduler.schedulePlugin({
 *   plugin: lingbuzzPlugin,
 *   intervalMs: 12 * 60 * 60 * 1000, // 12 hours
 *   runOnStart: true,
 * });
 *
 * scheduler.schedulePlugin({
 *   plugin: semanticsArchivePlugin,
 *   intervalMs: 12 * 60 * 60 * 1000, // 12 hours
 *   runOnStart: true,
 * });
 *
 * // On shutdown
 * await scheduler.stopAll();
 * ```
 *
 * @public
 * @since 0.1.0
 */
export class ImportScheduler {
  /**
   * Active interval timers keyed by plugin ID.
   */
  private readonly schedulers = new Map<string, NodeJS.Timeout>();

  /**
   * State tracking for each scheduled plugin.
   */
  private readonly pluginStates = new Map<string, ScheduledPluginState>();

  /**
   * Plugin instances keyed by plugin ID.
   */
  private readonly plugins = new Map<string, ImportingPlugin>();

  /**
   * Configuration for each scheduled plugin.
   */
  private readonly configs = new Map<string, PluginScheduleConfig>();

  /**
   * Logger instance.
   */
  private readonly logger: ILogger;

  /**
   * Whether the scheduler is shutting down.
   */
  private isShuttingDown = false;

  /**
   * Creates a new ImportScheduler.
   *
   * @param options - Scheduler options including logger
   */
  constructor(options: ImportSchedulerOptions) {
    this.logger = options.logger.child({ component: 'ImportScheduler' });
  }

  /**
   * Schedules periodic import cycles for a plugin.
   *
   * @param config - Schedule configuration
   *
   * @remarks
   * If the plugin is already scheduled, the existing schedule is replaced.
   * Use `unschedulePlugin()` first if you need to stop the existing schedule
   * without starting a new one.
   *
   * @throws PluginError if the plugin is not a valid ImportingPlugin
   *
   * @example
   * ```typescript
   * scheduler.schedulePlugin({
   *   plugin: lingbuzzPlugin,
   *   intervalMs: 43200000, // 12 hours
   *   runOnStart: true,
   *   timeoutMs: 3600000, // 1 hour timeout
   * });
   * ```
   */
  schedulePlugin(config: PluginScheduleConfig): void {
    if (this.isShuttingDown) {
      this.logger.warn('Cannot schedule plugin during shutdown', {
        pluginId: config.plugin.id,
      });
      return;
    }

    const pluginId = config.plugin.id;

    // Validate plugin has fetchEprints method (ImportingPlugin)
    if (!this.isImportingPlugin(config.plugin)) {
      throw new PluginError(
        pluginId,
        'INITIALIZE',
        'Plugin does not implement ImportingPlugin interface (missing fetchEprints method)'
      );
    }

    // Validate interval
    if (config.intervalMs < 60000) {
      throw new PluginError(
        pluginId,
        'INITIALIZE',
        `Import interval must be at least 60000ms (1 minute), got ${config.intervalMs}ms`
      );
    }

    // Unschedule existing if present
    if (this.schedulers.has(pluginId)) {
      this.unschedulePlugin(pluginId);
    }

    // Store plugin and config
    this.plugins.set(pluginId, config.plugin);
    this.configs.set(pluginId, config);

    // Initialize state
    const now = new Date();
    const state: ScheduledPluginState = {
      pluginId,
      lastRunAt: null,
      nextRunAt: config.runOnStart ? now : new Date(now.getTime() + config.intervalMs),
      isRunning: false,
      cyclesCompleted: 0,
      cyclesFailed: 0,
      lastResult: null,
    };
    this.pluginStates.set(pluginId, state);

    // Run immediately if configured
    if (config.runOnStart) {
      void this.runImportCycle(pluginId);
    }

    // Schedule recurring imports
    const intervalId = setInterval(() => {
      void this.runImportCycle(pluginId);
    }, config.intervalMs);

    this.schedulers.set(pluginId, intervalId);

    this.logger.info('Plugin scheduled for periodic imports', {
      pluginId,
      intervalMs: config.intervalMs,
      runOnStart: config.runOnStart ?? false,
      nextRunAt: state.nextRunAt.toISOString(),
    });
  }

  /**
   * Unschedules a plugin's import cycles.
   *
   * @param pluginId - ID of the plugin to unschedule
   * @returns True if the plugin was scheduled and removed, false otherwise
   *
   * @remarks
   * Does not interrupt a currently running import cycle.
   * The running cycle will complete but no new cycles will start.
   */
  unschedulePlugin(pluginId: string): boolean {
    const intervalId = this.schedulers.get(pluginId);
    if (!intervalId) {
      return false;
    }

    clearInterval(intervalId);
    this.schedulers.delete(pluginId);

    this.logger.info('Plugin unscheduled', { pluginId });

    return true;
  }

  /**
   * Stops all scheduled import cycles.
   *
   * @remarks
   * Clears all interval timers but does not interrupt running cycles.
   * Running cycles will complete naturally.
   *
   * Call this during application shutdown to ensure clean termination.
   *
   * @example
   * ```typescript
   * // In shutdown handler
   * process.on('SIGTERM', async () => {
   *   await scheduler.stopAll();
   *   process.exit(0);
   * });
   * ```
   */
  async stopAll(): Promise<void> {
    this.isShuttingDown = true;

    const pluginIds = [...this.schedulers.keys()];

    for (const pluginId of pluginIds) {
      const intervalId = this.schedulers.get(pluginId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    }

    this.schedulers.clear();

    this.logger.info('All plugin schedules stopped', {
      pluginCount: pluginIds.length,
      pluginIds,
    });

    // Wait for any running cycles to complete (with timeout)
    const runningPlugins = [...this.pluginStates.values()].filter((s) => s.isRunning);
    if (runningPlugins.length > 0) {
      this.logger.info('Waiting for running import cycles to complete', {
        runningCount: runningPlugins.length,
        pluginIds: runningPlugins.map((s) => s.pluginId),
      });

      // Wait up to 60 seconds for running cycles
      const maxWaitMs = 60000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        const stillRunning = [...this.pluginStates.values()].filter((s) => s.isRunning);
        if (stillRunning.length === 0) {
          break;
        }
        await this.sleep(1000);
      }

      const finalRunning = [...this.pluginStates.values()].filter((s) => s.isRunning);
      if (finalRunning.length > 0) {
        this.logger.warn('Some import cycles did not complete before shutdown timeout', {
          pluginIds: finalRunning.map((s) => s.pluginId),
        });
      }
    }
  }

  /**
   * Gets the state of a scheduled plugin.
   *
   * @param pluginId - ID of the plugin
   * @returns Plugin state or null if not scheduled
   */
  getPluginState(pluginId: string): Readonly<ScheduledPluginState> | null {
    const state = this.pluginStates.get(pluginId);
    return state ?? null;
  }

  /**
   * Gets the state of all scheduled plugins.
   *
   * @returns Array of plugin states
   */
  getAllPluginStates(): readonly Readonly<ScheduledPluginState>[] {
    return [...this.pluginStates.values()];
  }

  /**
   * Gets the IDs of all scheduled plugins.
   *
   * @returns Array of plugin IDs
   */
  getScheduledPluginIds(): readonly string[] {
    return [...this.schedulers.keys()];
  }

  /**
   * Checks if a plugin is currently scheduled.
   *
   * @param pluginId - ID of the plugin
   * @returns True if scheduled, false otherwise
   */
  isPluginScheduled(pluginId: string): boolean {
    return this.schedulers.has(pluginId);
  }

  /**
   * Manually triggers an import cycle for a scheduled plugin.
   *
   * @param pluginId - ID of the plugin
   * @returns Result of the import cycle
   *
   * @remarks
   * Useful for testing or manual refresh. Does not affect the
   * regular schedule (next scheduled run will still occur on time).
   *
   * @throws PluginError if plugin is not scheduled
   * @throws PluginError if an import cycle is already running for this plugin
   */
  async triggerImportCycle(pluginId: string): Promise<ImportCycleResult> {
    if (!this.plugins.has(pluginId)) {
      throw new PluginError(pluginId, 'EXECUTE', `Plugin ${pluginId} is not scheduled`);
    }

    const state = this.pluginStates.get(pluginId);
    if (state?.isRunning) {
      throw new PluginError(
        pluginId,
        'EXECUTE',
        `Import cycle already running for plugin ${pluginId}`
      );
    }

    return this.runImportCycle(pluginId);
  }

  /**
   * Runs an import cycle for a plugin.
   *
   * @param pluginId - ID of the plugin
   * @returns Result of the import cycle
   */
  private async runImportCycle(pluginId: string): Promise<ImportCycleResult> {
    const plugin = this.plugins.get(pluginId);
    const state = this.pluginStates.get(pluginId);
    const config = this.configs.get(pluginId);

    if (!plugin || !state || !config) {
      throw new PluginError(pluginId, 'EXECUTE', `Plugin ${pluginId} not found in scheduler`);
    }

    // Skip if already running (prevent overlapping cycles)
    if (state.isRunning) {
      this.logger.debug('Skipping import cycle, previous cycle still running', {
        pluginId,
      });
      return {
        totalFetched: 0,
        newImports: 0,
        updated: 0,
        errors: 0,
        startedAt: new Date(),
        completedAt: new Date(),
      };
    }

    // Update state
    state.isRunning = true;
    const startTime = Date.now();

    this.logger.info('Starting import cycle', {
      pluginId,
      cycleNumber: state.cyclesCompleted + 1,
    });

    try {
      // Run import with optional timeout
      const timeoutMs = config.timeoutMs ?? 3600000;
      const result = await this.runWithTimeout(plugin.runImportCycle(), timeoutMs, pluginId);

      // Update state on success
      state.lastRunAt = new Date();
      state.nextRunAt = new Date(Date.now() + config.intervalMs);
      state.cyclesCompleted++;
      state.lastResult = result;
      state.isRunning = false;

      this.logger.info('Import cycle completed', {
        pluginId,
        durationMs: Date.now() - startTime,
        totalFetched: result.totalFetched,
        newImports: result.newImports,
        updated: result.updated,
        errors: result.errors,
      });

      return result;
    } catch (err) {
      // Update state on failure
      state.cyclesFailed++;
      state.isRunning = false;
      state.lastRunAt = new Date();
      state.nextRunAt = new Date(Date.now() + config.intervalMs);

      const error = err instanceof Error ? err : new Error(String(err));

      this.logger.error('Import cycle failed', error, {
        pluginId,
        durationMs: Date.now() - startTime,
        cyclesFailed: state.cyclesFailed,
      });

      // Return empty result on failure
      return {
        totalFetched: 0,
        newImports: 0,
        updated: 0,
        errors: 1,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      };
    }
  }

  /**
   * Runs a promise with a timeout.
   *
   * @param promise - Promise to run
   * @param timeoutMs - Timeout in milliseconds
   * @param pluginId - Plugin ID for error context
   * @returns Result of the promise
   * @throws PluginError if timeout exceeded
   */
  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    pluginId: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new PluginError(pluginId, 'EXECUTE', `Import cycle exceeded timeout of ${timeoutMs}ms`)
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Type guard for ImportingPlugin interface.
   *
   * @param plugin - Plugin to check
   * @returns True if plugin implements ImportingPlugin
   */
  private isImportingPlugin(plugin: unknown): plugin is ImportingPlugin {
    return (
      typeof plugin === 'object' &&
      plugin !== null &&
      'fetchEprints' in plugin &&
      typeof (plugin as IImportingPlugin).fetchEprints === 'function' &&
      'runImportCycle' in plugin &&
      typeof (plugin as ImportingPlugin).runImportCycle === 'function'
    );
  }

  /**
   * Sleeps for a specified duration.
   *
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ImportScheduler;
