/**
 * Plugin event bus implementation using EventEmitter2.
 *
 * @remarks
 * This module provides the event bus for plugin hook system. It wraps
 * EventEmitter2 with wildcard support, error isolation, and async handling.
 *
 * Event naming convention:
 * - `preprint.*` - Preprint lifecycle events
 * - `review.*` - Review lifecycle events
 * - `plugin.*` - Plugin lifecycle events
 * - `system.*` - System-wide events
 *
 * @packageDocumentation
 * @public
 */

import EventEmitter2Module from 'eventemitter2';
import { singleton, inject } from 'tsyringe';

import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IPluginEventBus } from '../../types/interfaces/plugin.interface.js';

const { EventEmitter2 } = EventEmitter2Module;
type EventEmitter2Instance = InstanceType<typeof EventEmitter2>;

/**
 * EventEmitter2 configuration options.
 *
 * @internal
 */
const EMITTER_OPTIONS = {
  /**
   * Enable wildcard event patterns (e.g., 'preprint.*').
   */
  wildcard: true,

  /**
   * Delimiter for event namespaces.
   */
  delimiter: '.',

  /**
   * Maximum listeners per event before warning.
   */
  maxListeners: 100,

  /**
   * Log memory leak warnings.
   */
  verboseMemoryLeak: true,

  /**
   * Don't swallow errors in listeners.
   */
  ignoreErrors: false,

  /**
   * Create new listener arrays for each event.
   */
  newListener: false,

  /**
   * Remove listener event.
   */
  removeListener: false,
} as const;

/**
 * Handler registration entry for cleanup tracking.
 *
 * @internal
 */
interface HandlerEntry {
  /**
   * Original handler provided by caller.
   */
  original: (...args: readonly unknown[]) => void;

  /**
   * Wrapped handler registered with emitter.
   */
  wrapped: (...args: unknown[]) => void;
}

/**
 * Plugin event bus implementation.
 *
 * @remarks
 * Provides a pub/sub event system for plugin hooks built on EventEmitter2.
 * Features include:
 * - Wildcard event patterns (`preprint.*`)
 * - Namespace delimiter (`.`)
 * - Error isolation per handler
 * - Handler cleanup tracking
 * - Async event emission
 *
 * @example
 * ```typescript
 * const eventBus = container.resolve(PluginEventBus);
 *
 * // Subscribe to all preprint events
 * eventBus.on('preprint.*', (data) => {
 *   console.log('Preprint event:', data);
 * });
 *
 * // Emit specific event
 * eventBus.emit('preprint.indexed', { uri, title });
 *
 * // Emit and wait for all handlers
 * await eventBus.emitAsync('preprint.indexed', { uri, title });
 * ```
 *
 * @public
 */
@singleton()
export class PluginEventBus implements IPluginEventBus {
  /**
   * Underlying EventEmitter2 instance.
   */
  private readonly emitter: EventEmitter2Instance;

  /**
   * Logger instance.
   */
  private readonly logger: ILogger;

  /**
   * Handler function type for event bus.
   */
  private readonly handlerMap = new Map<
    string,
    Map<(...args: readonly unknown[]) => void, HandlerEntry>
  >();

  /**
   * Creates a new PluginEventBus.
   *
   * @param logger - Logger instance for event bus logging
   */
  constructor(@inject('ILogger') logger: ILogger) {
    this.logger = logger.child({ component: 'PluginEventBus' });
    this.emitter = new EventEmitter2(EMITTER_OPTIONS);

    this.logger.debug('Event bus initialized', {
      wildcard: EMITTER_OPTIONS.wildcard,
      delimiter: EMITTER_OPTIONS.delimiter,
      maxListeners: EMITTER_OPTIONS.maxListeners,
    });
  }

  /**
   * Subscribes to an event.
   *
   * @param event - Event name or pattern (supports wildcards like 'preprint.*')
   * @param handler - Event handler function
   *
   * @remarks
   * Handlers are wrapped to isolate errors. If a handler throws, the error
   * is logged but doesn't affect other handlers or crash the event bus.
   *
   * @example
   * ```typescript
   * // Subscribe to specific event
   * eventBus.on('preprint.indexed', (data) => {
   *   console.log('Indexed:', data.uri);
   * });
   *
   * // Subscribe to all preprint events
   * eventBus.on('preprint.*', (data) => {
   *   console.log('Preprint event:', data);
   * });
   * ```
   *
   * @public
   */
  on(event: string, handler: (...args: readonly unknown[]) => void): void {
    // Create wrapped handler for error isolation
    // Sync wrapper that starts async operation internally
    const wrappedHandler = (...args: unknown[]): void => {
      const asyncHandler = async (): Promise<void> => {
        try {
          const result = handler(...args) as unknown;
          // Handle async handlers
          if (result instanceof Promise) {
            await result;
          }
        } catch (error) {
          this.logger.error('Event handler error', error as Error, {
            event,
            handlerName: handler.name || 'anonymous',
          });
        }
      };
      void asyncHandler();
    };

    // Track mapping for removal
    let eventHandlers = this.handlerMap.get(event);
    if (!eventHandlers) {
      eventHandlers = new Map();
      this.handlerMap.set(event, eventHandlers);
    }

    const entry: HandlerEntry = {
      original: handler,
      wrapped: wrappedHandler,
    };

    eventHandlers.set(handler, entry);

    // Register with emitter
    this.emitter.on(event, wrappedHandler);

    this.logger.debug('Handler registered', {
      event,
      handlerName: handler.name || 'anonymous',
    });
  }

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
  once(event: string, handler: (...args: readonly unknown[]) => void): void {
    // Sync wrapper that starts async operation internally
    const wrappedHandler = (...args: unknown[]): void => {
      const asyncHandler = async (): Promise<void> => {
        try {
          const result = handler(...args) as unknown;
          if (result instanceof Promise) {
            await result;
          }
        } catch (error) {
          this.logger.error('Event handler error (once)', error as Error, {
            event,
          });
        } finally {
          // Clean up from map
          const eventHandlers = this.handlerMap.get(event);
          if (eventHandlers) {
            eventHandlers.delete(handler);
            if (eventHandlers.size === 0) {
              this.handlerMap.delete(event);
            }
          }
        }
      };
      void asyncHandler();
    };

    let eventHandlers = this.handlerMap.get(event);
    if (!eventHandlers) {
      eventHandlers = new Map();
      this.handlerMap.set(event, eventHandlers);
    }

    eventHandlers.set(handler, {
      original: handler,
      wrapped: wrappedHandler,
    });

    this.emitter.once(event, wrappedHandler);

    this.logger.debug('One-time handler registered', { event });
  }

  /**
   * Emits an event synchronously.
   *
   * @param event - Event name
   * @param args - Arguments to pass to handlers
   *
   * @remarks
   * This emits the event but doesn't wait for async handlers to complete.
   * Use {@link emitAsync} if you need to wait for all handlers.
   *
   * @example
   * ```typescript
   * eventBus.emit('preprint.indexed', {
   *   uri: 'at://did:plc:abc/pub.chive.preprint.submission/xyz',
   *   title: 'My Preprint',
   * });
   * ```
   *
   * @public
   */
  emit(event: string, ...args: readonly unknown[]): void {
    this.logger.debug('Emitting event', {
      event,
      argCount: args.length,
    });

    this.emitter.emit(event, ...args);
  }

  /**
   * Emits an event and waits for all handlers to complete.
   *
   * @param event - Event name
   * @param args - Arguments to pass to handlers
   * @returns Promise resolving when all handlers complete
   *
   * @example
   * ```typescript
   * await eventBus.emitAsync('preprint.indexed', {
   *   uri: 'at://did:plc:abc/pub.chive.preprint.submission/xyz',
   *   title: 'My Preprint',
   * });
   * console.log('All handlers completed');
   * ```
   *
   * @public
   */
  async emitAsync(event: string, ...args: readonly unknown[]): Promise<void> {
    this.logger.debug('Emitting async event', { event });

    await this.emitter.emitAsync(event, ...args);
  }

  /**
   * Unsubscribes from an event.
   *
   * @param event - Event name
   * @param handler - Handler function to remove
   *
   * @example
   * ```typescript
   * const handler = (data) => console.log(data);
   * eventBus.on('preprint.indexed', handler);
   *
   * // Later...
   * eventBus.off('preprint.indexed', handler);
   * ```
   *
   * @public
   */
  off(event: string, handler: (...args: readonly unknown[]) => void): void {
    const eventHandlers = this.handlerMap.get(event);
    if (!eventHandlers) {
      return;
    }

    const entry = eventHandlers.get(handler);
    if (!entry) {
      return;
    }

    // Remove from emitter using wrapped handler
    this.emitter.off(event, entry.wrapped);

    // Remove from tracking map
    eventHandlers.delete(handler);
    if (eventHandlers.size === 0) {
      this.handlerMap.delete(event);
    }

    this.logger.debug('Handler removed', {
      event,
      handlerName: handler.name || 'anonymous',
    });
  }

  /**
   * Gets listener count for an event pattern.
   *
   * @param event - Event name or pattern
   * @returns Number of listeners
   *
   * @public
   */
  listenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Gets all event names with listeners.
   *
   * @returns Array of event names
   *
   * @public
   */
  eventNames(): string[] {
    return this.emitter.eventNames() as string[];
  }

  /**
   * Removes all listeners.
   *
   * @remarks
   * Use during shutdown to clean up all event subscriptions.
   *
   * @public
   */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
    this.handlerMap.clear();

    this.logger.info('All event listeners removed');
  }

  /**
   * Removes all listeners for a specific event.
   *
   * @param event - Event name to clear
   *
   * @public
   */
  removeAllListenersForEvent(event: string): void {
    this.emitter.removeAllListeners(event);
    this.handlerMap.delete(event);

    this.logger.debug('Listeners removed for event', { event });
  }
}
