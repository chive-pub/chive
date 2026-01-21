import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import {
  createMockTagSummary,
  createMockTagSuggestion,
  createMockEprintTagsResponse,
  createMockTrendingTagsResponse,
} from '@/tests/mock-data';
import { APIError } from '@/lib/errors';

import {
  tagKeys,
  useEprintTags,
  useTagSuggestions,
  useTrendingTags,
  useTagSearch,
  useTagDetail,
  useCreateTag,
  useDeleteTag,
  usePrefetchTags,
} from './use-tags';

// Mock functions must be hoisted along with vi.mock
const {
  mockListForEprint,
  mockGetSuggestions,
  mockGetTrending,
  mockTagSearch,
  mockGetDetail,
  mockGetCurrentAgent,
  mockCreateTagRecord,
  mockDeleteRecord,
} = vi.hoisted(() => ({
  mockListForEprint: vi.fn(),
  mockGetSuggestions: vi.fn(),
  mockGetTrending: vi.fn(),
  mockTagSearch: vi.fn(),
  mockGetDetail: vi.fn(),
  mockGetCurrentAgent: vi.fn(),
  mockCreateTagRecord: vi.fn(),
  mockDeleteRecord: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        tag: {
          listForEprint: mockListForEprint,
          getSuggestions: mockGetSuggestions,
          getTrending: mockGetTrending,
          search: mockTagSearch,
          getDetail: mockGetDetail,
        },
      },
    },
  },
}));

vi.mock('@/lib/auth/oauth-client', () => ({
  getCurrentAgent: mockGetCurrentAgent,
}));

vi.mock('@/lib/atproto/record-creator', () => ({
  createTagRecord: mockCreateTagRecord,
  deleteRecord: mockDeleteRecord,
}));

describe('tagKeys', () => {
  it('generates all key', () => {
    expect(tagKeys.all).toEqual(['tags']);
  });

  it('generates forEprint key', () => {
    const uri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    expect(tagKeys.forEprint(uri)).toEqual(['tags', 'eprint', uri]);
  });

  it('generates suggestions key', () => {
    expect(tagKeys.suggestions('machine')).toEqual(['tags', 'suggestions', 'machine']);
  });

  it('generates trending key with default time window', () => {
    expect(tagKeys.trending()).toEqual(['tags', 'trending', 'week']);
  });

  it('generates trending key with custom time window', () => {
    expect(tagKeys.trending('month')).toEqual(['tags', 'trending', 'month']);
  });

  it('generates search key', () => {
    expect(tagKeys.search('learning')).toEqual(['tags', 'search', 'learning', undefined]);
  });

  it('generates search key with params', () => {
    const params = { limit: 10, minQuality: 0.5 };
    expect(tagKeys.search('learning', params)).toEqual(['tags', 'search', 'learning', params]);
  });

  it('generates detail key', () => {
    expect(tagKeys.detail('machine-learning')).toEqual(['tags', 'detail', 'machine-learning']);
  });

  it('generates eprintsWithTag key', () => {
    expect(tagKeys.eprintsWithTag('machine-learning')).toEqual([
      'tags',
      'eprints',
      'machine-learning',
      undefined,
    ]);
  });
});

describe('useEprintTags', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tags for an eprint', async () => {
    const mockResponse = createMockEprintTagsResponse();
    mockListForEprint.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprintTags(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockListForEprint).toHaveBeenCalledWith({ eprintUri });
  });

  it('is disabled when eprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprintTags(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockListForEprint.mockRejectedValueOnce(new Error('Tags unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprintTags(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Tags unavailable');
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprintTags(eprintUri, { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockListForEprint).not.toHaveBeenCalled();
  });
});

describe('useTagSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tag suggestions', async () => {
    const suggestions = [
      createMockTagSuggestion({ normalizedForm: 'machine-learning' }),
      createMockTagSuggestion({ normalizedForm: 'deep-learning' }),
    ];
    mockGetSuggestions.mockResolvedValueOnce({
      data: { suggestions },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagSuggestions('machine'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The hook transforms 'cooccurrence' to 'co-occurrence' for display
    const expectedSuggestions = suggestions.map((s) => ({
      ...s,
      source: s.source === 'cooccurrence' ? 'co-occurrence' : s.source,
    }));
    expect(result.current.data).toEqual(expectedSuggestions);
    expect(mockGetSuggestions).toHaveBeenCalledWith({ q: 'machine' });
  });

  it('is disabled when query is less than 2 characters', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagSuggestions('m'), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is enabled when query is exactly 2 characters', async () => {
    mockGetSuggestions.mockResolvedValueOnce({
      data: { suggestions: [] },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagSuggestions('ml'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetSuggestions).toHaveBeenCalled();
  });

  it('throws error when API returns error', async () => {
    mockGetSuggestions.mockRejectedValueOnce(new Error('Suggestions unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagSuggestions('machine'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Suggestions unavailable');
  });
});

describe('useTrendingTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches trending tags with default time window', async () => {
    const mockResponse = createMockTrendingTagsResponse();
    mockGetTrending.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrendingTags(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockGetTrending).toHaveBeenCalledWith({ timeWindow: 'week' });
  });

  it('fetches trending tags with custom time window', async () => {
    const mockResponse = createMockTrendingTagsResponse();
    mockGetTrending.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrendingTags('month'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetTrending).toHaveBeenCalledWith({ timeWindow: 'month' });
  });

  it('throws error when API returns error', async () => {
    mockGetTrending.mockRejectedValueOnce(new Error('Trending unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrendingTags(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Trending unavailable');
  });
});

describe('useTagSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches tags', async () => {
    const mockResponse = {
      tags: [createMockTagSummary({ normalizedForm: 'machine-learning' })],
      total: 1,
      hasMore: false,
    };
    mockTagSearch.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagSearch('machine'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockTagSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'machine',
      })
    );
  });

  it('passes search parameters', async () => {
    mockTagSearch.mockResolvedValueOnce({
      data: { tags: [], total: 0, hasMore: false },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useTagSearch('ai', {
          limit: 20,
          minQuality: 0.5,
          includeSpam: false,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockTagSearch).toHaveBeenCalledWith({
      q: 'ai',
      limit: 20,
      minQuality: 0.5,
      includeSpam: false,
      cursor: undefined,
    });
  });

  it('is disabled when query is less than 2 characters', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagSearch('m'), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockTagSearch.mockRejectedValueOnce(new Error('Search failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagSearch('machine'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Search failed');
  });
});

describe('useTagDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tag detail', async () => {
    const mockTag = createMockTagSummary({ normalizedForm: 'machine-learning' });
    mockGetDetail.mockResolvedValueOnce({
      data: mockTag,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagDetail('machine-learning'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockTag);
    expect(mockGetDetail).toHaveBeenCalledWith({ tag: 'machine-learning' });
  });

  it('returns null for non-existent tag (404)', async () => {
    mockGetDetail.mockRejectedValueOnce(new APIError('Not found', 404, 'getDetail'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagDetail('nonexistent-tag'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it('is disabled when normalizedForm is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagDetail(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error for non-404 errors', async () => {
    mockGetDetail.mockRejectedValueOnce(new APIError('Server error', 500, 'getDetail'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTagDetail('machine-learning'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Server error');
  });
});

describe('useCreateTag', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
  const mockAgent = { did: 'did:plc:user123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a tag', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateTagRecord.mockResolvedValueOnce({
      uri: 'at://did:plc:user123/pub.chive.eprint.userTag/abc',
      cid: 'bafycid123',
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTag(), { wrapper: Wrapper });

    const tag = await result.current.mutateAsync({
      eprintUri,
      displayForm: 'Machine Learning',
    });

    expect(mockCreateTagRecord).toHaveBeenCalledWith(mockAgent, {
      eprintUri,
      displayForm: 'Machine Learning',
    });
    expect(tag.uri).toBe('at://did:plc:user123/pub.chive.eprint.userTag/abc');
    expect(tag.normalizedForm).toBe('machine learning');
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTag(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        eprintUri,
        displayForm: 'Test Tag',
      })
    ).rejects.toThrow('Not authenticated');
  });

  it('throws error when record creation fails', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateTagRecord.mockRejectedValueOnce(new Error('PDS write failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTag(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        eprintUri,
        displayForm: 'Test Tag',
      })
    ).rejects.toThrow('PDS write failed');
  });
});

describe('useDeleteTag', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
  const tagUri = 'at://did:plc:abc/pub.chive.eprint.userTag/456';
  const mockAgent = { did: 'did:plc:user123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a tag', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockDeleteRecord.mockResolvedValueOnce(undefined);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteTag(), { wrapper: Wrapper });

    await result.current.mutateAsync({ uri: tagUri, eprintUri });

    expect(mockDeleteRecord).toHaveBeenCalledWith(mockAgent, tagUri);
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteTag(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: tagUri, eprintUri })).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('throws error when record deletion fails', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockDeleteRecord.mockRejectedValueOnce(new Error('PDS delete failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteTag(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: tagUri, eprintUri })).rejects.toThrow(
      'PDS delete failed'
    );
  });
});

describe('usePrefetchTags', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefetches tags for an eprint', async () => {
    const mockResponse = createMockEprintTagsResponse();
    mockListForEprint.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => usePrefetchTags(), { wrapper: Wrapper });

    result.current(eprintUri);

    await waitFor(() => {
      expect(mockListForEprint).toHaveBeenCalledWith({ eprintUri });
    });

    // Check that data is in cache
    const cachedData = queryClient.getQueryData(tagKeys.forEprint(eprintUri));
    expect(cachedData).toEqual(mockResponse);
  });
});
