import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import {
  createMockEndorsement,
  createMockEndorsementsResponse,
  createMockEndorsementSummary,
} from '@/tests/mock-data';

import {
  endorsementKeys,
  useEndorsements,
  useEndorsementSummary,
  useUserEndorsement,
  useCreateEndorsement,
  useUpdateEndorsement,
  useDeleteEndorsement,
  usePrefetchEndorsements,
} from './use-endorsement';

// Mock functions using vi.hoisted for proper hoisting
const {
  mockApiGet,
  mockApiPost,
  mockGetCurrentAgent,
  mockCreateEndorsementRecord,
  mockUpdateEndorsementRecord,
  mockDeleteRecord,
} = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockGetCurrentAgent: vi.fn(),
  mockCreateEndorsementRecord: vi.fn(),
  mockUpdateEndorsementRecord: vi.fn(),
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
  createEndorsementRecord: mockCreateEndorsementRecord,
  updateEndorsementRecord: mockUpdateEndorsementRecord,
  deleteRecord: mockDeleteRecord,
}));

describe('endorsementKeys', () => {
  it('generates all key', () => {
    expect(endorsementKeys.all).toEqual(['endorsements']);
  });

  it('generates forPreprint key', () => {
    const uri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
    expect(endorsementKeys.forPreprint(uri)).toEqual(['endorsements', 'preprint', uri]);
  });

  it('generates list key', () => {
    const uri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
    expect(endorsementKeys.list(uri)).toEqual(['endorsements', 'preprint', uri, 'list', undefined]);
  });

  it('generates list key with params', () => {
    const uri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
    const params = { limit: 10, contributionType: 'methodological' as const };
    expect(endorsementKeys.list(uri, params)).toEqual([
      'endorsements',
      'preprint',
      uri,
      'list',
      params,
    ]);
  });

  it('generates summary key', () => {
    const uri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
    expect(endorsementKeys.summary(uri)).toEqual(['endorsements', 'preprint', uri, 'summary']);
  });

  it('generates userEndorsement key', () => {
    const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
    const userDid = 'did:plc:user';
    expect(endorsementKeys.userEndorsement(preprintUri, userDid)).toEqual([
      'endorsements',
      'preprint',
      preprintUri,
      'user',
      userDid,
    ]);
  });

  it('generates byUser key', () => {
    const did = 'did:plc:user123';
    expect(endorsementKeys.byUser(did)).toEqual(['endorsements', 'user', did]);
  });
});

describe('useEndorsements', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches endorsements for a preprint', async () => {
    const mockResponse = createMockEndorsementsResponse();
    mockApiGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsements(preprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.endorsement.listForPreprint', {
      params: {
        query: expect.objectContaining({
          preprintUri,
        }),
      },
    });
  });

  it('is disabled when preprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsements(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('passes additional parameters', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: createMockEndorsementsResponse(),
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useEndorsements(preprintUri, {
          limit: 20,
          cursor: 'next',
          contributionType: 'methodological',
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.endorsement.listForPreprint', {
      params: {
        query: {
          preprintUri,
          limit: 20,
          cursor: 'next',
          contributionType: 'methodological',
        },
      },
    });
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Endorsement service unavailable' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsements(preprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Endorsement service unavailable');
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsements(preprintUri, {}, { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe('useEndorsementSummary', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches endorsement summary', async () => {
    const mockSummary = createMockEndorsementSummary();
    mockApiGet.mockResolvedValueOnce({
      data: mockSummary,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsementSummary(preprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSummary);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.endorsement.getSummary', {
      params: { query: { preprintUri } },
    });
  });

  it('is disabled when preprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsementSummary(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Summary unavailable' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsementSummary(preprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Summary unavailable');
  });
});

describe('useUserEndorsement', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
  const userDid = 'did:plc:user';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches user endorsement', async () => {
    const mockEndorsement = createMockEndorsement({ endorserDid: userDid });
    mockApiGet.mockResolvedValueOnce({
      data: mockEndorsement,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement(preprintUri, userDid), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockEndorsement);
    expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.endorsement.getUserEndorsement', {
      params: { query: { preprintUri, userDid } },
    });
  });

  it('returns null when user has not endorsed (404)', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { status: 404, message: 'Not found' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement(preprintUri, userDid), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it('is disabled when preprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement('', userDid), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is disabled when userDid is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement(preprintUri, ''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error for non-404 errors', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: undefined,
      error: { status: 500, message: 'Server error' },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement(preprintUri, userDid), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Server error');
  });
});

describe('useCreateEndorsement', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
  const mockAgent = { did: 'did:plc:user123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an endorsement with single contribution type', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateEndorsementRecord.mockResolvedValueOnce({
      uri: 'at://did:plc:user123/pub.chive.review.endorsement/abc',
      cid: 'bafycid123',
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateEndorsement(), { wrapper: Wrapper });

    const endorsement = await result.current.mutateAsync({
      preprintUri,
      contributions: ['methodological'],
    });

    expect(mockCreateEndorsementRecord).toHaveBeenCalledWith(mockAgent, {
      preprintUri,
      contributions: ['methodological'],
    });
    expect(endorsement.uri).toBe('at://did:plc:user123/pub.chive.review.endorsement/abc');
    expect(endorsement.contributions).toEqual(['methodological']);
  });

  it('creates an endorsement with multiple contribution types', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateEndorsementRecord.mockResolvedValueOnce({
      uri: 'at://did:plc:user123/pub.chive.review.endorsement/abc',
      cid: 'bafycid123',
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateEndorsement(), { wrapper: Wrapper });

    const endorsement = await result.current.mutateAsync({
      preprintUri,
      contributions: ['methodological', 'analytical', 'empirical'],
    });

    expect(mockCreateEndorsementRecord).toHaveBeenCalledWith(mockAgent, {
      preprintUri,
      contributions: ['methodological', 'analytical', 'empirical'],
    });
    expect(endorsement.contributions).toEqual(['methodological', 'analytical', 'empirical']);
  });

  it('creates an endorsement with comment', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateEndorsementRecord.mockResolvedValueOnce({
      uri: 'at://did:plc:user123/pub.chive.review.endorsement/abc',
      cid: 'bafycid123',
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateEndorsement(), { wrapper: Wrapper });

    const endorsement = await result.current.mutateAsync({
      preprintUri,
      contributions: ['empirical', 'data'],
      comment: 'Excellent findings!',
    });

    expect(mockCreateEndorsementRecord).toHaveBeenCalledWith(mockAgent, {
      preprintUri,
      contributions: ['empirical', 'data'],
      comment: 'Excellent findings!',
    });
    expect(endorsement.comment).toBe('Excellent findings!');
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateEndorsement(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        preprintUri,
        contributions: ['methodological'],
      })
    ).rejects.toThrow('Not authenticated');
  });

  it('throws error when record creation fails', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockCreateEndorsementRecord.mockRejectedValueOnce(new Error('PDS write failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateEndorsement(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        preprintUri,
        contributions: ['methodological'],
      })
    ).rejects.toThrow('PDS write failed');
  });
});

describe('useUpdateEndorsement', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
  const endorsementUri = 'at://did:plc:abc/pub.chive.review.endorsement/456';
  const mockAgent = { did: 'did:plc:user123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates an endorsement with new contribution types', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockUpdateEndorsementRecord.mockResolvedValueOnce({
      uri: endorsementUri,
      cid: 'bafycid456',
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEndorsement(), { wrapper: Wrapper });

    const endorsement = await result.current.mutateAsync({
      uri: endorsementUri,
      preprintUri,
      contributions: ['methodological', 'analytical', 'data'],
    });

    expect(mockUpdateEndorsementRecord).toHaveBeenCalledWith(mockAgent, {
      uri: endorsementUri,
      contributions: ['methodological', 'analytical', 'data'],
      comment: undefined,
    });
    expect(endorsement.contributions).toEqual(['methodological', 'analytical', 'data']);
  });

  it('updates an endorsement with new comment', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockUpdateEndorsementRecord.mockResolvedValueOnce({
      uri: endorsementUri,
      cid: 'bafycid456',
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEndorsement(), { wrapper: Wrapper });

    const endorsement = await result.current.mutateAsync({
      uri: endorsementUri,
      preprintUri,
      contributions: ['empirical'],
      comment: 'Updated comment',
    });

    expect(mockUpdateEndorsementRecord).toHaveBeenCalledWith(mockAgent, {
      uri: endorsementUri,
      contributions: ['empirical'],
      comment: 'Updated comment',
    });
    expect(endorsement.comment).toBe('Updated comment');
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEndorsement(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        uri: endorsementUri,
        preprintUri,
        contributions: ['methodological'],
      })
    ).rejects.toThrow('Not authenticated');
  });

  it('throws error when record update fails', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockUpdateEndorsementRecord.mockRejectedValueOnce(new Error('PDS update failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEndorsement(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        uri: endorsementUri,
        preprintUri,
        contributions: ['methodological'],
      })
    ).rejects.toThrow('PDS update failed');

    expect(mockUpdateEndorsementRecord).toHaveBeenCalledWith(mockAgent, {
      uri: endorsementUri,
      contributions: ['methodological'],
      comment: undefined,
    });
  });
});

describe('useDeleteEndorsement', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';
  const endorsementUri = 'at://did:plc:abc/pub.chive.review.endorsement/456';
  const mockAgent = { did: 'did:plc:user123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes an endorsement', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockDeleteRecord.mockResolvedValueOnce(undefined);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEndorsement(), { wrapper: Wrapper });

    await result.current.mutateAsync({ uri: endorsementUri, preprintUri });

    expect(mockDeleteRecord).toHaveBeenCalledWith(mockAgent, endorsementUri);
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEndorsement(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: endorsementUri, preprintUri })).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('throws error when record deletion fails', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockDeleteRecord.mockRejectedValueOnce(new Error('PDS delete failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEndorsement(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: endorsementUri, preprintUri })).rejects.toThrow(
      'PDS delete failed'
    );
  });
});

describe('usePrefetchEndorsements', () => {
  const preprintUri = 'at://did:plc:abc/pub.chive.preprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefetches endorsement summary for a preprint', async () => {
    const mockSummary = createMockEndorsementSummary();
    mockApiGet.mockResolvedValueOnce({
      data: mockSummary,
      error: undefined,
    });

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => usePrefetchEndorsements(), { wrapper: Wrapper });

    result.current(preprintUri);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/xrpc/pub.chive.endorsement.getSummary', {
        params: { query: { preprintUri } },
      });
    });

    // Check that data is in cache
    const cachedData = queryClient.getQueryData(endorsementKeys.summary(preprintUri));
    expect(cachedData).toEqual(mockSummary);
  });
});
