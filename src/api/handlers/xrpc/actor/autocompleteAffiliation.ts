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

import type {
  QueryParams,
  OutputSchema,
  AffiliationSuggestion,
} from '../../../../lexicons/generated/types/pub/chive/actor/autocompleteAffiliation.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

// Use generated types from lexicons

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
 * XRPC method for pub.chive.actor.autocompleteAffiliation.
 *
 * @public
 */
export const autocompleteAffiliation: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
        return { encoding: 'application/json', body: { suggestions: [] } };
      }

      const data = (await response.json()) as RorApiResponse;

      // Defensive check for missing items array
      if (!data.items || !Array.isArray(data.items)) {
        logger.warn('ROR API returned unexpected response structure', {
          hasItems: !!data.items,
          query: params.query,
        });
        return { encoding: 'application/json', body: { suggestions: [] } };
      }

      const suggestions: AffiliationSuggestion[] = data.items.slice(0, limit).map((org) => {
        // Get display name (ror_display type) or first name
        const displayName =
          org.names.find((n) => n.types.includes('ror_display'))?.value ??
          org.names[0]?.value ??
          'Unknown';

        // Get acronym if available
        const acronym = org.names.find((n) => n.types.includes('acronym'))?.value ?? undefined;

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

      return { encoding: 'application/json', body: { suggestions } };
    } catch (err) {
      logger.warn('Affiliation autocomplete error', {
        query: params.query,
        error: err instanceof Error ? err.message : String(err),
      });
      return { encoding: 'application/json', body: { suggestions: [] } };
    }
  },
};
