/**
 * Hook for searching the ROR (Research Organization Registry) API.
 *
 * @remarks
 * Searches institutions via the public ROR REST API. No authentication required.
 * Used in the collection wizard to let users add institutions not yet in the
 * Chive knowledge graph.
 *
 * @see {@link https://ror.readme.io/v2/docs/api-v2 | ROR API v2 docs}
 *
 * @packageDocumentation
 */

import { useQuery } from '@tanstack/react-query';

import { useDebounce } from '@/lib/hooks/use-eprint-search';

/**
 * A single ROR organization result.
 */
export interface ROROrganization {
  /** ROR ID (e.g., "https://ror.org/02mhbdp94") */
  readonly id: string;
  /** Primary organization name */
  readonly name: string;
  /** Alternative names */
  readonly aliases: string[];
  /** Country name */
  readonly country: string;
  /** City name */
  readonly city?: string;
}

/**
 * Searches the ROR API for organizations matching a query.
 *
 * @param query - Search query (minimum 2 characters)
 * @param options - Hook options
 * @returns Query result with matching organizations
 *
 * @example
 * ```tsx
 * const { data: institutions } = useRORSearch('Stanford');
 * // data = [{ id: "https://ror.org/00f54p054", name: "Stanford University", ... }]
 * ```
 */
export function useRORSearch(query: string, options?: { limit?: number; enabled?: boolean }) {
  const { limit = 5, enabled = true } = options ?? {};
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: ['ror-search', debouncedQuery, limit],
    queryFn: async (): Promise<ROROrganization[]> => {
      if (debouncedQuery.length < 2) return [];

      const params = new URLSearchParams({ query: debouncedQuery });
      const response = await fetch(`https://api.ror.org/v2/organizations?${params.toString()}`);

      if (!response.ok) return [];

      const data = (await response.json()) as {
        items?: Array<{
          id: string;
          names?: Array<{ value: string; types: string[] }>;
          locations?: Array<{
            geonames_details?: { country_name?: string; name?: string };
          }>;
        }>;
      };

      return (data.items ?? []).slice(0, limit).map((item) => {
        const displayName =
          item.names?.find((n) => n.types.includes('ror_display'))?.value ??
          item.names?.[0]?.value ??
          'Unknown';
        const aliases = (item.names ?? [])
          .filter((n) => n.types.includes('alias'))
          .map((n) => n.value);
        const location = item.locations?.[0]?.geonames_details;

        return {
          id: item.id,
          name: displayName,
          aliases,
          country: location?.country_name ?? '',
          city: location?.name,
        };
      });
    },
    enabled: enabled && debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}
