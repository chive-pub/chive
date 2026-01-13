import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';
import type { FacetedSearchResponse } from '@/lib/api/schema';
import type { FacetFilters } from '@/lib/utils/facets';

/**
 * Query key factory for faceted search queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Keys include all facet parameters to ensure proper cache separation.
 *
 * @example
 * ```typescript
 * // Invalidate all faceted search queries
 * queryClient.invalidateQueries({ queryKey: facetedSearchKeys.all });
 *
 * // Invalidate specific search
 * queryClient.invalidateQueries({ queryKey: facetedSearchKeys.search({ matter: ['physics'] }) });
 * ```
 */
export const facetedSearchKeys = {
  /** Base key for all faceted search queries */
  all: ['faceted-search'] as const,
  /** Key for specific faceted search with params */
  search: (params: FacetFilters) => [...facetedSearchKeys.all, params] as const,
  /** Key for facet counts only */
  counts: (params: FacetFilters) => [...facetedSearchKeys.all, 'counts', params] as const,
};

interface UseFacetedSearchParams extends FacetFilters {
  /** Text query (optional) */
  q?: string;
  /** Number of results to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Performs a 10-dimensional faceted search across PMEST and FAST dimensions.
 *
 * @remarks
 * Uses TanStack Query with a 30-second stale time.
 * Returns both results and facet counts for refinement.
 *
 * The 10 dimensions are:
 * - PMEST: Personality, Matter, Energy, Space, Time
 * - FAST: Person, Organization, Event, Work, Form-Genre
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useFacetedSearch({
 *   matter: ['computer-science'],
 *   energy: ['classification'],
 *   limit: 20,
 * });
 *
 * if (data) {
 *   console.log(`Found ${data.total} results`);
 *   console.log('Available facets:', data.facets);
 * }
 * ```
 *
 * @param params - Search parameters including facet filters
 * @returns Query result with search results and facet counts
 */
export function useFacetedSearch(params: UseFacetedSearchParams) {
  const hasFilters =
    !!params.q ||
    (params.personality && params.personality.length > 0) ||
    (params.matter && params.matter.length > 0) ||
    (params.energy && params.energy.length > 0) ||
    (params.space && params.space.length > 0) ||
    (params.time && params.time.length > 0) ||
    (params.person && params.person.length > 0) ||
    (params.organization && params.organization.length > 0) ||
    (params.event && params.event.length > 0) ||
    (params.work && params.work.length > 0) ||
    (params.formGenre && params.formGenre.length > 0);

  return useQuery({
    queryKey: facetedSearchKeys.search(params),
    queryFn: async (): Promise<FacetedSearchResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.browseFaceted', {
        params: { query: { ...params, limit: params.limit ?? 20 } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to search with facets',
          undefined,
          '/xrpc/pub.chive.graph.browseFaceted'
        );
      }
      return data!;
    },
    enabled: hasFilters || params.limit !== undefined,
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches only facet counts without eprint results.
 *
 * @remarks
 * Useful for displaying available filters before a search is performed.
 * Uses a longer stale time since facet counts change slowly.
 *
 * @example
 * ```tsx
 * const { data } = useFacetCounts({ matter: ['physics'] });
 *
 * // Display available refinements
 * data?.facets.energy?.forEach(facet => {
 *   console.log(`${facet.label}: ${facet.count}`);
 * });
 * ```
 *
 * @param currentFilters - Currently selected facet filters
 * @returns Query result with facet counts
 */
export function useFacetCounts(currentFilters: FacetFilters = {}) {
  return useQuery({
    queryKey: facetedSearchKeys.counts(currentFilters),
    queryFn: async (): Promise<FacetedSearchResponse['facets']> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.browseFaceted', {
        params: {
          query: {
            ...currentFilters,
            limit: 0, // Don't return results, just facets
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch facet counts',
          undefined,
          '/xrpc/pub.chive.graph.browseFaceted'
        );
      }
      return data!.facets;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes; facet counts change slowly.
  });
}

/**
 * Hook for debounced faceted search (useful for live filtering).
 *
 * @remarks
 * Uses a shorter stale time for more responsive results.
 * Automatically enabled when any filter is set.
 *
 * @example
 * ```tsx
 * const debouncedFilters = useDebounce(filters, 300);
 * const { data } = useLiveFacetedSearch(debouncedFilters);
 * ```
 *
 * @param params - Search parameters
 * @returns Query result with search results
 */
export function useLiveFacetedSearch(params: UseFacetedSearchParams) {
  const hasFilters = Object.values(params).some(
    (v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : !!v)
  );

  return useQuery({
    queryKey: ['live-faceted-search', params],
    queryFn: async (): Promise<FacetedSearchResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.browseFaceted', {
        params: { query: { ...params, limit: params.limit ?? 20 } },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to search with facets',
          undefined,
          '/xrpc/pub.chive.graph.browseFaceted'
        );
      }
      return data!;
    },
    enabled: hasFilters,
    staleTime: 10 * 1000, // 10 seconds for live search
  });
}

/**
 * Counts total active filters across all dimensions.
 *
 * @param filters - The facet filters
 * @returns Total count of active filter values
 */
export function countTotalFilters(filters: FacetFilters): number {
  return Object.values(filters).reduce((count, values) => count + (values?.length ?? 0), 0);
}

/**
 * Checks if a specific facet value is selected.
 *
 * @param filters - The current facet filters
 * @param dimension - The facet dimension
 * @param value - The facet value to check
 * @returns True if the value is selected
 */
export function isFacetSelected(
  filters: FacetFilters,
  dimension: keyof FacetFilters,
  value: string
): boolean {
  return filters[dimension]?.includes(value) ?? false;
}

/**
 * Adds a facet value to the filters.
 *
 * @param filters - The current facet filters
 * @param dimension - The facet dimension
 * @param value - The facet value to add
 * @returns New filters with the value added
 */
export function addFacetValue(
  filters: FacetFilters,
  dimension: keyof FacetFilters,
  value: string
): FacetFilters {
  const current = filters[dimension] ?? [];
  if (current.includes(value)) {
    return filters;
  }
  return {
    ...filters,
    [dimension]: [...current, value],
  };
}

/**
 * Removes a facet value from the filters.
 *
 * @param filters - The current facet filters
 * @param dimension - The facet dimension
 * @param value - The facet value to remove
 * @returns New filters with the value removed
 */
export function removeFacetValue(
  filters: FacetFilters,
  dimension: keyof FacetFilters,
  value: string
): FacetFilters {
  const current = filters[dimension] ?? [];
  const filtered = current.filter((v) => v !== value);
  return {
    ...filters,
    [dimension]: filtered.length > 0 ? filtered : undefined,
  };
}

/**
 * Toggles a facet value in the filters.
 *
 * @param filters - The current facet filters
 * @param dimension - The facet dimension
 * @param value - The facet value to toggle
 * @returns New filters with the value toggled
 */
export function toggleFacetValue(
  filters: FacetFilters,
  dimension: keyof FacetFilters,
  value: string
): FacetFilters {
  if (isFacetSelected(filters, dimension, value)) {
    return removeFacetValue(filters, dimension, value);
  }
  return addFacetValue(filters, dimension, value);
}

/**
 * Clears all filters for a specific dimension.
 *
 * @param filters - The current facet filters
 * @param dimension - The facet dimension to clear
 * @returns New filters with the dimension cleared
 */
export function clearDimensionFilters(
  filters: FacetFilters,
  dimension: keyof FacetFilters
): FacetFilters {
  return {
    ...filters,
    [dimension]: undefined,
  };
}

/**
 * Clears all facet filters.
 *
 * @returns Empty facet filters object
 */
export function clearAllFilters(): FacetFilters {
  return {};
}
