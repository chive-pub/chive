/**
 * React hooks for citation data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for fetching, creating, and deleting
 * user-curated citations for eprints. Citations are stored in the user's
 * PDS and indexed by Chive from the firehose.
 *
 * @example
 * ```tsx
 * import { useEprintCitations, useCreateCitation, citationKeys } from '@/lib/hooks/use-citations';
 *
 * function EprintCitations({ eprintUri }: { eprintUri: string }) {
 *   const { data } = useEprintCitations(eprintUri);
 *   const createCitation = useCreateCitation();
 *
 *   return (
 *     <CitationList
 *       citations={data?.citations ?? []}
 *       onAdd={(input) => createCitation.mutateAsync(input)}
 *     />
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { authApi, getApiBaseUrl } from '@/lib/api/client';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ context: { component: 'use-citations' } });
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  createCitationRecord,
  deleteRecord,
  type CreateCitationInput as RecordCreatorCitationInput,
} from '@/lib/atproto/record-creator';

// =============================================================================
// LOCAL TYPES (until OpenAPI types are regenerated)
// =============================================================================

/**
 * Author in a citation (as returned by GROBID/API).
 */
export interface CitationAuthor {
  firstName?: string;
  lastName?: string;
}

/**
 * View of a citation as returned by the API.
 *
 * @remarks
 * Matches the output schema of `pub.chive.eprint.listCitations`.
 */
export interface CitationView {
  uri?: string;
  title: string;
  doi?: string;
  arxivId?: string;
  authors?: CitationAuthor[];
  year?: number;
  venue?: string;
  chiveUri?: string;
  citationType?: string;
  context?: string;
  source: string;
  confidence?: number;
  isInfluential?: boolean;
  createdAt?: string;
}

/**
 * Response from the listCitations endpoint.
 */
export interface ListCitationsResponse {
  citations: CitationView[];
  cursor?: string;
  total?: number;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for citation queries.
 *
 * @remarks
 * Follows TanStack Query best practices for hierarchical cache key management.
 *
 * @example
 * ```typescript
 * // Invalidate all citation queries
 * queryClient.invalidateQueries({ queryKey: citationKeys.all });
 *
 * // Invalidate citations for a specific eprint
 * queryClient.invalidateQueries({ queryKey: citationKeys.forEprint(eprintUri) });
 * ```
 */
export const citationKeys = {
  /** Base key for all citation queries */
  all: ['citations'] as const,

  /** Key for citations by eprint */
  forEprint: (uri: string) => [...citationKeys.all, 'eprint', uri] as const,

  /** Key for citations with source filter */
  forEprintWithSource: (uri: string, source: string) =>
    [...citationKeys.forEprint(uri), 'source', source] as const,
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for citation query hooks.
 */
export interface UseCitationsOptions {
  /** Filter by citation source */
  source?: 'all' | 'user' | 'auto';
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Input for creating a new citation.
 */
export interface CreateCitationInput {
  /** AT-URI of the eprint being cited from */
  eprintUri: string;
  /** Title of the cited work */
  title: string;
  /** DOI of the cited work */
  doi?: string;
  /** Authors of the cited work */
  authors?: CitationAuthor[];
  /** Publication year */
  year?: number;
  /** Publication venue */
  venue?: string;
  /** Type of citation relationship */
  citationType?: string;
  /** Context or reason for the citation */
  context?: string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches citations for an eprint.
 *
 * @remarks
 * Returns both auto-extracted and user-provided citations.
 * Uses a 2-minute stale time since citations change less frequently
 * than annotations.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useEprintCitations(eprintUri);
 *
 * return (
 *   <CitationList
 *     citations={data?.citations ?? []}
 *     total={data?.total ?? 0}
 *   />
 * );
 * ```
 *
 * @param eprintUri - AT-URI of the eprint
 * @param options - Hook options (source filter, enabled)
 * @returns Query result with citations data
 */
export function useEprintCitations(eprintUri: string, options: UseCitationsOptions = {}) {
  const { source = 'all', enabled = true } = options;

  return useQuery({
    queryKey:
      source === 'all'
        ? citationKeys.forEprint(eprintUri)
        : citationKeys.forEprintWithSource(eprintUri, source),
    queryFn: async (): Promise<ListCitationsResponse> => {
      try {
        // Use direct fetch since the generated XRPC client may not include this
        // endpoint yet (backend is being developed in parallel).
        const searchParams = new URLSearchParams({ eprintUri, limit: '100' });
        if (source !== 'all') {
          searchParams.set('source', source);
        }
        const baseUrl = getApiBaseUrl();
        const url = `${baseUrl}/xrpc/pub.chive.eprint.listCitations?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string' ? body['message'] : 'Failed to fetch citations',
            response.status,
            'pub.chive.eprint.listCitations'
          );
        }
        return (await response.json()) as ListCitationsResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch citations',
          undefined,
          'pub.chive.eprint.listCitations'
        );
      }
    },
    enabled: !!eprintUri && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Mutation hook for creating a new citation.
 *
 * @remarks
 * Creates a citation record in the user's PDS and requests
 * immediate indexing for UI responsiveness. Falls back to
 * firehose indexing if immediate indexing fails.
 *
 * @example
 * ```tsx
 * const createCitation = useCreateCitation();
 *
 * const handleAdd = async (title: string) => {
 *   await createCitation.mutateAsync({
 *     eprintUri,
 *     title,
 *     citationType: 'extends',
 *   });
 * };
 * ```
 *
 * @returns Mutation object for creating citations
 */
export function useCreateCitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCitationInput): Promise<CitationView> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createCitation');
      }

      const result = await createCitationRecord(agent, {
        eprintUri: input.eprintUri,
        citedWork: {
          title: input.title,
          doi: input.doi,
          authors: input.authors?.map((a) => [a.firstName, a.lastName].filter(Boolean).join(' ')),
          year: input.year,
          venue: input.venue,
        },
        citationType: input.citationType,
        context: input.context,
      } as RecordCreatorCitationInput);

      // Request immediate indexing as a UX optimization.
      try {
        const indexResult = await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        if (indexResult.data && !indexResult.data.indexed) {
          logger.warn('Immediate indexing returned failure', {
            uri: result.uri,
            error: indexResult.data.error,
          });
        } else {
          logger.info('Immediate indexing succeeded', { uri: result.uri });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (indexError) {
        logger.warn('Immediate indexing failed; firehose will handle', {
          uri: result.uri,
          error: indexError instanceof Error ? indexError.message : String(indexError),
        });
      }

      return {
        uri: result.uri,
        title: input.title,
        doi: input.doi,
        authors: input.authors,
        year: input.year,
        venue: input.venue,
        citationType: input.citationType,
        context: input.context,
        source: 'user' as const,
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: citationKeys.forEprint(variables.eprintUri),
      });
    },
  });
}

/**
 * Mutation hook for deleting a citation.
 *
 * @remarks
 * Deletes a citation from the user's PDS. Only the citation creator
 * can delete their own citations.
 *
 * @example
 * ```tsx
 * const deleteCitation = useDeleteCitation();
 *
 * const handleDelete = async () => {
 *   await deleteCitation.mutateAsync({
 *     uri: citation.uri,
 *     eprintUri: citation.eprintUri,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for deleting citations
 */
export function useDeleteCitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri }: { uri: string; eprintUri: string }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'deleteCitation');
      }

      await deleteRecord(agent, uri);

      // Request immediate deletion indexing as a UX optimization.
      try {
        await authApi.pub.chive.sync.deleteRecord({ uri });
      } catch {
        logger.warn('Immediate deletion indexing failed; firehose will handle', { uri });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: citationKeys.forEprint(variables.eprintUri),
      });
    },
  });
}
