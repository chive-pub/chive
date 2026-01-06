/**
 * Plugin registry for dependency injection integration.
 *
 * @remarks
 * This module registers plugin system components with the TSyringe
 * dependency injection container.
 *
 * @packageDocumentation
 * @public
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import type { DependencyContainer } from 'tsyringe';

import { IsolatedVmSandbox } from '../sandbox/isolated-vm-sandbox.js';
import { PermissionEnforcer } from '../sandbox/permission-enforcer.js';
import { ResourceGovernor } from '../sandbox/resource-governor.js';

import { PluginEventBus } from './event-bus.js';
import { PluginContextFactory } from './plugin-context.js';
import { PluginLoader } from './plugin-loader.js';
import { PluginManager } from './plugin-manager.js';

/**
 * Registers all plugin system components with the DI container.
 *
 * @remarks
 * Call this during application startup to make plugin system
 * components available for injection.
 *
 * Prerequisites:
 * - ILogger must be registered
 * - ICacheProvider must be registered
 * - IMetrics must be registered
 *
 * @example
 * ```typescript
 * // During application startup
 * registerPluginSystem();
 *
 * // Now plugin components can be resolved
 * const manager = container.resolve(PluginManager);
 * ```
 *
 * @public
 */
export function registerPluginSystem(): void {
  // Register singletons
  container.registerSingleton(PluginEventBus, PluginEventBus);
  container.registerSingleton(PermissionEnforcer, PermissionEnforcer);
  container.registerSingleton(ResourceGovernor, ResourceGovernor);
  container.registerSingleton(IsolatedVmSandbox, IsolatedVmSandbox);
  container.registerSingleton(PluginLoader, PluginLoader);
  container.registerSingleton(PluginContextFactory, PluginContextFactory);
  container.registerSingleton(PluginManager, PluginManager);

  // Register interface tokens
  container.register('IPluginManager', { useToken: PluginManager });
  container.register('IPluginLoader', { useToken: PluginLoader });
  container.register('IPluginSandbox', { useToken: IsolatedVmSandbox });
  container.register('IPermissionEnforcer', { useToken: PermissionEnforcer });
  container.register('IResourceGovernor', { useToken: ResourceGovernor });
}

/**
 * Registers plugin system with a custom container.
 *
 * @param customContainer - Custom DI container
 *
 * @remarks
 * Use this when you need to register with a child container
 * for testing or isolation purposes.
 *
 * @example
 * ```typescript
 * const testContainer = container.createChildContainer();
 * registerPluginSystemWithContainer(testContainer);
 * ```
 *
 * @public
 */
export function registerPluginSystemWithContainer(customContainer: DependencyContainer): void {
  customContainer.registerSingleton(PluginEventBus, PluginEventBus);
  customContainer.registerSingleton(PermissionEnforcer, PermissionEnforcer);
  customContainer.registerSingleton(ResourceGovernor, ResourceGovernor);
  customContainer.registerSingleton(IsolatedVmSandbox, IsolatedVmSandbox);
  customContainer.registerSingleton(PluginLoader, PluginLoader);
  customContainer.registerSingleton(PluginContextFactory, PluginContextFactory);
  customContainer.registerSingleton(PluginManager, PluginManager);

  customContainer.register('IPluginManager', { useToken: PluginManager });
  customContainer.register('IPluginLoader', { useToken: PluginLoader });
  customContainer.register('IPluginSandbox', { useToken: IsolatedVmSandbox });
  customContainer.register('IPermissionEnforcer', { useToken: PermissionEnforcer });
  customContainer.register('IResourceGovernor', { useToken: ResourceGovernor });
}

/**
 * Gets the plugin manager instance from the global container.
 *
 * @returns Plugin manager instance
 *
 * @example
 * ```typescript
 * const manager = getPluginManager();
 * await manager.loadPluginsFromDirectory('/opt/chive/plugins');
 * ```
 *
 * @public
 */
export function getPluginManager(): PluginManager {
  return container.resolve(PluginManager);
}

/**
 * Gets the event bus instance from the global container.
 *
 * @returns Event bus instance
 *
 * @example
 * ```typescript
 * const eventBus = getEventBus();
 * eventBus.emit('preprint.indexed', { uri, title });
 * ```
 *
 * @public
 */
export function getEventBus(): PluginEventBus {
  return container.resolve(PluginEventBus);
}

/**
 * Gets the permission enforcer instance from the global container.
 *
 * @returns Permission enforcer instance
 *
 * @public
 */
export function getPermissionEnforcer(): PermissionEnforcer {
  return container.resolve(PermissionEnforcer);
}

/**
 * Gets the resource governor instance from the global container.
 *
 * @returns Resource governor instance
 *
 * @public
 */
export function getResourceGovernor(): ResourceGovernor {
  return container.resolve(ResourceGovernor);
}

/**
 * Checks if the plugin system is registered.
 *
 * @returns True if plugin system is registered
 *
 * @public
 */
export function isPluginSystemRegistered(): boolean {
  try {
    container.resolve(PluginManager);
    return true;
  } catch {
    return false;
  }
}
