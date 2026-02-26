import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockTrendingResponse } from '@/tests/mock-data';

import { trendingKeys, useTrending } from './use-trending';

// Mock functions must be hoisted along with vi.mock
const { mockGetTrending } = vi.hoisted(() => ({
  mockGetTrending: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        metrics: {
          getTrending: mockGetTrending,
        },
      },
    },
  },
}));

describe('trendingKeys', () => {
  it('generates all key', () => {
    expect(trendingKeys.all).toEqual(['trending']);
  });

  it('generates window key for 24h', () => {
    expect(trendingKeys.window('24h')).toEqual(['trending', '24h']);
  });

  it('generates window key for 7d', () => {
    expect(trendingKeys.window('7d')).toEqual(['trending', '7d']);
  });

  it('generates window key for 30d', () => {
    expect(trendingKeys.window('30d')).toEqual(['trending', '30d']);
  });
});

describe('useTrending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches trending eprints with default window (7d)', async () => {
    const mockResponse = createMockTrendingResponse();
    mockGetTrending.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockGetTrending).toHaveBeenCalledWith({ window: '7d', limit: 20 });
  });

  it('fetches trending eprints with 24h window', async () => {
    const mockResponse = createMockTrendingResponse({ window: '24h' });
    mockGetTrending.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending({ window: '24h' }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetTrending).toHaveBeenCalledWith({ window: '24h', limit: 20 });
  });

  it('fetches trending eprints with 30d window', async () => {
    const mockResponse = createMockTrendingResponse({ window: '30d' });
    mockGetTrending.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending({ window: '30d' }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetTrending).toHaveBeenCalledWith({ window: '30d', limit: 20 });
  });

  it('passes limit and cursor parameters', async () => {
    mockGetTrending.mockResolvedValueOnce({
      data: createMockTrendingResponse(),
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending({ window: '7d', limit: 20, cursor: 'next' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetTrending).toHaveBeenCalledWith({ window: '7d', limit: 20, cursor: 'next' });
  });

  it('throws error when API returns error', async () => {
    mockGetTrending.mockRejectedValueOnce(new Error('Service unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Service unavailable');
  });

  it('returns trending data with ranks', async () => {
    const mockResponse = createMockTrendingResponse();
    mockGetTrending.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.trending[0]).toHaveProperty('rank');
    expect(result.current.data?.trending[0]).toHaveProperty('viewsInWindow');
    expect(result.current.data?.trending[0].rank).toBe(1);
  });

  it('returns hasMore and cursor for pagination', async () => {
    const mockResponse = createMockTrendingResponse({
      hasMore: true,
      cursor: 'next-page',
    });
    mockGetTrending.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.hasMore).toBe(true);
    expect(result.current.data?.cursor).toBe('next-page');
  });

  describe('with fieldUris', () => {
    it('uses personalized query key when fieldUris provided', async () => {
      const fieldUris = ['at://did:plc:gov/pub.chive.graph.node/ml-field'];
      mockGetTrending.mockResolvedValueOnce({
        data: createMockTrendingResponse(),
        error: undefined,
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTrending({ fieldUris }), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should have passed fieldUris to the API call
      expect(mockGetTrending).toHaveBeenCalledWith(
        expect.objectContaining({
          window: '7d',
          limit: 20,
          fieldUris,
        })
      );
    });

    it('uses standard query key without fieldUris', async () => {
      mockGetTrending.mockResolvedValueOnce({
        data: createMockTrendingResponse(),
        error: undefined,
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTrending({ window: '24h' }), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should NOT include fieldUris in the API call
      expect(mockGetTrending).toHaveBeenCalledWith({ window: '24h', limit: 20 });
    });

    it('uses standard query key when fieldUris array is empty', async () => {
      mockGetTrending.mockResolvedValueOnce({
        data: createMockTrendingResponse(),
        error: undefined,
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTrending({ fieldUris: [] }), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Empty fieldUris is passed through in params spread but hasFields is false,
      // so the query key uses the standard (non-personalized) window key
      expect(mockGetTrending).toHaveBeenCalledWith(
        expect.objectContaining({ window: '7d', limit: 20 })
      );
    });
  });
});

describe('trendingKeys.personalized', () => {
  it('generates personalized key with window and sorted fieldUris', () => {
    const fieldUris = ['at://b-field', 'at://a-field'];
    expect(trendingKeys.personalized('7d', fieldUris)).toEqual([
      'trending',
      '7d',
      'fields',
      'at://a-field',
      'at://b-field',
    ]);
  });

  it('generates different keys for different field sets', () => {
    const key1 = trendingKeys.personalized('7d', ['at://field-a']);
    const key2 = trendingKeys.personalized('7d', ['at://field-b']);
    expect(key1).not.toEqual(key2);
  });
});
