/**
 * XRPC handler for pub.chive.contribution.searchTypes.
 *
 * @remarks
 * Searches contribution types by label and description.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  searchContributionTypesParamsSchema,
  searchContributionTypesResponseSchema,
  type SearchContributionTypesParams,
  type SearchContributionTypesResponse,
} from '../../../schemas/contribution.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.contribution.searchTypes query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Matching contribution types
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.contribution.searchTypes?q=writing&limit=10
 *
 * Response:
 * {
 *   "types": [
 *     { "id": "writing-original-draft", "label": "Writing - Original Draft", ... },
 *     { "id": "writing-review-editing", "label": "Writing - Review & Editing", ... }
 *   ],
 *   "total": 2
 * }
 * ```
 *
 * @public
 */
export async function searchContributionTypesHandler(
  c: Context<ChiveEnv>,
  params: SearchContributionTypesParams
): Promise<SearchContributionTypesResponse> {
  const { contributionTypeManager } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Searching contribution types', {
    query: params.q,
    limit: params.limit,
  });

  const result = await contributionTypeManager.searchContributionTypes(params.q, params.limit);

  const response: SearchContributionTypesResponse = {
    types: result.types.map((type) => ({
      uri: type.uri,
      id: type.id,
      label: type.label,
      description: type.description,
      status: type.status,
    })),
    total: result.total,
  };

  logger.info('Contribution types search complete', {
    query: params.q,
    count: response.types.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.contribution.searchTypes.
 *
 * @public
 */
export const searchContributionTypesEndpoint: XRPCEndpoint<
  SearchContributionTypesParams,
  SearchContributionTypesResponse
> = {
  method: 'pub.chive.contribution.searchTypes' as never,
  type: 'query',
  description: 'Search contribution types by label or description',
  inputSchema: searchContributionTypesParamsSchema,
  outputSchema: searchContributionTypesResponseSchema,
  handler: searchContributionTypesHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
