import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockAuthorProfileResponse, createMockPreprintSummary } from '@/tests/mock-data';

import {
  authorKeys,
  useAuthor,
  useAuthorProfile,
  useAuthorMetrics,
  useAuthorPreprints,
  hasOrcid,
  formatOrcidUrl,
} from './use-author';

// Mock functions using vi.hoisted for proper hoisting
const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: mockGet,
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

  it('generates preprints key', () => {
    expect(authorKeys.preprints('did:plc:abc', { limit: 10 })).toEqual([
      'authors',
      'preprints',
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
    mockGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthor('did:plc:abc'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockGet).toHaveBeenCalledWith('/xrpc/pub.chive.author.getProfile', {
      params: { query: { did: 'did:plc:abc' } },
    });
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
    mockGet.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Author not found' },
    });

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
    mockGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
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
    mockGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorMetrics('did:plc:abc'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse.metrics);
  });
});

describe('useAuthorPreprints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches author preprints with pagination', async () => {
    const mockResponse = {
      preprints: [
        createMockPreprintSummary({ uri: 'at://did:plc:test1/pub.chive.preprint.submission/1' }),
        createMockPreprintSummary({ uri: 'at://did:plc:test2/pub.chive.preprint.submission/2' }),
      ],
      cursor: 'next-cursor',
      hasMore: true,
    };
    mockGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorPreprints('did:plc:abc'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0]).toEqual(mockResponse);
    expect(result.current.hasNextPage).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('/xrpc/pub.chive.preprint.listByAuthor', {
      params: {
        query: expect.objectContaining({
          did: 'did:plc:abc',
          limit: 10,
        }),
      },
    });
  });

  it('handles custom limit', async () => {
    const mockResponse = {
      preprints: [],
      hasMore: false,
    };
    mockGet.mockResolvedValueOnce({
      data: mockResponse,
      error: undefined,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthorPreprints('did:plc:abc', { limit: 5 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledWith('/xrpc/pub.chive.preprint.listByAuthor', {
      params: {
        query: expect.objectContaining({
          did: 'did:plc:abc',
          limit: 5,
        }),
      },
    });
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
