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

import { useDebounce } from './use-preprint-search';

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
      // Use fetch directly until OpenAPI types are regenerated
      // This endpoint requires authentication
      const url = `/xrpc/pub.chive.actor.discoverAuthorIds?name=${encodeURIComponent(debouncedName)}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Author ID discovery failed');
      }
      return response.json();
    },
    enabled: enabled && debouncedName.length >= minLength,
    staleTime: 60 * 1000, // 1 minute
  });
}
