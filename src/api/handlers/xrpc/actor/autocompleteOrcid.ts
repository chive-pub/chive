/**
 * Autocomplete ORCID profiles handler.
 *
 * @remarks
 * Provides ORCID profile search for author verification.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Input params schema.
 */
const autocompleteOrcidParamsSchema = z.object({
  query: z.string().min(2).max(200).describe('Search query for author name'),
  limit: z.coerce.number().int().min(1).max(10).optional().describe('Max results (default 8)'),
});

export type AutocompleteOrcidParams = z.infer<typeof autocompleteOrcidParamsSchema>;

/**
 * ORCID suggestion schema.
 */
const orcidSuggestionSchema = z.object({
  orcid: z.string().describe('ORCID iD (e.g., 0000-0001-2345-6789)'),
  givenNames: z.string().nullable().describe('Given names'),
  familyName: z.string().nullable().describe('Family name'),
  affiliation: z.string().nullable().describe('Current affiliation'),
});

export type OrcidSuggestion = z.infer<typeof orcidSuggestionSchema>;

/**
 * Response schema.
 */
const autocompleteOrcidResponseSchema = z.object({
  suggestions: z.array(orcidSuggestionSchema),
});

export type AutocompleteOrcidResponse = z.infer<typeof autocompleteOrcidResponseSchema>;

/**
 * ORCID search API response type.
 */
interface OrcidSearchResponse {
  'expanded-result'?: {
    'orcid-id': string;
    'given-names': string | null;
    'family-names': string | null;
    'current-institution-affiliation-name'?: string;
    'institution-name'?: string[];
  }[];
}

/**
 * Handler for pub.chive.actor.autocompleteOrcid.
 *
 * @param c - Hono context
 * @param params - Autocomplete parameters
 * @returns ORCID profile suggestions
 */
export async function autocompleteOrcidHandler(
  c: Context<ChiveEnv>,
  params: AutocompleteOrcidParams
): Promise<AutocompleteOrcidResponse> {
  const logger = c.get('logger');

  logger.debug('ORCID autocomplete request', {
    query: params.query,
    limit: params.limit,
  });

  const limit = params.limit ?? 8;

  try {
    // Make direct API call to ORCID
    const url = new URL('https://pub.orcid.org/v3.0/expanded-search/');
    url.searchParams.set('q', params.query);
    url.searchParams.set('rows', String(limit));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn('ORCID API request failed', { status: response.status });
      return { suggestions: [] };
    }

    const data = (await response.json()) as OrcidSearchResponse;
    const results = data['expanded-result'] ?? [];

    // Slice results to limit in case API returns more than requested
    const suggestions: OrcidSuggestion[] = results.slice(0, limit).map((result) => ({
      orcid: result['orcid-id'],
      givenNames: result['given-names'] ?? null,
      familyName: result['family-names'] ?? null,
      affiliation:
        result['current-institution-affiliation-name'] ?? result['institution-name']?.[0] ?? null,
    }));

    logger.debug('ORCID autocomplete completed', {
      query: params.query,
      suggestionCount: suggestions.length,
    });

    return { suggestions };
  } catch (err) {
    logger.warn('ORCID autocomplete error', {
      query: params.query,
      error: err instanceof Error ? err.message : String(err),
    });
    return { suggestions: [] };
  }
}

/**
 * XRPC endpoint definition for pub.chive.actor.autocompleteOrcid.
 *
 * @public
 */
export const autocompleteOrcidEndpoint: XRPCEndpoint<
  AutocompleteOrcidParams,
  AutocompleteOrcidResponse
> = {
  method: 'pub.chive.actor.autocompleteOrcid' as never,
  type: 'query',
  description: 'Search for ORCID profiles by author name',
  inputSchema: autocompleteOrcidParamsSchema,
  outputSchema: autocompleteOrcidResponseSchema,
  handler: autocompleteOrcidHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
