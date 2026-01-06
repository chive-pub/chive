/**
 * Handler for pub.chive.claiming.autocomplete.
 *
 * @remarks
 * Provides fast autocomplete suggestions for claiming search.
 * Optimized for low latency with short timeouts.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  autocompleteParamsSchema,
  autocompleteResponseSchema,
  type AutocompleteParams,
  type AutocompleteResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Highlights the query portion in a title.
 *
 * @param title - Full title
 * @param query - Query to highlight
 * @returns Title with query portion wrapped in asterisks (markdown bold)
 *
 * @remarks
 * Uses "inverted highlighting" pattern - bolds the untyped portion
 * for faster scanning.
 */
function highlightMatch(title: string, query: string): string {
  const lowerTitle = title.toLowerCase();
  const lowerQuery = query.toLowerCase();

  const index = lowerTitle.indexOf(lowerQuery);
  if (index === -1) {
    return title;
  }

  const before = title.slice(0, index);
  const match = title.slice(index, index + query.length);
  const after = title.slice(index + query.length);

  // Bold the parts that don't match the query (inverted highlighting)
  return `${before ? `**${before}**` : ''}${match}${after ? `**${after}**` : ''}`;
}

/**
 * Handler for pub.chive.claiming.autocomplete.
 *
 * @param c - Hono context
 * @param params - Autocomplete parameters
 * @returns Autocomplete suggestions
 *
 * @remarks
 * Provides fast suggestions while the user types.
 * Limited to 8 suggestions max to prevent choice paralysis.
 *
 * If the user is authenticated, results may be personalized
 * by their research fields (field relevance scoring).
 *
 * @public
 */
export async function autocompleteHandler(
  c: Context<ChiveEnv>,
  params: AutocompleteParams
): Promise<AutocompleteResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming, ranking } = c.get('services');

  logger.debug('Autocomplete request', {
    query: params.query,
    limit: params.limit,
    userDid: user?.did,
  });

  const limit = Math.min(params.limit ?? 8, 10);

  // Get external search results with short timeout
  const results = await claiming.autocompleteExternal(params.query, {
    limit: limit + 2, // Fetch a few extra for ranking
    timeoutMs: 500,
  });

  // Rank results by user's research fields if authenticated
  let rankedResults = results;
  if (user && ranking) {
    try {
      const ranked = await ranking.rank([...results], {
        userDid: user.did,
        query: params.query,
      });
      rankedResults = ranked.map((r) => ({
        ...r.item,
        fieldMatchScore: r.fieldMatchScore,
      }));
    } catch (err) {
      logger.warn('Ranking failed, using unranked results', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Map to response format
  const suggestions = rankedResults.slice(0, limit).map((p) => {
    // Format authors: "Author1, Author2"
    const authorNames = p.authors
      .slice(0, 2)
      .map((a) => a.name)
      .join(', ');

    return {
      title: p.title,
      authors: authorNames + (p.authors.length > 2 ? ' et al.' : ''),
      source: p.source,
      externalId: p.externalId,
      highlightedTitle: highlightMatch(p.title, params.query),
      fieldMatchScore: 'fieldMatchScore' in p ? (p.fieldMatchScore as number) : undefined,
    };
  });

  logger.debug('Autocomplete completed', {
    query: params.query,
    suggestionCount: suggestions.length,
  });

  return {
    suggestions,
  };
}

/**
 * Endpoint definition for pub.chive.claiming.autocomplete.
 *
 * @public
 */
export const autocompleteEndpoint: XRPCEndpoint<AutocompleteParams, AutocompleteResponse> = {
  method: 'pub.chive.claiming.autocomplete' as never,
  type: 'query',
  description: 'Get autocomplete suggestions for claiming search',
  inputSchema: autocompleteParamsSchema,
  outputSchema: autocompleteResponseSchema,
  handler: autocompleteHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
