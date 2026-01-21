/**
 * Autocomplete OpenReview profiles handler.
 *
 * @remarks
 * Proxies OpenReview profile search API since it doesn't support CORS.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  OpenReviewSuggestion,
} from '../../../../lexicons/generated/types/pub/chive/actor/autocompleteOpenReview.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

// Use generated types from lexicons

/**
 * OpenReview API response type.
 */
interface OpenReviewProfileResponse {
  profiles: {
    id: string;
    content: {
      names: { fullname: string; preferred?: boolean }[];
      history?: {
        position?: string;
        institution?: { name: string };
      }[];
    };
  }[];
}

/**
 * XRPC method for pub.chive.actor.autocompleteOpenReview.
 *
 * @public
 */
export const autocompleteOpenReview: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');

    logger.debug('OpenReview autocomplete request', {
      query: params.query,
      limit: params.limit,
    });

    const limit = params.limit ?? 10;

    try {
      const url = `https://api.openreview.net/profiles/search?term=${encodeURIComponent(params.query)}&limit=${limit}`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        logger.warn('OpenReview API request failed', { status: response.status });
        return { encoding: 'application/json', body: { suggestions: [] } };
      }

      const data = (await response.json()) as OpenReviewProfileResponse;
      const profiles = data.profiles ?? [];

      const suggestions: OpenReviewSuggestion[] = profiles.slice(0, limit).map((profile) => {
        const preferredName =
          profile.content.names.find((n) => n.preferred) ?? profile.content.names[0];
        const institution = profile.content.history?.[0]?.institution?.name ?? undefined;

        return {
          id: profile.id,
          displayName: preferredName?.fullname ?? profile.id,
          institution,
        };
      });

      logger.debug('OpenReview autocomplete completed', {
        query: params.query,
        suggestionCount: suggestions.length,
      });

      return { encoding: 'application/json', body: { suggestions } };
    } catch (err) {
      logger.warn('OpenReview autocomplete error', {
        query: params.query,
        error: err instanceof Error ? err.message : String(err),
      });
      return { encoding: 'application/json', body: { suggestions: [] } };
    }
  },
};
