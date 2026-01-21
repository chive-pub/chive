/**
 * React hooks for tag data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for fetching, creating, and managing user tags.
 * Tags provide folksonomy-style classification alongside formal PMEST/FAST facets.
 *
 * The TaxoFolk system provides intelligent tag suggestions based on:
 * - Co-occurrence with other tags
 * - Authority record matching
 * - Facet value matching
 *
 * Tag quality and spam scoring helps surface high-quality tags while
 * filtering out noise. Tags can be promoted to facets or authority records
 * through community consensus.
 *
 * @example
 * ```tsx
 * import { useEprintTags, useTagSuggestions, tagKeys } from '@/lib/hooks/use-tags';
 *
 * function EprintTags({ eprintUri }: { eprintUri: string }) {
 *   const { data: tags } = useEprintTags(eprintUri);
 *   const { data: suggestions } = useTagSuggestions('machine learning');
 *
 *   return (
 *     <TagManager
 *       tags={tags?.tags ?? []}
 *       suggestions={suggestions ?? []}
 *     />
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { api } from '@/lib/api/client';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  createTagRecord,
  deleteRecord,
  type CreateTagInput as RecordCreatorTagInput,
} from '@/lib/atproto/record-creator';
import type {
  UserTag,
  TagSummary,
  TagSuggestion,
  EprintTagsResponse,
  TrendingTagsResponse,
  TagSearchResponse,
} from '@/lib/api/schema';

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for tag queries.
 *
 * @remarks
 * Follows TanStack Query best practices for hierarchical cache key management.
 *
 * @example
 * ```typescript
 * // Invalidate all tag queries
 * queryClient.invalidateQueries({ queryKey: tagKeys.all });
 *
 * // Invalidate tags for a specific eprint
 * queryClient.invalidateQueries({ queryKey: tagKeys.forEprint(eprintUri) });
 *
 * // Invalidate trending tags
 * queryClient.invalidateQueries({ queryKey: tagKeys.trending('week') });
 * ```
 */
export const tagKeys = {
  /** Base key for all tag queries */
  all: ['tags'] as const,

  /** Key for tags by eprint */
  forEprint: (eprintUri: string) => [...tagKeys.all, 'eprint', eprintUri] as const,

  /** Key for tag suggestions */
  suggestions: (query: string) => [...tagKeys.all, 'suggestions', query] as const,

  /** Key for trending tags */
  trending: (timeWindow: 'day' | 'week' | 'month' = 'week') =>
    [...tagKeys.all, 'trending', timeWindow] as const,

  /** Key for tag search */
  search: (query: string, params?: TagSearchParams) =>
    [...tagKeys.all, 'search', query, params] as const,

  /** Key for tag detail */
  detail: (normalizedForm: string) => [...tagKeys.all, 'detail', normalizedForm] as const,

  /** Key for eprints by tag */
  eprintsWithTag: (normalizedForm: string, params?: TagEprintParams) =>
    [...tagKeys.all, 'eprints', normalizedForm, params] as const,
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parameters for tag search.
 */
export interface TagSearchParams {
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Minimum quality score */
  minQuality?: number;
  /** Include spam tags */
  includeSpam?: boolean;
}

/**
 * Parameters for eprints by tag.
 */
export interface TagEprintParams {
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

/**
 * Options for tag hooks.
 */
export interface UseTagsOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Input for creating a new tag.
 */
export interface CreateTagInput {
  /** AT-URI of the eprint to tag */
  eprintUri: string;
  /** Tag display form */
  displayForm: string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetches tags for an eprint.
 *
 * @remarks
 * Returns user-generated tags along with TaxoFolk suggestions.
 * Tags are sorted by quality score (highest first).
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useEprintTags(eprintUri);
 *
 * return (
 *   <TagList
 *     tags={data?.tags ?? []}
 *     suggestions={data?.suggestions}
 *   />
 * );
 * ```
 *
 * @param eprintUri - AT-URI of the eprint
 * @param options - Hook options
 * @returns Query result with tags and suggestions
 */
export function useEprintTags(eprintUri: string, options: UseTagsOptions = {}) {
  return useQuery({
    queryKey: tagKeys.forEprint(eprintUri),
    queryFn: async (): Promise<EprintTagsResponse> => {
      try {
        const response = await api.pub.chive.tag.listForEprint({ eprintUri });
        return response.data as unknown as EprintTagsResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch tags',
          undefined,
          'pub.chive.tag.listForEprint'
        );
      }
    },
    enabled: !!eprintUri && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetches tag suggestions based on a query.
 *
 * @remarks
 * Uses the TaxoFolk system to provide intelligent suggestions from:
 * - Tag co-occurrence patterns
 * - Authority record matching
 * - Facet value matching
 *
 * Suggestions include confidence scores and source indicators.
 *
 * @example
 * ```tsx
 * const { data: suggestions } = useTagSuggestions(inputValue, {
 *   enabled: inputValue.length >= 2,
 * });
 *
 * return (
 *   <TagSuggestionList
 *     suggestions={suggestions ?? []}
 *     onSelect={handleSelectSuggestion}
 *   />
 * );
 * ```
 *
 * @param query - Search query for suggestions
 * @param options - Hook options
 * @returns Query result with tag suggestions
 */
export function useTagSuggestions(query: string, options: UseTagsOptions = {}) {
  return useQuery({
    queryKey: tagKeys.suggestions(query),
    queryFn: async (): Promise<TagSuggestion[]> => {
      try {
        const response = await api.pub.chive.tag.getSuggestions({ q: query });
        // Map API source values to domain source values
        return response.data.suggestions.map((s) => ({
          ...s,
          source: s.source === 'cooccurrence' ? 'co-occurrence' : s.source,
        })) as TagSuggestion[];
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch tag suggestions',
          undefined,
          'pub.chive.tag.getSuggestions'
        );
      }
    },
    enabled: query.length >= 2 && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000, // 5 minutes; suggestions are fairly stable.
  });
}

/**
 * Fetches trending tags.
 *
 * @remarks
 * Returns tags that are gaining popularity within a time window.
 * Useful for discovery and exploring active topics.
 *
 * @example
 * ```tsx
 * const { data } = useTrendingTags('week');
 *
 * return (
 *   <TrendingTags
 *     tags={data?.tags ?? []}
 *     timeWindow={data?.timeWindow ?? 'week'}
 *   />
 * );
 * ```
 *
 * @param timeWindow - Time window for trending calculation
 * @param options - Hook options
 * @returns Query result with trending tags
 */
export function useTrendingTags(
  timeWindow: 'day' | 'week' | 'month' = 'week',
  options: UseTagsOptions = {}
) {
  return useQuery({
    queryKey: tagKeys.trending(timeWindow),
    queryFn: async (): Promise<TrendingTagsResponse> => {
      try {
        const response = await api.pub.chive.tag.getTrending({ timeWindow });
        // Return API response directly - types now match
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch trending tags',
          undefined,
          'pub.chive.tag.getTrending'
        );
      }
    },
    enabled: options.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Searches for tags matching a query.
 *
 * @remarks
 * Full-text search across tag display forms and normalized forms.
 * Results include quality scores and promotion status.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useTagSearch('machine', {
 *   minQuality: 0.5,
 * });
 *
 * return (
 *   <TagSearchResults
 *     tags={data?.tags ?? []}
 *     total={data?.total ?? 0}
 *     hasMore={data?.hasMore ?? false}
 *   />
 * );
 * ```
 *
 * @param query - Search query
 * @param params - Search parameters
 * @param options - Hook options
 * @returns Query result with search results
 */
export function useTagSearch(
  query: string,
  params: TagSearchParams = {},
  options: UseTagsOptions = {}
) {
  return useQuery({
    queryKey: tagKeys.search(query, params),
    queryFn: async (): Promise<TagSearchResponse> => {
      try {
        const response = await api.pub.chive.tag.search({
          q: query,
          limit: params.limit ?? 20,
          cursor: params.cursor,
          minQuality: params.minQuality,
          includeSpam: params.includeSpam,
        });
        // Return API response directly - types now match
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to search tags',
          undefined,
          'pub.chive.tag.search'
        );
      }
    },
    enabled: query.length >= 2 && (options.enabled ?? true),
    staleTime: 60 * 1000, // 1 minute
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches details for a specific tag.
 *
 * @remarks
 * Returns full tag information including quality scores, usage metrics,
 * and promotion status.
 *
 * @example
 * ```tsx
 * const { data: tag, isLoading } = useTagDetail('machine-learning');
 *
 * if (!tag) return <TagNotFound />;
 *
 * return (
 *   <TagDetail
 *     tag={tag}
 *     showPromotion={userPreferences.showPromotionStatus}
 *   />
 * );
 * ```
 *
 * @param normalizedForm - Normalized form of the tag
 * @param options - Hook options
 * @returns Query result with tag details
 */
export function useTagDetail(normalizedForm: string, options: UseTagsOptions = {}) {
  return useQuery({
    queryKey: tagKeys.detail(normalizedForm),
    queryFn: async (): Promise<TagSummary | null> => {
      try {
        const response = await api.pub.chive.tag.getDetail({ tag: normalizedForm });
        return response.data;
      } catch (error) {
        // Return null for 404 (tag not found)
        if (error instanceof APIError && error.statusCode === 404) {
          return null;
        }
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch tag details',
          undefined,
          'pub.chive.tag.getDetail'
        );
      }
    },
    enabled: !!normalizedForm && (options.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Mutation hook for creating a new tag.
 *
 * @remarks
 * Creates a tag in the user's PDS. Tags are normalized for consistency
 * (lowercase, hyphen-separated) while preserving the display form.
 *
 * @example
 * ```tsx
 * const createTag = useCreateTag();
 *
 * const handleAddTag = async (displayForm: string) => {
 *   await createTag.mutateAsync({
 *     eprintUri,
 *     displayForm,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for creating tags
 */
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTagInput): Promise<UserTag> => {
      // Write directly to PDS from browser using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createTag');
      }

      const result = await createTagRecord(agent, input as RecordCreatorTagInput);

      // Return a UserTag-like object for cache management
      // The author info comes from the current user's agent DID
      return {
        uri: result.uri,
        cid: result.cid,
        eprintUri: input.eprintUri,
        author: {
          did: agent.did ?? '',
        },
        displayForm: input.displayForm,
        normalizedForm: input.displayForm.toLowerCase().trim(),
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      // Invalidate tags for the eprint
      queryClient.invalidateQueries({
        queryKey: tagKeys.forEprint(data.eprintUri),
      });

      // Invalidate tag detail if it exists
      queryClient.invalidateQueries({
        queryKey: tagKeys.detail(data.normalizedForm),
      });
    },
  });
}

/**
 * Mutation hook for deleting a tag.
 *
 * @remarks
 * Deletes a tag from the user's PDS. Only the tag creator
 * can delete their own tags.
 *
 * @example
 * ```tsx
 * const deleteTag = useDeleteTag();
 *
 * const handleDelete = async () => {
 *   await deleteTag.mutateAsync({
 *     uri: tag.uri,
 *     eprintUri: tag.eprintUri,
 *   });
 * };
 * ```
 *
 * @returns Mutation object for deleting tags
 */
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri }: { uri: string; eprintUri: string }): Promise<void> => {
      // Delete directly from PDS using the authenticated agent
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'deleteTag');
      }

      await deleteRecord(agent, uri);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: tagKeys.forEprint(variables.eprintUri),
      });
    },
  });
}

/**
 * Hook for prefetching tags on hover/focus.
 *
 * @remarks
 * Improves perceived performance by loading tag data before
 * the user views the tags section.
 *
 * @returns Function to prefetch tags for an eprint
 */
export function usePrefetchTags() {
  const queryClient = useQueryClient();

  return (eprintUri: string) => {
    queryClient.prefetchQuery({
      queryKey: tagKeys.forEprint(eprintUri),
      queryFn: async (): Promise<EprintTagsResponse | undefined> => {
        try {
          const response = await api.pub.chive.tag.listForEprint({ eprintUri });
          return response.data;
        } catch {
          return undefined;
        }
      },
      staleTime: 2 * 60 * 1000,
    });
  };
}
