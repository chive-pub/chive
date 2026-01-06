import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockSearchResults } from '@/tests/mock-data';

import { searchKeys, useSearch, useInstantSearch } from './use-search';

// Mock functions using vi.hoisted for proper hoisting
const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockApiGet,
  },
}));

describe('searchKeys', () => {
  it('generates all key', () => {
    expect(searchKeys.all).toEqual(['search']);
  });

  it('generates query key', () => {
    expect(searchKeys.query('machine learning')).toEqual(['search', 'machine learning', undefined]);
  });

  it('generates query key with params', () => {
    const params = { limit: 10, cursor: 'abc' };
    expect(searchKeys.query('AI', params)).toEqual(['search', 'AI', params]);
  });
});

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches preprints by query', async () => {
    const mockResults = createMockSearchResults();
    mockApiGet.mockResolvedValueOnce({
      data: mockResults,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearch('machine learning'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResults);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.preprint.searchSubmissions', {
      params: {
        query: expect.objectContaining({
          q: 'machine learning',
        }),
      },
    });
  });

  it('is disabled when query is less than 2 characters', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearch('a'), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is enabled when query is exactly 2 characters', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: createMockSearchResults({ total: 0, hits: [] }),
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearch('AI'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalled();
  });

  it('passes additional parameters', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: createMockSearchResults(),
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useSearch('physics', {
          limit: 20,
          cursor: 'next',
          field: 'physics',
          author: 'did:plc:author',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.preprint.searchSubmissions', {
      params: {
        query: expect.objectContaining({
          q: 'physics',
          limit: 20,
          cursor: 'next',
          field: 'physics',
          author: 'did:plc:author',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        }),
      },
    });
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Search service unavailable' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearch('test query'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Search service unavailable');
  });

  it('returns empty results for no matches', async () => {
    const emptyResults = createMockSearchResults({ hits: [], total: 0, hasMore: false });
    mockApiGet.mockResolvedValueOnce({
      data: emptyResults,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearch('nonexistent'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.hits).toHaveLength(0);
    expect(result.current.data?.total).toBe(0);
  });
});

describe('useInstantSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs instant search with limited results', async () => {
    const mockResults = createMockSearchResults();
    mockApiGet.mockResolvedValueOnce({
      data: mockResults,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInstantSearch('quick search'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.preprint.searchSubmissions', {
      params: {
        query: expect.objectContaining({
          q: 'quick search',
          limit: 5,
        }),
      },
    });
  });

  it('is disabled when query is less than 2 characters', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInstantSearch('x'), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Search failed' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInstantSearch('failing query'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Search failed');
  });
});
