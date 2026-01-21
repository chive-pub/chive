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
import { APIError } from '@/lib/errors';

// Mock functions using vi.hoisted for proper hoisting
const {
  mockListForEprint,
  mockGetSummary,
  mockGetUserEndorsement,
  mockGetCurrentAgent,
  mockCreateEndorsementRecord,
  mockUpdateEndorsementRecord,
  mockDeleteRecord,
} = vi.hoisted(() => ({
  mockListForEprint: vi.fn(),
  mockGetSummary: vi.fn(),
  mockGetUserEndorsement: vi.fn(),
  mockGetCurrentAgent: vi.fn(),
  mockCreateEndorsementRecord: vi.fn(),
  mockUpdateEndorsementRecord: vi.fn(),
  mockDeleteRecord: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        endorsement: {
          listForEprint: mockListForEprint,
          getSummary: mockGetSummary,
        },
      },
    },
  },
  authApi: {
    pub: {
      chive: {
        endorsement: {
          getUserEndorsement: mockGetUserEndorsement,
        },
      },
    },
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

  it('generates forEprint key', () => {
    const uri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    expect(endorsementKeys.forEprint(uri)).toEqual(['endorsements', 'eprint', uri]);
  });

  it('generates list key', () => {
    const uri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    expect(endorsementKeys.list(uri)).toEqual(['endorsements', 'eprint', uri, 'list', undefined]);
  });

  it('generates list key with params', () => {
    const uri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    const params = { limit: 10, contributionType: 'methodological' as const };
    expect(endorsementKeys.list(uri, params)).toEqual([
      'endorsements',
      'eprint',
      uri,
      'list',
      params,
    ]);
  });

  it('generates summary key', () => {
    const uri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    expect(endorsementKeys.summary(uri)).toEqual(['endorsements', 'eprint', uri, 'summary']);
  });

  it('generates userEndorsement key', () => {
    const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    const userDid = 'did:plc:user';
    expect(endorsementKeys.userEndorsement(eprintUri, userDid)).toEqual([
      'endorsements',
      'eprint',
      eprintUri,
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
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches endorsements for an eprint', async () => {
    const mockResponse = createMockEndorsementsResponse();
    mockListForEprint.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsements(eprintUri), { wrapper: Wrapper });

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
    const { result } = renderHook(() => useEndorsements(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('passes additional parameters', async () => {
    mockListForEprint.mockResolvedValueOnce({
      data: createMockEndorsementsResponse(),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useEndorsements(eprintUri, {
          limit: 20,
          cursor: 'next',
          contributionType: 'methodological',
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
    });
  });

  it('throws error when API returns error', async () => {
    mockListForEprint.mockRejectedValueOnce(new Error('Endorsement service unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsements(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Endorsement service unavailable');
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsements(eprintUri, {}, { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockListForEprint).not.toHaveBeenCalled();
  });
});

describe('useEndorsementSummary', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches endorsement summary', async () => {
    const mockSummary = createMockEndorsementSummary();
    mockGetSummary.mockResolvedValueOnce({
      data: mockSummary,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsementSummary(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSummary);
    expect(mockGetSummary).toHaveBeenCalledWith({ eprintUri });
  });

  it('is disabled when eprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsementSummary(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockGetSummary.mockRejectedValueOnce(new Error('Summary unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEndorsementSummary(eprintUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Summary unavailable');
  });
});

describe('useUserEndorsement', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
  const userDid = 'did:plc:user';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches user endorsement', async () => {
    const mockEndorsement = createMockEndorsement({ endorserDid: userDid });
    mockGetUserEndorsement.mockResolvedValueOnce({
      data: mockEndorsement,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement(eprintUri, userDid), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockEndorsement);
    expect(mockGetUserEndorsement).toHaveBeenCalledWith({ eprintUri, userDid });
  });

  it('returns null when user has not endorsed (404)', async () => {
    mockGetUserEndorsement.mockRejectedValueOnce(
      new APIError('Not found', 404, 'getUserEndorsement')
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement(eprintUri, userDid), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it('is disabled when eprintUri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement('', userDid), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is disabled when userDid is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement(eprintUri, ''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error for non-404 errors', async () => {
    mockGetUserEndorsement.mockRejectedValueOnce(
      new APIError('Server error', 500, 'getUserEndorsement')
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserEndorsement(eprintUri, userDid), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Server error');
  });
});

describe('useCreateEndorsement', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
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
      eprintUri,
      contributions: ['methodological'],
    });

    expect(mockCreateEndorsementRecord).toHaveBeenCalledWith(mockAgent, {
      eprintUri,
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
      eprintUri,
      contributions: ['methodological', 'analytical', 'empirical'],
    });

    expect(mockCreateEndorsementRecord).toHaveBeenCalledWith(mockAgent, {
      eprintUri,
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
      eprintUri,
      contributions: ['empirical', 'data'],
      comment: 'Excellent findings!',
    });

    expect(mockCreateEndorsementRecord).toHaveBeenCalledWith(mockAgent, {
      eprintUri,
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
        eprintUri,
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
        eprintUri,
        contributions: ['methodological'],
      })
    ).rejects.toThrow('PDS write failed');
  });
});

describe('useUpdateEndorsement', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
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
      eprintUri,
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
      eprintUri,
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
        eprintUri,
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
        eprintUri,
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
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';
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

    await result.current.mutateAsync({ uri: endorsementUri, eprintUri });

    expect(mockDeleteRecord).toHaveBeenCalledWith(mockAgent, endorsementUri);
  });

  it('throws error when not authenticated', async () => {
    mockGetCurrentAgent.mockReturnValue(null as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEndorsement(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: endorsementUri, eprintUri })).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('throws error when record deletion fails', async () => {
    mockGetCurrentAgent.mockReturnValue(mockAgent as never);
    mockDeleteRecord.mockRejectedValueOnce(new Error('PDS delete failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEndorsement(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: endorsementUri, eprintUri })).rejects.toThrow(
      'PDS delete failed'
    );
  });
});

describe('usePrefetchEndorsements', () => {
  const eprintUri = 'at://did:plc:abc/pub.chive.eprint.submission/123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefetches endorsement summary for an eprint', async () => {
    const mockSummary = createMockEndorsementSummary();
    mockGetSummary.mockResolvedValueOnce({
      data: mockSummary,
    });

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => usePrefetchEndorsements(), { wrapper: Wrapper });

    result.current(eprintUri);

    await waitFor(() => {
      expect(mockGetSummary).toHaveBeenCalledWith({ eprintUri });
    });

    // Check that data is in cache
    const cachedData = queryClient.getQueryData(endorsementKeys.summary(eprintUri));
    expect(cachedData).toEqual(mockSummary);
  });
});
