/**
 * Author search handler.
 *
 * @remarks
 * Searches for authors who have eprints on Chive or have Chive profiles.
 * This endpoint returns Chive-relevant authors only, not all ATProto users.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type { DID } from '../../../../types/atproto.js';
import {
  searchAuthorsParamsSchema,
  searchAuthorsResponseSchema,
  type SearchAuthorsParams,
  type SearchAuthorsResponse,
  type SearchAuthorResult,
} from '../../../schemas/author.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Searches for authors by querying Elasticsearch for eprints with matching author names.
 */
async function searchAuthorsInIndex(
  c: Context<ChiveEnv>,
  query: string,
  limit: number
): Promise<{ did: string; name?: string; hasEprints: boolean; hasProfile: boolean }[]> {
  const logger = c.get('logger');
  const search = c.get('services').search;

  try {
    // Search for eprints with matching author names
    const searchResults = await search.search({
      q: query,
      limit: limit * 3, // Get more to dedupe authors
    });

    const authorMap = new Map<
      string,
      { did: string; name?: string; hasEprints: boolean; hasProfile: boolean }
    >();

    // Extract unique authors from search results
    for (const hit of searchResults.hits) {
      // Get the full eprint data to access authors
      const eprint = await c.get('services').eprint.getEprint(hit.uri);
      if (!eprint) continue;

      for (const author of eprint.authors) {
        if (author.did && !authorMap.has(author.did)) {
          // Check if the author name matches the query
          const authorNameLower = author.name?.toLowerCase() ?? '';
          const queryLower = query.toLowerCase();
          if (authorNameLower.includes(queryLower) || author.did.includes(queryLower)) {
            authorMap.set(author.did, {
              did: author.did,
              name: author.name,
              hasEprints: true,
              hasProfile: false, // We don't check profiles in this implementation
            });
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
 * Enriches author results with handle and avatar from DID resolution.
 */
async function enrichAuthorsWithProfiles(
  c: Context<ChiveEnv>,
  authors: { did: string; name?: string; hasEprints: boolean; hasProfile: boolean }[]
): Promise<SearchAuthorResult[]> {
  const redis = c.get('redis');
  const logger = c.get('logger');
  const didResolver = new DIDResolver({ redis, logger });

  const enrichedResults = await Promise.all(
    authors.map(async (author): Promise<SearchAuthorResult> => {
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
          hasEprints: author.hasEprints,
          hasProfile: author.hasProfile,
        };
      } catch {
        // DID resolution failed, return basic info
        return {
          did: author.did,
          displayName: author.name,
          hasEprints: author.hasEprints,
          hasProfile: author.hasProfile,
        };
      }
    })
  );

  return enrichedResults;
}

/**
 * Handler for pub.chive.author.searchAuthors.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Matching authors with Chive presence
 *
 * @remarks
 * Searches for authors who have eprints on Chive or have Chive profiles.
 * Results include handle, avatar, and ORCID when available.
 *
 * @public
 */
export async function searchAuthorsHandler(
  c: Context<ChiveEnv>,
  params: SearchAuthorsParams
): Promise<SearchAuthorsResponse> {
  const logger = c.get('logger');
  const { query, limit } = params;

  logger.debug('Searching authors', { query, limit });

  // Search for authors in the index
  const dbResults = await searchAuthorsInIndex(c, query, limit);

  if (dbResults.length === 0) {
    return { authors: [] };
  }

  // Enrich results with profile data
  const enrichedAuthors = await enrichAuthorsWithProfiles(c, dbResults);

  logger.info('Author search completed', {
    query,
    resultCount: enrichedAuthors.length,
  });

  return { authors: enrichedAuthors };
}

/**
 * XRPC endpoint definition for pub.chive.author.searchAuthors.
 *
 * @public
 */
export const searchAuthorsEndpoint: XRPCEndpoint<SearchAuthorsParams, SearchAuthorsResponse> = {
  method: 'pub.chive.author.searchAuthors' as never,
  type: 'query',
  description: 'Search for authors with Chive presence (eprints or profiles)',
  inputSchema: searchAuthorsParamsSchema,
  outputSchema: searchAuthorsResponseSchema,
  handler: searchAuthorsHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
