import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockTrendingResponse } from '@/tests/mock-data';

import { trendingKeys, useTrending } from './use-trending';

// Mock functions must be hoisted along with vi.mock
const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockApiGet,
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
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.metrics.getTrending', {
      params: { query: { window: '7d', limit: 20 } },
    });
  });

  it('fetches trending eprints with 24h window', async () => {
    const mockResponse = createMockTrendingResponse({ window: '24h' });
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending({ window: '24h' }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.metrics.getTrending', {
      params: { query: { window: '24h', limit: 20 } },
    });
  });

  it('fetches trending eprints with 30d window', async () => {
    const mockResponse = createMockTrendingResponse({ window: '30d' });
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending({ window: '30d' }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.metrics.getTrending', {
      params: { query: { window: '30d', limit: 20 } },
    });
  });

  it('passes limit and cursor parameters', async () => {
    mockApiGet.mockResolvedValueOnce({
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

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.metrics.getTrending', {
      params: { query: { window: '7d', limit: 20, cursor: 'next' } },
    });
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Service unavailable' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrending(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Service unavailable');
  });

  it('returns trending data with ranks', async () => {
    const mockResponse = createMockTrendingResponse();
    mockApiGet.mockResolvedValueOnce({
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
    mockApiGet.mockResolvedValueOnce({
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
});
