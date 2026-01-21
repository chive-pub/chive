import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockBlobRef, createMockEprintSummary } from '@/tests/mock-data';

import {
  eprintKeys,
  useEprint,
  useEprints,
  useEprintsByAuthor,
  usePrefetchEprint,
} from './use-eprint';

// Mock functions using vi.hoisted for proper hoisting
const { mockGetSubmission, mockSearchSubmissions, mockListByAuthor } = vi.hoisted(() => ({
  mockGetSubmission: vi.fn(),
  mockSearchSubmissions: vi.fn(),
  mockListByAuthor: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        eprint: {
          getSubmission: mockGetSubmission,
          searchSubmissions: mockSearchSubmissions,
          listByAuthor: mockListByAuthor,
        },
      },
    },
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

  it('fetches an eprint by URI', async () => {
    // Mock the raw API response structure (uri, cid, value, indexedAt, pdsUrl)
    const mockSubmissionResponse = {
      uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
      cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      value: {
        $type: 'pub.chive.eprint.submission',
        title: 'A Novel Approach to Machine Learning',
        abstract: [{ type: 'text', content: 'This paper presents a novel approach.' }],
        abstractPlainText: 'This paper presents a novel approach.',
        document: createMockBlobRef(),
        authors: [
          {
            $type: 'pub.chive.eprint.authorContribution',
            did: 'did:plc:test123',
            name: 'Test User',
            order: 1,
            affiliations: [],
            contributions: [],
            isCorrespondingAuthor: true,
            isHighlighted: false,
          },
        ],
        submittedBy: 'did:plc:test123',
        keywords: ['machine learning'],
        fieldUris: ['at://did:plc:chive-governance/pub.chive.graph.field/computer-science'],
        licenseSlug: 'CC-BY-4.0',
        publicationStatusSlug: 'preprint',
        createdAt: '2024-01-15T10:30:00Z',
      },
      indexedAt: '2024-01-15T10:35:00Z',
      pdsUrl: 'https://bsky.social',
    };

    mockGetSubmission.mockResolvedValueOnce({
      data: mockSubmissionResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useEprint('at://did:plc:test/pub.chive.eprint.submission/123'),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetSubmission).toHaveBeenCalledWith({
      uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
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
    mockGetSubmission.mockRejectedValueOnce(new Error('Not found'));

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
    mockSearchSubmissions.mockResolvedValueOnce({
      data: mockData,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprints({ q: 'machine learning' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockSearchSubmissions).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'machine learning' })
    );
  });

  it('passes parameters to the query', async () => {
    mockSearchSubmissions.mockResolvedValueOnce({
      data: { eprints: [], cursor: undefined, hasMore: false, total: 0 },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useEprints({ q: 'physics research', limit: 10, cursor: 'abc' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSearchSubmissions).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'physics research',
        limit: 10,
        cursor: 'abc',
      })
    );
  });

  it('throws error when API returns error', async () => {
    mockSearchSubmissions.mockRejectedValueOnce(new Error('Server error'));

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
    };
    mockListByAuthor.mockResolvedValueOnce({
      data: mockData,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprintsByAuthor({ did: 'did:plc:author123' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.eprints).toEqual(mockData.eprints);
    expect(mockListByAuthor).toHaveBeenCalledWith(
      expect.objectContaining({ did: 'did:plc:author123' })
    );
  });

  it('is disabled when did is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEprintsByAuthor({ did: '' }), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockListByAuthor.mockRejectedValueOnce(new Error('Author not found'));

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
    // Mock the raw API response structure
    const mockSubmissionResponse = {
      uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
      cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      value: {
        $type: 'pub.chive.eprint.submission',
        title: 'A Novel Approach to Machine Learning',
        abstract: [{ type: 'text', content: 'Test abstract.' }],
        abstractPlainText: 'Test abstract.',
        document: createMockBlobRef(),
        authors: [
          {
            did: 'did:plc:test123',
            name: 'Test User',
            order: 1,
            affiliations: [],
            contributions: [],
            isCorrespondingAuthor: true,
            isHighlighted: false,
          },
        ],
        submittedBy: 'did:plc:test123',
        licenseSlug: 'CC-BY-4.0',
        publicationStatusSlug: 'preprint',
        createdAt: '2024-01-15T10:30:00Z',
      },
      indexedAt: '2024-01-15T10:35:00Z',
      pdsUrl: 'https://bsky.social',
    };

    mockGetSubmission.mockResolvedValueOnce({
      data: mockSubmissionResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePrefetchEprint(), { wrapper: Wrapper });

    // Call the prefetch function
    result.current('at://did:plc:test/pub.chive.eprint.submission/123');

    // The API should have been called
    expect(mockGetSubmission).toHaveBeenCalled();
  });
});
