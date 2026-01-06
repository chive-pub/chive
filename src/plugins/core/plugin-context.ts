/**
 * Factory for creating plugin contexts with scoped dependencies.
 *
 * @remarks
 * This module provides a factory for creating IPluginContext instances
 * with properly scoped and permission-enforced dependencies for each plugin.
 *
 * Each plugin receives:
 * - Prefixed logger (with plugin ID in context)
 * - Prefixed cache (keys namespaced to plugin)
 * - Labeled metrics (with plugin ID label)
 * - Scoped event bus (with permission enforcement)
 *
 * @packageDocumentation
 * @public
 */

import { singleton, inject } from 'tsyringe';

import type { ICacheProvider } from '../../types/interfaces/cache.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IMetrics } from '../../types/interfaces/metrics.interface.js';
import {
  type IPluginContext,
  type IPluginManifest,
  type IPluginEventBus,
  PluginState,
} from '../../types/interfaces/plugin.interface.js';
import { PermissionEnforcer } from '../sandbox/permission-enforcer.js';

import { PluginEventBus } from './event-bus.js';
import { ScopedPluginEventBus } from './scoped-event-bus.js';

/**
 * Factory for creating plugin contexts.
 *
 * @remarks
 * Creates IPluginContext instances with scoped dependencies for each plugin.
 * All services are automatically prefixed/labeled with the plugin ID for
 * proper isolation and observability.
 *
 * @example
 * ```typescript
 * const factory = container.resolve(PluginContextFactory);
 *
 * const context = factory.createContext(manifest, config);
 *
 * // Context is ready to be passed to plugin.initialize()
 * await plugin.initialize(context);
 * ```
 *
 * @public
 */
@singleton()
export class PluginContextFactory {
  /**
   * Base logger instance.
   */
  private readonly logger: ILogger;

  /**
   * Base cache provider.
   */
  private readonly cache: ICacheProvider;

  /**
   * Base metrics provider.
   */
  private readonly metrics: IMetrics;

  /**
   * Main event bus.
   */
  private readonly eventBus: PluginEventBus;

  /**
   * Permission enforcer.
   */
  private readonly permissionEnforcer: PermissionEnforcer;

  /**
   * Map of plugin IDs to their scoped event buses.
   */
  private readonly scopedEventBuses = new Map<string, ScopedPluginEventBus>();

  /**
   * Creates a new PluginContextFactory.
   *
   * @param logger - Base logger instance
   * @param cache - Base cache provider
   * @param metrics - Base metrics provider
   * @param eventBus - Main plugin event bus
   * @param permissionEnforcer - Permission enforcer instance
   */
  constructor(
    @inject('ILogger') logger: ILogger,
    @inject('ICacheProvider') cache: ICacheProvider,
    @inject('IMetrics') metrics: IMetrics,
    @inject(PluginEventBus) eventBus: PluginEventBus,
    @inject(PermissionEnforcer) permissionEnforcer: PermissionEnforcer
  ) {
    this.logger = logger;
    this.cache = cache;
    this.metrics = metrics;
    this.eventBus = eventBus;
    this.permissionEnforcer = permissionEnforcer;
  }

  /**
   * Creates a context for a plugin.
   *
   * @param manifest - Plugin manifest
   * @param config - Plugin-specific configuration
   * @returns Plugin context with scoped dependencies
   *
   * @example
   * ```typescript
   * const context = factory.createContext(manifest, {
   *   apiKey: 'xxx',
   *   enableFeature: true,
   * });
   * ```
   *
   * @public
   */
  createContext(manifest: IPluginManifest, config: Record<string, unknown>): IPluginContext {
    // Create scoped logger with plugin ID
    const scopedLogger = this.createScopedLogger(manifest);

    // Create scoped cache with key prefix
    const scopedCache = this.createScopedCache(manifest);

    // Create scoped metrics with labels
    const scopedMetrics = this.createScopedMetrics(manifest);

    // Create scoped event bus with permission enforcement
    const scopedEventBus = this.createScopedEventBus(manifest);

    return {
      logger: scopedLogger,
      cache: scopedCache,
      metrics: scopedMetrics,
      eventBus: scopedEventBus,
      config,
    };
  }

  /**
   * Cleans up resources for a plugin.
   *
   * @param pluginId - ID of plugin to clean up
   *
   * @remarks
   * Called when a plugin is unloaded to clean up:
   * - Event bus subscriptions
   * - Storage usage tracking
   *
   * @public
   */
  cleanup(pluginId: string): void {
    // Clean up scoped event bus
    const scopedEventBus = this.scopedEventBuses.get(pluginId);
    if (scopedEventBus) {
      scopedEventBus.cleanup();
      this.scopedEventBuses.delete(pluginId);
    }

    // Reset storage usage
    this.permissionEnforcer.resetStorageUsage(pluginId);
  }

  /**
   * Gets the scoped event bus for a plugin.
   *
   * @param pluginId - Plugin ID
   * @returns Scoped event bus or undefined
   *
   * @public
   */
  getScopedEventBus(pluginId: string): ScopedPluginEventBus | undefined {
    return this.scopedEventBuses.get(pluginId);
  }

  /**
   * Creates a scoped logger for a plugin.
   *
   * @param manifest - Plugin manifest
   * @returns Scoped logger instance
   *
   * @internal
   */
  private createScopedLogger(manifest: IPluginManifest): ILogger {
    return this.logger.child({
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      component: 'Plugin',
    });
  }

  /**
   * Creates a scoped cache for a plugin.
   *
   * @param manifest - Plugin manifest
   * @returns Scoped cache provider
   *
   * @internal
   */
  private createScopedCache(manifest: IPluginManifest): ICacheProvider {
    const prefix = `plugin:${manifest.id}:`;
    const baseCache = this.cache;
    const enforcer = this.permissionEnforcer;
    const pluginId = manifest.id;

    // Create a mock plugin for permission checks
    const mockPlugin = {
      id: manifest.id,
      manifest,
      initialize: (): Promise<void> => Promise.resolve(),
      shutdown: (): Promise<void> => Promise.resolve(),
      getState: (): PluginState => PluginState.READY,
    };

    return {
      async get<T>(key: string): Promise<T | null> {
        return baseCache.get<T>(`${prefix}${key}`);
      },

      async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        // Estimate size for quota enforcement
        const size = JSON.stringify(value).length;
        enforcer.enforceStorageLimit(mockPlugin, size);
        return baseCache.set(`${prefix}${key}`, value, ttl);
      },

      async delete(key: string): Promise<void> {
        // Try to get current value to calculate size for quota decrease
        const current = await baseCache.get<unknown>(`${prefix}${key}`);
        if (current !== null) {
          const size = JSON.stringify(current).length;
          enforcer.decreaseStorageUsage(pluginId, size);
        }
        return baseCache.delete(`${prefix}${key}`);
      },

      async exists(key: string): Promise<boolean> {
        return baseCache.exists(`${prefix}${key}`);
      },

      async expire(key: string, ttl: number): Promise<void> {
        return baseCache.expire(`${prefix}${key}`, ttl);
      },
    };
  }

  /**
   * Creates scoped metrics for a plugin.
   *
   * @param manifest - Plugin manifest
   * @returns Scoped metrics provider
   *
   * @internal
   */
  private createScopedMetrics(manifest: IPluginManifest): IMetrics {
    const baseMetrics = this.metrics;
    const defaultLabels = { plugin_id: manifest.id };

    return {
      incrementCounter(name: string, labels?: Record<string, string>, value?: number): void {
        baseMetrics.incrementCounter(`plugin_${name}`, { ...defaultLabels, ...labels }, value);
      },

      setGauge(name: string, value: number, labels?: Record<string, string>): void {
        baseMetrics.setGauge(`plugin_${name}`, value, { ...defaultLabels, ...labels });
      },

      observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
        baseMetrics.observeHistogram(`plugin_${name}`, value, { ...defaultLabels, ...labels });
      },

      startTimer(name: string, labels?: Record<string, string>): () => void {
        return baseMetrics.startTimer(`plugin_${name}`, { ...defaultLabels, ...labels });
      },
    };
  }

  /**
   * Creates a scoped event bus for a plugin.
   *
   * @param manifest - Plugin manifest
   * @returns Scoped event bus with permission enforcement
   *
   * @internal
   */
  private createScopedEventBus(manifest: IPluginManifest): IPluginEventBus {
    const scopedEventBus = new ScopedPluginEventBus(this.eventBus, manifest);
    this.scopedEventBuses.set(manifest.id, scopedEventBus);
    return scopedEventBus;
  }
}
