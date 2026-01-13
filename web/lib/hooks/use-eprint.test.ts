import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockEprint, createMockEprintSummary } from '@/tests/mock-data';

import {
  eprintKeys,
  useEprint,
  useEprints,
  useEprintsByAuthor,
  usePrefetchEprint,
} from './use-eprint';

// Mock functions using vi.hoisted for proper hoisting
const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockApiGet,
  },
}));

describe('eprintKeys', () => {
  it('generates all key', () => {
    expect(eprintKeys.all).toEqual(['eprints']);
  });

  it('generates lists key', () => {
    expect(eprintKeys.lists()).toEqual(['eprints', 'list']);
  });

  it('generates list key with params', () => {
    const params = { limit: 10, cursor: 'abc', field: 'cs' };
    expect(eprintKeys.list(params)).toEqual(['eprints', 'list', params]);
  });

  it('generates details key', () => {
    expect(eprintKeys.details()).toEqual(['eprints', 'detail']);
  });

  it('generates detail key with uri', () => {
    const uri = 'at://did:plc:test/pub.chive.eprint.submission/123';
    expect(eprintKeys.detail(uri)).toEqual(['eprints', 'detail', uri]);
  });

  it('generates byAuthor key with did', () => {
    const did = 'did:plc:test123';
    expect(eprintKeys.byAuthor(did)).toEqual(['eprints', 'author', did]);
  });
});

describe('useEprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a eprint by URI', async () => {
    const mockEprint = createMockEprint();
    mockApiGet.mockResolvedValueOnce({
      data: mockEprint,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useEprint('at://did:plc:test/pub.chive.eprint.submission/123'),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockEprint);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.eprint.getSubmission', {
      params: { query: { uri: 'at://did:plc:test/pub.chive.eprint.submission/123' } },
    });
  });

  it('is disabled when uri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprint(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useEprint('at://did:plc:test/pub.chive.eprint.submission/123', { enabled: false }),
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
      () => useEprint('at://did:plc:test/pub.chive.eprint.submission/invalid'),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Not found');
  });
});

describe('useEprints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a list of eprints with search query', async () => {
    const mockData = {
      eprints: [createMockEprintSummary(), createMockEprintSummary()],
      cursor: 'next',
      hasMore: true,
      total: 10,
    };
    mockApiGet.mockResolvedValueOnce({
      data: mockData,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprints({ q: 'machine learning' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/eprints', {
      params: { query: expect.objectContaining({ q: 'machine learning' }) },
    });
  });

  it('passes parameters to the query', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { eprints: [], cursor: undefined, hasMore: false, total: 0 },
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useEprints({ q: 'physics research', limit: 10, cursor: 'abc' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/eprints', {
      params: {
        query: expect.objectContaining({
          q: 'physics research',
          limit: 10,
          cursor: 'abc',
        }),
      },
    });
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Server error' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprints({ q: 'test query' }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Server error');
  });

  it('is disabled when search query is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprints(), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useEprintsByAuthor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches eprints by author DID', async () => {
    const mockData = {
      eprints: [createMockEprintSummary()],
      cursor: undefined,
      hasMore: false,
    };
    mockApiGet.mockResolvedValueOnce({
      data: mockData,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprintsByAuthor({ did: 'did:plc:author123' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.eprint.listByAuthor', {
      params: { query: expect.objectContaining({ did: 'did:plc:author123' }) },
    });
  });

  it('is disabled when did is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprintsByAuthor({ did: '' }), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Author not found' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprintsByAuthor({ did: 'did:plc:invalid' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Author not found');
  });
});

describe('usePrefetchEprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a prefetch function', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePrefetchEprint(), { wrapper: Wrapper });

    expect(typeof result.current).toBe('function');
  });

  it('calls prefetchQuery when invoked', () => {
    const mockEprint = createMockEprint();
    mockApiGet.mockResolvedValueOnce({
      data: mockEprint,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePrefetchEprint(), { wrapper: Wrapper });

    // Call the prefetch function
    result.current('at://did:plc:test/pub.chive.eprint.submission/123');

    // The API should have been called
    expect(mockApiGet).toHaveBeenCalled();
  });
});
