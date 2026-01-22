import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { createMockFacetedSearchResponse } from '@/tests/mock-data';

import {
  facetedSearchKeys,
  useFacetedSearch,
  useFacetCounts,
  countTotalFilters,
  isFacetSelected,
  addFacetValue,
  removeFacetValue,
  toggleFacetValue,
  clearDimensionFilters,
  clearAllFilters,
} from './use-faceted-search';

// Mock functions using vi.hoisted for proper hoisting
const { mockBrowseFaceted } = vi.hoisted(() => ({
  mockBrowseFaceted: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        graph: {
          browseFaceted: mockBrowseFaceted,
        },
      },
    },
  },
}));

describe('facetedSearchKeys', () => {
  it('generates all key', () => {
    expect(facetedSearchKeys.all).toEqual(['faceted-search']);
  });

  it('generates search key with params', () => {
    const params = { facets: { matter: ['physics'], energy: ['classification'] } };
    expect(facetedSearchKeys.search(params)).toEqual(['faceted-search', params]);
  });

  it('generates counts key with params', () => {
    const filters = { personality: ['research'] };
    expect(facetedSearchKeys.counts(filters)).toEqual(['faceted-search', 'counts', filters]);
  });
});

describe('useFacetedSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs faceted search with single dimension', async () => {
    const mockResponse = createMockFacetedSearchResponse();
    mockBrowseFaceted.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFacetedSearch({ facets: { matter: ['physics'] } }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockBrowseFaceted).toHaveBeenCalledWith(
      expect.objectContaining({
        facets: JSON.stringify({ matter: ['physics'] }),
      })
    );
  });

  it('performs faceted search with multiple dimensions', async () => {
    const mockResponse = createMockFacetedSearchResponse();
    mockBrowseFaceted.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useFacetedSearch({
          facets: {
            matter: ['physics'],
            energy: ['classification'],
            person: ['einstein'],
          },
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockBrowseFaceted).toHaveBeenCalledWith(
      expect.objectContaining({
        facets: JSON.stringify({
          matter: ['physics'],
          energy: ['classification'],
          person: ['einstein'],
        }),
      })
    );
  });

  it('performs faceted search with text query', async () => {
    const mockResponse = createMockFacetedSearchResponse();
    mockBrowseFaceted.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useFacetedSearch({ q: 'machine learning', facets: { matter: ['computer-science'] } }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockBrowseFaceted).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'machine learning',
        facets: JSON.stringify({ matter: ['computer-science'] }),
      })
    );
  });

  it('is disabled when no filters are set', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFacetedSearch({}), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is enabled when limit is set even without filters', async () => {
    const mockResponse = createMockFacetedSearchResponse();
    mockBrowseFaceted.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFacetedSearch({ limit: 10 }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockBrowseFaceted).toHaveBeenCalled();
  });

  it('throws error when API returns error', async () => {
    mockBrowseFaceted.mockRejectedValueOnce(new Error('Search failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFacetedSearch({ facets: { matter: ['invalid'] } }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Search failed');
  });
});

describe('useFacetCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches facet counts', async () => {
    const mockResponse = createMockFacetedSearchResponse();
    mockBrowseFaceted.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFacetCounts({ matter: ['physics'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse.facets);
    expect(mockBrowseFaceted).toHaveBeenCalledWith(
      expect.objectContaining({
        facets: JSON.stringify({ matter: ['physics'] }),
        limit: 1, // Minimum limit - we only care about facets
      })
    );
  });

  it('fetches counts with empty filters', async () => {
    const mockResponse = createMockFacetedSearchResponse();
    mockBrowseFaceted.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFacetCounts(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockBrowseFaceted).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 1, // Minimum limit - we only care about facets
      })
    );
  });
});

describe('countTotalFilters', () => {
  it('counts filters across all dimensions', () => {
    expect(
      countTotalFilters({
        matter: ['physics', 'chemistry'],
        person: ['einstein'],
      })
    ).toBe(3);
  });

  it('returns 0 for empty filters', () => {
    expect(countTotalFilters({})).toBe(0);
  });

  it('handles undefined dimension values', () => {
    expect(
      countTotalFilters({
        matter: ['physics'],
        energy: undefined as unknown as string[],
      })
    ).toBe(1);
  });
});

describe('isFacetSelected', () => {
  it('returns true when facet is selected', () => {
    const filters = { matter: ['physics', 'chemistry'] };
    expect(isFacetSelected(filters, 'matter', 'physics')).toBe(true);
  });

  it('returns false when facet is not selected', () => {
    const filters = { matter: ['physics'] };
    expect(isFacetSelected(filters, 'matter', 'chemistry')).toBe(false);
  });

  it('returns false for empty dimension', () => {
    const filters = {};
    expect(isFacetSelected(filters, 'matter', 'physics')).toBe(false);
  });
});

describe('addFacetValue', () => {
  it('adds value to existing dimension', () => {
    const filters = { matter: ['physics'] };
    const result = addFacetValue(filters, 'matter', 'chemistry');
    expect(result.matter).toEqual(['physics', 'chemistry']);
  });

  it('creates new dimension array', () => {
    const filters = {};
    const result = addFacetValue(filters, 'matter', 'physics');
    expect(result.matter).toEqual(['physics']);
  });

  it('does not duplicate existing value', () => {
    const filters = { matter: ['physics'] };
    const result = addFacetValue(filters, 'matter', 'physics');
    expect(result.matter).toEqual(['physics']);
  });

  it('preserves other dimensions', () => {
    const filters = { matter: ['physics'], person: ['einstein'] };
    const result = addFacetValue(filters, 'matter', 'chemistry');
    expect(result.person).toEqual(['einstein']);
  });
});

describe('removeFacetValue', () => {
  it('removes value from dimension', () => {
    const filters = { matter: ['physics', 'chemistry'] };
    const result = removeFacetValue(filters, 'matter', 'physics');
    expect(result.matter).toEqual(['chemistry']);
  });

  it('removes dimension when last value removed', () => {
    const filters = { matter: ['physics'] };
    const result = removeFacetValue(filters, 'matter', 'physics');
    expect(result.matter).toBeUndefined();
  });

  it('handles non-existent value gracefully', () => {
    const filters = { matter: ['physics'] };
    const result = removeFacetValue(filters, 'matter', 'chemistry');
    expect(result.matter).toEqual(['physics']);
  });

  it('handles non-existent dimension gracefully', () => {
    const filters = {};
    const result = removeFacetValue(filters, 'matter', 'physics');
    expect(result.matter).toBeUndefined();
  });
});

describe('toggleFacetValue', () => {
  it('adds value when not present', () => {
    const filters = { matter: ['physics'] };
    const result = toggleFacetValue(filters, 'matter', 'chemistry');
    expect(result.matter).toEqual(['physics', 'chemistry']);
  });

  it('removes value when present', () => {
    const filters = { matter: ['physics', 'chemistry'] };
    const result = toggleFacetValue(filters, 'matter', 'physics');
    expect(result.matter).toEqual(['chemistry']);
  });
});

describe('clearDimensionFilters', () => {
  it('removes all values from dimension', () => {
    const filters = { matter: ['physics', 'chemistry'], person: ['einstein'] };
    const result = clearDimensionFilters(filters, 'matter');
    expect(result.matter).toBeUndefined();
    expect(result.person).toEqual(['einstein']);
  });

  it('handles non-existent dimension gracefully', () => {
    const filters = { person: ['einstein'] };
    const result = clearDimensionFilters(filters, 'matter');
    expect(result).toEqual({ person: ['einstein'] });
  });
});

describe('clearAllFilters', () => {
  it('returns empty filters object', () => {
    const result = clearAllFilters();
    expect(result).toEqual({});
  });
});
