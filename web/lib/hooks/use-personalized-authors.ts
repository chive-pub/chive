import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth';
import { APIError } from '@/lib/errors';
import type { SearchResultsResponse } from '@/lib/api/schema';

import { useAuthorProfile } from './use-author';
import { useDiscoverySettings } from './use-discovery';
import { useTrending } from './use-trending';
import { useMutedAuthors, filterMutedContent } from './use-muted-authors';

/**
 * Author info extracted from eprint search results.
 */
export interface DiscoveredAuthor {
  did: string;
  name: string;
  handle?: string;
  avatarUrl?: string;
  /** Fields from the eprint where this author was found */
  fields?: { uri: string; label: string }[];
}

/**
 * Query key factory for personalized author queries.
 */
export const personalizedAuthorKeys = {
  all: ['personalized-authors'] as const,
  fields: (fieldUris: string[]) => [...personalizedAuthorKeys.all, fieldUris] as const,
};

/**
 * Return type for the usePersonalizedAuthors hook.
 */
interface PersonalizedAuthorsResult {
  isPersonalized: boolean;
  needsFieldSetup: boolean;
  authors: DiscoveredAuthor[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Extracts and deduplicates authors from eprint search hits.
 */
function extractAuthors(
  hits: {
    authors?: { did?: string; name: string; handle?: string; avatarUrl?: string }[];
    fields?: { uri: string; label: string }[];
  }[],
  limit: number
): DiscoveredAuthor[] {
  const authorMap = new Map<string, DiscoveredAuthor>();

  for (const hit of hits) {
    for (const author of hit.authors ?? []) {
      if (!author.did) continue;
      if (authorMap.has(author.did)) continue;
      authorMap.set(author.did, {
        did: author.did,
        name: author.name,
        handle: author.handle,
        avatarUrl: author.avatarUrl,
        fields: hit.fields,
      });
      if (authorMap.size >= limit) return Array.from(authorMap.values());
    }
  }

  return Array.from(authorMap.values());
}

/**
 * Hook for personalized author discovery on the /authors page.
 *
 * @remarks
 * Authenticated users with fields see authors who recently posted in their fields.
 * Anonymous users or users without fields see authors from trending eprints.
 * Muted authors are filtered out. Authors are deduped by DID.
 */
export function usePersonalizedAuthors(
  options: { limit?: number } = {}
): PersonalizedAuthorsResult {
  const limit = options.limit ?? 20;
  const user = useCurrentUser();
  const { data: profile, isLoading: isProfileLoading } = useAuthorProfile(user?.did ?? '');
  const { data: discoverySettings } = useDiscoverySettings();
  const { mutedDids } = useMutedAuthors();

  const personalizationEnabled = discoverySettings?.enablePersonalization !== false;
  const fieldUris = profile?.fields ?? [];
  const hasFields = !!user && fieldUris.length > 0 && personalizationEnabled;
  const isAuthenticated = !!user;

  // Personalized: search recent eprints in user's fields, extract authors
  const personalizedQuery = useQuery({
    queryKey: personalizedAuthorKeys.fields(fieldUris),
    queryFn: async (): Promise<SearchResultsResponse> => {
      try {
        const response = await api.pub.chive.eprint.searchSubmissions({
          fieldUris,
          sort: 'recent',
          limit: limit * 3, // Fetch more to get enough unique authors after dedup
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch authors in your fields',
          undefined,
          'pub.chive.eprint.searchSubmissions'
        );
      }
    },
    enabled: hasFields && !isProfileLoading,
    staleTime: 60 * 1000,
  });

  // Trending fallback
  const trendingQuery = useTrending({ window: '7d', limit: limit * 3 });

  // Extract and filter authors
  const authors = useMemo(() => {
    let raw: DiscoveredAuthor[];

    if (hasFields && personalizedQuery.data) {
      raw = extractAuthors(personalizedQuery.data.hits ?? [], limit * 2);
    } else {
      // TrendingEntry.AuthorRef lacks handle/avatarUrl, so fallback author
      // cards will show initials only. Profile data loads on click-through.
      const trending = trendingQuery.data?.trending ?? [];
      raw = extractAuthors(
        trending.map((t) => ({
          authors: t.authors?.map((a) => ({
            did: a.did,
            name: a.name,
            handle: undefined,
            avatarUrl: undefined,
          })),
          fields: t.fields,
        })),
        limit * 2
      );
    }

    // Filter muted authors
    const filtered = filterMutedContent(raw, mutedDids, (a) => [a.did]);
    return filtered.slice(0, limit);
  }, [hasFields, personalizedQuery.data, trendingQuery.data, mutedDids, limit]);

  if (hasFields) {
    return {
      isPersonalized: true,
      needsFieldSetup: false,
      authors,
      isLoading: personalizedQuery.isLoading || isProfileLoading,
      error: personalizedQuery.error,
    };
  }

  if (isAuthenticated && !isProfileLoading && fieldUris.length === 0) {
    return {
      isPersonalized: false,
      needsFieldSetup: true,
      authors,
      isLoading: trendingQuery.isLoading,
      error: trendingQuery.error,
    };
  }

  return {
    isPersonalized: false,
    needsFieldSetup: false,
    authors,
    isLoading: isAuthenticated
      ? isProfileLoading || trendingQuery.isLoading
      : trendingQuery.isLoading,
    error: trendingQuery.error,
  };
}
