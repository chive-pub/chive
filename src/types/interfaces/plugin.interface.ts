/**
 * Plugin system interfaces for Chive's extensibility framework.
 *
 * @remarks
 * This module defines interfaces for Chive's plugin system, enabling
 * third-party extensions with security isolation and declared permissions.
 *
 * The plugin architecture combines dependency injection via TSyringe,
 * an event-driven hook system using EventEmitter2, and security sandboxing
 * through isolated-vm.
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { ICacheProvider } from './cache.interface.js';
import type { ILogger } from './logger.interface.js';
import type { IMetrics } from './metrics.interface.js';

// Re-export for test convenience
export type { ICacheProvider, IMetrics };

/**
 * Plugin lifecycle state.
 *
 * @remarks
 * Tracks plugin state through its lifecycle from initialization to shutdown.
 *
 * @public
 * @since 0.1.0
 */
export enum PluginState {
  /**
   * Plugin has been loaded but not initialized.
   */
  UNINITIALIZED = 'uninitialized',

  /**
   * Plugin is currently initializing.
   */
  INITIALIZING = 'initializing',

  /**
   * Plugin is initialized and ready for use.
   */
  READY = 'ready',

  /**
   * Plugin encountered an error during initialization or execution.
   */
  ERROR = 'error',

  /**
   * Plugin is shutting down.
   */
  SHUTTING_DOWN = 'shutting_down',

  /**
   * Plugin has been shut down.
   */
  SHUTDOWN = 'shutdown',
}

/**
 * Plugin manifest schema.
 *
 * @remarks
 * Describes plugin metadata, dependencies, and required permissions.
 * Stored in `plugin.json` or `package.json` `chive` field.
 *
 * @public
 * @since 0.1.0
 */
export interface IPluginManifest {
  /**
   * Unique plugin identifier.
   *
   * @remarks
   * Format: reverse domain notation (e.g., "com.example.github-integration")
   */
  readonly id: string;

  /**
   * Human-readable plugin name.
   */
  readonly name: string;

  /**
   * Semantic version.
   *
   * @example "1.2.3"
   */
  readonly version: string;

  /**
   * Plugin description.
   */
  readonly description: string;

  /**
   * Author name or organization.
   */
  readonly author: string;

  /**
   * License (SPDX identifier).
   *
   * @example "MIT", "Apache-2.0"
   */
  readonly license: string;

  /**
   * Declared permissions.
   *
   * @remarks
   * Plugins must declare all permissions they need. Chive enforces
   * these at runtime via security sandbox.
   */
  readonly permissions: IPluginPermissions;

  /**
   * Entry point file path.
   *
   * @remarks
   * Relative to plugin root directory.
   *
   * @example "dist/index.js"
   */
  readonly entrypoint: string;

  /**
   * Plugin dependencies (other plugin IDs).
   *
   * @remarks
   * Dependencies are loaded before this plugin initializes.
   */
  readonly dependencies?: readonly string[];
}

/**
 * Plugin permissions (declared capabilities).
 *
 * @remarks
 * Plugins must declare permissions for:
 * - Network access (which domains)
 * - Storage quota (max size)
 * - Event hooks (which events to subscribe)
 *
 * Permissions are enforced by the plugin sandbox (isolated-vm).
 *
 * @public
 * @since 0.1.0
 */
export interface IPluginPermissions {
  /**
   * Network access permissions.
   */
  readonly network?: {
    /**
     * Allowed domains for HTTP requests.
     *
     * @remarks
     * Plugins can only make requests to these domains.
     *
     * @example ["api.github.com", "orcid.org"]
     */
    readonly allowedDomains: readonly string[];
  };

  /**
   * Storage permissions.
   */
  readonly storage?: {
    /**
     * Maximum storage size in bytes.
     *
     * @remarks
     * Plugins have isolated key-value storage. This limits total size.
     */
    readonly maxSize: number;
  };

  /**
   * Event hook subscriptions.
   */
  readonly hooks?: readonly string[];
}

/**
 * Plugin context (dependency injection).
 *
 * @remarks
 * Passed to plugin during initialization. Provides access to Chive
 * services and infrastructure.
 *
 * @public
 * @since 0.1.0
 */
export interface IPluginContext {
  /**
   * Logger instance for this plugin.
   *
   * @remarks
   * Pre-configured with plugin ID in context.
   */
  readonly logger: ILogger;

  /**
   * Cache provider for this plugin.
   *
   * @remarks
   * Keys are automatically prefixed with plugin ID.
   */
  readonly cache: ICacheProvider;

  /**
   * Metrics provider for this plugin.
   *
   * @remarks
   * Metrics are automatically labeled with plugin ID.
   */
  readonly metrics: IMetrics;

  /**
   * Event bus for subscribing to hooks.
   */
  readonly eventBus: IPluginEventBus;

  /**
   * Plugin-specific configuration.
   *
   * @remarks
   * Loaded from Chive configuration file or environment variables.
   */
  readonly config: Record<string, unknown>;
}

/**
 * Plugin event bus interface.
 *
 * @remarks
 * Provides pub/sub event system for plugin hooks. Built on EventEmitter2.
 *
 * @public
 * @since 0.1.0
 */
export interface IPluginEventBus {
  /**
   * Subscribes to an event.
   *
   * @param event - Event name
   * @param handler - Event handler function
   *
   * @remarks
   * Handler is called whenever the event is emitted.
   *
   * @example
   * ```typescript
   * eventBus.on('preprint.indexed', (preprint) => {
   *   console.log('Preprint indexed:', preprint.title);
   * });
   * ```
   *
   * @public
   */
  on(event: string, handler: (...args: readonly unknown[]) => void): void;

  /**
   * Emits an event.
   *
   * @param event - Event name
   * @param args - Event arguments
   *
   * @remarks
   * Calls all subscribed handlers with the provided arguments.
   *
   * @example
   * ```typescript
   * eventBus.emit('preprint.indexed', preprint);
   * ```
   *
   * @public
   */
  emit(event: string, ...args: readonly unknown[]): void;

  /**
   * Emits an event asynchronously and waits for all handlers.
   *
   * @param event - Event name
   * @param args - Event arguments
   * @returns Promise that resolves when all handlers complete
   *
   * @example
   * ```typescript
   * await eventBus.emitAsync('preprint.indexed', preprint);
   * ```
   *
   * @public
   */
  emitAsync(event: string, ...args: readonly unknown[]): Promise<void>;

  /**
   * Unsubscribes from an event.
   *
   * @param event - Event name
   * @param handler - Event handler to remove
   *
   * @example
   * ```typescript
   * eventBus.off('preprint.indexed', handler);
   * ```
   *
   * @public
   */
  off(event: string, handler: (...args: readonly unknown[]) => void): void;

  /**
   * Subscribes to an event for one-time execution.
   *
   * @param event - Event name or pattern
   * @param handler - Event handler function (called once then removed)
   *
   * @example
   * ```typescript
   * eventBus.once('system.startup', () => {
   *   console.log('System started');
   * });
   * ```
   *
   * @public
   */
  once(event: string, handler: (...args: readonly unknown[]) => void): void;

  /**
   * Gets the number of listeners for an event.
   *
   * @param event - Event name
   * @returns Number of registered listeners
   *
   * @public
   */
  listenerCount(event: string): number;

  /**
   * Gets the names of all events with registered listeners.
   *
   * @returns Array of event names
   *
   * @public
   */
  eventNames(): string[];

  /**
   * Removes all listeners from all events.
   *
   * @public
   */
  removeAllListeners(): void;
}

/**
 * Base plugin interface.
 *
 * @remarks
 * All Chive plugins must implement this interface.
 *
 * @public
 * @since 0.1.0
 */
export interface IChivePlugin {
  /**
   * Unique plugin identifier.
   *
   * @remarks
   * Must match `manifest.id`.
   */
  readonly id: string;

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest;

  /**
   * Initializes the plugin.
   *
   * @param context - Plugin context with injected dependencies
   * @returns Promise resolving when initialization complete
   *
   * @remarks
   * Called once when plugin is loaded. Use this to:
   * - Subscribe to event hooks
   * - Initialize plugin state
   * - Validate configuration
   *
   * If initialization fails, throw an error to prevent plugin from loading.
   *
   * @example
   * ```typescript
   * async initialize(context: IPluginContext): Promise<void> {
   *   this.logger = context.logger;
   *   this.cache = context.cache;
   *
   *   context.eventBus.on('preprint.indexed', this.handleIndexed.bind(this));
   *
   *   this.logger.info('Plugin initialized');
   * }
   * ```
   *
   * @public
   */
  initialize(context: IPluginContext): Promise<void>;

  /**
   * Shuts down the plugin.
   *
   * @returns Promise resolving when shutdown complete
   *
   * @remarks
   * Called when Chive is shutting down or plugin is being unloaded.
   * Use this to:
   * - Unsubscribe from event hooks
   * - Close connections
   * - Save state
   *
   * @example
   * ```typescript
   * async shutdown(): Promise<void> {
   *   this.logger.info('Plugin shutting down');
   *   await this.saveState();
   * }
   * ```
   *
   * @public
   */
  shutdown(): Promise<void>;

  /**
   * Gets current plugin state.
   *
   * @returns Current lifecycle state
   *
   * @example
   * ```typescript
   * getState(): PluginState {
   *   return this.state;
   * }
   * ```
   *
   * @public
   */
  getState(): PluginState;
}

// ============================================================================
// Plugin Manager and Loader Interfaces
// ============================================================================

/**
 * Plugin manager interface for lifecycle management.
 *
 * @remarks
 * Manages plugin loading, initialization, and shutdown with proper
 * dependency ordering and error handling.
 *
 * @example
 * ```typescript
 * const manager = container.resolve<IPluginManager>('IPluginManager');
 *
 * // Load a plugin
 * await manager.loadPlugin(manifest);
 *
 * // Get all loaded plugins
 * const plugins = manager.getAllPlugins();
 *
 * // Shutdown all plugins
 * await manager.shutdownAll();
 * ```
 *
 * @public
 * @since 0.1.0
 */
export interface IPluginManager {
  /**
   * Loads and initializes a plugin from its manifest.
   *
   * @param manifest - Plugin manifest
   * @throws {PluginError} If loading or initialization fails
   */
  loadPlugin(manifest: IPluginManifest): Promise<void>;

  /**
   * Unloads a plugin, calling its shutdown method.
   *
   * @param pluginId - ID of the plugin to unload
   * @throws {PluginError} If plugin not found or shutdown fails
   */
  unloadPlugin(pluginId: string): Promise<void>;

  /**
   * Gets a loaded plugin by ID.
   *
   * @param pluginId - ID of the plugin to get
   * @returns Plugin instance or undefined if not loaded
   */
  getPlugin(pluginId: string): IChivePlugin | undefined;

  /**
   * Gets all loaded plugins.
   *
   * @returns Array of all loaded plugin instances
   */
  getAllPlugins(): readonly IChivePlugin[];

  /**
   * Gets the current state of a plugin.
   *
   * @param pluginId - ID of the plugin
   * @returns Plugin state or undefined if not loaded
   */
  getPluginState(pluginId: string): PluginState | undefined;

  /**
   * Reloads a plugin (unload then load).
   *
   * @param pluginId - ID of the plugin to reload
   * @throws {PluginError} If reload fails
   */
  reloadPlugin(pluginId: string): Promise<void>;

  /**
   * Loads all plugins from a directory.
   *
   * @param path - Path to plugin directory
   */
  loadPluginsFromDirectory(path: string): Promise<void>;

  /**
   * Shuts down all loaded plugins.
   */
  shutdownAll(): Promise<void>;
}

/**
 * Result type for manifest validation.
 *
 * @public
 * @since 0.1.0
 */
export type ManifestValidationResult =
  | { ok: true; value: IPluginManifest }
  | { ok: false; error: import('../errors.js').ManifestValidationError };

/**
 * Plugin loader interface for discovery and code loading.
 *
 * @remarks
 * Scans directories for plugin manifests, validates them, and loads
 * plugin code. Used by IPluginManager.
 *
 * @public
 * @since 0.1.0
 */
export interface IPluginLoader {
  /**
   * Scans a directory for plugin manifests.
   *
   * @param path - Directory path to scan
   * @returns Array of valid plugin manifests found
   */
  scanDirectory(path: string): Promise<readonly IPluginManifest[]>;

  /**
   * Validates a plugin manifest against the schema.
   *
   * @param manifest - Raw manifest data to validate
   * @returns Result with validated manifest or validation error
   */
  validateManifest(manifest: unknown): Promise<ManifestValidationResult>;

  /**
   * Loads plugin code from manifest entry point.
   *
   * @param manifest - Plugin manifest
   * @returns Plugin instance
   * @throws {PluginError} If code loading fails
   */
  loadPluginCode(manifest: IPluginManifest): Promise<IChivePlugin>;
}

// ============================================================================
// Sandbox and Security Interfaces
// ============================================================================

/**
 * Sandbox isolate handle.
 *
 * @remarks
 * Represents a V8 isolate created for a plugin. Used to track
 * resource usage and manage isolate lifecycle.
 *
 * @public
 * @since 0.1.0
 */
export interface SandboxIsolate {
  /**
   * Unique isolate identifier.
   */
  readonly id: string;

  /**
   * ID of the plugin running in this isolate.
   */
  readonly pluginId: string;

  /**
   * Memory limit in megabytes.
   */
  readonly memoryLimit: number;

  /**
   * CPU time limit in milliseconds.
   */
  readonly cpuLimit: number;
}

/**
 * Sandbox execution context.
 *
 * @remarks
 * Provides the context available to plugin code executing in the sandbox.
 * All services are proxied through permission checks.
 *
 * @public
 * @since 0.1.0
 */
export interface SandboxContext {
  /**
   * Logger instance for the plugin.
   */
  readonly logger: ILogger;

  /**
   * Cache provider for the plugin.
   */
  readonly cache: ICacheProvider;

  /**
   * Metrics provider for the plugin.
   */
  readonly metrics: IMetrics;

  /**
   * Plugin configuration.
   */
  readonly config: Record<string, unknown>;

  /**
   * Allowed network domains.
   */
  readonly allowedDomains: readonly string[];
}

/**
 * Plugin sandbox interface.
 *
 * @remarks
 * Manages V8 isolates for plugin execution using isolated-vm.
 * Provides security isolation with memory and CPU limits.
 *
 * @example
 * ```typescript
 * const sandbox = container.resolve<IPluginSandbox>('IPluginSandbox');
 *
 * // Create isolate for plugin
 * const isolate = await sandbox.createIsolate(manifest);
 *
 * // Execute code in sandbox
 * const result = await sandbox.executeInSandbox(isolate, code, context);
 *
 * // Dispose when done
 * sandbox.dispose(isolate);
 * ```
 *
 * @public
 * @since 0.1.0
 */
export interface IPluginSandbox {
  /**
   * Creates a new V8 isolate for a plugin.
   *
   * @param manifest - Plugin manifest (used for resource limits)
   * @returns Sandbox isolate handle
   */
  createIsolate(manifest: IPluginManifest): Promise<SandboxIsolate>;

  /**
   * Executes code in a sandbox isolate.
   *
   * @param isolate - Sandbox isolate handle
   * @param code - JavaScript code to execute
   * @param context - Execution context with services
   * @returns Execution result
   * @throws {SandboxViolationError} If resource limits exceeded
   */
  executeInSandbox<T>(isolate: SandboxIsolate, code: string, context: SandboxContext): Promise<T>;

  /**
   * Disposes a single isolate.
   *
   * @param isolate - Isolate to dispose
   */
  dispose(isolate: SandboxIsolate): void;

  /**
   * Disposes all isolates.
   */
  disposeAll(): void;

  /**
   * Gets current memory usage for an isolate.
   *
   * @param isolate - Sandbox isolate handle
   * @returns Memory usage in bytes
   */
  getMemoryUsage(isolate: SandboxIsolate): number;
}

/**
 * Permission enforcer interface.
 *
 * @remarks
 * Enforces plugin permissions at runtime using ES6 Proxy wrappers.
 * All service access goes through permission checks.
 *
 * @public
 * @since 0.1.0
 */
export interface IPermissionEnforcer {
  /**
   * Checks if a plugin has a specific permission.
   *
   * @param plugin - Plugin to check
   * @param permission - Permission string (e.g., 'network:api.github.com')
   * @returns True if permission is granted
   */
  checkPermission(plugin: IChivePlugin, permission: string): boolean;

  /**
   * Creates a permission-checking proxy for a service.
   *
   * @param service - Service to wrap
   * @param requiredPermission - Permission required to access service
   * @param plugin - Plugin requesting access
   * @returns Proxied service that checks permissions on each call
   */
  createPermissionProxy<T extends object>(
    service: T,
    requiredPermission: string,
    plugin: IChivePlugin
  ): T;

  /**
   * Enforces network access permission.
   *
   * @param plugin - Plugin requesting access
   * @param domain - Domain being accessed
   * @throws {SandboxViolationError} If access denied
   */
  enforceNetworkAccess(plugin: IChivePlugin, domain: string): void;

  /**
   * Enforces storage limit.
   *
   * @param plugin - Plugin requesting storage
   * @param sizeBytes - Size of data being stored
   * @throws {SandboxViolationError} If quota exceeded
   */
  enforceStorageLimit(plugin: IChivePlugin, sizeBytes: number): void;

  /**
   * Enforces hook access permission.
   *
   * @param plugin - Plugin requesting hook access
   * @param hookName - Hook being accessed
   * @throws {SandboxViolationError} If hook not allowed
   */
  enforceHookAccess(plugin: IChivePlugin, hookName: string): void;

  /**
   * Resets storage usage tracking for a plugin.
   *
   * @param pluginId - ID of plugin to reset
   */
  resetStorageUsage(pluginId: string): void;
}

/**
 * Resource limits for plugins.
 *
 * @public
 * @since 0.1.0
 */
export interface ResourceLimits {
  /**
   * Maximum memory in megabytes.
   */
  readonly maxMemoryMB: number;

  /**
   * Maximum CPU percentage.
   */
  readonly maxCpuPercent: number;

  /**
   * Maximum execution time in milliseconds.
   */
  readonly maxExecutionTimeMs: number;
}

/**
 * Resource governor interface.
 *
 * @remarks
 * Tracks and enforces CPU and memory limits per plugin.
 *
 * @public
 * @since 0.1.0
 */
export interface IResourceGovernor {
  /**
   * Allocates resources for a plugin.
   *
   * @param pluginId - Plugin ID
   * @param limits - Resource limits to apply
   */
  allocate(pluginId: string, limits: ResourceLimits): void;

  /**
   * Gets current memory usage for a plugin.
   *
   * @param pluginId - Plugin ID
   * @returns Memory usage in MB
   */
  checkMemoryUsage(pluginId: string): number;

  /**
   * Gets current CPU usage for a plugin.
   *
   * @param pluginId - Plugin ID
   * @returns CPU usage percentage
   */
  checkCpuUsage(pluginId: string): number;

  /**
   * Releases resources for a plugin.
   *
   * @param pluginId - Plugin ID
   */
  release(pluginId: string): void;

  /**
   * Checks if a plugin is within its resource limits.
   *
   * @param pluginId - Plugin ID
   * @returns True if within limits
   */
  isWithinLimits(pluginId: string): boolean;

  /**
   * Updates memory usage for a plugin.
   *
   * @param pluginId - Plugin ID
   * @param memoryMB - Current memory usage in MB
   * @throws {SandboxViolationError} If limit exceeded
   */
  updateMemoryUsage(pluginId: string, memoryMB: number): void;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Plugin hook event types.
 *
 * @remarks
 * Standard event names that plugins can subscribe to.
 *
 * @public
 * @since 0.1.0
 */
export type PluginHookEvent =
  | 'preprint.indexed'
  | 'preprint.updated'
  | 'preprint.deleted'
  | 'review.created'
  | 'review.updated'
  | 'endorsement.created'
  | 'author.linked'
  | 'field.proposed'
  | 'field.approved'
  | 'plugin.loaded'
  | 'plugin.unloaded'
  | 'system.startup'
  | 'system.shutdown'
  | 'import.created'
  | 'import.updated'
  | 'import.claimed'
  | 'claim.started'
  | 'claim.approved'
  | 'claim.rejected'
  | 'backlink.created'
  | 'backlink.deleted';

// ============================================================================
// Import Plugin Interfaces
// ============================================================================

/**
 * External preprint source identifier.
 *
 * @remarks
 * Import sources are EXTENSIBLE - any plugin can define its own source identifier.
 * This is intentionally a string type (not a union) to allow third-party plugins
 * to introduce new sources without modifying core Chive code.
 *
 * **Format requirements:**
 * - Lowercase alphanumeric characters only (a-z, 0-9)
 * - 2-50 characters long
 * - No special characters, hyphens, or underscores
 *
 * The canonical source of truth for validation is `importSourceSchema` in
 * `src/api/schemas/claiming.ts`. The `WELL_KNOWN_SOURCES` constant provides
 * metadata for built-in sources (display names, categories) but does NOT
 * restrict what source identifiers are valid.
 *
 * @example
 * // Built-in plugin source
 * readonly source: ImportSource = 'arxiv';
 *
 * // Third-party plugin with custom source
 * readonly source: ImportSource = 'mybiorxiv';
 *
 * @public
 * @since 0.1.0
 */
export type ImportSource = string;

/**
 * Author information from an external preprint.
 *
 * @public
 * @since 0.1.0
 */
export interface ExternalAuthor {
  /**
   * Author name as it appears on the preprint.
   */
  readonly name: string;

  /**
   * ORCID iD if available (format: 0000-0002-1825-0097).
   */
  readonly orcid?: string;

  /**
   * Affiliation text as it appears.
   */
  readonly affiliation?: string;

  /**
   * Email address if available.
   */
  readonly email?: string;
}

/**
 * External preprint data fetched from an external source.
 *
 * @remarks
 * Represents the metadata of a preprint before it's imported
 * into the Chive AppView cache.
 *
 * @public
 * @since 0.1.0
 */
export interface ExternalPreprint {
  /**
   * Source-specific identifier.
   *
   * @example "2401.12345" (arXiv), "007123" (LingBuzz)
   */
  readonly externalId: string;

  /**
   * Full URL to the original preprint.
   */
  readonly url: string;

  /**
   * Preprint title.
   */
  readonly title: string;

  /**
   * Abstract text (may be truncated).
   */
  readonly abstract?: string;

  /**
   * Author list.
   */
  readonly authors: readonly ExternalAuthor[];

  /**
   * Publication or upload date.
   */
  readonly publicationDate?: Date;

  /**
   * DOI if assigned.
   */
  readonly doi?: string;

  /**
   * URL to PDF (we never store the PDF itself, only the URL).
   */
  readonly pdfUrl?: string;

  /**
   * Subject categories/keywords from source.
   */
  readonly categories?: readonly string[];

  /**
   * License identifier (SPDX).
   */
  readonly license?: string;

  /**
   * Version number if the source tracks versions.
   */
  readonly version?: number;

  /**
   * Source-specific metadata not covered above.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Imported preprint stored in AppView cache.
 *
 * @remarks
 * This is ephemeral data stored in the AppView's database,
 * NOT in a user's PDS. It can be rebuilt from the external source.
 *
 * @public
 * @since 0.1.0
 */
export interface ImportedPreprint extends ExternalPreprint {
  /**
   * Internal database ID.
   */
  readonly id: number;

  /**
   * Source system identifier.
   */
  readonly source: ImportSource;

  /**
   * Plugin that performed the import.
   */
  readonly importedByPlugin: string;

  /**
   * When the preprint was imported.
   */
  readonly importedAt: Date;

  /**
   * Last synchronization with source.
   */
  readonly lastSyncedAt?: Date;

  /**
   * Sync status with external source.
   */
  readonly syncStatus: 'active' | 'stale' | 'unavailable';

  /**
   * Current claim status.
   */
  readonly claimStatus: 'unclaimed' | 'pending' | 'claimed';

  /**
   * AT-URI of the canonical record (if claimed).
   */
  readonly canonicalUri?: string;

  /**
   * DID of the user who claimed this preprint.
   */
  readonly claimedByDid?: string;

  /**
   * When the preprint was claimed.
   */
  readonly claimedAt?: Date;
}

/**
 * Options for fetching preprints from external sources.
 *
 * @public
 * @since 0.1.0
 */
export interface FetchOptions {
  /**
   * Maximum number of preprints to fetch.
   */
  readonly limit?: number;

  /**
   * Only fetch preprints after this date.
   */
  readonly since?: Date;

  /**
   * Cursor for pagination.
   */
  readonly cursor?: string;

  /**
   * Filter by categories/subjects.
   */
  readonly categories?: readonly string[];

  /**
   * Search query.
   */
  readonly query?: string;
}

/**
 * Import service interface for tracking imported preprints.
 *
 * @remarks
 * Manages the AppView cache of imported preprints. All data
 * is rebuildable from external sources (ATProto compliant).
 *
 * @public
 * @since 0.1.0
 */
export interface IImportService {
  /**
   * Checks if a preprint has been imported.
   *
   * @param source - External source
   * @param externalId - Source-specific ID
   * @returns True if already imported
   */
  exists(source: ImportSource, externalId: string): Promise<boolean>;

  /**
   * Gets an imported preprint by source and ID.
   *
   * @param source - External source
   * @param externalId - Source-specific ID
   * @returns Imported preprint or null
   */
  get(source: ImportSource, externalId: string): Promise<ImportedPreprint | null>;

  /**
   * Gets an imported preprint by internal ID.
   *
   * @param id - Internal database ID
   * @returns Imported preprint or null
   */
  getById(id: number): Promise<ImportedPreprint | null>;

  /**
   * Creates a new imported preprint.
   *
   * @param data - Import data
   * @returns Created imported preprint
   */
  create(data: {
    source: ImportSource;
    externalId: string;
    externalUrl: string;
    title: string;
    abstract?: string;
    authors: readonly ExternalAuthor[];
    publicationDate?: Date;
    doi?: string;
    pdfUrl?: string;
    categories?: readonly string[];
    importedByPlugin: string;
    metadata?: Record<string, unknown>;
  }): Promise<ImportedPreprint>;

  /**
   * Updates an imported preprint.
   *
   * @param id - Internal database ID
   * @param data - Fields to update
   * @returns Updated imported preprint
   */
  update(
    id: number,
    data: Partial<{
      title: string;
      abstract: string;
      authors: readonly ExternalAuthor[];
      doi: string;
      pdfUrl: string;
      lastSyncedAt: Date;
      syncStatus: 'active' | 'stale' | 'unavailable';
      claimStatus: 'unclaimed' | 'pending' | 'claimed';
      canonicalUri: string;
      claimedByDid: string;
      claimedAt: Date;
    }>
  ): Promise<ImportedPreprint>;

  /**
   * Searches imported preprints.
   *
   * @param options - Search options
   * @returns Matching preprints with cursor
   */
  search(options: {
    query?: string;
    source?: ImportSource;
    claimStatus?: 'unclaimed' | 'pending' | 'claimed';
    authorName?: string;
    authorOrcid?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ preprints: ImportedPreprint[]; cursor?: string }>;

  /**
   * Marks a preprint as claimed.
   *
   * @param id - Internal database ID
   * @param canonicalUri - AT-URI of user's canonical record
   * @param claimedByDid - DID of claiming user
   */
  markClaimed(id: number, canonicalUri: string, claimedByDid: string): Promise<void>;
}

// ============================================================================
// Searchable Plugin Interfaces
// ============================================================================

/**
 * Search query parameters for external preprint sources.
 *
 * @remarks
 * Used by SearchablePlugin implementations to query external APIs
 * on demand. Supports author name, title, DOI, and source-specific IDs.
 *
 * Distinct from SearchQuery in search.interface.ts which is for
 * internal Elasticsearch queries.
 *
 * @public
 * @since 0.1.0
 */
export interface ExternalSearchQuery {
  /**
   * Author name to search for.
   *
   * @remarks
   * Matches against author names in the external source.
   * The matching algorithm is source-specific.
   */
  readonly author?: string;

  /**
   * Title or partial title to search for.
   */
  readonly title?: string;

  /**
   * DOI to search for (exact match).
   */
  readonly doi?: string;

  /**
   * Source-specific external ID (exact match).
   *
   * @example "2401.12345" for arXiv, "007123" for LingBuzz
   */
  readonly externalId?: string;

  /**
   * Maximum number of results to return.
   *
   * @defaultValue 10
   */
  readonly limit?: number;

  /**
   * Filter by categories/subjects (source-specific).
   */
  readonly categories?: readonly string[];
}

/**
 * Plugin that supports on-demand search of external sources.
 *
 * @remarks
 * Extends IChivePlugin with search capabilities. Plugins implementing
 * this interface can query external APIs directly when users search,
 * rather than requiring bulk pre-import.
 *
 * This approach:
 * - Reduces storage requirements (only import claimed papers)
 * - Ensures fresh data (real-time from source)
 * - Minimizes API load on external services
 *
 * @example
 * ```typescript
 * class ArxivPlugin implements SearchablePlugin {
 *   readonly supportsSearch = true;
 *
 *   async search(query: ExternalSearchQuery): Promise<ExternalPreprint[]> {
 *     const url = buildArxivQuery(query);
 *     const response = await fetch(url);
 *     return parseAtomFeed(response);
 *   }
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
export interface SearchablePlugin extends IChivePlugin {
  /**
   * Discriminator to identify searchable plugins.
   *
   * @remarks
   * Used in type guards to distinguish from non-searchable plugins.
   * Always set to `true` for SearchablePlugin implementations.
   */
  readonly supportsSearch: true;

  /**
   * Searches the external source for preprints matching the query.
   *
   * @param query - Search parameters
   * @returns Matching preprints from the external source
   *
   * @throws {PluginError} If the search request fails
   *
   * @remarks
   * Implementations must:
   * - Respect rate limits of the external API
   * - Handle network errors gracefully
   * - Return empty array (not throw) for no results
   */
  search(query: ExternalSearchQuery): Promise<readonly ExternalPreprint[]>;
}

/**
 * Type guard for SearchablePlugin.
 *
 * @param plugin - Plugin to check
 * @returns True if the plugin supports on-demand search
 *
 * @example
 * ```typescript
 * if (isSearchablePlugin(plugin)) {
 *   const results = await plugin.search({ title: 'attention' });
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function isSearchablePlugin(plugin: IChivePlugin): plugin is SearchablePlugin {
  return 'supportsSearch' in plugin && plugin.supportsSearch === true;
}

/**
 * Plugin that supports bulk import from external sources.
 *
 * @remarks
 * For sources without search APIs (LingBuzz, Semantics Archive),
 * plugins must implement bulk fetching. The ImportScheduler
 * periodically triggers imports for these plugins.
 *
 * @public
 * @since 0.1.0
 */
export interface ImportingPlugin extends IChivePlugin {
  /**
   * Discriminator to identify importing plugins.
   */
  readonly supportsSearch: false;

  /**
   * Source identifier for this plugin.
   */
  readonly source: ImportSource;

  /**
   * Fetches preprints from the external source.
   *
   * @param options - Fetch options (pagination, filters)
   * @yields External preprints from the source
   *
   * @remarks
   * Use async generator for memory-efficient bulk fetching.
   * Implementations must respect rate limits.
   */
  fetchPreprints(options?: FetchOptions): AsyncIterable<ExternalPreprint>;
}

/**
 * Type guard for ImportingPlugin.
 *
 * @param plugin - Plugin to check
 * @returns True if the plugin supports bulk import
 *
 * @public
 * @since 0.1.0
 */
export function isImportingPlugin(plugin: IChivePlugin): plugin is ImportingPlugin {
  return 'supportsSearch' in plugin && plugin.supportsSearch === false;
}

// ============================================================================
// Backlink Plugin Interfaces
// ============================================================================

/**
 * Backlink source types from ATProto ecosystem.
 *
 * @public
 * @since 0.1.0
 */
export type BacklinkSourceType =
  | 'semble.collection'
  | 'leaflet.list'
  | 'whitewind.blog'
  | 'bluesky.post'
  | 'bluesky.embed'
  | 'other';

/**
 * Backlink record from an external ATProto application.
 *
 * @public
 * @since 0.1.0
 */
export interface Backlink {
  /**
   * Internal database ID.
   */
  readonly id: number;

  /**
   * AT-URI of the source record (e.g., Semble collection).
   */
  readonly sourceUri: string;

  /**
   * Type of backlink source.
   */
  readonly sourceType: BacklinkSourceType;

  /**
   * AT-URI of the target preprint.
   */
  readonly targetUri: string;

  /**
   * Optional context (e.g., collection title, post text).
   */
  readonly context?: string;

  /**
   * When this backlink was indexed.
   */
  readonly indexedAt: Date;

  /**
   * Whether the source record has been deleted.
   */
  readonly deleted: boolean;
}

/**
 * Aggregated backlink counts for a preprint.
 *
 * @public
 * @since 0.1.0
 */
export interface BacklinkCounts {
  /**
   * Number of Semble collections.
   */
  readonly sembleCollections: number;

  /**
   * Number of Leaflet reading lists.
   */
  readonly leafletLists: number;

  /**
   * Number of WhiteWind blog mentions.
   */
  readonly whitewindBlogs: number;

  /**
   * Number of Bluesky post references.
   */
  readonly blueskyPosts: number;

  /**
   * Number of Bluesky embed references.
   */
  readonly blueskyEmbeds: number;

  /**
   * Number of other/external references.
   */
  readonly other: number;

  /**
   * Total backlink count.
   */
  readonly total: number;

  /**
   * When counts were last updated.
   */
  readonly updatedAt: Date;
}

/**
 * Backlink service interface.
 *
 * @remarks
 * Tracks backlinks from ATProto ecosystem apps (Semble, Leaflet,
 * WhiteWind, Bluesky) that reference Chive preprints.
 * All data is rebuildable from firehose (ATProto compliant).
 *
 * @public
 * @since 0.1.0
 */
export interface IBacklinkService {
  /**
   * Creates a new backlink.
   *
   * @param data - Backlink data
   * @returns Created backlink
   */
  createBacklink(data: {
    sourceUri: string;
    sourceType: BacklinkSourceType;
    targetUri: string;
    context?: string;
  }): Promise<Backlink>;

  /**
   * Marks a backlink as deleted.
   *
   * @param sourceUri - AT-URI of the source record
   */
  deleteBacklink(sourceUri: string): Promise<void>;

  /**
   * Gets backlinks for a preprint.
   *
   * @param targetUri - AT-URI of the preprint
   * @param options - Filter options
   * @returns Backlinks matching criteria
   */
  getBacklinks(
    targetUri: string,
    options?: {
      sourceType?: BacklinkSourceType;
      limit?: number;
      cursor?: string;
    }
  ): Promise<{ backlinks: Backlink[]; cursor?: string }>;

  /**
   * Gets aggregated backlink counts for a preprint.
   *
   * @param targetUri - AT-URI of the preprint
   * @returns Aggregated counts
   */
  getCounts(targetUri: string): Promise<BacklinkCounts>;

  /**
   * Updates cached counts for a preprint.
   *
   * @param targetUri - AT-URI of the preprint
   */
  updateCounts(targetUri: string): Promise<void>;
}

// ============================================================================
// Claiming Service Interfaces
// ============================================================================

/**
 * Evidence types for preprint claiming.
 *
 * @public
 * @since 0.1.0
 */
export type ClaimEvidenceType =
  | 'orcid-match'
  | 'semantic-scholar-match'
  | 'openreview-match'
  | 'openalex-match'
  | 'arxiv-ownership'
  | 'institutional-email'
  | 'ror-affiliation'
  | 'name-match'
  | 'coauthor-overlap'
  | 'author-claim';

/**
 * Evidence item for a claim.
 *
 * @public
 * @since 0.1.0
 */
export interface ClaimEvidence {
  /**
   * Type of evidence.
   */
  readonly type: ClaimEvidenceType;

  /**
   * Confidence score (0-1).
   */
  readonly score: number;

  /**
   * Human-readable description.
   */
  readonly details: string;

  /**
   * Supporting data.
   */
  readonly data?: Record<string, unknown>;
}

/**
 * Claim request status.
 *
 * @public
 * @since 0.1.0
 */
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Claim request record.
 *
 * @public
 * @since 0.1.0
 */
export interface ClaimRequest {
  /**
   * Internal database ID.
   */
  readonly id: number;

  /**
   * ID of the imported preprint.
   */
  readonly importId: number;

  /**
   * DID of the claimant.
   */
  readonly claimantDid: string;

  /**
   * Evidence supporting the claim.
   */
  readonly evidence: readonly ClaimEvidence[];

  /**
   * Computed verification score (0-1).
   */
  readonly verificationScore: number;

  /**
   * Current status.
   */
  readonly status: ClaimStatus;

  /**
   * DID of reviewer (if manually reviewed).
   */
  readonly reviewedBy?: string;

  /**
   * When reviewed.
   */
  readonly reviewedAt?: Date;

  /**
   * Reason for rejection (if rejected).
   */
  readonly rejectionReason?: string;

  /**
   * AT-URI of canonical record (once created).
   */
  readonly canonicalUri?: string;

  /**
   * When request was created.
   */
  readonly createdAt: Date;

  /**
   * When request expires (for pending claims).
   */
  readonly expiresAt?: Date;
}

/**
 * Claiming service interface.
 *
 * @remarks
 * Manages the multi-authority verification flow for authors
 * to claim imported preprints. Follows ATProto principles:
 * - User creates canonical record in THEIR PDS
 * - Chive only recognizes and links the claim
 *
 * @public
 * @since 0.1.0
 */
export interface IClaimingService {
  /**
   * Starts a claim request.
   *
   * @param importId - ID of imported preprint
   * @param claimantDid - DID of user claiming
   * @param evidence - Initial evidence (e.g., from ORCID OAuth)
   * @returns Created claim request
   */
  startClaim(
    importId: number,
    claimantDid: string,
    evidence?: readonly ClaimEvidence[]
  ): Promise<ClaimRequest>;

  /**
   * Collects evidence for a claim from multiple authorities.
   *
   * @param claimId - Claim request ID
   * @returns Updated claim with all collected evidence
   */
  collectEvidence(claimId: number): Promise<ClaimRequest>;

  /**
   * Computes verification score from evidence.
   *
   * @param evidence - All evidence items
   * @returns Score (0-1) and decision
   */
  computeScore(evidence: readonly ClaimEvidence[]): {
    score: number;
    decision: 'auto-approve' | 'expedited' | 'manual' | 'insufficient';
  };

  /**
   * Completes a claim after user creates canonical record.
   *
   * @param claimId - Claim request ID
   * @param canonicalUri - AT-URI of user's canonical record
   */
  completeClaim(claimId: number, canonicalUri: string): Promise<void>;

  /**
   * Rejects a claim.
   *
   * @param claimId - Claim request ID
   * @param reason - Rejection reason
   * @param reviewerDid - DID of reviewer
   */
  rejectClaim(claimId: number, reason: string, reviewerDid: string): Promise<void>;

  /**
   * Gets a claim request by ID.
   *
   * @param claimId - Claim request ID
   */
  getClaim(claimId: number): Promise<ClaimRequest | null>;

  /**
   * Gets pending claims for a user.
   *
   * @param claimantDid - User's DID
   */
  getUserClaims(claimantDid: string): Promise<readonly ClaimRequest[]>;

  /**
   * Finds claimable preprints for a user.
   *
   * @param options - Search options
   */
  findClaimable(options: {
    name?: string;
    orcid?: string;
    email?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ preprints: ImportedPreprint[]; cursor?: string }>;
}
