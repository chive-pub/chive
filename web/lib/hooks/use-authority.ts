/**
 * React hooks for authority record data fetching.
 *
 * @remarks
 * Provides TanStack Query hooks for searching and browsing authority records.
 * Authority records provide standardized forms for fields, concepts, and
 * organizations following IFLA LRM principles.
 *
 * @example
 * ```tsx
 * import { useAuthoritySearch, useAuthority } from '@/lib/hooks/use-authority';
 *
 * function AuthorityBrowser() {
 *   const { data } = useAuthoritySearch('neural networks', { type: 'concept' });
 *   return <AuthorityList records={data?.authorities ?? []} />;
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type {
  Authority,
  AuthorityType,
  AuthorityStatus,
  AuthoritySearchResponse,
  AuthorityReconciliation,
} from '@/lib/api/schema';

// Re-export types for convenience
export type { Authority, AuthorityType, AuthorityStatus, AuthorityReconciliation };

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for authority queries.
 */
export const authorityKeys = {
  /** Base key */
  all: ['authorities'] as const,

  /** Key for search queries */
  search: (query: string, params?: AuthoritySearchParams) =>
    [...authorityKeys.all, 'search', query, params] as const,

  /** Key for single authority */
  detail: (id: string) => [...authorityKeys.all, 'detail', id] as const,

  /** Key for reconciliations */
  reconciliations: (id: string) => [...authorityKeys.all, 'reconciliations', id] as const,

  /** Key for authorities by type */
  byType: (type: AuthorityType) => [...authorityKeys.all, 'type', type] as const,
};

// =============================================================================
// PARAMETER TYPES
// =============================================================================

/**
 * Search parameters.
 */
export interface AuthoritySearchParams {
  /** Filter by type */
  type?: AuthorityType;
  /** Filter by status */
  status?: AuthorityStatus;
  /** Maximum results */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Hook options.
 */
export interface UseAuthorityOptions {
  /** Whether query is enabled */
  enabled?: boolean;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Searches authority records.
 *
 * @param query - Search query
 * @param params - Search parameters
 * @param options - Hook options
 * @returns Query result with matching records
 *
 * @example
 * ```tsx
 * const { data } = useAuthoritySearch('neural networks', {
 *   type: 'concept',
 *   status: 'established',
 * });
 * ```
 */
export function useAuthoritySearch(
  query: string,
  params: AuthoritySearchParams = {},
  options: UseAuthorityOptions = {}
) {
  return useQuery({
    queryKey: authorityKeys.search(query, params),
    queryFn: async (): Promise<AuthoritySearchResponse> => {
      const { data } = await api.GET('/xrpc/pub.chive.graph.searchAuthorities', {
        params: {
          query: {
            q: query,
            sort: 'relevance' as const,
            limit: params.limit ?? 20,
            cursor: params.cursor,
            type: params.type,
            status: params.status,
          },
        },
      });
      return data!;
    },
    enabled: query.length >= 2 && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches a single authority record.
 *
 * @param authorityId - Authority ID
 * @param options - Hook options
 * @returns Query result with authority
 *
 * @example
 * ```tsx
 * const { data: authority } = useAuthority(authorityId);
 * ```
 */
export function useAuthority(authorityId: string, options: UseAuthorityOptions = {}) {
  return useQuery({
    queryKey: authorityKeys.detail(authorityId),
    queryFn: async (): Promise<Authority> => {
      const { data } = await api.GET('/xrpc/pub.chive.graph.getAuthority', {
        params: {
          query: { id: authorityId },
        },
      });
      return data!;
    },
    enabled: !!authorityId && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches reconciliations for an authority record.
 *
 * @param authorityId - Authority ID
 * @param options - Hook options
 * @returns Query result with reconciliations
 */
export function useAuthorityReconciliations(
  authorityId: string,
  options: UseAuthorityOptions = {}
) {
  return useQuery({
    queryKey: authorityKeys.reconciliations(authorityId),
    queryFn: async (): Promise<readonly AuthorityReconciliation[]> => {
      const { data } = await api.GET('/xrpc/pub.chive.graph.getAuthorityReconciliations', {
        params: {
          query: { authorityId, limit: 50 },
        },
      });
      return data!.reconciliations;
    },
    enabled: !!authorityId && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for prefetching an authority on hover.
 */
export function usePrefetchAuthority() {
  const queryClient = useQueryClient();

  return (authorityId: string) => {
    queryClient.prefetchQuery({
      queryKey: authorityKeys.detail(authorityId),
      queryFn: async (): Promise<Authority | undefined> => {
        const { data } = await api.GET('/xrpc/pub.chive.graph.getAuthority', {
          params: { query: { id: authorityId } },
        });
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Authority type labels.
 */
export const AUTHORITY_TYPE_LABELS: Record<AuthorityType, string> = {
  person: 'Person',
  organization: 'Organization',
  concept: 'Concept',
  place: 'Place',
};

/**
 * Authority status labels.
 */
export const AUTHORITY_STATUS_LABELS: Record<AuthorityStatus, string> = {
  proposed: 'Proposed',
  under_review: 'Under Review',
  approved: 'Approved',
  deprecated: 'Deprecated',
};

/**
 * External system labels.
 */
export const EXTERNAL_SYSTEM_LABELS: Record<string, string> = {
  wikidata: 'Wikidata',
  lcsh: 'Library of Congress',
  fast: 'OCLC FAST',
  ror: 'ROR',
  orcid: 'ORCID',
  viaf: 'VIAF',
};
