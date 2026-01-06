/**
 * Plugin lifecycle manager.
 *
 * @remarks
 * This module manages plugin loading, initialization, and shutdown with
 * proper dependency ordering and error handling.
 *
 * @packageDocumentation
 * @public
 */

import { singleton, inject } from 'tsyringe';

import { PluginError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import {
  type IPluginManager,
  type IPluginManifest,
  type IChivePlugin,
  PluginState,
} from '../../types/interfaces/plugin.interface.js';
import { IsolatedVmSandbox } from '../sandbox/isolated-vm-sandbox.js';
import { ResourceGovernor, DEFAULT_RESOURCE_LIMITS } from '../sandbox/resource-governor.js';

import { PluginEventBus } from './event-bus.js';
import { PluginContextFactory } from './plugin-context.js';
import { PluginLoader } from './plugin-loader.js';

/**
 * Loaded plugin entry with state tracking.
 *
 * @internal
 */
interface LoadedPlugin {
  /**
   * Plugin instance.
   */
  plugin: IChivePlugin;

  /**
   * Plugin manifest.
   */
  manifest: IPluginManifest;

  /**
   * Current lifecycle state.
   */
  state: PluginState;

  /**
   * Load timestamp.
   */
  loadedAt: Date;
}

/**
 * Plugin manager implementation.
 *
 * @remarks
 * Manages plugin lifecycle:
 * - Loading from manifests or directly
 * - Dependency resolution and ordering
 * - Initialization with context injection
 * - Shutdown with proper cleanup
 * - Reload support
 *
 * @example
 * ```typescript
 * const manager = container.resolve(PluginManager);
 *
 * // Load plugins from directory
 * await manager.loadPluginsFromDirectory('/opt/chive/plugins');
 *
 * // Load a specific plugin
 * await manager.loadPlugin(manifest);
 *
 * // Get loaded plugins
 * const plugins = manager.getAllPlugins();
 *
 * // Shutdown all
 * await manager.shutdownAll();
 * ```
 *
 * @public
 */
@singleton()
export class PluginManager implements IPluginManager {
  /**
   * Map of plugin IDs to loaded plugins.
   */
  private readonly plugins = new Map<string, LoadedPlugin>();

  /**
   * Logger instance.
   */
  private readonly logger: ILogger;

  /**
   * Plugin loader.
   */
  private readonly loader: PluginLoader;

  /**
   * Context factory.
   */
  private readonly contextFactory: PluginContextFactory;

  /**
   * Event bus.
   */
  private readonly eventBus: PluginEventBus;

  /**
   * Sandbox manager.
   */
  private readonly sandbox: IsolatedVmSandbox;

  /**
   * Resource governor.
   */
  private readonly resourceGovernor: ResourceGovernor;

  /**
   * Plugin configuration store.
   */
  private readonly pluginConfigs = new Map<string, Record<string, unknown>>();

  /**
   * Creates a new PluginManager.
   *
   * @param logger - Logger instance
   * @param loader - Plugin loader
   * @param contextFactory - Context factory
   * @param eventBus - Event bus
   * @param sandbox - Sandbox manager
   * @param resourceGovernor - Resource governor
   */
  constructor(
    @inject('ILogger') logger: ILogger,
    @inject(PluginLoader) loader: PluginLoader,
    @inject(PluginContextFactory) contextFactory: PluginContextFactory,
    @inject(PluginEventBus) eventBus: PluginEventBus,
    @inject(IsolatedVmSandbox) sandbox: IsolatedVmSandbox,
    @inject(ResourceGovernor) resourceGovernor: ResourceGovernor
  ) {
    this.logger = logger.child({ component: 'PluginManager' });
    this.loader = loader;
    this.contextFactory = contextFactory;
    this.eventBus = eventBus;
    this.sandbox = sandbox;
    this.resourceGovernor = resourceGovernor;
  }

  /**
   * Loads and initializes a plugin from its manifest.
   *
   * @param manifest - Plugin manifest
   * @throws {PluginError} If loading or initialization fails
   *
   * @example
   * ```typescript
   * await manager.loadPlugin(manifest);
   * console.log('Plugin loaded:', manifest.id);
   * ```
   *
   * @public
   */
  async loadPlugin(manifest: IPluginManifest): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      throw new PluginError(manifest.id, 'LOAD', `Plugin already loaded: ${manifest.id}`);
    }

    this.logger.info('Loading plugin', {
      pluginId: manifest.id,
      version: manifest.version,
    });

    // Check dependencies
    this.checkDependencies(manifest);

    // Load plugin code
    const plugin = await this.loader.loadPluginCode(manifest);

    // Register plugin
    this.plugins.set(manifest.id, {
      plugin,
      manifest,
      state: PluginState.UNINITIALIZED,
      loadedAt: new Date(),
    });

    // Allocate resources
    this.resourceGovernor.allocate(manifest.id, DEFAULT_RESOURCE_LIMITS);

    // Create context and initialize
    const config = this.pluginConfigs.get(manifest.id) ?? {};
    const context = this.contextFactory.createContext(manifest, config);

    try {
      this.updateState(manifest.id, PluginState.INITIALIZING);

      await plugin.initialize(context);

      this.updateState(manifest.id, PluginState.READY);

      this.logger.info('Plugin loaded successfully', {
        pluginId: manifest.id,
        version: manifest.version,
      });

      // Emit plugin loaded event
      this.eventBus.emit('plugin.loaded', { pluginId: manifest.id });
    } catch (err) {
      this.updateState(manifest.id, PluginState.ERROR);
      this.plugins.delete(manifest.id);
      this.resourceGovernor.release(manifest.id);
      this.contextFactory.cleanup(manifest.id);

      throw new PluginError(
        manifest.id,
        'INITIALIZE',
        `Failed to initialize plugin: ${(err as Error).message}`,
        err as Error
      );
    }
  }

  /**
   * Loads a builtin plugin directly (without manifest file).
   *
   * @param plugin - Plugin instance
   * @param config - Plugin configuration
   *
   * @remarks
   * Used for loading builtin plugins that are bundled with Chive.
   *
   * @example
   * ```typescript
   * const githubPlugin = new GitHubIntegrationPlugin();
   * await manager.loadBuiltinPlugin(githubPlugin, { apiToken: 'xxx' });
   * ```
   *
   * @public
   */
  async loadBuiltinPlugin(
    plugin: IChivePlugin,
    config: Record<string, unknown> = {}
  ): Promise<void> {
    const manifest = plugin.manifest;

    if (this.plugins.has(manifest.id)) {
      throw new PluginError(manifest.id, 'LOAD', `Plugin already loaded: ${manifest.id}`);
    }

    this.logger.info('Loading builtin plugin', {
      pluginId: manifest.id,
      version: manifest.version,
    });

    // Check dependencies
    this.checkDependencies(manifest);

    // Register plugin
    this.plugins.set(manifest.id, {
      plugin,
      manifest,
      state: PluginState.UNINITIALIZED,
      loadedAt: new Date(),
    });

    // Allocate resources
    this.resourceGovernor.allocate(manifest.id, DEFAULT_RESOURCE_LIMITS);

    // Create context and initialize
    const context = this.contextFactory.createContext(manifest, config);

    try {
      this.updateState(manifest.id, PluginState.INITIALIZING);

      await plugin.initialize(context);

      this.updateState(manifest.id, PluginState.READY);

      this.logger.info('Builtin plugin loaded successfully', {
        pluginId: manifest.id,
      });

      this.eventBus.emit('plugin.loaded', { pluginId: manifest.id });
    } catch (err) {
      this.updateState(manifest.id, PluginState.ERROR);
      this.plugins.delete(manifest.id);
      this.resourceGovernor.release(manifest.id);
      this.contextFactory.cleanup(manifest.id);

      throw new PluginError(
        manifest.id,
        'INITIALIZE',
        `Failed to initialize plugin: ${(err as Error).message}`,
        err as Error
      );
    }
  }

  /**
   * Unloads a plugin, calling its shutdown method.
   *
   * @param pluginId - ID of the plugin to unload
   * @throws {PluginError} If plugin not found or shutdown fails
   *
   * @public
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new PluginError(pluginId, 'SHUTDOWN', `Plugin not loaded: ${pluginId}`);
    }

    this.logger.info('Unloading plugin', { pluginId });

    try {
      this.updateState(pluginId, PluginState.SHUTTING_DOWN);

      await entry.plugin.shutdown();

      this.updateState(pluginId, PluginState.SHUTDOWN);
    } catch (err) {
      this.logger.error('Error during plugin shutdown', err as Error, { pluginId });
    } finally {
      this.plugins.delete(pluginId);
      this.resourceGovernor.release(pluginId);
      this.contextFactory.cleanup(pluginId);

      this.eventBus.emit('plugin.unloaded', { pluginId });

      this.logger.info('Plugin unloaded', { pluginId });
    }
  }

  /**
   * Gets a loaded plugin by ID.
   *
   * @param pluginId - ID of the plugin to get
   * @returns Plugin instance or undefined if not loaded
   *
   * @public
   */
  getPlugin(pluginId: string): IChivePlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Gets all loaded plugins.
   *
   * @returns Array of all loaded plugin instances
   *
   * @public
   */
  getAllPlugins(): readonly IChivePlugin[] {
    return Array.from(this.plugins.values()).map((entry) => entry.plugin);
  }

  /**
   * Gets the current state of a plugin.
   *
   * @param pluginId - ID of the plugin
   * @returns Plugin state or undefined if not loaded
   *
   * @public
   */
  getPluginState(pluginId: string): PluginState | undefined {
    return this.plugins.get(pluginId)?.state;
  }

  /**
   * Reloads a plugin (unload then load).
   *
   * @param pluginId - ID of the plugin to reload
   * @throws {PluginError} If reload fails
   *
   * @public
   */
  async reloadPlugin(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new PluginError(pluginId, 'LOAD', `Plugin not loaded: ${pluginId}`);
    }

    const manifest = entry.manifest;

    this.logger.info('Reloading plugin', { pluginId });

    await this.unloadPlugin(pluginId);
    await this.loadPlugin(manifest);

    this.logger.info('Plugin reloaded', { pluginId });
  }

  /**
   * Loads all plugins from a directory.
   *
   * @param path - Path to plugin directory
   *
   * @public
   */
  async loadPluginsFromDirectory(path: string): Promise<void> {
    this.logger.info('Loading plugins from directory', { path });

    const manifests = await this.loader.scanDirectory(path);

    if (manifests.length === 0) {
      this.logger.info('No plugins found in directory', { path });
      return;
    }

    // Sort by dependencies
    const sorted = this.sortByDependencies(manifests);

    let loaded = 0;
    let failed = 0;

    for (const manifest of sorted) {
      try {
        await this.loadPlugin(manifest);
        loaded++;
      } catch (err) {
        failed++;
        this.logger.error('Failed to load plugin', err as Error, {
          pluginId: manifest.id,
        });
      }
    }

    this.logger.info('Finished loading plugins from directory', {
      path,
      loaded,
      failed,
      total: manifests.length,
    });
  }

  /**
   * Shuts down all loaded plugins.
   *
   * @public
   */
  async shutdownAll(): Promise<void> {
    this.logger.info('Shutting down all plugins', {
      count: this.plugins.size,
    });

    // Emit system shutdown event first
    await this.eventBus.emitAsync('system.shutdown', {});

    // Shutdown in reverse dependency order
    const pluginIds = Array.from(this.plugins.keys()).reverse();

    for (const pluginId of pluginIds) {
      try {
        await this.unloadPlugin(pluginId);
      } catch (err) {
        this.logger.error('Failed to unload plugin during shutdown', err as Error, {
          pluginId,
        });
      }
    }

    // Dispose all sandboxes
    this.sandbox.disposeAll();

    this.logger.info('All plugins shut down');
  }

  /**
   * Sets configuration for a plugin.
   *
   * @param pluginId - Plugin ID
   * @param config - Configuration to set
   *
   * @remarks
   * Set configuration before loading the plugin.
   *
   * @public
   */
  setPluginConfig(pluginId: string, config: Record<string, unknown>): void {
    this.pluginConfigs.set(pluginId, config);
  }

  /**
   * Gets the number of loaded plugins.
   *
   * @returns Number of loaded plugins
   *
   * @public
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  /**
   * Gets plugin info for all loaded plugins.
   *
   * @returns Array of plugin info
   *
   * @public
   */
  getPluginInfo(): readonly {
    id: string;
    name: string;
    version: string;
    state: PluginState;
    loadedAt: Date;
  }[] {
    return Array.from(this.plugins.values()).map((entry) => ({
      id: entry.manifest.id,
      name: entry.manifest.name,
      version: entry.manifest.version,
      state: entry.state,
      loadedAt: entry.loadedAt,
    }));
  }

  /**
   * Checks if all dependencies are loaded.
   *
   * @param manifest - Plugin manifest
   * @throws {PluginError} If dependencies are missing
   *
   * @internal
   */
  private checkDependencies(manifest: IPluginManifest): void {
    for (const depId of manifest.dependencies ?? []) {
      if (!this.plugins.has(depId)) {
        throw new PluginError(
          manifest.id,
          'LOAD',
          `Missing dependency: ${depId}. Load ${depId} before ${manifest.id}.`
        );
      }

      const depState = this.getPluginState(depId);
      if (depState !== PluginState.READY) {
        throw new PluginError(
          manifest.id,
          'LOAD',
          `Dependency ${depId} is not ready (state: ${depState})`
        );
      }
    }
  }

  /**
   * Sorts manifests by dependencies using topological sort.
   *
   * @param manifests - Manifests to sort
   * @returns Sorted manifests
   *
   * @internal
   */
  private sortByDependencies(manifests: readonly IPluginManifest[]): readonly IPluginManifest[] {
    const result: IPluginManifest[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>(); // For cycle detection
    const manifestMap = new Map(manifests.map((m) => [m.id, m]));

    const visit = (manifest: IPluginManifest): void => {
      if (visited.has(manifest.id)) {
        return;
      }

      if (visiting.has(manifest.id)) {
        this.logger.warn('Circular dependency detected', {
          pluginId: manifest.id,
        });
        return;
      }

      visiting.add(manifest.id);

      for (const depId of manifest.dependencies ?? []) {
        const dep = manifestMap.get(depId);
        if (dep) {
          visit(dep);
        }
      }

      visiting.delete(manifest.id);
      visited.add(manifest.id);
      result.push(manifest);
    };

    for (const manifest of manifests) {
      visit(manifest);
    }

    return result;
  }

  /**
   * Updates plugin state.
   *
   * @param pluginId - Plugin ID
   * @param state - New state
   *
   * @internal
   */
  private updateState(pluginId: string, state: PluginState): void {
    const entry = this.plugins.get(pluginId);
    if (entry) {
      entry.state = state;
    }
  }
}
