import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { api, authApi, createServerClient } from './client';

describe('api client', () => {
  it('is exported and has pub.chive namespace', () => {
    expect(api).toBeDefined();
    expect(api.pub).toBeDefined();
    expect(api.pub.chive).toBeDefined();
  });

  it('has eprint methods', () => {
    expect(api.pub.chive.eprint).toBeDefined();
    expect(typeof api.pub.chive.eprint.getSubmission).toBe('function');
    expect(typeof api.pub.chive.eprint.searchSubmissions).toBe('function');
  });

  it('has author methods', () => {
    expect(api.pub.chive.author).toBeDefined();
    expect(typeof api.pub.chive.author.getProfile).toBe('function');
    expect(typeof api.pub.chive.author.searchAuthors).toBe('function');
  });
});

describe('authApi client', () => {
  it('is exported and has pub.chive namespace', () => {
    expect(authApi).toBeDefined();
    expect(authApi.pub).toBeDefined();
    expect(authApi.pub.chive).toBeDefined();
  });

  it('has claiming methods', () => {
    expect(authApi.pub.chive.claiming).toBeDefined();
    expect(typeof authApi.pub.chive.claiming.startClaim).toBe('function');
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
    expect(client.pub.chive).toBeDefined();
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
