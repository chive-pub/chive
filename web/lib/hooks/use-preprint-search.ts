/**
 * External eprint search hooks with debouncing and autocomplete.
 *
 * @remarks
 * This module provides hooks for searching external eprint sources
 * (arXiv, OpenReview, PsyArXiv, LingBuzz, Semantics Archive) for the
 * claiming workflow. Implements industry-standard patterns:
 *
 * - Debounced input for autocomplete to reduce API calls
 * - Federated search across multiple sources
 * - Field-based ranking for personalized results
 * - Optimistic UI updates for better UX
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { getServiceAuthToken } from '@/lib/auth/service-auth';
import { getCurrentAgent } from '@/lib/auth/oauth-client';

/**
 * Get the API base URL.
 */
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
  }
  const isTunnelMode = process.env.NEXT_PUBLIC_DEV_MODE === 'tunnel';
  if (isTunnelMode) {
    return '';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
}

/**
 * Make an authenticated API request.
 */
async function fetchWithAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  // Add service auth if available
  if (typeof window !== 'undefined') {
    const agent = getCurrentAgent();
    if (agent) {
      try {
        const lxm = path.startsWith('/xrpc/') ? path.slice(6).split('?')[0] : undefined;
        const token = await getServiceAuthToken(agent, lxm);
        headers.set('Authorization', `Bearer ${token}`);
      } catch {
        // Continue without auth
      }
    }
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new APIError(
      (body as { message?: string }).message ?? 'Request failed',
      response.status,
      path
    );
  }

  return response.json();
}

/**
 * Import source type from API.
 */
export type ImportSource =
  | 'arxiv'
  | 'biorxiv'
  | 'medrxiv'
  | 'psyarxiv'
  | 'lingbuzz'
  | 'semanticsarchive'
  | 'openreview'
  | 'ssrn'
  | 'osf'
  | 'zenodo'
  | 'philpapers'
  | 'other';

/**
 * External eprint author.
 */
export interface ExternalEprintAuthor {
  readonly name: string;
  readonly orcid?: string;
  readonly affiliation?: string;
  readonly email?: string;
}

/**
 * External eprint from federated search.
 */
export interface ExternalEprint {
  readonly externalId: string;
  readonly url: string;
  readonly title: string;
  readonly abstract?: string;
  readonly authors: readonly ExternalEprintAuthor[];
  readonly publicationDate?: string;
  readonly doi?: string;
  readonly pdfUrl?: string;
  readonly categories?: readonly string[];
  readonly source: ImportSource;
}

/**
 * Autocomplete suggestion from external search.
 */
export interface AutocompleteSuggestion {
  readonly title: string;
  readonly authors: string;
  readonly source: ImportSource;
  readonly externalId: string;
  readonly highlightedTitle?: string;
  readonly fieldMatchScore?: number;
}

/**
 * Search results response.
 */
export interface SearchEprintsResponse {
  readonly eprints: readonly ExternalEprint[];
  readonly facets?: {
    readonly sources: Record<string, number>;
  };
}

/**
 * Autocomplete response.
 */
export interface AutocompleteResponse {
  readonly suggestions: readonly AutocompleteSuggestion[];
}

/**
 * Query key factory for eprint search queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for search data.
 */
export const eprintSearchKeys = {
  /** Base key for all eprint search queries */
  all: ['eprint-search'] as const,
  /** Key for federated search queries */
  search: (params: { query?: string; author?: string; sources?: string; limit?: number }) =>
    [...eprintSearchKeys.all, 'search', params] as const,
  /** Key for autocomplete queries */
  autocomplete: (query: string) => [...eprintSearchKeys.all, 'autocomplete', query] as const,
};

// =============================================================================
// DEBOUNCE HOOK
// =============================================================================

/**
 * Custom hook for debouncing a value.
 *
 * @param value - Value to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced value
 *
 * @remarks
 * Implements standard debounce pattern for reducing API calls during typing.
 * Used by autocomplete to wait for user to stop typing before searching.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// =============================================================================
// AUTOCOMPLETE HOOK
// =============================================================================

/**
 * Options for autocomplete hook.
 */
export interface UseAutocompleteOptions {
  /** Debounce delay in milliseconds (default: 200) */
  debounceMs?: number;
  /** Maximum suggestions to return (default: 8) */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Hook for eprint autocomplete suggestions.
 *
 * @param query - Search query (minimum 2 characters)
 * @param options - Autocomplete options
 * @returns Autocomplete suggestions with loading state
 *
 * @remarks
 * Provides fast autocomplete suggestions while the user types.
 * Implements best practices from Baymard Institute research:
 * - Max 8 suggestions to prevent choice paralysis
 * - 200ms debounce to reduce API calls
 * - Inverted highlighting (bold untyped portion)
 * - Field match scores for personalized ranking
 *
 * @example
 * ```tsx
 * const [query, setQuery] = useState('');
 * const { suggestions, isLoading } = useAutocomplete(query);
 *
 * return (
 *   <Combobox>
 *     <Input value={query} onChange={e => setQuery(e.target.value)} />
 *     {suggestions.map(s => (
 *       <ComboboxOption key={s.externalId} value={s}>
 *         {s.highlightedTitle}
 *       </ComboboxOption>
 *     ))}
 *   </Combobox>
 * );
 * ```
 */
export function useAutocomplete(query: string, options: UseAutocompleteOptions = {}) {
  const { debounceMs = 200, limit = 8, enabled = true } = options;

  // Debounce query to reduce API calls
  const debouncedQuery = useDebounce(query.trim(), debounceMs);

  const result = useQuery({
    queryKey: eprintSearchKeys.autocomplete(debouncedQuery),
    queryFn: async (): Promise<AutocompleteResponse> => {
      const params = new URLSearchParams({
        query: debouncedQuery,
        limit: String(limit),
      });

      return fetchWithAuth<AutocompleteResponse>(`/xrpc/pub.chive.claiming.autocomplete?${params}`);
    },
    enabled: enabled && debouncedQuery.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    suggestions: result.data?.suggestions ?? [],
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
  };
}

// =============================================================================
// FEDERATED SEARCH HOOK
// =============================================================================

/**
 * Options for federated search hook.
 */
export interface UseEprintSearchOptions {
  /** Author name filter */
  author?: string;
  /** Comma-separated list of sources to search */
  sources?: string;
  /** Maximum results (default: 20) */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Hook for federated eprint search across external sources.
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Search results with facets
 *
 * @remarks
 * Performs federated search across all configured sources:
 * - arXiv, OpenReview, PsyArXiv (real-time API search)
 * - LingBuzz, Semantics Archive (local index search)
 *
 * Results include source facets for filtering UI.
 *
 * @example
 * ```tsx
 * const { eprints, facets, isLoading } = useEprintSearch('attention mechanism', {
 *   sources: 'arxiv,openreview',
 *   limit: 20,
 * });
 *
 * return (
 *   <>
 *     <SourceFacets facets={facets} />
 *     <EprintList eprints={eprints} isLoading={isLoading} />
 *   </>
 * );
 * ```
 */
export function useEprintSearch(query: string, options: UseEprintSearchOptions = {}) {
  const { author, sources, limit = 20, enabled = true } = options;

  const result = useQuery({
    queryKey: eprintSearchKeys.search({ query, author, sources, limit }),
    queryFn: async (): Promise<SearchEprintsResponse> => {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      if (author) params.set('author', author);
      if (sources) params.set('sources', sources);
      params.set('limit', String(limit));

      return fetchWithAuth<SearchEprintsResponse>(
        `/xrpc/pub.chive.claiming.searchEprints?${params}`
      );
    },
    enabled: enabled && (query.length >= 2 || !!author),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    eprints: result.data?.eprints ?? [],
    facets: result.data?.facets,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

// =============================================================================
// START CLAIM FROM EXTERNAL MUTATION
// =============================================================================

/**
 * Claim request from API.
 */
export interface ClaimRequest {
  readonly id: number;
  readonly importId: number;
  readonly claimantDid: string;
  readonly evidence: readonly {
    readonly type: string;
    readonly score: number;
    readonly details: string;
    readonly data?: Record<string, unknown>;
  }[];
  readonly verificationScore: number;
  readonly status: 'pending' | 'approved' | 'rejected' | 'expired';
  readonly canonicalUri?: string;
  readonly rejectionReason?: string;
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

/**
 * Mutation parameters for starting a claim from external search.
 */
export interface StartClaimFromExternalParams {
  /** External source */
  source: ImportSource;
  /** Source-specific identifier */
  externalId: string;
}

/**
 * Hook for starting a claim from an external search result.
 *
 * @returns Mutation for starting claim with import-on-demand
 *
 * @remarks
 * Implements "import on demand" pattern:
 * 1. User selects eprint from search results
 * 2. If not already imported, fetches from source and imports
 * 3. Creates claim request
 *
 * This reduces storage and API load by only importing papers
 * that users actually want to claim.
 *
 * @example
 * ```tsx
 * const startClaim = useStartClaimFromExternal();
 *
 * const handleSelect = (eprint: ExternalEprint) => {
 *   startClaim.mutate({
 *     source: eprint.source,
 *     externalId: eprint.externalId,
 *   });
 * };
 *
 * return (
 *   <EprintCard
 *     eprint={eprint}
 *     onClaim={handleSelect}
 *     isClaimPending={startClaim.isPending}
 *   />
 * );
 * ```
 */
export function useStartClaimFromExternal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: StartClaimFromExternalParams): Promise<ClaimRequest> => {
      const response = await fetchWithAuth<{ claim: ClaimRequest }>(
        '/xrpc/pub.chive.claiming.startClaimFromExternal',
        {
          method: 'POST',
          body: JSON.stringify({
            source: params.source,
            externalId: params.externalId,
          }),
        }
      );

      return response.claim;
    },
    onSuccess: (claim) => {
      // Invalidate user claims to show the new claim
      queryClient.invalidateQueries({ queryKey: ['claiming', 'user'] });
      // Set the new claim in cache
      queryClient.setQueryData(['claiming', 'claim', claim.id], claim);
    },
  });
}

// =============================================================================
// COMBINED SEARCH STATE HOOK
// =============================================================================

/**
 * Options for combined search state hook.
 */
export interface UseEprintSearchStateOptions {
  /** Initial search query */
  initialQuery?: string;
  /** Debounce delay for autocomplete (default: 200ms) */
  autocompleteDebounceMs?: number;
  /** Debounce delay for full search (default: 500ms) */
  searchDebounceMs?: number;
}

/**
 * Combined hook for managing eprint search state.
 *
 * @param options - Search state options
 * @returns Search state and handlers
 *
 * @remarks
 * Provides a complete search experience with:
 * - Controlled input state
 * - Debounced autocomplete suggestions
 * - Full search on submit
 * - Loading states for both autocomplete and search
 *
 * Implements progressive disclosure pattern:
 * - Start with autocomplete while typing
 * - Execute full search on submit
 *
 * @example
 * ```tsx
 * const {
 *   query,
 *   setQuery,
 *   suggestions,
 *   searchResults,
 *   handleSubmit,
 *   isAutocompleteLoading,
 *   isSearchLoading,
 * } = useEprintSearchState();
 *
 * return (
 *   <form onSubmit={handleSubmit}>
 *     <SearchInput
 *       value={query}
 *       onChange={e => setQuery(e.target.value)}
 *       suggestions={suggestions}
 *       isLoading={isAutocompleteLoading}
 *     />
 *     <SearchResults results={searchResults} isLoading={isSearchLoading} />
 *   </form>
 * );
 * ```
 */
export function useEprintSearchState(options: UseEprintSearchStateOptions = {}) {
  const {
    initialQuery = '',
    autocompleteDebounceMs = 200,
    searchDebounceMs: _searchDebounceMs = 500,
  } = options;

  // Input query state
  const [query, setQuery] = useState(initialQuery);

  // Submitted query for full search
  const [submittedQuery, setSubmittedQuery] = useState('');

  // Source filter state
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  // Author filter state
  const [authorFilter, setAuthorFilter] = useState('');

  // Debounced query for autocomplete
  const debouncedAutocompleteQuery = useDebounce(query, autocompleteDebounceMs);

  // Autocomplete hook
  const autocomplete = useAutocomplete(debouncedAutocompleteQuery, {
    enabled: !submittedQuery && query.length >= 2,
  });

  // Full search hook
  const search = useEprintSearch(submittedQuery, {
    sources: selectedSources.length > 0 ? selectedSources.join(',') : undefined,
    author: authorFilter || undefined,
    enabled: !!submittedQuery,
  });

  // Submit handler
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      setSubmittedQuery(query);
    },
    [query]
  );

  // Select suggestion handler (immediate search)
  const handleSelectSuggestion = useCallback((suggestion: AutocompleteSuggestion) => {
    setQuery(suggestion.title);
    setSubmittedQuery(suggestion.title);
  }, []);

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setSubmittedQuery('');
  }, []);

  // Toggle source filter
  const toggleSource = useCallback((source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }, []);

  // Memoized available sources from facets
  const availableSources = useMemo(() => {
    if (!search.facets?.sources) return [];
    return Object.entries(search.facets.sources)
      .sort(([, a], [, b]) => b - a)
      .map(([source, count]) => ({ source, count }));
  }, [search.facets]);

  return {
    // State
    query,
    setQuery,
    submittedQuery,
    selectedSources,
    authorFilter,
    setAuthorFilter,

    // Autocomplete
    suggestions: autocomplete.suggestions,
    isAutocompleteLoading: autocomplete.isLoading,
    isAutocompleteFetching: autocomplete.isFetching,

    // Search results
    searchResults: search.eprints,
    facets: search.facets,
    availableSources,
    isSearchLoading: search.isLoading,
    isSearchFetching: search.isFetching,
    searchError: search.error,

    // Handlers
    handleSubmit,
    handleSelectSuggestion,
    handleClear,
    toggleSource,
    refetchSearch: search.refetch,
  };
}
