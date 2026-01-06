/**
 * Autocomplete affiliations via ROR handler.
 *
 * @remarks
 * Provides institutional affiliation autocomplete using the
 * Research Organization Registry (ROR) API.
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
const autocompleteAffiliationParamsSchema = z.object({
  query: z.string().min(2).max(200).describe('Search query for affiliation name'),
  limit: z.coerce.number().int().min(1).max(15).optional().describe('Max results (default 8)'),
});

export type AutocompleteAffiliationParams = z.infer<typeof autocompleteAffiliationParamsSchema>;

/**
 * Affiliation suggestion schema.
 */
const affiliationSuggestionSchema = z.object({
  rorId: z.string().describe('ROR ID (e.g., https://ror.org/02mhbdp94)'),
  name: z.string().describe('Organization name'),
  country: z.string().describe('Country name'),
  types: z.array(z.string()).describe('Organization types (Education, Healthcare, etc.)'),
  acronym: z.string().nullable().describe('Acronym if available'),
});

export type AffiliationSuggestion = z.infer<typeof affiliationSuggestionSchema>;

/**
 * Response schema.
 */
const autocompleteAffiliationResponseSchema = z.object({
  suggestions: z.array(affiliationSuggestionSchema),
});

export type AutocompleteAffiliationResponse = z.infer<typeof autocompleteAffiliationResponseSchema>;

/**
 * ROR API v2 response type.
 */
interface RorApiResponse {
  items: {
    id: string;
    names: {
      value: string;
      types: string[];
      lang: string | null;
    }[];
    locations: {
      geonames_details: {
        country_name: string;
        country_code: string;
      };
    }[];
    types: string[];
  }[];
}

/**
 * Handler for pub.chive.actor.autocompleteAffiliation.
 *
 * @param c - Hono context
 * @param params - Autocomplete parameters
 * @returns Affiliation suggestions from ROR
 */
export async function autocompleteAffiliationHandler(
  c: Context<ChiveEnv>,
  params: AutocompleteAffiliationParams
): Promise<AutocompleteAffiliationResponse> {
  const logger = c.get('logger');

  logger.debug('Affiliation autocomplete request', {
    query: params.query,
    limit: params.limit,
  });

  const limit = params.limit ?? 8;

  try {
    // Make direct API call to ROR
    const url = new URL('https://api.ror.org/v2/organizations');
    url.searchParams.set('query', params.query);

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn('ROR API request failed', { status: response.status });
      return { suggestions: [] };
    }

    const data = (await response.json()) as RorApiResponse;

    // Defensive check for missing items array
    if (!data.items || !Array.isArray(data.items)) {
      logger.warn('ROR API returned unexpected response structure', {
        hasItems: !!data.items,
        query: params.query,
      });
      return { suggestions: [] };
    }

    const suggestions: AffiliationSuggestion[] = data.items.slice(0, limit).map((org) => {
      // Get display name (ror_display type) or first name
      const displayName =
        org.names.find((n) => n.types.includes('ror_display'))?.value ??
        org.names[0]?.value ??
        'Unknown';

      // Get acronym if available
      const acronym = org.names.find((n) => n.types.includes('acronym'))?.value ?? null;

      // Get country from first location
      const country = org.locations?.[0]?.geonames_details?.country_name ?? 'Unknown';

      return {
        rorId: org.id,
        name: displayName,
        country,
        types: org.types ?? [],
        acronym,
      };
    });

    logger.debug('Affiliation autocomplete completed', {
      query: params.query,
      suggestionCount: suggestions.length,
    });

    return { suggestions };
  } catch (err) {
    logger.warn('Affiliation autocomplete error', {
      query: params.query,
      error: err instanceof Error ? err.message : String(err),
    });
    return { suggestions: [] };
  }
}

/**
 * XRPC endpoint definition for pub.chive.actor.autocompleteAffiliation.
 *
 * @public
 */
export const autocompleteAffiliationEndpoint: XRPCEndpoint<
  AutocompleteAffiliationParams,
  AutocompleteAffiliationResponse
> = {
  method: 'pub.chive.actor.autocompleteAffiliation' as never,
  type: 'query',
  description: 'Search for institutional affiliations via ROR',
  inputSchema: autocompleteAffiliationParamsSchema,
  outputSchema: autocompleteAffiliationResponseSchema,
  handler: autocompleteAffiliationHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
