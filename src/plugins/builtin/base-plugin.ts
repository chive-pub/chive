/**
 * Base class for builtin plugins.
 *
 * @remarks
 * This module provides a base class for Chive's builtin plugins,
 * implementing common functionality and reducing boilerplate.
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { PluginError } from '../../types/errors.js';
import type { ICacheProvider } from '../../types/interfaces/cache.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IMetrics } from '../../types/interfaces/metrics.interface.js';
import {
  type IChivePlugin,
  type IPluginContext,
  type IPluginManifest,
  PluginState,
} from '../../types/interfaces/plugin.interface.js';

/**
 * Base class for builtin plugins.
 *
 * @remarks
 * Provides common functionality for Chive's builtin plugins:
 * - Lifecycle state management
 * - Logging
 * - Caching
 * - Metrics
 * - Event subscriptions
 *
 * Subclasses should override:
 * - `onInitialize()` - Custom initialization logic
 * - `onShutdown()` - Custom shutdown logic (optional)
 *
 * @example
 * ```typescript
 * export class MyPlugin extends BasePlugin {
 *   readonly id = 'pub.chive.plugin.my';
 *   readonly manifest: IPluginManifest = {
 *     id: 'pub.chive.plugin.my',
 *     name: 'My Plugin',
 *     // ...
 *   };
 *
 *   protected async onInitialize(): Promise<void> {
 *     this.context.eventBus.on('preprint.indexed', this.handleIndexed.bind(this));
 *   }
 *
 *   private async handleIndexed(data: { uri: string }): Promise<void> {
 *     this.logger.info('Preprint indexed', { uri: data.uri });
 *   }
 * }
 * ```
 *
 * @public
 */
export abstract class BasePlugin implements IChivePlugin {
  /**
   * Unique plugin identifier.
   *
   * @remarks
   * Must match `manifest.id`.
   */
  abstract readonly id: string;

  /**
   * Plugin manifest.
   */
  abstract readonly manifest: IPluginManifest;

  /**
   * Plugin context (available after initialization).
   */
  protected context!: IPluginContext;

  /**
   * Logger instance (available after initialization).
   */
  protected logger!: ILogger;

  /**
   * Cache provider (available after initialization).
   */
  protected cache!: ICacheProvider;

  /**
   * Metrics provider (available after initialization).
   */
  protected metrics!: IMetrics;

  /**
   * Current lifecycle state.
   */
  private state: PluginState = PluginState.UNINITIALIZED;

  /**
   * Initializes the plugin.
   *
   * @param context - Plugin context with injected dependencies
   *
   * @remarks
   * Sets up context and calls `onInitialize()`. Subclasses should
   * override `onInitialize()` instead of this method.
   *
   * @public
   */
  async initialize(context: IPluginContext): Promise<void> {
    this.state = PluginState.INITIALIZING;
    this.context = context;
    this.logger = context.logger;
    this.cache = context.cache;
    this.metrics = context.metrics;

    try {
      await this.onInitialize();

      this.state = PluginState.READY;
      this.logger.info('Plugin initialized', {
        pluginId: this.id,
        version: this.manifest.version,
      });
    } catch (err) {
      this.state = PluginState.ERROR;
      this.logger.error('Plugin initialization failed', err as Error);
      throw err;
    }
  }

  /**
   * Shuts down the plugin.
   *
   * @remarks
   * Calls `onShutdown()` and updates state. Subclasses should
   * override `onShutdown()` instead of this method.
   *
   * @public
   */
  async shutdown(): Promise<void> {
    this.state = PluginState.SHUTTING_DOWN;
    this.logger.info('Plugin shutting down');

    try {
      await this.onShutdown();
    } catch (err) {
      this.logger.error('Error during shutdown', err as Error);
    } finally {
      this.state = PluginState.SHUTDOWN;
    }
  }

  /**
   * Gets current plugin state.
   *
   * @returns Current lifecycle state
   *
   * @public
   */
  getState(): PluginState {
    return this.state;
  }

  /**
   * Override in subclass for initialization logic.
   *
   * @remarks
   * Called during `initialize()` after context is set up.
   * Use this to:
   * - Subscribe to event hooks
   * - Initialize plugin state
   * - Validate configuration
   *
   * @example
   * ```typescript
   * protected async onInitialize(): Promise<void> {
   *   // Subscribe to events
   *   this.context.eventBus.on('preprint.indexed', this.handleIndexed.bind(this));
   *
   *   // Load cached state
   *   const state = await this.cache.get('state');
   *   if (state) {
   *     this.restoreState(state);
   *   }
   * }
   * ```
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Override in subclass for shutdown logic.
   *
   * @remarks
   * Called during `shutdown()`. Use this to:
   * - Save state
   * - Close connections
   * - Clean up resources
   *
   * Default implementation does nothing.
   *
   * @example
   * ```typescript
   * protected async onShutdown(): Promise<void> {
   *   await this.saveState();
   *   this.connection?.close();
   * }
   * ```
   */
  protected async onShutdown(): Promise<void> {
    // Default no-op, subclasses can override
  }

  /**
   * Gets a configuration value with type safety.
   *
   * @param key - Configuration key
   * @returns Configuration value or undefined
   *
   * @example
   * ```typescript
   * const apiKey = this.getConfig<string>('apiKey');
   * ```
   */
  protected getConfig<T>(key: string): T | undefined {
    return this.context.config[key] as T | undefined;
  }

  /**
   * Gets a required configuration value.
   *
   * @param key - Configuration key
   * @returns Configuration value
   * @throws Error if key not found
   *
   * @example
   * ```typescript
   * const apiKey = this.getRequiredConfig<string>('apiKey');
   * ```
   */
  protected getRequiredConfig<T>(key: string): T {
    const value = this.context.config[key];
    if (value === undefined) {
      throw new PluginError(this.id, 'INITIALIZE', `Missing required config: ${key}`);
    }
    return value as T;
  }

  /**
   * Records a counter metric.
   *
   * @param name - Metric name
   * @param labels - Optional labels
   * @param value - Optional increment value (default 1)
   */
  protected recordCounter(name: string, labels?: Record<string, string>, value?: number): void {
    this.metrics.incrementCounter(name, labels, value);
  }

  /**
   * Records a gauge metric.
   *
   * @param name - Metric name
   * @param value - Gauge value
   * @param labels - Optional labels
   */
  protected recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.setGauge(name, value, labels);
  }

  /**
   * Starts a timer for histogram metrics.
   *
   * @param name - Metric name
   * @param labels - Optional labels
   * @returns Function to call when operation completes
   *
   * @example
   * ```typescript
   * const endTimer = this.startTimer('api_request');
   * await this.fetchData();
   * endTimer(); // Records duration
   * ```
   */
  protected startTimer(name: string, labels?: Record<string, string>): () => void {
    return this.metrics.startTimer(name, labels);
  }
}
