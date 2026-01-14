/**
 * Profile autocomplete hooks.
 *
 * @remarks
 * React Query hooks for profile autocomplete endpoints.
 * Used by profile settings forms to provide suggestions for:
 * - ORCID lookup
 * - Institutional affiliations (ROR)
 * - Research keywords (FAST + Wikidata)
 * - External author IDs discovery
 *
 * @packageDocumentation
 */

import { useQuery } from '@tanstack/react-query';

import { getCurrentAgent } from '../auth/oauth-client';
import { getServiceAuthToken } from '../auth/service-auth';
import { APIError, AuthenticationError } from '../errors';
import { useDebounce } from './use-eprint-search';

/**
 * Query key factory for profile autocomplete queries.
 */
export const profileAutocompleteKeys = {
  all: ['profile-autocomplete'] as const,
  orcid: (query: string) => [...profileAutocompleteKeys.all, 'orcid', query] as const,
  affiliation: (query: string) => [...profileAutocompleteKeys.all, 'affiliation', query] as const,
  keyword: (query: string, sources?: string[]) =>
    [...profileAutocompleteKeys.all, 'keyword', query, sources] as const,
  authorIds: (name: string) => [...profileAutocompleteKeys.all, 'author-ids', name] as const,
  semanticScholar: (query: string) =>
    [...profileAutocompleteKeys.all, 'semantic-scholar', query] as const,
  openAlex: (query: string) => [...profileAutocompleteKeys.all, 'openalex', query] as const,
  dblp: (query: string) => [...profileAutocompleteKeys.all, 'dblp', query] as const,
  openReview: (query: string) => [...profileAutocompleteKeys.all, 'openreview', query] as const,
};

/**
 * ORCID suggestion type.
 */
export interface OrcidSuggestion {
  orcid: string;
  givenNames: string | null;
  familyName: string | null;
  affiliation: string | null;
}

/**
 * Affiliation suggestion type.
 */
export interface AffiliationSuggestion {
  rorId: string;
  name: string;
  country: string;
  types: string[];
  acronym: string | null;
}

/**
 * Keyword suggestion type.
 */
export interface KeywordSuggestion {
  id: string;
  label: string;
  source: 'fast' | 'wikidata' | 'freetext';
  description: string | null;
  usageCount: number | null;
}

/**
 * Author ID match type.
 */
export interface AuthorIdMatch {
  displayName: string;
  institution: string | null;
  worksCount: number;
  citedByCount: number;
  ids: {
    openalex: string | null;
    semanticScholar: string | null;
    orcid: string | null;
    dblp: string | null;
  };
}

/**
 * Semantic Scholar author result.
 */
export interface SemanticScholarAuthor {
  authorId: string;
  name: string;
  affiliations: string[];
  paperCount: number;
  citationCount: number;
  hIndex: number;
}

/**
 * OpenAlex author result.
 */
export interface OpenAlexAuthor {
  id: string;
  display_name: string;
  works_count: number;
  cited_by_count: number;
  last_known_institution: {
    display_name: string;
  } | null;
}

/**
 * DBLP author result.
 */
export interface DblpAuthor {
  author: string;
  url: string;
  notes?: {
    note:
      | {
          '@type': string;
          text: string;
        }
      | Array<{ '@type': string; text: string }>;
  };
}

interface UseAutocompleteOptions {
  /** Minimum query length before searching (default: 2) */
  minLength?: number;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook for ORCID profile autocomplete.
 *
 * @param query - Search query (author name)
 * @param options - Hook options
 * @returns Query result with ORCID suggestions
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useOrcidAutocomplete('John Smith');
 *
 * data?.suggestions.map((s) => (
 *   <div key={s.orcid}>
 *     {s.givenNames} {s.familyName} - {s.affiliation}
 *   </div>
 * ));
 * ```
 */
export function useOrcidAutocomplete(query: string, options: UseAutocompleteOptions = {}) {
  const { minLength = 2, debounceMs = 300, enabled = true } = options;
  const debouncedQuery = useDebounce(query, debounceMs);

  return useQuery({
    queryKey: profileAutocompleteKeys.orcid(debouncedQuery),
    queryFn: async (): Promise<{ suggestions: OrcidSuggestion[] }> => {
      // Use fetch directly until OpenAPI types are regenerated
      const url = `/xrpc/pub.chive.actor.autocompleteOrcid?query=${encodeURIComponent(debouncedQuery)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('ORCID search failed');
      }
      return response.json();
    },
    enabled: enabled && debouncedQuery.length >= minLength,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for institutional affiliation autocomplete via ROR.
 *
 * @param query - Search query (organization name)
 * @param options - Hook options
 * @returns Query result with affiliation suggestions
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAffiliationAutocomplete('Stanford');
 *
 * data?.suggestions.map((s) => (
 *   <div key={s.rorId}>
 *     {s.name} ({s.country})
 *   </div>
 * ));
 * ```
 */
export function useAffiliationAutocomplete(query: string, options: UseAutocompleteOptions = {}) {
  const { minLength = 2, debounceMs = 300, enabled = true } = options;
  const debouncedQuery = useDebounce(query, debounceMs);

  return useQuery({
    queryKey: profileAutocompleteKeys.affiliation(debouncedQuery),
    queryFn: async (): Promise<{ suggestions: AffiliationSuggestion[] }> => {
      // Use fetch directly until OpenAPI types are regenerated
      const url = `/xrpc/pub.chive.actor.autocompleteAffiliation?query=${encodeURIComponent(debouncedQuery)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Affiliation search failed');
      }
      return response.json();
    },
    enabled: enabled && debouncedQuery.length >= minLength,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for research keyword autocomplete via FAST and Wikidata.
 *
 * @param query - Search query (keyword)
 * @param options - Hook options
 * @returns Query result with keyword suggestions
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useKeywordAutocomplete('machine learning');
 *
 * data?.suggestions.map((s) => (
 *   <div key={s.id}>
 *     {s.label} ({s.source})
 *   </div>
 * ));
 * ```
 */
export function useKeywordAutocomplete(
  query: string,
  options: UseAutocompleteOptions & { sources?: ('fast' | 'wikidata')[] } = {}
) {
  const { minLength = 2, debounceMs = 300, enabled = true, sources } = options;
  const debouncedQuery = useDebounce(query, debounceMs);

  return useQuery({
    queryKey: profileAutocompleteKeys.keyword(debouncedQuery, sources),
    queryFn: async (): Promise<{ suggestions: KeywordSuggestion[] }> => {
      // Use fetch directly until OpenAPI types are regenerated
      const params = new URLSearchParams({ query: debouncedQuery });
      if (sources?.length) {
        sources.forEach((s) => params.append('sources', s));
      }
      const url = `/xrpc/pub.chive.actor.autocompleteKeyword?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Keyword search failed');
      }
      return response.json();
    },
    enabled: enabled && debouncedQuery.length >= minLength,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for Semantic Scholar author autocomplete.
 *
 * @param query - Search query (author name)
 * @param options - Hook options
 * @returns Query result with Semantic Scholar author matches
 */
export function useSemanticScholarAutocomplete(
  query: string,
  options: UseAutocompleteOptions = {}
) {
  const { minLength = 2, debounceMs = 300, enabled = true } = options;
  const debouncedQuery = useDebounce(query, debounceMs);

  return useQuery({
    queryKey: profileAutocompleteKeys.semanticScholar(debouncedQuery),
    queryFn: async (): Promise<{ data: SemanticScholarAuthor[] }> => {
      const url = `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(debouncedQuery)}&fields=authorId,name,affiliations,paperCount,citationCount,hIndex&limit=10`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new APIError('Semantic Scholar search failed', response.status);
      }

      return response.json();
    },
    enabled: enabled && debouncedQuery.length >= minLength,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for OpenAlex author autocomplete.
 *
 * @param query - Search query (author name)
 * @param options - Hook options
 * @returns Query result with OpenAlex author matches
 */
export function useOpenAlexAutocomplete(query: string, options: UseAutocompleteOptions = {}) {
  const { minLength = 2, debounceMs = 300, enabled = true } = options;
  const debouncedQuery = useDebounce(query, debounceMs);

  return useQuery({
    queryKey: profileAutocompleteKeys.openAlex(debouncedQuery),
    queryFn: async (): Promise<{ results: OpenAlexAuthor[] }> => {
      const url = `https://api.openalex.org/authors?filter=display_name.search:${encodeURIComponent(debouncedQuery)}&per-page=10&mailto=admin@chive.pub`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new APIError('OpenAlex search failed', response.status);
      }

      return response.json();
    },
    enabled: enabled && debouncedQuery.length >= minLength,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for DBLP author autocomplete.
 *
 * @param query - Search query (author name)
 * @param options - Hook options
 * @returns Query result with DBLP author matches
 */
export function useDblpAutocomplete(query: string, options: UseAutocompleteOptions = {}) {
  const { minLength = 2, debounceMs = 300, enabled = true } = options;
  const debouncedQuery = useDebounce(query, debounceMs);

  return useQuery({
    queryKey: profileAutocompleteKeys.dblp(debouncedQuery),
    queryFn: async (): Promise<{ result: { hits: { hit: Array<{ info: DblpAuthor }> } } }> => {
      const url = `https://dblp.org/search/author/api?q=${encodeURIComponent(debouncedQuery)}&format=json&h=10`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new APIError('DBLP search failed', response.status);
      }

      return response.json();
    },
    enabled: enabled && debouncedQuery.length >= minLength,
    staleTime: 30 * 1000,
  });
}

/**
 * OpenReview suggestion from our backend proxy.
 */
export interface OpenReviewSuggestion {
  id: string;
  displayName: string;
  institution: string | null;
}

/**
 * Hook for OpenReview profile autocomplete.
 *
 * @remarks
 * Uses our backend proxy since OpenReview API doesn't support CORS.
 *
 * @param query - Search query (author name)
 * @param options - Hook options
 * @returns Query result with OpenReview profile matches
 */
export function useOpenReviewAutocomplete(query: string, options: UseAutocompleteOptions = {}) {
  const { minLength = 2, debounceMs = 300, enabled = true } = options;
  const debouncedQuery = useDebounce(query, debounceMs);

  return useQuery({
    queryKey: profileAutocompleteKeys.openReview(debouncedQuery),
    queryFn: async (): Promise<{ suggestions: OpenReviewSuggestion[] }> => {
      // Use our backend proxy since OpenReview doesn't support CORS
      const url = `/xrpc/pub.chive.actor.autocompleteOpenReview?query=${encodeURIComponent(debouncedQuery)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new APIError('OpenReview search failed', response.status);
      }

      return response.json();
    },
    enabled: enabled && debouncedQuery.length >= minLength,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for discovering external author IDs by name.
 *
 * @remarks
 * Requires authentication. Searches OpenAlex and Semantic Scholar
 * to help users find their external author IDs.
 *
 * @param name - Author name to search
 * @param options - Hook options
 * @returns Query result with potential author matches
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAuthorIdDiscovery('Jane Smith');
 *
 * data?.matches.map((m) => (
 *   <div key={m.ids.openalex ?? m.ids.semanticScholar}>
 *     {m.displayName} - {m.institution}
 *     <p>Works: {m.worksCount}, Citations: {m.citedByCount}</p>
 *   </div>
 * ));
 * ```
 */
export function useAuthorIdDiscovery(name: string, options: UseAutocompleteOptions = {}) {
  const { minLength = 2, debounceMs = 500, enabled = true } = options;
  const debouncedName = useDebounce(name, debounceMs);

  return useQuery({
    queryKey: profileAutocompleteKeys.authorIds(debouncedName),
    queryFn: async (): Promise<{ searchedName: string; matches: AuthorIdMatch[] }> => {
      // This endpoint requires authentication
      const agent = getCurrentAgent();
      if (!agent) {
        throw new AuthenticationError('Authentication required for author ID discovery');
      }

      const token = await getServiceAuthToken(agent, 'pub.chive.actor.discoverAuthorIds');

      const url = `/xrpc/pub.chive.actor.discoverAuthorIds?name=${encodeURIComponent(debouncedName)}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new APIError(
          (errorBody as { message?: string }).message ?? 'Author ID discovery failed',
          response.status
        );
      }

      return response.json();
    },
    enabled:
      enabled &&
      debouncedName.length >= minLength &&
      typeof window !== 'undefined' &&
      !!getCurrentAgent(),
    staleTime: 60 * 1000, // 1 minute
  });
}
