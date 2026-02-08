import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockReviewsResponse, createMockReviewThread } from '@/tests/mock-data';

import {
  reviewKeys,
  useReviews,
  useInlineReviews,
  useReviewThread,
  useCreateReview,
  useDeleteReview,
  usePrefetchReviews,
} from './use-review';

// Mock functions using vi.hoisted for proper hoisting
const {
  mockListForEprint,
  mockGetThread,
  mockGetCurrentAgent,
  mockCreateReviewRecord,
  mockDeleteRecord,
} = vi.hoisted(() => ({
  mockListForEprint: vi.fn(),
  mockGetThread: vi.fn(),
  mockGetCurrentAgent: vi.fn(),
  mockCreateReviewRecord: vi.fn(),
  mockDeleteRecord: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        review: {
          listForEprint: mockListForEprint,
          getThread: mockGetThread,
        },
      },
    },
  },
  getApiBaseUrl: () => 'http://localhost:3001',
}));

vi.mock('@/lib/auth/oauth-client', () => ({
  getCurrentAgent: mockGetCurrentAgent,
}));

vi.mock('@/lib/atproto/record-creator', () => ({
  createReviewRecord: mockCreateReviewRecord,
  deleteRecord: mockDeleteRecord,
}));

describe('reviewKeys', () => {
  it('generates all key', () => {
    expect(reviewKeys.all).toEqual(['reviews']);
  });

  it('generates forEprint key', () => {
    const uri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    expect(reviewKeys.forEprint(uri)).toEqual(['reviews', 'eprint', uri]);
  });

  it('generates list key', () => {
    const uri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    expect(reviewKeys.list(uri)).toEqual(['reviews', 'eprint', uri, 'list', undefined]);
  });

  it('generates list key with params', () => {
    const uri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    const params = { limit: 10, cursor: 'abc' };
    expect(reviewKeys.list(uri, params)).toEqual(['reviews', 'eprint', uri, 'list', params]);
  });

  it('generates threads key', () => {
    expect(reviewKeys.threads()).toEqual(['reviews', 'thread']);
  });

  it('generates thread key', () => {
    const reviewUri = 'at://did:plc:abc/pub.chive.review.comment/456';
    expect(reviewKeys.thread(reviewUri)).toEqual(['reviews', 'thread', reviewUri]);
  });

  it('generates inline key', () => {
    const uri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    expect(reviewKeys.inline(uri)).toEqual(['reviews', 'eprint', uri, 'inline']);
  });

  it('generates byUser key', () => {
    const did = 'did:plc:user123';
    expect(reviewKeys.byUser(did)).toEqual(['reviews', 'user', did]);
  });
});

describe('useReviews', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches reviews for an eprint', async () => {
    const mockResponse = createMockReviewsResponse();
    mockListForEprint.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockListForEprint).toHaveBeenCalledWith(
      expect.objectContaining({
        eprintUri,
      })
    );
  });

  it('is disabled when eprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('passes additional parameters', async () => {
    mockListForEprint.mockResolvedValueOnce({
      data: createMockReviewsResponse(),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useReviews(eprintUri, {
          limit: 20,
          cursor: 'next',
          motivation: 'commenting',
          inlineOnly: false,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockListForEprint).toHaveBeenCalledWith({
      eprintUri,
      limit: 20,
      cursor: 'next',
      motivation: 'commenting',
      inlineOnly: false,
    });
  });

  it('throws error when API returns error', async () => {
    mockListForEprint.mockRejectedValueOnce(new Error('Reviews service unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Reviews service unavailable');
  });

  it('returns empty results when no reviews', async () => {
    const emptyResponse = createMockReviewsResponse({ reviews: [], total: 0, hasMore: false });
    mockListForEprint.mockResolvedValueOnce({
      data: emptyResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.reviews).toHaveLength(0);
    expect(result.current.data?.total).toBe(0);
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(eprintUri, {}, { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockListForEprint).not.toHaveBeenCalled();
  });
});

describe('useInlineReviews', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches inline reviews with inlineOnly flag', async () => {
    const mockResponse = createMockReviewsResponse();
    mockListForEprint.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInlineReviews(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockListForEprint).toHaveBeenCalledWith(
      expect.objectContaining({
        eprintUri,
        inlineOnly: true,
      })
    );
  });

  it('is disabled when eprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInlineReviews(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockListForEprint.mockRejectedValueOnce(new Error('Failed to fetch'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInlineReviews(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Failed to fetch');
  });
});

describe('useReviewThread', () => {
  const reviewUri = 'at://did:plc:abc/pub.chive.review.comment/456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches review thread', async () => {
    const mockThread = createMockReviewThread();
    mockGetThread.mockResolvedValueOnce({
      data: mockThread,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviewThread(reviewUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockThread);
    expect(mockGetThread).toHaveBeenCalledWith({ uri: reviewUri });
  });

  it('is disabled when reviewUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviewThread(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockGetThread.mockRejectedValueOnce(new Error('Thread not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviewThread(reviewUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Thread not found');
  });
});

describe('useCreateReview', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
  const mockAgent = { did: 'did:plc:user123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a review', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateReviewRecord.mockResolvedValueOnce({
      uri: 'at://did:plc:user123/pub.chive.review.comment/abc',
      cid: 'bafycid123',
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateReview(), { wrapper: Wrapper });

    const review = await result.current.mutateAsync({
      eprintUri,
      content: 'Great paper!',
      motivation: 'commenting',
    });

    expect(mockCreateReviewRecord).toHaveBeenCalledWith(mockAgent, {
      eprintUri,
      content: 'Great paper!',
      parentReviewUri: undefined,
      target: undefined,
      motivation: 'commenting',
      facets: undefined,
    });
    expect(review.uri).toBe('at://did:plc:user123/pub.chive.review.comment/abc');
    expect(review.content).toBe('Great paper!');
  });

  it('creates a review with target span', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateReviewRecord.mockResolvedValueOnce({
      uri: 'at://did:plc:user123/pub.chive.review.comment/abc',
      cid: 'bafycid123',
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateReview(), { wrapper: Wrapper });

    const target = {
      source: eprintUri,
      selector: {
        type: 'TextQuoteSelector' as const,
        exact: 'important finding',
        prefix: 'We found an ',
        suffix: ' in our study.',
      },
    };

    const review = await result.current.mutateAsync({
      eprintUri,
      content: 'This finding is significant.',
      target,
      motivation: 'highlighting',
    });

    expect(mockCreateReviewRecord).toHaveBeenCalledWith(mockAgent, {
      eprintUri,
      content: 'This finding is significant.',
      parentReviewUri: undefined,
      target,
      motivation: 'highlighting',
      facets: undefined,
    });
    expect(review.target).toEqual(target);
    expect(review.motivation).toBe('highlighting');
  });

  it('creates a reply to another review', async () => {
    const parentReviewUri = 'at://did:plc:other/pub.chive.review.comment/parent';
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateReviewRecord.mockResolvedValueOnce({
      uri: 'at://did:plc:user123/pub.chive.review.comment/abc',
      cid: 'bafycid123',
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateReview(), { wrapper: Wrapper });

    const review = await result.current.mutateAsync({
      eprintUri,
      content: 'I agree with your point.',
      parentReviewUri,
      motivation: 'replying',
    });

    expect(mockCreateReviewRecord).toHaveBeenCalledWith(mockAgent, {
      eprintUri,
      content: 'I agree with your point.',
      parentReviewUri,
      target: undefined,
      motivation: 'replying',
      facets: undefined,
    });
    expect(review.parentReviewUri).toBe(parentReviewUri);
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateReview(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        eprintUri,
        content: 'Test',
      })
    ).rejects.toThrow('Not authenticated');
  });

  it('throws error when record creation fails', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateReviewRecord.mockRejectedValueOnce(new Error('PDS write failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateReview(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        eprintUri,
        content: 'Test',
      })
    ).rejects.toThrow('PDS write failed');
  });
});

describe('useDeleteReview', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
  const reviewUri = 'at://did:plc:abc/pub.chive.review.comment/456';
  const mockAgent = { did: 'did:plc:user123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a review', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockDeleteRecord.mockResolvedValueOnce(undefined);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteReview(), { wrapper: Wrapper });

    await result.current.mutateAsync({ uri: reviewUri, eprintUri });

    expect(mockDeleteRecord).toHaveBeenCalledWith(mockAgent, reviewUri);
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteReview(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: reviewUri, eprintUri })).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('throws error when record deletion fails', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockDeleteRecord.mockRejectedValueOnce(new Error('PDS delete failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteReview(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: reviewUri, eprintUri })).rejects.toThrow(
      'PDS delete failed'
    );
  });
});

describe('usePrefetchReviews', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefetches reviews for an eprint', async () => {
    const mockResponse = createMockReviewsResponse();
    mockListForEprint.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => usePrefetchReviews(), { wrapper: Wrapper });

    result.current(eprintUri);

    await waitFor(() => {
      expect(mockListForEprint).toHaveBeenCalledWith(expect.objectContaining({ eprintUri }));
    });

    // Check that data is in cache
    const cachedData = queryClient.getQueryData(reviewKeys.list(eprintUri, {}));
    expect(cachedData).toEqual(mockResponse);
  });
});
