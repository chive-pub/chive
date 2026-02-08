import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { Record as SubmissionRecord } from '@/lib/api/generated/types/pub/chive/eprint/submission';
import { APIError } from '@/lib/errors';
import type { Eprint, EprintSummary, EprintAuthorView, ApiSchemaHints } from '@/lib/api/schema';

/**
 * Extended eprint with optional schema hints.
 */
export interface EprintWithSchemaHints extends Eprint {
  /** Schema hints for migration (if available) */
  _schemaHints?: ApiSchemaHints;
}

/**
 * Extracts plain text from a rich abstract array.
 */
function extractPlainTextAbstract(
  abstractItems: Array<{ type?: string; content?: string; label?: string }>
): string {
  return abstractItems
    .map((item) => {
      if (item.type === 'text' && item.content) {
        return item.content;
      }
      if (item.type === 'nodeRef' && item.label) {
        return item.label;
      }
      return '';
    })
    .join('')
    .trim();
}

/**
 * Transforms raw author contribution record to enriched author view.
 */
function transformAuthor(author: {
  did?: string;
  name: string;
  handle?: string;
  avatarUrl?: string;
  orcid?: string;
  email?: string;
  order: number;
  affiliations?: Array<{
    name: string;
    institutionUri?: string;
    rorId?: string;
    department?: string;
  }>;
  contributions?: Array<{
    typeUri: string;
    typeSlug?: string;
    degreeUri?: string;
    degreeSlug: string;
  }>;
  isCorrespondingAuthor: boolean;
  isHighlighted: boolean;
}): EprintAuthorView {
  return {
    did: author.did,
    name: author.name,
    handle: author.handle,
    avatar: author.avatarUrl,
    displayName: author.name,
    orcid: author.orcid,
    order: author.order,
    affiliations: author.affiliations,
    contributions: author.contributions,
    isCorrespondingAuthor: author.isCorrespondingAuthor,
    isHighlighted: author.isHighlighted,
  };
}

/**
 * Response from the listByAuthor endpoint.
 */
interface EprintsByAuthorResponse {
  eprints: EprintSummary[];
  cursor?: string;
  hasMore: boolean;
}

/**
 * Query key factory for eprint queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for eprint data.
 *
 * @example
 * ```typescript
 * // Invalidate all eprint queries
 * queryClient.invalidateQueries({ queryKey: eprintKeys.all });
 *
 * // Invalidate specific eprint
 * queryClient.invalidateQueries({ queryKey: eprintKeys.detail('at://did:plc:abc/...') });
 *
 * // Invalidate all eprints by a specific author
 * queryClient.invalidateQueries({ queryKey: eprintKeys.byAuthor('did:plc:abc') });
 * ```
 */
export const eprintKeys = {
  /** Base key for all eprint queries */
  all: ['eprints'] as const,
  /** Key for eprint list queries */
  lists: () => [...eprintKeys.all, 'list'] as const,
  /** Key for specific eprint list query with params */
  list: (params: { limit?: number; cursor?: string; field?: string }) =>
    [...eprintKeys.lists(), params] as const,
  /** Key for eprint detail queries */
  details: () => [...eprintKeys.all, 'detail'] as const,
  /** Key for specific eprint detail query */
  detail: (uri: string) => [...eprintKeys.details(), uri] as const,
  /** Key for eprints by author */
  byAuthor: (did: string) => [...eprintKeys.all, 'author', did] as const,
};

/**
 * Options for the useEprint hook.
 */
interface UseEprintOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches a single eprint by AT Protocol URI.
 *
 * @remarks
 * Uses TanStack Query with a 5-minute stale time since eprints rarely change.
 * Returns cached data while revalidating in background.
 *
 * @example
 * ```tsx
 * const { data: eprint, isLoading, error } = useEprint(
 *   'at://did:plc:abc/pub.chive.eprint.submission/123'
 * );
 *
 * if (isLoading) return <EprintSkeleton />;
 * if (error) return <EprintError error={error} />;
 *
 * return <EprintDetail eprint={eprint} />;
 * ```
 *
 * @param uri - AT Protocol URI of the eprint
 * @param options - Query options
 * @returns Query result with eprint data, loading state, and error
 *
 * @throws {Error} When the eprint API request fails
 */
export function useEprint(uri: string, options: UseEprintOptions = {}) {
  return useQuery({
    queryKey: eprintKeys.detail(uri),
    queryFn: async (): Promise<EprintWithSchemaHints> => {
      try {
        const response = await api.pub.chive.eprint.getSubmission({ uri });
        const { value: rawValue, ...metadata } = response.data;

        // Cast value to SubmissionRecord type (value is unknown per ATProto pattern)
        const value = rawValue as SubmissionRecord;

        // Extract schema hints if present (additive field from backend)
        const dataWithHints = response.data as typeof response.data & {
          _schemaHints?: ApiSchemaHints;
        };
        const schemaHints = dataWithHints._schemaHints;

        // Transform raw record to enriched Eprint view
        const abstractItems = value.abstract as Array<{
          type?: string;
          content?: string;
          label?: string;
        }>;
        const plainTextAbstract =
          value.abstractPlainText ?? extractPlainTextAbstract(abstractItems);

        // Transform authors to enriched view
        const authors = value.authors.map(transformAuthor);

        // Extract license from slug or URI
        const license = value.licenseSlug;

        // Extract DOI from external IDs or published version
        const doi = value.externalIds?.zenodoDoi ?? value.publishedVersion?.doi;

        // Map publication status slug to display value
        const publicationStatus = value.publicationStatusSlug as Eprint['publicationStatus'];

        return {
          ...value,
          ...metadata,
          abstract: plainTextAbstract,
          abstractItems,
          authors,
          license,
          doi,
          publicationStatus,
          // fields, metrics, versions would need additional API calls or backend enrichment
          // Include schema hints if present
          ...(schemaHints && { _schemaHints: schemaHints }),
        };
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch eprint',
          undefined,
          'pub.chive.eprint.getSubmission'
        );
      }
    },
    enabled: !!uri && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000, // 5 minutes; eprints rarely change.
  });
}

/**
 * Parameters for the useEprints hook.
 */
interface UseEprintsParams {
  /** Search query */
  q?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Filter by field ID */
  field?: string;
}

/**
 * Fetches a paginated list of eprints.
 *
 * @remarks
 * Uses placeholder data to show previous results while fetching new ones,
 * providing a smoother pagination experience.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useEprints({
 *   field: 'computer-science',
 *   limit: 20,
 * });
 *
 * return (
 *   <EprintList
 *     eprints={data?.eprints ?? []}
 *     isLoading={isLoading}
 *   />
 * );
 * ```
 *
 * @param params - Query parameters (limit, cursor, field)
 * @returns Query result with eprint list
 *
 * @throws {Error} When the eprints API request fails
 */
export function useEprints(params: UseEprintsParams = {}) {
  const { q, limit, cursor, field } = params;

  return useQuery({
    queryKey: eprintKeys.list(params),
    queryFn: async () => {
      // API requires q to be a non-empty string
      if (!q) {
        throw new APIError('Search query is required', undefined, 'searchSubmissions');
      }

      try {
        const response = await api.pub.chive.eprint.searchSubmissions({
          q,
          limit,
          cursor,
          fieldUris: field ? [field] : undefined,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch eprints',
          undefined,
          'pub.chive.eprint.searchSubmissions'
        );
      }
    },
    // Only enable query when q is provided
    enabled: !!q,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Parameters for the useEprintsByAuthor hook.
 */
interface UseEprintsByAuthorParams {
  /** Author's decentralized identifier (DID) */
  did: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

/**
 * Fetches eprints authored by a specific user.
 *
 * @remarks
 * Queries eprints by the author's DID. Only enabled when a valid DID is provided.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useEprintsByAuthor({
 *   did: 'did:plc:abc123',
 *   limit: 10,
 * });
 *
 * return (
 *   <AuthorEprints
 *     eprints={data?.eprints ?? []}
 *     isLoading={isLoading}
 *   />
 * );
 * ```
 *
 * @param params - Query parameters including author DID
 * @returns Query result with author's eprints
 *
 * @throws {Error} When the author eprints API request fails
 */
export function useEprintsByAuthor(params: UseEprintsByAuthorParams) {
  return useQuery<EprintsByAuthorResponse>({
    queryKey: eprintKeys.byAuthor(params.did),
    queryFn: async (): Promise<EprintsByAuthorResponse> => {
      try {
        const response = await api.pub.chive.eprint.listByAuthor({
          did: params.did,
          limit: params.limit ?? 20,
          sortBy: 'indexedAt',
          sortOrder: 'desc',
          cursor: params.cursor,
        });
        // listByAuthor doesn't return hasMore, derive from cursor presence
        const data = response.data;
        return {
          eprints: data.eprints,
          cursor: data.cursor,
          hasMore: !!data.cursor,
        };
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch eprints by author',
          undefined,
          'pub.chive.eprint.listByAuthor'
        );
      }
    },
    enabled: !!params.did,
  });
}

/**
 * Hook for prefetching an eprint on hover/focus.
 *
 * @remarks
 * Improves perceived performance by loading eprint data before navigation.
 * Uses the same cache key as useEprint for seamless transitions.
 *
 * @example
 * ```tsx
 * const prefetchEprint = usePrefetchEprint();
 *
 * return (
 *   <EprintCard
 *     eprint={eprint}
 *     onMouseEnter={() => prefetchEprint(eprint.uri)}
 *     onFocus={() => prefetchEprint(eprint.uri)}
 *   />
 * );
 * ```
 *
 * @returns Function to prefetch an eprint by URI
 */
export function usePrefetchEprint() {
  const queryClient = useQueryClient();

  return (uri: string) => {
    queryClient.prefetchQuery({
      queryKey: eprintKeys.detail(uri),
      queryFn: async (): Promise<Eprint | undefined> => {
        try {
          const response = await api.pub.chive.eprint.getSubmission({ uri });
          const { value: rawValue, ...metadata } = response.data;

          // Cast value to SubmissionRecord type (value is unknown per ATProto pattern)
          const value = rawValue as SubmissionRecord;

          // Transform raw record to enriched Eprint view
          const abstractItems = value.abstract as Array<{
            type?: string;
            content?: string;
            label?: string;
          }>;
          const plainTextAbstract =
            value.abstractPlainText ?? extractPlainTextAbstract(abstractItems);
          const authors = value.authors.map(transformAuthor);
          const license = value.licenseSlug;
          const doi = value.externalIds?.zenodoDoi ?? value.publishedVersion?.doi;
          const publicationStatus = value.publicationStatusSlug as Eprint['publicationStatus'];

          return {
            ...value,
            ...metadata,
            abstract: plainTextAbstract,
            abstractItems,
            authors,
            license,
            doi,
            publicationStatus,
          };
        } catch {
          return undefined;
        }
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}
