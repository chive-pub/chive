/**
 * Shared DI registration helpers for the plugin system.
 *
 * @remarks
 * Both the API server and the indexer load the plugin system, which depends
 * on `ILogger`, `ICacheProvider`, and `IMetrics` being registered with the
 * tsyringe container before `registerPluginSystem()` is called. These helpers
 * centralize that wiring so the two entry points can't drift apart.
 *
 * @packageDocumentation
 */

import type { Redis } from 'ioredis';
import { container } from 'tsyringe';

import type { ICacheProvider } from '../../types/interfaces/cache.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IMetrics } from '../../types/interfaces/metrics.interface.js';

export function createPluginCacheProvider(redis: Redis): ICacheProvider {
  const PREFIX = 'chive:plugin:';
  return {
    async get<T>(key: string): Promise<T | null> {
      const value = await redis.get(`${PREFIX}${key}`);
      if (value === null) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setex(`${PREFIX}${key}`, ttl, serialized);
      } else {
        await redis.set(`${PREFIX}${key}`, serialized);
      }
    },
    async delete(key: string): Promise<void> {
      await redis.del(`${PREFIX}${key}`);
    },
    async exists(key: string): Promise<boolean> {
      const result = await redis.exists(`${PREFIX}${key}`);
      return result === 1;
    },
    async expire(key: string, ttl: number): Promise<void> {
      await redis.expire(`${PREFIX}${key}`, ttl);
    },
  };
}

export function createNoopMetrics(): IMetrics {
  const noop = (): void => {
    // No-op metrics provider; replace with Prometheus in production.
  };
  return {
    incrementCounter: noop,
    setGauge: noop,
    observeHistogram: noop,
    startTimer: () => noop,
  };
}

/**
 * Pre-registers the tokens that `registerPluginSystem()` resolves.
 */
export function registerPluginDependencies(logger: ILogger, redis: Redis): void {
  container.register('ILogger', { useValue: logger });
  container.register('ICacheProvider', { useValue: createPluginCacheProvider(redis) });
  container.register('IMetrics', { useValue: createNoopMetrics() });
}
