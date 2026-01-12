/**
 * XRPC handler for pub.chive.contribution.listTypes.
 *
 * @remarks
 * Lists CRediT-based contribution types with optional filtering.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  listContributionTypesParamsSchema,
  listContributionTypesResponseSchema,
  type ListContributionTypesParams,
  type ListContributionTypesResponse,
} from '../../../schemas/contribution.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.contribution.listTypes query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Paginated list of contribution types
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.contribution.listTypes?status=established&limit=50
 *
 * Response:
 * {
 *   "types": [
 *     { "id": "conceptualization", "label": "Conceptualization", ... }
 *   ],
 *   "total": 14,
 *   "hasMore": false
 * }
 * ```
 *
 * @public
 */
export async function listContributionTypesHandler(
  c: Context<ChiveEnv>,
  params: ListContributionTypesParams
): Promise<ListContributionTypesResponse> {
  const { contributionTypeManager } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Listing contribution types', {
    status: params.status,
    search: params.search,
    limit: params.limit,
    cursor: params.cursor,
  });

  // If search is provided, use search method
  if (params.search) {
    const searchResult = await contributionTypeManager.searchContributionTypes(
      params.search,
      params.limit
    );

    return {
      types: searchResult.types.map((type) => ({
        uri: type.uri,
        id: type.id,
        label: type.label,
        description: type.description,
        status: type.status,
      })),
      total: searchResult.total,
      hasMore: false,
      cursor: undefined,
    };
  }

  // Otherwise list with optional status filter
  const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
  const result = await contributionTypeManager.listContributionTypes({
    status: params.status,
    limit: params.limit,
    offset,
  });

  const hasMore = offset + result.types.length < result.total;
  const nextCursor = hasMore ? String(offset + result.types.length) : undefined;

  const response: ListContributionTypesResponse = {
    types: result.types.map((type) => ({
      uri: type.uri,
      id: type.id,
      label: type.label,
      description: type.description,
      status: type.status,
    })),
    total: result.total,
    hasMore,
    cursor: nextCursor,
  };

  logger.info('Contribution types listed', {
    count: response.types.length,
    total: response.total,
    hasMore: response.hasMore,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.contribution.listTypes.
 *
 * @public
 */
export const listContributionTypesEndpoint: XRPCEndpoint<
  ListContributionTypesParams,
  ListContributionTypesResponse
> = {
  method: 'pub.chive.contribution.listTypes' as never,
  type: 'query',
  description: 'List CRediT-based contribution types',
  inputSchema: listContributionTypesParamsSchema,
  outputSchema: listContributionTypesResponseSchema,
  handler: listContributionTypesHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
