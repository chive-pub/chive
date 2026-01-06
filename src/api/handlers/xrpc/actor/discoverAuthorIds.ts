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

import type { Context } from 'hono';
import { z } from 'zod';

import { AuthenticationError } from '../../../../types/errors.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Input params schema.
 */
const discoverAuthorIdsParamsSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(200)
    .optional()
    .describe('Name to search (defaults to profile displayName)'),
  limit: z.coerce.number().int().min(1).max(10).optional().describe('Max results (default 5)'),
});

export type DiscoverAuthorIdsParams = z.infer<typeof discoverAuthorIdsParamsSchema>;

/**
 * External IDs schema.
 */
const externalIdsSchema = z.object({
  openalex: z.string().nullable().describe('OpenAlex author ID'),
  semanticScholar: z.string().nullable().describe('Semantic Scholar author ID'),
  orcid: z.string().nullable().describe('ORCID if linked'),
  dblp: z.string().nullable().describe('DBLP author ID'),
});

/**
 * Author match schema.
 */
const authorMatchSchema = z.object({
  displayName: z.string().describe('Author display name'),
  institution: z.string().nullable().describe('Current institution hint'),
  worksCount: z.number().describe('Number of works'),
  citedByCount: z.number().describe('Citation count'),
  ids: externalIdsSchema.describe('External authority IDs'),
});

export type AuthorMatch = z.infer<typeof authorMatchSchema>;

/**
 * Response schema.
 */
const discoverAuthorIdsResponseSchema = z.object({
  searchedName: z.string().describe('Name that was searched'),
  matches: z.array(authorMatchSchema),
});

export type DiscoverAuthorIdsResponse = z.infer<typeof discoverAuthorIdsResponseSchema>;

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
    throw new Error(`OpenAlex API returned ${response.status}`);
  }

  const data = (await response.json()) as OpenAlexAutocompleteResponse;
  const results = data.results ?? [];

  return results.slice(0, limit).map((result) => ({
    displayName: result.display_name,
    institution: result.hint,
    worksCount: result.works_count,
    citedByCount: result.cited_by_count,
    ids: {
      openalex: result.id.replace('https://openalex.org/', ''),
      semanticScholar: null,
      orcid: result.external_ids?.orcid ?? null,
      dblp: null,
    },
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
    throw new Error(`Semantic Scholar API returned ${response.status}`);
  }

  const data = (await response.json()) as S2AuthorSearchResponse;
  const results = data.data ?? [];

  return results.map((result) => ({
    displayName: result.name,
    institution: result.affiliations?.[0] ?? null,
    worksCount: result.paperCount,
    citedByCount: result.citationCount,
    ids: {
      openalex: null,
      semanticScholar: result.authorId,
      orcid: result.externalIds?.ORCID ?? null,
      dblp: result.externalIds?.DBLP?.[0] ?? null,
    },
  }));
}

/**
 * Handler for pub.chive.actor.discoverAuthorIds.
 *
 * @param c - Hono context
 * @param params - Discovery parameters
 * @returns Potential author matches with external IDs
 */
export async function discoverAuthorIdsHandler(
  c: Context<ChiveEnv>,
  params: DiscoverAuthorIdsParams
): Promise<DiscoverAuthorIdsResponse> {
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
    throw new AuthenticationError('Name parameter required');
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
    searchedName: searchName,
    matches: matches.slice(0, limit),
  };
}

/**
 * XRPC endpoint definition for pub.chive.actor.discoverAuthorIds.
 *
 * @public
 */
export const discoverAuthorIdsEndpoint: XRPCEndpoint<
  DiscoverAuthorIdsParams,
  DiscoverAuthorIdsResponse
> = {
  method: 'pub.chive.actor.discoverAuthorIds' as never,
  type: 'query',
  description: 'Discover potential external author IDs by name search',
  inputSchema: discoverAuthorIdsParamsSchema,
  outputSchema: discoverAuthorIdsResponseSchema,
  handler: discoverAuthorIdsHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
