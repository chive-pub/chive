/**
 * Transport utilities for Faro.
 *
 * @remarks
 * The Faro SDK includes built-in transports that handle batching,
 * retry, and offline support. This module provides helper utilities
 * for custom logging in development mode.
 *
 * @packageDocumentation
 */

import type { FaroConfig } from './config';
import { scrubObject } from './privacy';

/**
 * Log a Faro item to the console (for development).
 *
 * @param item - The item to log
 * @param type - The item type
 */
export function logToConsole(
  item: unknown,
  type: 'log' | 'exception' | 'measurement' | 'trace' | 'event'
): void {
  const scrubbed = scrubObject(item);
  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 12) ?? '';

  switch (type) {
    case 'log':
      console.log(`[${timestamp}] [Faro/Log]`, scrubbed);
      break;
    case 'exception':
      console.error(`[${timestamp}] [Faro/Error]`, scrubbed);
      break;
    case 'measurement':
      console.debug(`[${timestamp}] [Faro/Metric]`, scrubbed);
      break;
    case 'trace':
      console.debug(`[${timestamp}] [Faro/Trace]`, scrubbed);
      break;
    case 'event':
      console.log(`[${timestamp}] [Faro/Event]`, scrubbed);
      break;
    default:
      console.log(`[${timestamp}] [Faro/${type}]`, scrubbed);
  }
}

/**
 * Storage key for offline items.
 */
const OFFLINE_STORAGE_KEY = 'chive:faro:offline';

/**
 * Maximum items to store offline.
 */
const MAX_OFFLINE_ITEMS = 100;

/**
 * Store an item for later transmission when offline.
 *
 * @param item - Item to store
 */
export function storeOfflineItem(item: unknown): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const stored = localStorage.getItem(OFFLINE_STORAGE_KEY);
    const items: unknown[] = stored ? JSON.parse(stored) : [];

    items.push({
      ...(scrubObject(item) as object),
      _storedAt: Date.now(),
    });

    // Keep only recent items
    const toStore = items.slice(-MAX_OFFLINE_ITEMS);
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Storage may be full or unavailable
    try {
      // Try to store just the new item
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify([item]));
    } catch {
      // Give up silently
    }
  }
}

/**
 * Get stored offline items.
 *
 * @returns Array of stored items
 */
export function getOfflineItems(): unknown[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const stored = localStorage.getItem(OFFLINE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Clear stored offline items.
 */
export function clearOfflineItems(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(OFFLINE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

/**
 * Check if the browser is online.
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Calculate exponential backoff delay.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseMs - Base delay in milliseconds
 * @param maxMs - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number, baseMs = 1000, maxMs = 30000): number {
  const delay = baseMs * Math.pow(2, attempt);
  return Math.min(delay, maxMs);
}

/**
 * Create a simple retry function.
 *
 * @param fn - Function to retry
 * @param maxAttempts - Maximum attempts
 * @returns Promise that resolves when successful
 */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts - 1) {
        const delay = calculateBackoff(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error('All retry attempts failed');
}

// Re-export placeholder functions for backwards compatibility
// The actual transport creation is handled by Faro SDK internally

/**
 * @deprecated Use Faro's built-in transports instead
 */
export function createBatchingTransport(_config: FaroConfig, innerTransport: unknown) {
  return innerTransport;
}

/**
 * @deprecated Use Faro's built-in console instrumentation instead
 */
export function createConsoleTransport(_config: FaroConfig) {
  return null;
}

/**
 * @deprecated Use Faro's built-in offline support instead
 */
export function createOfflineTransport(_config: FaroConfig, innerTransport: unknown) {
  return innerTransport;
}

/**
 * @deprecated Use Faro's built-in retry logic instead
 */
export function createRetryTransport(_config: FaroConfig, innerTransport: unknown) {
  return innerTransport;
}
