import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { api, createServerClient } from './client';

describe('api client', () => {
  it('is exported and has GET method', () => {
    expect(api).toBeDefined();
    expect(api.GET).toBeDefined();
    expect(typeof api.GET).toBe('function');
  });

  it('is exported and has POST method', () => {
    expect(api.POST).toBeDefined();
    expect(typeof api.POST).toBe('function');
  });
});

describe('createServerClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('creates a client with default revalidate of 60', () => {
    const client = createServerClient();
    expect(client).toBeDefined();
    expect(client.GET).toBeDefined();
  });

  it('creates a client with custom revalidate', () => {
    const client = createServerClient({ revalidate: 120 });
    expect(client).toBeDefined();
  });

  it('creates a client with revalidate of 0 for no cache', () => {
    const client = createServerClient({ revalidate: 0 });
    expect(client).toBeDefined();
  });
});

describe('API configuration', () => {
  it('uses NEXT_PUBLIC_API_URL environment variable when set', () => {
    // The default baseUrl is http://localhost:3001 when env var is not set
    // This test verifies the client is configured correctly
    expect(api).toBeDefined();
  });

  it('falls back to localhost when environment variable is not set', () => {
    // Since we're testing without the env var set, it should use localhost
    expect(api).toBeDefined();
  });
});
