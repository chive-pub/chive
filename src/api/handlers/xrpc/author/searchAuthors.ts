/**
 * XRPC handler for pub.chive.author.searchAuthors.
 *
 * @remarks
 * Searches for authors by combining Chive's eprint index with the Bluesky
 * public actor search API. Chive-indexed authors (those with eprints) are
 * returned first, with Bluesky network results as a fallback so that any
 * ATProto user can be found by name or handle.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type {
  QueryParams,
  OutputSchema,
  AuthorSearchResult,
} from '../../../../lexicons/generated/types/pub/chive/author/searchAuthors.js';
import type { DID } from '../../../../types/atproto.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

const BLUESKY_PUBLIC_API = 'https://public.api.bsky.app';

/**
 * Searches for authors by querying Elasticsearch for eprints with matching author names.
 */
async function searchAuthorsInIndex(
  c: Context<ChiveEnv>,
  query: string,
  limit: number
): Promise<{ did: string; name?: string; eprintCount?: number }[]> {
  const logger = c.get('logger');
  const search = c.get('services').search;

  try {
    // Search for eprints with matching author names
    const searchResults = await search.search({
      q: query,
      limit: limit * 3, // Get more to dedupe authors
    });

    const authorMap = new Map<string, { did: string; name?: string; eprintCount: number }>();

    // Extract unique authors from search results
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(Boolean);

    for (const hit of searchResults.hits) {
      // Get the full eprint data to access authors
      const eprint = await c.get('services').eprint.getEprint(hit.uri);
      if (!eprint) continue;

      for (const author of eprint.authors) {
        if (author.did) {
          // Check if the author name matches the query using word-prefix matching.
          // Each query word must prefix-match at least one name word, so
          // "aarons" matches "Aaron Steven White" (prefix of "aarons" -> "aaron").
          const authorNameLower = author.name?.toLowerCase() ?? '';
          const nameWords = authorNameLower.split(/\s+/).filter(Boolean);

          const matches =
            authorNameLower.includes(queryLower) ||
            author.did.includes(queryLower) ||
            queryWords.every((qw) =>
              nameWords.some((nw) => nw.startsWith(qw) || qw.startsWith(nw))
            );

          if (matches) {
            const existing = authorMap.get(author.did);
            if (existing) {
              existing.eprintCount += 1;
            } else {
              authorMap.set(author.did, {
                did: author.did,
                name: author.name,
                eprintCount: 1,
              });
            }
          }
        }
      }

      if (authorMap.size >= limit) break;
    }

    return Array.from(authorMap.values()).slice(0, limit);
  } catch (error) {
    logger.error('Author search failed', error instanceof Error ? error : undefined, {
      query,
    });
    return [];
  }
}

/**
 * Searches Bluesky's public actor search API as a fallback.
 *
 * @remarks
 * Enables finding any ATProto user by name or handle, not just
 * authors with eprints indexed on Chive.
 */
async function searchBlueskyActors(
  logger: { warn: (msg: string, ctx?: Record<string, unknown>) => void },
  query: string,
  limit: number
): Promise<AuthorSearchResult[]> {
  try {
    const response = await fetch(
      `${BLUESKY_PUBLIC_API}/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      actors?: {
        did: string;
        handle?: string;
        displayName?: string;
        avatar?: string;
      }[];
    };

    return (data.actors ?? []).map((actor) => ({
      did: actor.did,
      handle: actor.handle,
      displayName: actor.displayName,
      avatar: actor.avatar,
    }));
  } catch {
    logger.warn('Bluesky actor search fallback failed', { query });
    return [];
  }
}

/**
 * Enriches author results with handle and avatar from DID resolution.
 */
async function enrichAuthorsWithProfiles(
  c: Context<ChiveEnv>,
  authors: { did: string; name?: string; eprintCount?: number }[]
): Promise<AuthorSearchResult[]> {
  const redis = c.get('redis');
  const logger = c.get('logger');
  const didResolver = new DIDResolver({ redis, logger });

  const enrichedResults = await Promise.all(
    authors.map(async (author): Promise<AuthorSearchResult> => {
      try {
        const [didDoc, pdsEndpoint] = await Promise.all([
          didResolver.resolveDID(author.did as DID),
          didResolver.getPDSEndpoint(author.did as DID),
        ]);

        // Extract handle from alsoKnownAs
        let handle: string | undefined;
        if (didDoc?.alsoKnownAs) {
          const handleEntry = didDoc.alsoKnownAs.find((aka) => aka.startsWith('at://'));
          if (handleEntry) {
            handle = handleEntry.replace('at://', '');
          }
        }

        // Try to fetch basic profile data
        let displayName = author.name;
        let avatar: string | undefined;

        if (pdsEndpoint) {
          try {
            const profileResponse = await fetch(
              `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(author.did)}&collection=app.bsky.actor.profile&rkey=self`,
              {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(3000),
              }
            );

            if (profileResponse.ok) {
              const profileData = (await profileResponse.json()) as {
                value?: {
                  displayName?: string;
                  avatar?: { ref?: { $link?: string } };
                };
              };

              if (profileData.value?.displayName) {
                displayName = profileData.value.displayName;
              }

              if (profileData.value?.avatar?.ref?.$link) {
                avatar = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(author.did)}&cid=${profileData.value.avatar.ref.$link}`;
              }
            }
          } catch {
            // Profile fetch failed, continue with basic info
          }
        }

        return {
          did: author.did,
          handle,
          displayName,
          avatar,
          eprintCount: author.eprintCount,
        };
      } catch {
        // DID resolution failed, return basic info
        return {
          did: author.did,
          displayName: author.name,
          eprintCount: author.eprintCount,
        };
      }
    })
  );

  return enrichedResults;
}

/**
 * XRPC method for pub.chive.author.searchAuthors.
 *
 * @remarks
 * Searches for authors who have eprints on Chive or have Chive profiles.
 * Falls back to Bluesky's public actor search API when the Chive index
 * returns no results, enabling any ATProto user to be found.
 *
 * @public
 */
export const searchAuthors: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { q, limit } = params;

    logger.debug('Searching authors', { q, limit });

    // 1. Search Chive's eprint index for authors
    const dbResults = await searchAuthorsInIndex(c, q, limit);

    if (dbResults.length > 0) {
      // Enrich Chive results with profile data
      const enrichedAuthors = await enrichAuthorsWithProfiles(c, dbResults);

      logger.info('Author search completed (chive index)', {
        q,
        resultCount: enrichedAuthors.length,
      });

      return { encoding: 'application/json', body: { authors: enrichedAuthors } };
    }

    // 2. Fall back to Bluesky public actor search
    const blueskyResults = await searchBlueskyActors(logger, q, limit);

    logger.info('Author search completed (bluesky fallback)', {
      q,
      resultCount: blueskyResults.length,
    });

    return { encoding: 'application/json', body: { authors: blueskyResults } };
  },
};
