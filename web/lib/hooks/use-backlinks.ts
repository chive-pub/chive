import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { APIError } from '@/lib/errors';

/**
 * Backlink source type.
 */
export type BacklinkSourceType =
  | 'semble.collection'
  | 'leaflet.list'
  | 'whitewind.blog'
  | 'bluesky.post'
  | 'bluesky.embed'
  | 'other';

/**
 * Backlink record.
 */
export interface Backlink {
  id: number;
  sourceUri: string;
  sourceType: BacklinkSourceType;
  targetUri: string;
  context?: string;
  indexedAt: string;
  deleted: boolean;
}

/**
 * Backlink counts by source type.
 */
export interface BacklinkCounts {
  sembleCollections: number;
  leafletLists: number;
  whitewindBlogs: number;
  blueskyPosts: number;
  blueskyEmbeds: number;
  other: number;
  total: number;
}

/**
 * Response from backlink list endpoint.
 */
interface ListBacklinksResponse {
  backlinks: Backlink[];
  cursor?: string;
  hasMore: boolean;
}

/**
 * Query key factory for backlink-related queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 */
export const backlinkKeys = {
  /** Base key for all backlink queries */
  all: ['backlinks'] as const,
  /** Key for backlink list queries */
  list: (targetUri: string, options?: { sourceType?: BacklinkSourceType; limit?: number }) =>
    [...backlinkKeys.all, 'list', targetUri, options] as const,
  /** Key for backlink count queries */
  counts: (targetUri: string) => [...backlinkKeys.all, 'counts', targetUri] as const,
};

interface UseBacklinksOptions {
  /** Filter by source type */
  sourceType?: BacklinkSourceType;
  /** Number of backlinks per page */
  limit?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches backlinks to a eprint with pagination.
 *
 * @remarks
 * Uses TanStack Query's useInfiniteQuery for cursor-based pagination.
 * Backlinks track references to Chive eprints from external sources
 * like Semble collections, Bluesky posts, WhiteWind blogs, and Leaflet lists.
 *
 * @example
 * ```tsx
 * const { data, isLoading, hasNextPage, fetchNextPage } = useBacklinks(eprintUri);
 * const allBacklinks = data?.pages.flatMap(p => p.backlinks) ?? [];
 * ```
 *
 * @param targetUri - AT URI of the eprint to get backlinks for
 * @param options - Query options
 * @returns Infinite query result with paginated backlinks
 */
export function useBacklinks(targetUri: string, options: UseBacklinksOptions = {}) {
  const { sourceType, limit = 20, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: backlinkKeys.list(targetUri, { sourceType, limit }),
    queryFn: async ({ pageParam }): Promise<ListBacklinksResponse> => {
      // Build query params, explicitly filtering undefined values
      const queryParams: {
        targetUri: string;
        sourceType?: typeof sourceType;
        limit?: number;
        cursor?: string;
      } = {
        targetUri,
      };

      if (sourceType !== undefined) {
        queryParams.sourceType = sourceType;
      }
      if (limit !== undefined) {
        queryParams.limit = limit;
      }
      if (pageParam !== undefined) {
        queryParams.cursor = pageParam;
      }

      const { data, error } = await api.GET('/xrpc/pub.chive.backlink.list', {
        params: {
          query: queryParams,
        },
      });

      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch backlinks',
          undefined,
          '/xrpc/pub.chive.backlink.list'
        );
      }

      return data!;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    enabled: enabled && !!targetUri,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

interface UseBacklinkCountsOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches aggregated backlink counts for a eprint.
 *
 * @remarks
 * Returns counts by source type (Semble, Bluesky, WhiteWind, Leaflet, etc.)
 * and a total count. Useful for displaying summary badges.
 *
 * @example
 * ```tsx
 * const { data: counts, isLoading } = useBacklinkCounts(eprintUri);
 * console.log(counts?.total, 'total backlinks');
 * ```
 *
 * @param targetUri - AT URI of the eprint to get counts for
 * @param options - Query options
 * @returns Query result with backlink counts
 */
export function useBacklinkCounts(targetUri: string, options: UseBacklinkCountsOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: backlinkKeys.counts(targetUri),
    queryFn: async (): Promise<BacklinkCounts> => {
      const { data, error } = await api.GET('/xrpc/pub.chive.backlink.getCounts', {
        params: {
          query: { targetUri },
        },
      });
      if (error) {
        throw new APIError(
          (error as { message?: string }).message ?? 'Failed to fetch backlink counts',
          undefined,
          '/xrpc/pub.chive.backlink.getCounts'
        );
      }
      return data!;
    },
    enabled: enabled && !!targetUri,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Groups backlinks by source type.
 *
 * @param backlinks - Array of backlinks to group
 * @returns Map of source type to backlinks
 */
export function groupBacklinksBySource(backlinks: Backlink[]): Map<BacklinkSourceType, Backlink[]> {
  const grouped = new Map<BacklinkSourceType, Backlink[]>();

  for (const backlink of backlinks) {
    const existing = grouped.get(backlink.sourceType) ?? [];
    grouped.set(backlink.sourceType, [...existing, backlink]);
  }

  return grouped;
}

/**
 * Gets a human-readable label for a backlink source type.
 *
 * @param sourceType - The source type
 * @returns Human-readable label
 */
export function getSourceTypeLabel(sourceType: BacklinkSourceType): string {
  switch (sourceType) {
    case 'semble.collection':
      return 'Semble Collections';
    case 'leaflet.list':
      return 'Leaflet Lists';
    case 'whitewind.blog':
      return 'WhiteWind Blogs';
    case 'bluesky.post':
      return 'Bluesky Posts';
    case 'bluesky.embed':
      return 'Bluesky Embeds';
    case 'other':
    default:
      return 'Other Sources';
  }
}
