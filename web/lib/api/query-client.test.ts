import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { makeQueryClient, getQueryClient } from './query-client';

describe('makeQueryClient', () => {
  it('creates a QueryClient instance', () => {
    const client = makeQueryClient();
    expect(client).toBeDefined();
    expect(typeof client.getQueryCache).toBe('function');
    expect(typeof client.getMutationCache).toBe('function');
  });

  it('has staleTime of 30 seconds', () => {
    const client = makeQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.staleTime).toBe(30 * 1000);
  });

  it('has gcTime of 5 minutes', () => {
    const client = makeQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.gcTime).toBe(5 * 60 * 1000);
  });

  it('has refetchOnWindowFocus enabled', () => {
    const client = makeQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);
  });

  it('has refetchOnReconnect enabled', () => {
    const client = makeQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.refetchOnReconnect).toBe(true);
  });

  it('has single retry for queries', () => {
    const client = makeQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.retry).toBe(1);
  });

  it('has refetchOnMount enabled', () => {
    const client = makeQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.refetchOnMount).toBe(true);
  });

  it('has no retry for mutations', () => {
    const client = makeQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.mutations?.retry).toBe(0);
  });
});

describe('getQueryClient', () => {
  describe('server-side (window is undefined)', () => {
    const originalWindow = global.window;

    beforeEach(() => {
      // @ts-expect-error Simulating server environment.
      delete global.window;
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it('returns a new QueryClient on each call', () => {
      const client1 = getQueryClient();
      const client2 = getQueryClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('browser-side (window is defined)', () => {
    it('returns the same QueryClient on subsequent calls', () => {
      // In browser environment (window is defined)
      const client1 = getQueryClient();
      const client2 = getQueryClient();
      expect(client1).toBe(client2);
    });

    it('returns a singleton instance', () => {
      const client1 = getQueryClient();
      const client2 = getQueryClient();
      const client3 = getQueryClient();
      expect(client1).toBe(client2);
      expect(client2).toBe(client3);
    });
  });
});

describe('QueryClient functionality', () => {
  it('can get query cache', () => {
    const client = makeQueryClient();
    const cache = client.getQueryCache();
    expect(cache).toBeDefined();
    expect(typeof cache.find).toBe('function');
  });

  it('can get mutation cache', () => {
    const client = makeQueryClient();
    const cache = client.getMutationCache();
    expect(cache).toBeDefined();
  });

  it('can clear the cache', () => {
    const client = makeQueryClient();
    expect(() => client.clear()).not.toThrow();
  });

  it('can invalidate queries', async () => {
    const client = makeQueryClient();
    await expect(client.invalidateQueries()).resolves.toBeUndefined();
  });
});
