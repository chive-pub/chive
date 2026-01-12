/**
 * Scoped event bus that enforces plugin hook permissions.
 *
 * @remarks
 * This module provides a permission-enforced wrapper around the main
 * event bus. Each plugin receives a scoped instance that only allows
 * subscription to hooks declared in the plugin's manifest.
 *
 * @packageDocumentation
 * @public
 */

import { PluginPermissionError } from '../../types/errors.js';
import type { IPluginEventBus, IPluginManifest } from '../../types/interfaces/plugin.interface.js';

/**
 * Registered handler entry for cleanup tracking.
 *
 * @internal
 */
interface RegisteredHandler {
  /**
   * Event name or pattern.
   */
  event: string;

  /**
   * Handler function.
   */
  handler: (...args: readonly unknown[]) => void;
}

/**
 * Scoped plugin event bus with permission enforcement.
 *
 * @remarks
 * Each plugin receives a scoped event bus that:
 * - Only allows subscription to hooks declared in manifest.permissions.hooks
 * - Supports wildcard patterns (e.g., 'eprint.*' in manifest allows 'eprint.indexed')
 * - Tracks all registered handlers for cleanup on plugin unload
 * - Delegates actual event handling to the main PluginEventBus
 *
 * @example
 * ```typescript
 * // Plugin manifest declares allowed hooks
 * const manifest = {
 *   permissions: {
 *     hooks: ['eprint.indexed', 'eprint.updated', 'system.*']
 *   }
 * };
 *
 * const scopedBus = new ScopedPluginEventBus(mainEventBus, manifest);
 *
 * // Allowed (matches declared hook)
 * scopedBus.on('eprint.indexed', handler);
 *
 * // Allowed (matches wildcard 'system.*')
 * scopedBus.on('system.startup', handler);
 *
 * // Throws PluginPermissionError (not declared)
 * scopedBus.on('review.created', handler);
 * ```
 *
 * @public
 */
export class ScopedPluginEventBus implements IPluginEventBus {
  /**
   * Delegate event bus.
   */
  private readonly delegate: IPluginEventBus;

  /**
   * Plugin ID for error messages.
   */
  private readonly pluginId: string;

  /**
   * Set of allowed hook patterns.
   */
  private readonly allowedHooks: ReadonlySet<string>;

  /**
   * Registered handlers for cleanup.
   */
  private readonly registeredHandlers: RegisteredHandler[] = [];

  /**
   * Creates a new ScopedPluginEventBus.
   *
   * @param delegate - Main event bus to delegate to
   * @param manifest - Plugin manifest with permission declarations
   */
  constructor(delegate: IPluginEventBus, manifest: IPluginManifest) {
    this.delegate = delegate;
    this.pluginId = manifest.id;
    this.allowedHooks = new Set(manifest.permissions.hooks ?? []);
  }

  /**
   * Subscribes to an event if the plugin has permission.
   *
   * @param event - Event name or pattern
   * @param handler - Event handler function
   * @throws {PluginPermissionError} If hook not declared in manifest
   *
   * @example
   * ```typescript
   * // Plugin with hooks: ['eprint.*']
   * scopedBus.on('eprint.indexed', (data) => {
   *   console.log('Indexed:', data.uri);
   * });
   * ```
   *
   * @public
   */
  on(event: string, handler: (...args: readonly unknown[]) => void): void {
    this.enforceHookPermission(event);

    this.registeredHandlers.push({ event, handler });
    this.delegate.on(event, handler);
  }

  /**
   * Emits an event if the plugin has permission.
   *
   * @param event - Event name
   * @param args - Event arguments
   * @throws {PluginPermissionError} If hook not declared in manifest
   *
   * @remarks
   * Plugins can only emit events they have permission to subscribe to.
   * This prevents plugins from spoofing events they shouldn't have access to.
   *
   * @public
   */
  emit(event: string, ...args: readonly unknown[]): void {
    this.enforceHookPermission(event);

    this.delegate.emit(event, ...args);
  }

  /**
   * Emits an event asynchronously and waits for all handlers.
   *
   * @param event - Event name
   * @param args - Event arguments
   * @returns Promise that resolves when all handlers complete
   * @throws {PluginPermissionError} If hook not declared in manifest
   *
   * @public
   */
  async emitAsync(event: string, ...args: readonly unknown[]): Promise<void> {
    this.enforceHookPermission(event);

    await this.delegate.emitAsync(event, ...args);
  }

  /**
   * Subscribes to an event for one-time execution if the plugin has permission.
   *
   * @param event - Event name or pattern
   * @param handler - Event handler function (called once then removed)
   * @throws {PluginPermissionError} If hook not declared in manifest
   *
   * @public
   */
  once(event: string, handler: (...args: readonly unknown[]) => void): void {
    this.enforceHookPermission(event);

    // Wrap handler to remove from tracking after execution
    const wrappedHandler = (...args: readonly unknown[]): void => {
      // Remove from tracking before calling handler
      const index = this.registeredHandlers.findIndex(
        (h) => h.event === event && h.handler === wrappedHandler
      );
      if (index >= 0) {
        this.registeredHandlers.splice(index, 1);
      }
      handler(...args);
    };

    this.registeredHandlers.push({ event, handler: wrappedHandler });
    this.delegate.once(event, wrappedHandler);
  }

  /**
   * Unsubscribes from an event.
   *
   * @param event - Event name
   * @param handler - Handler to remove
   *
   * @public
   */
  off(event: string, handler: (...args: readonly unknown[]) => void): void {
    this.delegate.off(event, handler);

    // Remove from tracking
    const index = this.registeredHandlers.findIndex(
      (h) => h.event === event && h.handler === handler
    );
    if (index >= 0) {
      this.registeredHandlers.splice(index, 1);
    }
  }

  /**
   * Gets the number of listeners for an event.
   *
   * @param event - Event name
   * @returns Number of registered listeners
   *
   * @public
   */
  listenerCount(event: string): number {
    return this.delegate.listenerCount(event);
  }

  /**
   * Gets the names of all events with registered listeners.
   *
   * @returns Array of event names
   *
   * @public
   */
  eventNames(): string[] {
    return this.delegate.eventNames();
  }

  /**
   * Removes all listeners registered through this scoped bus.
   *
   * @remarks
   * This only removes handlers registered through this scoped bus,
   * not all handlers on the delegate.
   *
   * @public
   */
  removeAllListeners(): void {
    this.cleanup();
  }

  /**
   * Unregisters all handlers registered through this scoped bus.
   *
   * @remarks
   * Called during plugin unload to ensure all handlers are properly
   * cleaned up. This prevents memory leaks and orphaned handlers.
   *
   * @example
   * ```typescript
   * // During plugin shutdown
   * scopedEventBus.cleanup();
   * ```
   *
   * @public
   */
  cleanup(): void {
    for (const { event, handler } of this.registeredHandlers) {
      this.delegate.off(event, handler);
    }
    this.registeredHandlers.length = 0;
  }

  /**
   * Gets the number of handlers registered through this scoped bus.
   *
   * @returns Number of registered handlers
   *
   * @public
   */
  getHandlerCount(): number {
    return this.registeredHandlers.length;
  }

  /**
   * Gets the list of allowed hooks for this plugin.
   *
   * @returns Array of allowed hook patterns
   *
   * @public
   */
  getAllowedHooks(): readonly string[] {
    return Array.from(this.allowedHooks);
  }

  /**
   * Checks if a hook is allowed.
   *
   * @param hookName - Hook to check
   * @returns True if hook is allowed
   *
   * @public
   */
  isHookAllowed(hookName: string): boolean {
    return this.checkHookPermission(hookName);
  }

  /**
   * Enforces hook permission, throwing if denied.
   *
   * @param hookName - Hook to check
   * @throws {PluginPermissionError} If hook not allowed
   *
   * @internal
   */
  private enforceHookPermission(hookName: string): void {
    if (!this.checkHookPermission(hookName)) {
      throw new PluginPermissionError(this.pluginId, `hook:${hookName}`);
    }
  }

  /**
   * Checks if a hook is allowed by the plugin's declared permissions.
   *
   * @param hookName - Hook name to check
   * @returns True if hook is allowed
   *
   * @remarks
   * Supports exact matches and wildcard patterns:
   * - Exact: 'eprint.indexed' matches 'eprint.indexed'
   * - Wildcard: 'eprint.*' matches 'eprint.indexed', 'eprint.updated'
   *
   * @internal
   */
  private checkHookPermission(hookName: string): boolean {
    // Check exact match
    if (this.allowedHooks.has(hookName)) {
      return true;
    }

    // Check wildcard patterns
    for (const hook of this.allowedHooks) {
      if (this.matchesPattern(hook, hookName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if a hook name matches a pattern.
   *
   * @param pattern - Pattern to match against (may include wildcards)
   * @param hookName - Hook name to check
   * @returns True if pattern matches hook name
   *
   * @remarks
   * Pattern matching rules:
   * - Exact match: 'eprint.indexed' matches 'eprint.indexed'
   * - Trailing wildcard: 'eprint.*' matches 'eprint.indexed', 'eprint.updated'
   * - Double wildcard: 'eprint.**' matches 'eprint.indexed', 'eprint.version.created'
   *
   * @internal
   */
  private matchesPattern(pattern: string, hookName: string): boolean {
    // Exact match
    if (pattern === hookName) {
      return true;
    }

    // Trailing single wildcard (e.g., 'eprint.*')
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1); // Remove '*', keep '.'
      // Hook must start with prefix and have exactly one more segment
      if (hookName.startsWith(prefix)) {
        const suffix = hookName.slice(prefix.length);
        // No more dots means single segment
        return !suffix.includes('.');
      }
      return false;
    }

    // Trailing double wildcard (e.g., 'eprint.**')
    if (pattern.endsWith('.**')) {
      const prefix = pattern.slice(0, -2); // Remove '**', keep '.'
      return hookName.startsWith(prefix);
    }

    return false;
  }
}
