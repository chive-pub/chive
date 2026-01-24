import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockAuthorProfileResponse, createMockEprintSummary } from '@/tests/mock-data';

import {
  authorKeys,
  useAuthor,
  useAuthorProfile,
  useAuthorMetrics,
  useAuthorEprints,
  useAuthorSearch,
  hasOrcid,
  formatOrcidUrl,
} from './use-author';

// Mock functions using vi.hoisted for proper hoisting
const { mockGetProfile, mockListByAuthor, mockSearchAuthors } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockListByAuthor: vi.fn(),
  mockSearchAuthors: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        author: {
          getProfile: mockGetProfile,
          searchAuthors: mockSearchAuthors,
        },
        eprint: {
          listByAuthor: mockListByAuthor,
        },
      },
    },
  },
  authApi: {
    pub: {
      chive: {
        actor: {
          getMyProfile: vi.fn(),
        },
      },
    },
  },
}));

describe('authorKeys', () => {
  it('generates all key', () => {
    expect(authorKeys.all).toEqual(['authors']);
  });

  it('generates profiles key', () => {
    expect(authorKeys.profiles()).toEqual(['authors', 'profile']);
  });

  it('generates profile key for specific DID', () => {
    expect(authorKeys.profile('did:plc:abc')).toEqual(['authors', 'profile', 'did:plc:abc']);
  });

  it('generates metrics key', () => {
    expect(authorKeys.metrics('did:plc:abc')).toEqual(['authors', 'metrics', 'did:plc:abc']);
  });

  it('generates eprints key', () => {
    expect(authorKeys.eprints('did:plc:abc', { limit: 10 })).toEqual([
      'authors',
      'eprints',
      'did:plc:abc',
      { limit: 10 },
    ]);
  });

  it('generates search key', () => {
    expect(authorKeys.search('smith', 10)).toEqual(['authors', 'search', 'smith', 10]);
  });
});

describe('useAuthor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches author profile by DID', async () => {
    const mockResponse = createMockAuthorProfileResponse();
    mockGetProfile.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthor('did:plc:abc'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockGetProfile).toHaveBeenCalledWith({ did: 'did:plc:abc' });
  });

  it('is disabled when DID is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthor(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthor('did:plc:abc', { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws error when API returns error', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('Author not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthor('did:plc:invalid'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Author not found');
  });
});

describe('useAuthorProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches author profile', async () => {
    const mockResponse = createMockAuthorProfileResponse();
    mockGetProfile.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorProfile('did:plc:abc'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse.profile);
  });
});

describe('useAuthorMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches author metrics', async () => {
    const mockResponse = createMockAuthorProfileResponse();
    mockGetProfile.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorMetrics('did:plc:abc'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse.metrics);
  });
});

describe('useAuthorEprints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches author eprints with pagination', async () => {
    const mockResponse = {
      eprints: [
        createMockEprintSummary({ uri: 'at://did:plc:test1/pub.chive.eprint.submission/1' }),
        createMockEprintSummary({ uri: 'at://did:plc:test2/pub.chive.eprint.submission/2' }),
      ],
      cursor: 'next-cursor',
      hasMore: true,
    };
    mockListByAuthor.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorEprints('did:plc:abc'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0]).toEqual(mockResponse);
    expect(result.current.hasNextPage).toBe(true);
    expect(mockListByAuthor).toHaveBeenCalledWith(
      expect.objectContaining({
        did: 'did:plc:abc',
        limit: 10,
      })
    );
  });

  it('handles custom limit', async () => {
    const mockResponse = {
      eprints: [],
      hasMore: false,
    };
    mockListByAuthor.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorEprints('did:plc:abc', { limit: 5 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockListByAuthor).toHaveBeenCalledWith(
      expect.objectContaining({
        did: 'did:plc:abc',
        limit: 5,
      })
    );
  });
});

describe('hasOrcid', () => {
  it('returns true when profile has ORCID', () => {
    expect(hasOrcid({ did: 'test', pdsEndpoint: 'test', orcid: '0000-0002-1825-0097' })).toBe(true);
  });

  it('returns false when profile has no ORCID', () => {
    expect(hasOrcid({ did: 'test', pdsEndpoint: 'test' })).toBe(false);
  });

  it('returns false for null/undefined profile', () => {
    expect(hasOrcid(null)).toBe(false);
    expect(hasOrcid(undefined)).toBe(false);
  });
});

describe('formatOrcidUrl', () => {
  it('formats bare ORCID to full URL', () => {
    expect(formatOrcidUrl('0000-0002-1825-0097')).toBe('https://orcid.org/0000-0002-1825-0097');
  });

  it('handles already-formatted URL', () => {
    expect(formatOrcidUrl('https://orcid.org/0000-0002-1825-0097')).toBe(
      'https://orcid.org/0000-0002-1825-0097'
    );
  });
});

describe('useAuthorSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches authors by query', async () => {
    const mockResponse = {
      authors: [
        {
          did: 'did:plc:abc',
          handle: 'alice.bsky.social',
          displayName: 'Alice Smith',
          affiliation: 'MIT',
          eprintCount: 5,
        },
        {
          did: 'did:plc:def',
          handle: 'bob.bsky.social',
          displayName: 'Bob Smith',
        },
      ],
    };
    mockSearchAuthors.mockResolvedValueOnce({ data: mockResponse });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorSearch('smith'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockSearchAuthors).toHaveBeenCalledWith({ q: 'smith', limit: 10 });
  });

  it('uses custom limit', async () => {
    mockSearchAuthors.mockResolvedValueOnce({ data: { authors: [] } });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorSearch('test', { limit: 5 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSearchAuthors).toHaveBeenCalledWith({ q: 'test', limit: 5 });
  });

  it('is disabled when query is too short', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorSearch('a'), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorSearch('smith', { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('handles API errors', async () => {
    mockSearchAuthors.mockRejectedValueOnce(new Error('Search failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorSearch('error'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Search failed');
  });
});
