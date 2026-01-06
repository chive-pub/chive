/**
 * Runtime permission enforcement for plugins.
 *
 * @remarks
 * This module provides permission enforcement for plugin operations using
 * ES6 Proxy wrappers. All service access is mediated through permission
 * checks based on the plugin's declared manifest permissions.
 *
 * @packageDocumentation
 * @public
 */

import { singleton, inject } from 'tsyringe';

import { PluginPermissionError, SandboxViolationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  IPermissionEnforcer,
  IChivePlugin,
  IPluginPermissions,
} from '../../types/interfaces/plugin.interface.js';

/**
 * Storage usage entry for quota tracking.
 *
 * @internal
 */
interface StorageUsage {
  /**
   * Current usage in bytes.
   */
  currentBytes: number;

  /**
   * Maximum allowed in bytes.
   */
  maxBytes: number;
}

/**
 * Permission enforcer implementation.
 *
 * @remarks
 * Provides runtime permission enforcement for plugins:
 * - Network access by domain allowlist
 * - Storage quota enforcement
 * - Hook access by declared permissions
 *
 * Uses ES6 Proxy to wrap service interfaces and check permissions
 * before each method call.
 *
 * @example
 * ```typescript
 * const enforcer = container.resolve(PermissionEnforcer);
 *
 * // Check permission
 * if (enforcer.checkPermission(plugin, 'network:api.github.com')) {
 *   // Plugin can access github
 * }
 *
 * // Create proxied service
 * const proxiedCache = enforcer.createPermissionProxy(
 *   cache,
 *   'storage:write',
 *   plugin
 * );
 *
 * // Enforce network access
 * enforcer.enforceNetworkAccess(plugin, 'api.github.com');
 * ```
 *
 * @public
 */
@singleton()
export class PermissionEnforcer implements IPermissionEnforcer {
  /**
   * Logger instance.
   */
  private readonly logger: ILogger;

  /**
   * Storage usage tracking per plugin.
   */
  private readonly storageUsage = new Map<string, StorageUsage>();

  /**
   * Creates a new PermissionEnforcer.
   *
   * @param logger - Logger instance
   */
  constructor(@inject('ILogger') logger: ILogger) {
    this.logger = logger.child({ component: 'PermissionEnforcer' });
  }

  /**
   * Checks if a plugin has a specific permission.
   *
   * @param plugin - Plugin to check
   * @param permission - Permission string
   * @returns True if permission is granted
   *
   * @remarks
   * Permission string formats:
   * - `network:domain.com` - Network access to domain
   * - `hook:event.name` - Hook subscription
   * - `storage:read` or `storage:write` - Storage access
   *
   * @example
   * ```typescript
   * if (enforcer.checkPermission(plugin, 'network:api.github.com')) {
   *   // Plugin can access github
   * }
   * ```
   *
   * @public
   */
  checkPermission(plugin: IChivePlugin, permission: string): boolean {
    const [type, value] = permission.split(':');
    const permissions = plugin.manifest.permissions;

    switch (type) {
      case 'network':
        return this.checkNetworkPermission(permissions, value ?? '');

      case 'hook':
        return this.checkHookPermission(permissions, value ?? '');

      case 'storage':
        return permissions.storage !== undefined;

      default:
        this.logger.warn('Unknown permission type', { type, permission });
        return false;
    }
  }

  /**
   * Creates a permission-checking proxy for a service.
   *
   * @param service - Service to wrap
   * @param requiredPermission - Permission required to access service
   * @param plugin - Plugin requesting access
   * @returns Proxied service that checks permissions on each call
   *
   * @remarks
   * The returned proxy intercepts all method calls and checks the
   * required permission before delegating to the actual method.
   *
   * @example
   * ```typescript
   * const proxiedCache = enforcer.createPermissionProxy(
   *   cache,
   *   'storage:write',
   *   plugin
   * );
   *
   * // This will check permission before calling set
   * await proxiedCache.set('key', 'value');
   * ```
   *
   * @public
   */
  createPermissionProxy<T extends object>(
    service: T,
    requiredPermission: string,
    plugin: IChivePlugin
  ): T {
    const checkPermission = this.checkPermission.bind(this);
    const logger = this.logger;

    return new Proxy(service, {
      get(target, prop, receiver): unknown {
        const value = Reflect.get(target, prop, receiver) as unknown;

        // Only wrap functions
        if (typeof value !== 'function') {
          return value;
        }

        // Type the value as a callable function
        const originalMethod = value as (...methodArgs: unknown[]) => unknown;

        // Wrap method with permission check
        return function (this: unknown, ...args: unknown[]): unknown {
          if (!checkPermission(plugin, requiredPermission)) {
            logger.warn('Permission denied', {
              pluginId: plugin.id,
              permission: requiredPermission,
              method: String(prop),
            });
            throw new PluginPermissionError(plugin.id, requiredPermission);
          }

          // Log access for audit
          logger.debug('Permission granted', {
            pluginId: plugin.id,
            permission: requiredPermission,
            method: String(prop),
          });

          // Call the original method with proper context
          const context = this === receiver ? target : this;
          return originalMethod.apply(context, args);
        };
      },
    });
  }

  /**
   * Enforces network access permission.
   *
   * @param plugin - Plugin requesting access
   * @param domain - Domain being accessed
   * @throws {SandboxViolationError} If access denied
   *
   * @example
   * ```typescript
   * enforcer.enforceNetworkAccess(plugin, 'api.github.com');
   * // Throws if plugin doesn't have network:api.github.com permission
   * ```
   *
   * @public
   */
  enforceNetworkAccess(plugin: IChivePlugin, domain: string): void {
    if (!this.checkNetworkPermission(plugin.manifest.permissions, domain)) {
      this.logger.warn('Network access denied', {
        pluginId: plugin.id,
        domain,
      });

      throw new SandboxViolationError(
        plugin.id,
        'NETWORK',
        `Network access denied to domain: ${domain}`
      );
    }

    this.logger.debug('Network access granted', {
      pluginId: plugin.id,
      domain,
    });
  }

  /**
   * Enforces storage limit.
   *
   * @param plugin - Plugin requesting storage
   * @param sizeBytes - Size of data being stored
   * @throws {SandboxViolationError} If quota exceeded
   *
   * @example
   * ```typescript
   * const dataSize = JSON.stringify(data).length;
   * enforcer.enforceStorageLimit(plugin, dataSize);
   * // Throws if adding dataSize would exceed quota
   * ```
   *
   * @public
   */
  enforceStorageLimit(plugin: IChivePlugin, sizeBytes: number): void {
    const maxSize = plugin.manifest.permissions.storage?.maxSize ?? 0;

    if (maxSize === 0) {
      throw new SandboxViolationError(plugin.id, 'STORAGE', 'Storage permission not granted');
    }

    // Get or create usage tracking
    let usage = this.storageUsage.get(plugin.id);
    if (!usage) {
      usage = { currentBytes: 0, maxBytes: maxSize };
      this.storageUsage.set(plugin.id, usage);
    }

    const newUsage = usage.currentBytes + sizeBytes;

    if (newUsage > maxSize) {
      this.logger.warn('Storage limit exceeded', {
        pluginId: plugin.id,
        currentUsage: usage.currentBytes,
        requested: sizeBytes,
        maxSize,
      });

      throw new SandboxViolationError(
        plugin.id,
        'STORAGE',
        `Storage limit exceeded: ${newUsage} bytes > ${maxSize} bytes`
      );
    }

    // Update usage
    usage.currentBytes = newUsage;

    this.logger.debug('Storage usage updated', {
      pluginId: plugin.id,
      currentUsage: newUsage,
      maxSize,
    });
  }

  /**
   * Enforces hook access permission.
   *
   * @param plugin - Plugin requesting hook access
   * @param hookName - Hook being accessed
   * @throws {SandboxViolationError} If hook not allowed
   *
   * @example
   * ```typescript
   * enforcer.enforceHookAccess(plugin, 'preprint.indexed');
   * // Throws if plugin doesn't have hook:preprint.indexed permission
   * ```
   *
   * @public
   */
  enforceHookAccess(plugin: IChivePlugin, hookName: string): void {
    if (!this.checkHookPermission(plugin.manifest.permissions, hookName)) {
      this.logger.warn('Hook access denied', {
        pluginId: plugin.id,
        hookName,
      });

      throw new SandboxViolationError(plugin.id, 'HOOK', `Hook access denied: ${hookName}`);
    }
  }

  /**
   * Resets storage usage tracking for a plugin.
   *
   * @param pluginId - ID of plugin to reset
   *
   * @remarks
   * Called when a plugin is unloaded or when storage is cleared.
   *
   * @public
   */
  resetStorageUsage(pluginId: string): void {
    this.storageUsage.delete(pluginId);

    this.logger.debug('Storage usage reset', { pluginId });
  }

  /**
   * Gets current storage usage for a plugin.
   *
   * @param pluginId - Plugin ID
   * @returns Current storage usage in bytes, or 0 if not tracked
   *
   * @public
   */
  getStorageUsage(pluginId: string): number {
    return this.storageUsage.get(pluginId)?.currentBytes ?? 0;
  }

  /**
   * Decreases storage usage for a plugin.
   *
   * @param pluginId - Plugin ID
   * @param sizeBytes - Size to subtract
   *
   * @remarks
   * Called when data is deleted from plugin storage.
   *
   * @internal
   */
  decreaseStorageUsage(pluginId: string, sizeBytes: number): void {
    const usage = this.storageUsage.get(pluginId);
    if (usage) {
      usage.currentBytes = Math.max(0, usage.currentBytes - sizeBytes);
    }
  }

  /**
   * Checks network permission for a domain.
   *
   * @param permissions - Plugin permissions
   * @param domain - Domain to check
   * @returns True if domain is allowed
   *
   * @internal
   */
  private checkNetworkPermission(permissions: IPluginPermissions, domain: string): boolean {
    const allowedDomains = permissions.network?.allowedDomains ?? [];

    for (const allowed of allowedDomains) {
      // Exact match
      if (allowed === domain) {
        return true;
      }

      // Wildcard subdomain match (e.g., *.github.com)
      if (allowed.startsWith('*.')) {
        const baseDomain = allowed.slice(2);
        if (domain === baseDomain || domain.endsWith(`.${baseDomain}`)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks hook permission.
   *
   * @param permissions - Plugin permissions
   * @param hookName - Hook to check
   * @returns True if hook is allowed
   *
   * @internal
   */
  private checkHookPermission(permissions: IPluginPermissions, hookName: string): boolean {
    const allowedHooks = permissions.hooks ?? [];

    // Check exact match
    if (allowedHooks.includes(hookName)) {
      return true;
    }

    // Check wildcard patterns
    for (const hook of allowedHooks) {
      // Single wildcard (preprint.* matches preprint.indexed)
      if (hook.endsWith('.*')) {
        const prefix = hook.slice(0, -1);
        if (hookName.startsWith(prefix) && !hookName.slice(prefix.length).includes('.')) {
          return true;
        }
      }

      // Double wildcard (preprint.** matches preprint.version.created)
      if (hook.endsWith('.**')) {
        const prefix = hook.slice(0, -2);
        if (hookName.startsWith(prefix)) {
          return true;
        }
      }
    }

    return false;
  }
}
