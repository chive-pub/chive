/**
 * Autocomplete OpenReview profiles handler.
 *
 * @remarks
 * Proxies OpenReview profile search API since it doesn't support CORS.
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
const autocompleteOpenReviewParamsSchema = z.object({
  query: z.string().min(2).max(200).describe('Search query for author name'),
  limit: z.coerce.number().int().min(1).max(10).optional().describe('Max results (default 10)'),
});

export type AutocompleteOpenReviewParams = z.infer<typeof autocompleteOpenReviewParamsSchema>;

/**
 * OpenReview profile suggestion schema.
 */
const openReviewSuggestionSchema = z.object({
  id: z.string().describe('OpenReview profile ID (e.g., ~John_Smith1)'),
  displayName: z.string().describe('Display name'),
  institution: z.string().nullable().describe('Current institution'),
});

export type OpenReviewSuggestion = z.infer<typeof openReviewSuggestionSchema>;

/**
 * Response schema.
 */
const autocompleteOpenReviewResponseSchema = z.object({
  suggestions: z.array(openReviewSuggestionSchema),
});

export type AutocompleteOpenReviewResponse = z.infer<typeof autocompleteOpenReviewResponseSchema>;

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
 * Handler for pub.chive.actor.autocompleteOpenReview.
 *
 * @param c - Hono context
 * @param params - Autocomplete parameters
 * @returns OpenReview profile suggestions
 */
export async function autocompleteOpenReviewHandler(
  c: Context<ChiveEnv>,
  params: AutocompleteOpenReviewParams
): Promise<AutocompleteOpenReviewResponse> {
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
      return { suggestions: [] };
    }

    const data = (await response.json()) as OpenReviewProfileResponse;
    const profiles = data.profiles ?? [];

    const suggestions: OpenReviewSuggestion[] = profiles.slice(0, limit).map((profile) => {
      const preferredName =
        profile.content.names.find((n) => n.preferred) ?? profile.content.names[0];
      const institution = profile.content.history?.[0]?.institution?.name ?? null;

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

    return { suggestions };
  } catch (err) {
    logger.warn('OpenReview autocomplete error', {
      query: params.query,
      error: err instanceof Error ? err.message : String(err),
    });
    return { suggestions: [] };
  }
}

/**
 * XRPC endpoint definition for pub.chive.actor.autocompleteOpenReview.
 *
 * @public
 */
export const autocompleteOpenReviewEndpoint: XRPCEndpoint<
  AutocompleteOpenReviewParams,
  AutocompleteOpenReviewResponse
> = {
  method: 'pub.chive.actor.autocompleteOpenReview' as never,
  type: 'query',
  description: 'Search for OpenReview profiles by author name',
  inputSchema: autocompleteOpenReviewParamsSchema,
  outputSchema: autocompleteOpenReviewResponseSchema,
  handler: autocompleteOpenReviewHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
