import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockTrendingResponse } from '@/tests/mock-data';

import { personalizedFeedKeys, usePersonalizedFeed } from './use-personalized-feed';

// Mock functions using vi.hoisted for proper hoisting
const { mockSearchSubmissions, mockGetTrending, mockUseCurrentUser, mockUseAuthorProfile } =
  vi.hoisted(() => ({
    mockSearchSubmissions: vi.fn(),
    mockGetTrending: vi.fn(),
    mockUseCurrentUser: vi.fn(),
    mockUseAuthorProfile: vi.fn(),
  }));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        eprint: {
          searchSubmissions: mockSearchSubmissions,
        },
        metrics: {
          getTrending: mockGetTrending,
        },
      },
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  useCurrentUser: mockUseCurrentUser,
  useAgent: vi.fn(() => null),
}));

vi.mock('./use-author', () => ({
  useAuthorProfile: mockUseAuthorProfile,
}));

vi.mock('@/lib/errors', () => ({
  APIError: class APIError extends Error {
    statusCode?: number;
    endpoint?: string;
    constructor(message: string, statusCode?: number, endpoint?: string) {
      super(message);
      this.statusCode = statusCode;
      this.endpoint = endpoint;
    }
  },
}));

describe('personalizedFeedKeys', () => {
  it('generates all key', () => {
    expect(personalizedFeedKeys.all).toEqual(['personalized-feed']);
  });

  it('generates fields key with field URIs', () => {
    const fieldUris = ['at://did:plc:gov/pub.chive.graph.node/abc'];
    expect(personalizedFeedKeys.fields(fieldUris)).toEqual(['personalized-feed', fieldUris]);
  });
});

describe('usePersonalizedFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to anonymous user
    mockUseCurrentUser.mockReturnValue(null);
    mockUseAuthorProfile.mockReturnValue({ data: undefined, isLoading: false });
    // Default trending response
    mockGetTrending.mockResolvedValue({
      data: createMockTrendingResponse(),
      error: undefined,
    });
  });

  it('returns trending for anonymous user with isPersonalized=false', async () => {
    mockUseCurrentUser.mockReturnValue(null);
    mockUseAuthorProfile.mockReturnValue({ data: undefined, isLoading: false });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePersonalizedFeed(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isPersonalized).toBe(false);
    expect(result.current.needsFieldSetup).toBe(false);
    // Should not have called searchSubmissions
    expect(mockSearchSubmissions).not.toHaveBeenCalled();
  });

  it('returns needsFieldSetup=true for authenticated user without fields', async () => {
    mockUseCurrentUser.mockReturnValue({ did: 'did:plc:testuser1', displayName: 'Test' });
    mockUseAuthorProfile.mockReturnValue({
      data: { fields: [] },
      isLoading: false,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePersonalizedFeed(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isPersonalized).toBe(false);
    expect(result.current.needsFieldSetup).toBe(true);
    // Should not have called searchSubmissions
    expect(mockSearchSubmissions).not.toHaveBeenCalled();
  });

  it('returns personalized feed for authenticated user with fields', async () => {
    const fieldUris = ['at://did:plc:gov/pub.chive.graph.node/ml-field'];

    mockUseCurrentUser.mockReturnValue({ did: 'did:plc:testuser1', displayName: 'Test' });
    mockUseAuthorProfile.mockReturnValue({
      data: { fields: fieldUris },
      isLoading: false,
    });

    mockSearchSubmissions.mockResolvedValue({
      data: {
        hits: [
          { uri: 'at://did:plc:t1/pub.chive.eprint.submission/1', title: 'Personalized Paper' },
        ],
        total: 1,
        cursor: undefined,
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePersonalizedFeed(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isPersonalized).toBe(true);
    expect(result.current.needsFieldSetup).toBe(false);
    expect(result.current.eprints).toHaveLength(1);

    // Should have called searchSubmissions with fieldUris and sort=recent
    expect(mockSearchSubmissions).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldUris,
        sort: 'recent',
      })
    );
  });

  it('reports loading while profile is loading for authenticated user', () => {
    mockUseCurrentUser.mockReturnValue({ did: 'did:plc:testuser1', displayName: 'Test' });
    mockUseAuthorProfile.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePersonalizedFeed(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it('returns empty eprints when search returns no results', async () => {
    const fieldUris = ['at://did:plc:gov/pub.chive.graph.node/field1'];

    mockUseCurrentUser.mockReturnValue({ did: 'did:plc:testuser1' });
    mockUseAuthorProfile.mockReturnValue({
      data: { fields: fieldUris },
      isLoading: false,
    });

    mockSearchSubmissions.mockResolvedValue({
      data: {
        hits: [],
        total: 0,
        cursor: undefined,
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePersonalizedFeed(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isPersonalized).toBe(true);
    expect(result.current.eprints).toHaveLength(0);
  });
});
