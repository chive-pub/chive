import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import type {
  GetRecommendationsResponse,
  GetSimilarResponse,
  GetCitationsResponse,
  GetEnrichmentResponse,
} from '@/lib/api/schema';

import {
  discoveryKeys,
  useForYouFeed,
  useSimilarPapers,
  useCitations,
  useEnrichment,
  useDiscoverySettings,
  useUpdateDiscoverySettings,
  DEFAULT_DISCOVERY_SETTINGS,
  type DiscoverySettings,
} from './use-discovery';

// Mock functions using vi.hoisted for proper hoisting
const { mockGetRecommendations, mockGetSimilar, mockGetCitations, mockGetEnrichment } = vi.hoisted(
  () => ({
    mockGetRecommendations: vi.fn(),
    mockGetSimilar: vi.fn(),
    mockGetCitations: vi.fn(),
    mockGetEnrichment: vi.fn(),
  })
);

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        discovery: {
          getSimilar: mockGetSimilar,
          getCitations: mockGetCitations,
          getEnrichment: mockGetEnrichment,
        },
      },
    },
  },
  authApi: {
    pub: {
      chive: {
        discovery: {
          getRecommendations: mockGetRecommendations,
        },
      },
    },
  },
}));

// Mock auth module to provide hooks without AuthProvider
vi.mock('@/lib/auth', () => ({
  useCurrentUser: vi.fn(() => null),
  useAgent: vi.fn(() => null),
}));

// Mock localStorage
const mockLocalStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  }),
});

// Test data factories
function createMockRecommendationsResponse(
  overrides: Partial<GetRecommendationsResponse> = {}
): GetRecommendationsResponse {
  return {
    recommendations: [
      {
        uri: 'at://did:plc:test/pub.chive.eprint/1',
        title: 'Test Eprint 1',
        abstract: 'Abstract for test eprint',
        score: 0.95,
        explanation: {
          type: 'semantic',
          text: 'Based on your research interests',
          weight: 0.8,
        },
      },
    ],
    hasMore: false,
    cursor: undefined,
    ...overrides,
  };
}

function createMockSimilarResponse(
  overrides: Partial<GetSimilarResponse> = {}
): GetSimilarResponse {
  return {
    eprint: {
      uri: 'at://did:plc:test/pub.chive.eprint/source',
      title: 'Source Eprint',
    },
    related: [
      {
        uri: 'at://did:plc:test/pub.chive.eprint/related1',
        title: 'Related Eprint 1',
        relationshipType: 'semantically-similar',
        score: 0.9,
        explanation: 'Similar topics',
      },
    ],
    ...overrides,
  };
}

function createMockCitationsResponse(
  overrides: Partial<GetCitationsResponse> = {}
): GetCitationsResponse {
  return {
    eprint: {
      uri: 'at://did:plc:test/pub.chive.eprint/source',
      title: 'Source Eprint',
    },
    counts: {
      citedByCount: 10,
      referencesCount: 25,
      influentialCitedByCount: 3,
    },
    citations: [
      {
        citingUri: 'at://did:plc:test/pub.chive.eprint/citing1',
        citedUri: 'at://did:plc:test/pub.chive.eprint/source',
        isInfluential: true,
        source: 'semantic-scholar',
      },
    ],
    hasMore: false,
    ...overrides,
  };
}

function createMockEnrichmentResponse(
  overrides: Partial<GetEnrichmentResponse> = {}
): GetEnrichmentResponse {
  return {
    enrichment: {
      uri: 'at://did:plc:test/pub.chive.eprint/1',
      semanticScholarId: 's2-123',
      openAlexId: 'W123456',
      citationCount: 42,
      concepts: [{ id: 'C1', displayName: 'Machine Learning' }],
    },
    available: true,
    ...overrides,
  };
}

describe('discoveryKeys', () => {
  it('generates all key', () => {
    expect(discoveryKeys.all).toEqual(['discovery']);
  });

  it('generates forYou key with options', () => {
    expect(discoveryKeys.forYou({ limit: 10 })).toEqual(['discovery', 'forYou', { limit: 10 }]);
  });

  it('generates similar key with uri and options', () => {
    const uri = 'at://did:plc:test/pub.chive.eprint/1';
    expect(discoveryKeys.similar(uri, { limit: 5 })).toEqual([
      'discovery',
      'similar',
      uri,
      { limit: 5 },
    ]);
  });

  it('generates citations key with uri and options', () => {
    const uri = 'at://did:plc:test/pub.chive.eprint/1';
    expect(discoveryKeys.citations(uri, { direction: 'citing', limit: 10 })).toEqual([
      'discovery',
      'citations',
      uri,
      { direction: 'citing', limit: 10 },
    ]);
  });

  it('generates enrichment key with uri', () => {
    const uri = 'at://did:plc:test/pub.chive.eprint/1';
    expect(discoveryKeys.enrichment(uri)).toEqual(['discovery', 'enrichment', uri]);
  });

  it('generates settings key', () => {
    expect(discoveryKeys.settings()).toEqual(['discovery', 'settings']);
  });
});

describe('useForYouFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches personalized recommendations', async () => {
    const mockResponse = createMockRecommendationsResponse();
    mockGetRecommendations.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useForYouFeed(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0]).toEqual(mockResponse);
    expect(mockGetRecommendations).toHaveBeenCalledWith({
      limit: 10,
      cursor: undefined,
    });
  });

  it('respects limit option', async () => {
    const mockResponse = createMockRecommendationsResponse();
    mockGetRecommendations.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useForYouFeed({ limit: 20 }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetRecommendations).toHaveBeenCalledWith({
      limit: 20,
      cursor: undefined,
    });
  });

  it('can be disabled', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useForYouFeed({ enabled: false }), { wrapper: Wrapper });

    expect(result.current.isFetching).toBe(false);
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });
});

describe('useSimilarPapers', () => {
  const testUri = 'at://did:plc:test/pub.chive.eprint/1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches similar papers for an eprint', async () => {
    const mockResponse = createMockSimilarResponse();
    mockGetSimilar.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSimilarPapers(testUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockGetSimilar).toHaveBeenCalledWith({
      uri: testUri,
      limit: 5,
    });
  });

  it('respects limit option', async () => {
    const mockResponse = createMockSimilarResponse();
    mockGetSimilar.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    renderHook(() => useSimilarPapers(testUri, { limit: 10 }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockGetSimilar).toHaveBeenCalled();
    });

    expect(mockGetSimilar).toHaveBeenCalledWith({
      uri: testUri,
      limit: 10,
    });
  });

  it('does not fetch when uri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSimilarPapers(''), { wrapper: Wrapper });

    expect(result.current.isFetching).toBe(false);
    expect(mockGetSimilar).not.toHaveBeenCalled();
  });
});

describe('useCitations', () => {
  const testUri = 'at://did:plc:test/pub.chive.eprint/1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches citations for an eprint', async () => {
    const mockResponse = createMockCitationsResponse();
    mockGetCitations.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCitations(testUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockGetCitations).toHaveBeenCalledWith({
      uri: testUri,
      direction: 'both',
      limit: 20,
      onlyInfluential: false,
    });
  });

  it('respects direction option', async () => {
    const mockResponse = createMockCitationsResponse();
    mockGetCitations.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    renderHook(() => useCitations(testUri, { direction: 'citing' }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockGetCitations).toHaveBeenCalled();
    });

    expect(mockGetCitations).toHaveBeenCalledWith({
      uri: testUri,
      direction: 'citing',
      limit: 20,
      onlyInfluential: false,
    });
  });

  it('can request only influential citations', async () => {
    const mockResponse = createMockCitationsResponse();
    mockGetCitations.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    renderHook(() => useCitations(testUri, { onlyInfluential: true }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockGetCitations).toHaveBeenCalled();
    });

    expect(mockGetCitations).toHaveBeenCalledWith({
      uri: testUri,
      direction: 'both',
      limit: 20,
      onlyInfluential: true,
    });
  });
});

describe('useEnrichment', () => {
  const testUri = 'at://did:plc:test/pub.chive.eprint/1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches enrichment data for an eprint', async () => {
    const mockResponse = createMockEnrichmentResponse();
    mockGetEnrichment.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEnrichment(testUri), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockGetEnrichment).toHaveBeenCalledWith({ uri: testUri });
  });

  it('does not fetch when uri is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEnrichment(''), { wrapper: Wrapper });

    expect(result.current.isFetching).toBe(false);
    expect(mockGetEnrichment).not.toHaveBeenCalled();
  });
});

describe('useDiscoverySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('returns default settings when no stored settings exist', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDiscoverySettings(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(DEFAULT_DISCOVERY_SETTINGS);
  });

  it('returns merged settings from localStorage', async () => {
    const storedSettings: Partial<DiscoverySettings> = {
      enableForYouFeed: false,
      forYouSignals: { ...DEFAULT_DISCOVERY_SETTINGS.forYouSignals, trending: false },
    };
    // Set up mock before creating the wrapper
    mockLocalStorage['chive:discoverySettings'] = JSON.stringify(storedSettings);
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => mockLocalStorage[key] ?? null
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDiscoverySettings(), { wrapper: Wrapper });

    // Wait for the actual data to be loaded (not just placeholderData)
    await waitFor(() => {
      expect(result.current.isFetched).toBe(true);
      expect(result.current.data?.enableForYouFeed).toBe(false);
    });

    expect(result.current.data?.forYouSignals.trending).toBe(false);
    // Other defaults should be preserved
    expect(result.current.data?.enablePersonalization).toBe(true);

    // Clean up
    delete mockLocalStorage['chive:discoverySettings'];
  });
});

describe('useUpdateDiscoverySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('saves settings to localStorage', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateDiscoverySettings(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ enableForYouFeed: false });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localStorage.setItem).toHaveBeenCalled();
    const savedValue = vi.mocked(localStorage.setItem).mock.calls[0][1];
    const parsed = JSON.parse(savedValue);
    expect(parsed.enableForYouFeed).toBe(false);
  });

  it('merges nested forYouSignals correctly', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(DEFAULT_DISCOVERY_SETTINGS));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateDiscoverySettings(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ forYouSignals: { trending: false } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localStorage.setItem).toHaveBeenCalled();
    const savedValue = vi.mocked(localStorage.setItem).mock.calls[0][1];
    const parsed = JSON.parse(savedValue);
    // Trending should be false
    expect(parsed.forYouSignals.trending).toBe(false);
    // Other signals should be preserved
    expect(parsed.forYouSignals.fields).toBe(true);
    expect(parsed.forYouSignals.citations).toBe(true);
  });
});
