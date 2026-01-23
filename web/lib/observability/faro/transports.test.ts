/**
 * Tests for transport utilities.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock privacy module
vi.mock('./privacy', () => ({
  scrubObject: vi.fn((obj) => obj),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

import {
  logToConsole,
  storeOfflineItem,
  getOfflineItems,
  clearOfflineItems,
  isOnline,
  calculateBackoff,
  withRetry,
  createBatchingTransport,
  createConsoleTransport,
  createOfflineTransport,
  createRetryTransport,
} from './transports';

describe('Transport Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logToConsole', () => {
    it('logs message with log type', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logToConsole({ message: 'test' }, 'log');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Faro/Log]'),
        expect.objectContaining({ message: 'test' })
      );
    });

    it('logs exception with error type', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logToConsole({ error: 'test error' }, 'exception');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Faro/Error]'),
        expect.objectContaining({ error: 'test error' })
      );
    });

    it('logs measurement with debug', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      logToConsole({ metric: 100 }, 'measurement');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Faro/Metric]'),
        expect.objectContaining({ metric: 100 })
      );
    });

    it('logs trace with debug', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      logToConsole({ traceId: 'abc' }, 'trace');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Faro/Trace]'),
        expect.objectContaining({ traceId: 'abc' })
      );
    });

    it('logs event with log', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logToConsole({ event: 'click' }, 'event');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Faro/Event]'),
        expect.objectContaining({ event: 'click' })
      );
    });
  });

  describe('storeOfflineItem', () => {
    it('stores item in localStorage', () => {
      storeOfflineItem({ message: 'test' });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'chive:faro:offline',
        expect.any(String)
      );
    });

    it('appends to existing items', () => {
      localStorageMock.setItem('chive:faro:offline', JSON.stringify([{ message: 'first' }]));

      storeOfflineItem({ message: 'second' });

      const stored = JSON.parse(localStorageMock.getItem('chive:faro:offline') || '[]');
      expect(stored).toHaveLength(2);
    });

    it('limits to max items', () => {
      // Store 100 items first
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      localStorageMock.setItem('chive:faro:offline', JSON.stringify(items));

      // Store one more
      storeOfflineItem({ id: 100 });

      const stored = JSON.parse(localStorageMock.getItem('chive:faro:offline') || '[]');
      // Should keep only the last 100
      expect(stored.length).toBeLessThanOrEqual(100);
    });
  });

  describe('getOfflineItems', () => {
    it('returns empty array when nothing stored', () => {
      const items = getOfflineItems();

      expect(items).toEqual([]);
    });

    it('returns stored items', () => {
      localStorageMock.setItem('chive:faro:offline', JSON.stringify([{ message: 'test' }]));

      const items = getOfflineItems();

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({ message: 'test' });
    });
  });

  describe('clearOfflineItems', () => {
    it('removes items from localStorage', () => {
      localStorageMock.setItem('chive:faro:offline', JSON.stringify([{ message: 'test' }]));

      clearOfflineItems();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('chive:faro:offline');
    });
  });

  describe('isOnline', () => {
    it('returns navigator.onLine value', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });

      expect(isOnline()).toBe(true);

      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      expect(isOnline()).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('calculates exponential delay', () => {
      expect(calculateBackoff(0)).toBe(1000);
      expect(calculateBackoff(1)).toBe(2000);
      expect(calculateBackoff(2)).toBe(4000);
      expect(calculateBackoff(3)).toBe(8000);
    });

    it('respects max delay', () => {
      expect(calculateBackoff(10, 1000, 30000)).toBe(30000);
    });

    it('uses custom base delay', () => {
      expect(calculateBackoff(0, 500)).toBe(500);
      expect(calculateBackoff(1, 500)).toBe(1000);
    });
  });

  describe('withRetry', () => {
    it('returns result on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('throws after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(withRetry(fn, 2)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('deprecated transport functions', () => {
    const mockConfig = {
      collectorUrl: 'https://example.com',
      appName: 'test',
      appVersion: '1.0.0',
      environment: 'test',
      traceSampleRate: 1.0,
      sessionSampleRate: 1.0,
      enabled: true,
      instrumentConsole: true,
      instrumentPerformance: true,
      instrumentErrors: true,
    };

    it('createBatchingTransport returns inner transport', () => {
      const inner = { send: vi.fn() };

      const result = createBatchingTransport(mockConfig, inner);

      expect(result).toBe(inner);
    });

    it('createConsoleTransport returns null', () => {
      const result = createConsoleTransport(mockConfig);

      expect(result).toBeNull();
    });

    it('createOfflineTransport returns inner transport', () => {
      const inner = { send: vi.fn() };

      const result = createOfflineTransport(mockConfig, inner);

      expect(result).toBe(inner);
    });

    it('createRetryTransport returns inner transport', () => {
      const inner = { send: vi.fn() };

      const result = createRetryTransport(mockConfig, inner);

      expect(result).toBe(inner);
    });
  });
});
