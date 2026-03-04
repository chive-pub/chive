/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for the useMyRoles hook.
 *
 * @remarks
 * Tests the query key factory, query configuration, and queryFn behavior
 * including authentication and error handling.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({
  getApiBaseUrl: () => 'https://api.chive.test',
}));

vi.mock('@/lib/auth/service-auth', () => ({
  getServiceAuthToken: vi.fn().mockResolvedValue('test-roles-token'),
}));

vi.mock('@/lib/auth/oauth-client', () => ({
  getCurrentAgent: vi.fn().mockReturnValue({ did: 'did:plc:testuser' }),
}));

vi.mock('@/lib/observability', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Import after mocks
import { useMyRoles, myRolesKeys, type MyRolesResponse } from '@/lib/hooks/use-my-roles';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function mockFetchResponse(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: vi.fn().mockResolvedValue(body),
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('myRolesKeys', () => {
  it('produces the correct key', () => {
    expect(myRolesKeys.all).toEqual(['myRoles']);
  });
});

describe('useMyRoles', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it('fetches from the correct endpoint with auth header', async () => {
    const rolesData: MyRolesResponse = {
      roles: ['admin', 'editor'],
      isAdmin: true,
      isAlphaTester: true,
      isPremium: false,
    };
    mockFetchResponse(rolesData);

    const { result } = renderHook(() => useMyRoles(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.chive.test/xrpc/pub.chive.actor.getMyRoles');
    expect((options.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-roles-token'
    );
    expect(result.current.data).toEqual(rolesData);
  });

  it('requests token for the correct NSID', async () => {
    const { getServiceAuthToken } = await import('@/lib/auth/service-auth');
    mockFetchResponse({ roles: [], isAdmin: false, isAlphaTester: false, isPremium: false });

    const { result } = renderHook(() => useMyRoles(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getServiceAuthToken).toHaveBeenCalledWith(
      expect.objectContaining({ did: 'did:plc:testuser' }),
      'pub.chive.actor.getMyRoles'
    );
  });

  it('continues without auth when getServiceAuthToken throws', async () => {
    const { getServiceAuthToken } = await import('@/lib/auth/service-auth');
    vi.mocked(getServiceAuthToken).mockRejectedValueOnce(new Error('token error'));
    mockFetchResponse({ roles: [], isAdmin: false, isAlphaTester: false, isPremium: false });

    const { result } = renderHook(() => useMyRoles(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('continues without auth when no agent is available', async () => {
    const { getCurrentAgent } = await import('@/lib/auth/oauth-client');
    vi.mocked(getCurrentAgent).mockReturnValueOnce(null);
    mockFetchResponse({ roles: [], isAdmin: false, isAlphaTester: false, isPremium: false });

    const { result } = renderHook(() => useMyRoles(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('throws with server error message on non-ok response', async () => {
    mockFetchResponse({ message: 'Unauthorized' }, false, 401);

    const { result } = renderHook(() => useMyRoles(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Unauthorized');
  });

  it('throws generic message when error body is not parseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error('invalid json')),
      })
    );

    const { result } = renderHook(() => useMyRoles(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to fetch roles');
  });

  it('throws generic message when error message field is not a string', async () => {
    mockFetchResponse({ message: 42 }, false, 400);

    const { result } = renderHook(() => useMyRoles(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to fetch roles');
  });

  it('can be disabled via options', async () => {
    mockFetchResponse({ roles: [], isAdmin: false, isAlphaTester: false, isPremium: false });

    const { result } = renderHook(() => useMyRoles({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetch).not.toHaveBeenCalled();
  });
});
