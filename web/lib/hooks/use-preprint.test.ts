import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockPreprint, createMockPreprintSummary } from '@/tests/mock-data';

import {
  preprintKeys,
  usePreprint,
  usePreprints,
  usePreprintsByAuthor,
  usePrefetchPreprint,
} from './use-preprint';

// Mock functions using vi.hoisted for proper hoisting
const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockApiGet,
  },
}));

describe('preprintKeys', () => {
  it('generates all key', () => {
    expect(preprintKeys.all).toEqual(['preprints']);
  });

  it('generates lists key', () => {
    expect(preprintKeys.lists()).toEqual(['preprints', 'list']);
  });

  it('generates list key with params', () => {
    const params = { limit: 10, cursor: 'abc', field: 'cs' };
    expect(preprintKeys.list(params)).toEqual(['preprints', 'list', params]);
  });

  it('generates details key', () => {
    expect(preprintKeys.details()).toEqual(['preprints', 'detail']);
  });

  it('generates detail key with uri', () => {
    const uri = 'at://did:plc:test/pub.chive.preprint.submission/123';
    expect(preprintKeys.detail(uri)).toEqual(['preprints', 'detail', uri]);
  });

  it('generates byAuthor key with did', () => {
    const did = 'did:plc:test123';
    expect(preprintKeys.byAuthor(did)).toEqual(['preprints', 'author', did]);
  });
});

describe('usePreprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a preprint by URI', async () => {
    const mockPreprint = createMockPreprint();
    mockApiGet.mockResolvedValueOnce({
      data: mockPreprint,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => usePreprint('at://did:plc:test/pub.chive.preprint.submission/123'),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPreprint);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.preprint.getSubmission', {
      params: { query: { uri: 'at://did:plc:test/pub.chive.preprint.submission/123' } },
    });
  });

  it('is disabled when uri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePreprint(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => usePreprint('at://did:plc:test/pub.chive.preprint.submission/123', { enabled: false }),
      { wrapper: Wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Not found' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => usePreprint('at://did:plc:test/pub.chive.preprint.submission/invalid'),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Not found');
  });
});

describe('usePreprints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a list of preprints', async () => {
    const mockData = {
      preprints: [createMockPreprintSummary(), createMockPreprintSummary()],
      cursor: 'next',
      hasMore: true,
      total: 10,
    };
    mockApiGet.mockResolvedValueOnce({
      data: mockData,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePreprints(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/preprints', {
      params: { query: expect.objectContaining({}) },
    });
  });

  it('passes parameters to the query', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { preprints: [], cursor: undefined, hasMore: false, total: 0 },
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => usePreprints({ limit: 10, cursor: 'abc', field: 'physics' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/preprints', {
      params: { query: expect.objectContaining({ limit: 10, cursor: 'abc', field: 'physics' }) },
    });
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Server error' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePreprints(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Server error');
  });
});

describe('usePreprintsByAuthor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches preprints by author DID', async () => {
    const mockData = {
      preprints: [createMockPreprintSummary()],
      cursor: undefined,
      hasMore: false,
    };
    mockApiGet.mockResolvedValueOnce({
      data: mockData,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePreprintsByAuthor({ did: 'did:plc:author123' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.preprint.listByAuthor', {
      params: { query: expect.objectContaining({ did: 'did:plc:author123' }) },
    });
  });

  it('is disabled when did is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePreprintsByAuthor({ did: '' }), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Author not found' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePreprintsByAuthor({ did: 'did:plc:invalid' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Author not found');
  });
});

describe('usePrefetchPreprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a prefetch function', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePrefetchPreprint(), { wrapper: Wrapper });

    expect(typeof result.current).toBe('function');
  });

  it('calls prefetchQuery when invoked', () => {
    const mockPreprint = createMockPreprint();
    mockApiGet.mockResolvedValueOnce({
      data: mockPreprint,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePrefetchPreprint(), { wrapper: Wrapper });

    // Call the prefetch function
    result.current('at://did:plc:test/pub.chive.preprint.submission/123');

    // The API should have been called
    expect(mockApiGet).toHaveBeenCalled();
  });
});
