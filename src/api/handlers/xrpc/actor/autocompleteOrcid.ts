/**
 * Autocomplete ORCID profiles handler.
 *
 * @remarks
 * Provides ORCID profile search for author verification.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  OrcidSuggestion,
} from '../../../../lexicons/generated/types/pub/chive/actor/autocompleteOrcid.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

// Use generated types from lexicons

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
 * XRPC method for pub.chive.actor.autocompleteOrcid.
 *
 * @public
 */
export const autocompleteOrcid: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
        return { encoding: 'application/json', body: { suggestions: [] } };
      }

      const data = (await response.json()) as OrcidSearchResponse;
      const results = data['expanded-result'] ?? [];

      // Slice results to limit in case API returns more than requested
      const suggestions: OrcidSuggestion[] = results.slice(0, limit).map((result) => ({
        orcid: result['orcid-id'],
        givenNames: result['given-names'] ?? undefined,
        familyName: result['family-names'] ?? undefined,
        affiliation:
          result['current-institution-affiliation-name'] ??
          result['institution-name']?.[0] ??
          undefined,
      }));

      logger.debug('ORCID autocomplete completed', {
        query: params.query,
        suggestionCount: suggestions.length,
      });

      return { encoding: 'application/json', body: { suggestions } };
    } catch (err) {
      logger.warn('ORCID autocomplete error', {
        query: params.query,
        error: err instanceof Error ? err.message : String(err),
      });
      return { encoding: 'application/json', body: { suggestions: [] } };
    }
  },
};
