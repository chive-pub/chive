import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';

import { useDismissSuggestion, claimingKeys } from './use-claiming';

// Mock functions using vi.hoisted for proper hoisting
const { mockFetch, mockGetCurrentAgent, mockGetServiceAuthToken } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockGetCurrentAgent: vi.fn(),
  mockGetServiceAuthToken: vi.fn(),
}));

vi.mock('@/lib/auth/oauth-client', () => ({
  getCurrentAgent: mockGetCurrentAgent,
}));

vi.mock('@/lib/auth/service-auth', () => ({
  getServiceAuthToken: mockGetServiceAuthToken,
}));

// Mock the API client module
vi.mock('@/lib/api/client', () => ({
  api: {
    pub: { chive: { claiming: {} } },
  },
  authApi: {
    pub: {
      chive: {
        claiming: {
          getSuggestions: vi.fn().mockResolvedValue({ data: { papers: [], profileUsed: {} } }),
          getUserClaims: vi.fn().mockResolvedValue({ data: { claims: [] } }),
          getClaim: vi.fn().mockResolvedValue({ data: { claim: null } }),
          findClaimable: vi.fn().mockResolvedValue({ data: { eprints: [] } }),
          getPendingClaims: vi.fn().mockResolvedValue({ data: { claims: [] } }),
          getSubmissionData: vi.fn().mockResolvedValue({ data: {} }),
          startClaim: vi.fn().mockResolvedValue({ data: { claim: {} } }),
          completeClaim: vi.fn().mockResolvedValue({ data: { success: true } }),
          approveClaim: vi.fn().mockResolvedValue({ data: {} }),
          rejectClaim: vi.fn().mockResolvedValue({ data: {} }),
          getMyCoauthorRequests: vi.fn().mockResolvedValue({ data: { requests: [] } }),
          getCoauthorRequests: vi.fn().mockResolvedValue({ data: { requests: [] } }),
          requestCoauthorship: vi.fn().mockResolvedValue({ data: { request: {} } }),
          approveCoauthor: vi.fn().mockResolvedValue({ data: {} }),
          rejectCoauthor: vi.fn().mockResolvedValue({ data: {} }),
        },
      },
    },
  },
  getApiBaseUrl: vi.fn().mockReturnValue('https://api.chive.test'),
}));

// Mock observability
vi.mock('@/lib/observability', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock auth module
vi.mock('@/lib/auth', () => ({
  useCurrentUser: vi.fn(() => null),
  useAgent: vi.fn(() => null),
}));

describe('useDismissSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentAgent.mockReturnValue(null);
    mockGetServiceAuthToken.mockResolvedValue('test-token');
    vi.stubGlobal('fetch', mockFetch);
  });

  it('calls dismiss API endpoint with correct params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDismissSuggestion(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ source: 'arxiv', externalId: '2401.12345' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.chive.test/xrpc/pub.chive.claiming.dismissSuggestion',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ source: 'arxiv', externalId: '2401.12345' }),
      })
    );
  });

  it('optimistically removes paper from suggestion cache', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { Wrapper, queryClient } = createWrapper();

    // Pre-populate the suggestions cache
    const suggestionsKey = claimingKeys.suggestions({ limit: 20 });
    queryClient.setQueryData(suggestionsKey, {
      papers: [
        { source: 'arxiv', externalId: '2401.12345', title: 'Paper to Dismiss' },
        { source: 'arxiv', externalId: '2401.99999', title: 'Paper to Keep' },
      ],
      profileUsed: {
        displayName: undefined,
        nameVariants: [],
        hasOrcid: false,
        hasExternalIds: false,
      },
    });

    const { result } = renderHook(() => useDismissSuggestion(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ source: 'arxiv', externalId: '2401.12345' });
    });

    // Check that the cache was optimistically updated
    const cachedData = queryClient.getQueryData(suggestionsKey) as
      | {
          papers: Array<{ source: string; externalId: string }>;
        }
      | undefined;

    // The dismissed paper should be removed
    const dismissedPaper = cachedData?.papers.find(
      (p) => p.source === 'arxiv' && p.externalId === '2401.12345'
    );
    expect(dismissedPaper).toBeUndefined();

    // The other paper should remain
    const keptPaper = cachedData?.papers.find(
      (p) => p.source === 'arxiv' && p.externalId === '2401.99999'
    );
    expect(keptPaper).toBeDefined();
  });

  it('rolls back on error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    const { Wrapper, queryClient } = createWrapper();

    // Pre-populate the suggestions cache
    const suggestionsKey = claimingKeys.suggestions({ limit: 20 });
    const originalData = {
      papers: [{ source: 'arxiv', externalId: '2401.12345', title: 'Paper to Dismiss' }],
      profileUsed: {
        displayName: undefined,
        nameVariants: [],
        hasOrcid: false,
        hasExternalIds: false,
      },
    };
    queryClient.setQueryData(suggestionsKey, originalData);

    // Spy on setQueryData to verify rollback call
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => useDismissSuggestion(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ source: 'arxiv', externalId: '2401.12345' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Verify that setQueryData was called with the original data for rollback.
    // onSettled runs invalidateQueries after onError, which clears cache for
    // queries without active observers; so we verify the rollback call itself.
    const rollbackCall = setQueryDataSpy.mock.calls.find(
      ([key, data]) =>
        Array.isArray(key) &&
        key[0] === 'claiming' &&
        key[1] === 'suggestions' &&
        data != null &&
        typeof data === 'object' &&
        'papers' in data &&
        Array.isArray((data as { papers: unknown[] }).papers) &&
        (data as { papers: Array<{ externalId: string }> }).papers.some(
          (p) => p.externalId === '2401.12345'
        )
    );
    expect(rollbackCall).toBeDefined();
  });

  it('invalidates suggestions query on settle', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDismissSuggestion(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ source: 'arxiv', externalId: '2401.12345' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should have called invalidateQueries for suggestions
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['claiming', 'suggestions']),
      })
    );
  });
});
