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
const { mockApiGet, mockApiPost, mockGetCurrentAgent, mockCreateReviewRecord, mockDeleteRecord } =
  vi.hoisted(() => ({
    mockApiGet: vi.fn(),
    mockApiPost: vi.fn(),
    mockGetCurrentAgent: vi.fn(),
    mockCreateReviewRecord: vi.fn(),
    mockDeleteRecord: vi.fn(),
  }));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockApiGet,
    POST: mockApiPost,
  },
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

  it('generates forPreprint key', () => {
    const uri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
    expect(reviewKeys.forPreprint(uri)).toEqual(['reviews', 'preprint', uri]);
  });

  it('generates list key', () => {
    const uri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
    expect(reviewKeys.list(uri)).toEqual(['reviews', 'preprint', uri, 'list', undefined]);
  });

  it('generates list key with params', () => {
    const uri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
    const params = { limit: 10, cursor: 'abc' };
    expect(reviewKeys.list(uri, params)).toEqual(['reviews', 'preprint', uri, 'list', params]);
  });

  it('generates threads key', () => {
    expect(reviewKeys.threads()).toEqual(['reviews', 'thread']);
  });

  it('generates thread key', () => {
    const reviewUri = 'at://did:plc:abc/pub.chive.review.comment/456';
    expect(reviewKeys.thread(reviewUri)).toEqual(['reviews', 'thread', reviewUri]);
  });

  it('generates inline key', () => {
    const uri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
    expect(reviewKeys.inline(uri)).toEqual(['reviews', 'preprint', uri, 'inline']);
  });

  it('generates byUser key', () => {
    const did = 'did:plc:user123';
    expect(reviewKeys.byUser(did)).toEqual(['reviews', 'user', did]);
  });
});

describe('useReviews', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches reviews for a preprint', async () => {
    const mockResponse = createMockReviewsResponse();
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(preprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.review.listForPreprint', {
      params: {
        query: expect.objectContaining({
          preprintUri,
        }),
      },
    });
  });

  it('is disabled when preprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('passes additional parameters', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: createMockReviewsResponse(),
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useReviews(preprintUri, {
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

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.review.listForPreprint', {
      params: {
        query: {
          preprintUri,
          limit: 20,
          cursor: 'next',
          motivation: 'commenting',
          inlineOnly: false,
        },
      },
    });
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Reviews service unavailable' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(preprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Reviews service unavailable');
  });

  it('returns empty results when no reviews', async () => {
    const emptyResponse = createMockReviewsResponse({ reviews: [], total: 0, hasMore: false });
    mockApiGet.mockResolvedValueOnce({
      data: emptyResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(preprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.reviews).toHaveLength(0);
    expect(result.current.data?.total).toBe(0);
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviews(preprintUri, {}, { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('useInlineReviews', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches inline reviews with inlineOnly flag', async () => {
    const mockResponse = createMockReviewsResponse();
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInlineReviews(preprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.review.listForPreprint', {
      params: {
        query: expect.objectContaining({
          preprintUri,
          inlineOnly: true,
        }),
      },
    });
  });

  it('is disabled when preprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInlineReviews(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Failed to fetch' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useInlineReviews(preprintUri), { wrapper: Wrapper });

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
    mockApiGet.mockResolvedValueOnce({
      data: mockThread,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviewThread(reviewUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockThread);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.review.getThread', {
      params: { query: { uri: reviewUri } },
    });
  });

  it('is disabled when reviewUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviewThread(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Thread not found' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReviewThread(reviewUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Thread not found');
  });
});

describe('useCreateReview', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
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
      preprintUri,
      content: 'Great paper!',
      motivation: 'commenting',
    });

    expect(mockCreateReviewRecord).toHaveBeenCalledWith(mockAgent, {
      preprintUri,
      content: 'Great paper!',
      parentReviewUri: undefined,
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
      source: preprintUri,
      selector: {
        type: 'TextQuoteSelector' as const,
        exact: 'important finding',
        prefix: 'We found an ',
        suffix: ' in our study.',
      },
    };

    const review = await result.current.mutateAsync({
      preprintUri,
      content: 'This finding is significant.',
      target,
      motivation: 'highlighting',
    });

    expect(mockCreateReviewRecord).toHaveBeenCalledWith(mockAgent, {
      preprintUri,
      content: 'This finding is significant.',
      parentReviewUri: undefined,
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
      preprintUri,
      content: 'I agree with your point.',
      parentReviewUri,
      motivation: 'replying',
    });

    expect(mockCreateReviewRecord).toHaveBeenCalledWith(mockAgent, {
      preprintUri,
      content: 'I agree with your point.',
      parentReviewUri,
    });
    expect(review.parentReviewUri).toBe(parentReviewUri);
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateReview(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        preprintUri,
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
        preprintUri,
        content: 'Test',
      })
    ).rejects.toThrow('PDS write failed');
  });
});

describe('useDeleteReview', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
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

    await result.current.mutateAsync({ uri: reviewUri, preprintUri });

    expect(mockDeleteRecord).toHaveBeenCalledWith(mockAgent, reviewUri);
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteReview(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: reviewUri, preprintUri })).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('throws error when record deletion fails', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockDeleteRecord.mockRejectedValueOnce(new Error('PDS delete failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteReview(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: reviewUri, preprintUri })).rejects.toThrow(
      'PDS delete failed'
    );
  });
});

describe('usePrefetchReviews', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefetches reviews for a preprint', async () => {
    const mockResponse = createMockReviewsResponse();
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => usePrefetchReviews(), { wrapper: Wrapper });

    result.current(preprintUri);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.review.listForPreprint', {
        params: { query: expect.objectContaining({ preprintUri }) },
      });
    });

    // Check that data is in cache
    const cachedData = queryClient.getQueryData(reviewKeys.list(preprintUri, {}));
    expect(cachedData).toEqual(mockResponse);
  });
});
