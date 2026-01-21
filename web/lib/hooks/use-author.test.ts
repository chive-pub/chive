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
  hasOrcid,
  formatOrcidUrl,
} from './use-author';

// Mock functions using vi.hoisted for proper hoisting
const { mockGetProfile, mockListByAuthor } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockListByAuthor: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        author: {
          getProfile: mockGetProfile,
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
