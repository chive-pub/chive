import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';

/**
 * Facet value with count.
 */
export interface FacetValue {
  value: string;
  label?: string;
  count: number;
}

/**
 * Facet definition from the knowledge graph.
 */
export interface FacetDefinition {
  slug: string;
  label: string;
  description?: string;
  values: FacetValue[];
}

/**
 * Dynamic facet filters keyed by facet slug.
 */
export type DynamicFacetFilters = Record<string, string[]>;

/**
 * Faceted search response with dynamic facets.
 */
export interface FacetedSearchResponse {
  hits: Array<{
    uri: string;
    cid: string;
    title: string;
    abstract: string;
    authors: Array<{
      did: string;
      name: string;
      orcid?: string;
      email?: string;
      order: number;
      affiliations: Array<{ name: string; rorId?: string; department?: string }>;
      contributions: Array<{
        typeUri?: string;
        typeId?: string;
        typeLabel?: string;
        degree?: string;
      }>;
      isCorrespondingAuthor?: boolean;
      isHighlighted?: boolean;
      handle?: string;
      avatarUrl?: string;
    }>;
    submittedBy: string;
    paperDid?: string;
    fields?: Array<{ uri: string; name: string; id?: string; parentUri?: string }>;
    license: string;
    keywords?: string[];
    createdAt: string;
    indexedAt: string;
    source: {
      pdsEndpoint: string;
      recordUrl: string;
      blobUrl?: string;
      lastVerifiedAt?: string;
      stale: boolean;
    };
    score?: number;
    highlights?: Record<string, string[]>;
  }>;
  facets: FacetDefinition[];
  cursor?: string;
  hasMore: boolean;
  total: number;
  impressionId?: string;
}

/**
 * Query key factory for faceted search queries.
 */
export const facetedSearchKeys = {
  all: ['faceted-search'] as const,
  search: (params: UseFacetedSearchParams) => [...facetedSearchKeys.all, params] as const,
  counts: (filters: DynamicFacetFilters) => [...facetedSearchKeys.all, 'counts', filters] as const,
};

interface UseFacetedSearchParams {
  /** Text query (optional) */
  q?: string;
  /** Facet filters keyed by slug */
  facets?: DynamicFacetFilters;
  /** Number of results to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Performs faceted search with dynamic facets from the knowledge graph.
 *
 * @remarks
 * Facets are fetched dynamically from nodes with subkind='facet'.
 * Users can propose new facets through governance.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useFacetedSearch({
 *   facets: { methodology: ['meta-analysis'], 'time-period': ['21st-century'] },
 *   limit: 20,
 * });
 *
 * if (data) {
 *   console.log(`Found ${data.total} results`);
 *   console.log('Available facets:', data.facets);
 * }
 * ```
 */
export function useFacetedSearch(params: UseFacetedSearchParams) {
  const hasFilters = !!params.q || (params.facets && Object.keys(params.facets).length > 0);

  return useQuery({
    queryKey: facetedSearchKeys.search(params),
    queryFn: async (): Promise<FacetedSearchResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.browseFaceted', {
        params: {
          query: {
            q: params.q,
            facets: params.facets ? JSON.stringify(params.facets) : undefined,
            limit: params.limit ?? 20,
            cursor: params.cursor,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to search with facets',
          undefined,
          '/xrpc/pub.chive.graph.browseFaceted'
        );
      }
      return data as FacetedSearchResponse;
    },
    enabled: hasFilters || params.limit !== undefined,
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches only facet counts without eprint results.
 *
 * @example
 * ```tsx
 * const { data } = useFacetCounts({ methodology: ['meta-analysis'] });
 * ```
 */
export function useFacetCounts(currentFilters: DynamicFacetFilters = {}) {
  return useQuery({
    queryKey: facetedSearchKeys.counts(currentFilters),
    queryFn: async (): Promise<FacetDefinition[]> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.browseFaceted', {
        params: {
          query: {
            facets:
              Object.keys(currentFilters).length > 0 ? JSON.stringify(currentFilters) : undefined,
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
      return (data as FacetedSearchResponse).facets;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for debounced faceted search (useful for live filtering).
 */
export function useLiveFacetedSearch(params: UseFacetedSearchParams) {
  const hasFilters =
    !!params.q || (params.facets && Object.values(params.facets).some((v) => v && v.length > 0));

  return useQuery({
    queryKey: ['live-faceted-search', params],
    queryFn: async (): Promise<FacetedSearchResponse> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.graph.browseFaceted', {
        params: {
          query: {
            q: params.q,
            facets: params.facets ? JSON.stringify(params.facets) : undefined,
            limit: params.limit ?? 20,
            cursor: params.cursor,
          },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to search with facets',
          undefined,
          '/xrpc/pub.chive.graph.browseFaceted'
        );
      }
      return data as FacetedSearchResponse;
    },
    enabled: hasFilters,
    staleTime: 10 * 1000, // 10 seconds
  });
}

/**
 * Counts total active filters across all facets.
 */
export function countTotalFilters(filters: DynamicFacetFilters): number {
  return Object.values(filters).reduce((count, values) => count + (values?.length ?? 0), 0);
}

/**
 * Checks if a specific facet value is selected.
 */
export function isFacetSelected(
  filters: DynamicFacetFilters,
  facetSlug: string,
  value: string
): boolean {
  return filters[facetSlug]?.includes(value) ?? false;
}

/**
 * Adds a facet value to the filters.
 */
export function addFacetValue(
  filters: DynamicFacetFilters,
  facetSlug: string,
  value: string
): DynamicFacetFilters {
  const current = filters[facetSlug] ?? [];
  if (current.includes(value)) {
    return filters;
  }
  return {
    ...filters,
    [facetSlug]: [...current, value],
  };
}

/**
 * Removes a facet value from the filters.
 */
export function removeFacetValue(
  filters: DynamicFacetFilters,
  facetSlug: string,
  value: string
): DynamicFacetFilters {
  const current = filters[facetSlug] ?? [];
  const filtered = current.filter((v) => v !== value);
  if (filtered.length === 0) {
    const { [facetSlug]: _, ...rest } = filters;
    return rest;
  }
  return {
    ...filters,
    [facetSlug]: filtered,
  };
}

/**
 * Toggles a facet value in the filters.
 */
export function toggleFacetValue(
  filters: DynamicFacetFilters,
  facetSlug: string,
  value: string
): DynamicFacetFilters {
  if (isFacetSelected(filters, facetSlug, value)) {
    return removeFacetValue(filters, facetSlug, value);
  }
  return addFacetValue(filters, facetSlug, value);
}

/**
 * Clears all filters for a specific facet.
 */
export function clearDimensionFilters(
  filters: DynamicFacetFilters,
  facetSlug: string
): DynamicFacetFilters {
  const { [facetSlug]: _, ...rest } = filters;
  return rest;
}

/**
 * Clears all facet filters.
 */
export function clearAllFilters(): DynamicFacetFilters {
  return {};
}
