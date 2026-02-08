/**
 * Discover author external IDs handler.
 *
 * @remarks
 * Helps users discover their external author IDs (OpenAlex, Semantic Scholar, etc.)
 * by searching for their name across multiple academic databases.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  AuthorMatch,
  ExternalIds,
} from '../../../../lexicons/generated/types/pub/chive/actor/discoverAuthorIds.js';
import { APIError, AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

// Use generated types from lexicons

/**
 * OpenAlex autocomplete response type.
 */
interface OpenAlexAutocompleteResponse {
  results?: {
    id: string;
    display_name: string;
    hint: string | null;
    works_count: number;
    cited_by_count: number;
    external_ids?: {
      orcid?: string;
    };
  }[];
}

/**
 * Semantic Scholar author search response type.
 */
interface S2AuthorSearchResponse {
  data?: {
    authorId: string;
    name: string;
    affiliations?: string[];
    paperCount: number;
    citationCount: number;
    externalIds?: {
      ORCID?: string;
      DBLP?: string[];
    };
  }[];
}

/**
 * Searches OpenAlex for authors.
 */
async function searchOpenAlex(query: string, limit: number): Promise<AuthorMatch[]> {
  const url = new URL('https://api.openalex.org/autocomplete/authors');
  url.searchParams.set('q', query);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Chive/1.0 (https://chive.pub; mailto:support@chive.pub)',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new APIError(
      `OpenAlex API error`,
      response.status,
      'https://api.openalex.org/autocomplete/authors'
    );
  }

  const data = (await response.json()) as OpenAlexAutocompleteResponse;
  const results = data.results ?? [];

  return results.slice(0, limit).map((result) => ({
    displayName: result.display_name,
    institution: result.hint ?? undefined,
    worksCount: result.works_count,
    citedByCount: result.cited_by_count,
    ids: {
      openalex: result.id.replace('https://openalex.org/', ''),
      semanticScholar: undefined,
      orcid: result.external_ids?.orcid ?? undefined,
      dblp: undefined,
    } satisfies ExternalIds,
  }));
}

/**
 * Searches Semantic Scholar for authors.
 */
async function searchSemanticScholar(query: string, limit: number): Promise<AuthorMatch[]> {
  const url = new URL('https://api.semanticscholar.org/graph/v1/author/search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('fields', 'authorId,name,affiliations,paperCount,citationCount,externalIds');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new APIError(
      `Semantic Scholar API error`,
      response.status,
      'https://api.semanticscholar.org/graph/v1/author/search'
    );
  }

  const data = (await response.json()) as S2AuthorSearchResponse;
  const results = data.data ?? [];

  return results.map((result) => ({
    displayName: result.name,
    institution: result.affiliations?.[0] ?? undefined,
    worksCount: result.paperCount,
    citedByCount: result.citationCount,
    ids: {
      openalex: undefined,
      semanticScholar: result.authorId,
      orcid: result.externalIds?.ORCID ?? undefined,
      dblp: result.externalIds?.DBLP?.[0] ?? undefined,
    } satisfies ExternalIds,
  }));
}

/**
 * XRPC method for pub.chive.actor.discoverAuthorIds.
 *
 * @public
 */
export const discoverAuthorIds: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required to discover author IDs');
    }

    // Get name to search
    const searchName = params.name;

    if (!searchName) {
      // Try to get displayName from profile
      // For now, require explicit name parameter
      throw new ValidationError('Name parameter required', 'name', 'required');
    }

    logger.debug('Author ID discovery request', {
      name: searchName,
      limit: params.limit,
      userDid: user.did,
    });

    const limit = params.limit ?? 5;

    const matches: AuthorMatch[] = [];
    const seenNames = new Set<string>();

    // Search OpenAlex and Semantic Scholar in parallel
    const [oaResults, s2Results] = await Promise.all([
      searchOpenAlex(searchName, limit).catch((err) => {
        logger.warn('OpenAlex author discovery error', {
          name: searchName,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
      searchSemanticScholar(searchName, limit).catch((err) => {
        logger.warn('Semantic Scholar author discovery error', {
          name: searchName,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
    ]);

    // Add OpenAlex results first (faster API, more comprehensive)
    for (const result of oaResults) {
      const normalizedName = result.displayName.toLowerCase();
      if (seenNames.has(normalizedName)) continue;
      seenNames.add(normalizedName);
      matches.push(result);
    }

    // Add Semantic Scholar results
    for (const result of s2Results) {
      const normalizedName = result.displayName.toLowerCase();
      if (seenNames.has(normalizedName)) continue;
      seenNames.add(normalizedName);
      matches.push(result);
    }

    // Sort by citation count (most likely to be the correct person)
    matches.sort((a, b) => b.citedByCount - a.citedByCount);

    logger.debug('Author ID discovery completed', {
      name: searchName,
      matchCount: matches.length,
    });

    return {
      encoding: 'application/json',
      body: {
        searchedName: searchName,
        matches: matches.slice(0, limit),
      },
    };
  },
};
