/**
 * XRPC handler for pub.chive.graph.searchAuthorities.
 *
 * @remarks
 * Searches authority records (persons, organizations, concepts) in the
 * knowledge graph. Supports filtering by type and status.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  searchAuthoritiesParamsSchema,
  authoritySearchResponseSchema,
  type SearchAuthoritiesParams,
  type AuthoritySearchResponse,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.searchAuthorities query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated search parameters
 * @returns Paginated authority records matching search criteria
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.graph.searchAuthorities?q=quantum&type=concept
 *
 * Response:
 * {
 *   "authorities": [...],
 *   "total": 25,
 *   "hasMore": true
 * }
 * ```
 *
 * @public
 */
export async function searchAuthoritiesHandler(
  c: Context<ChiveEnv>,
  params: SearchAuthoritiesParams
): Promise<AuthoritySearchResponse> {
  const { graph } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Searching authorities', {
    query: params.q,
    type: params.type,
    status: params.status,
  });

  // Call graph service with search parameters
  const results = await graph.searchAuthorities({
    query: params.q,
    type: params.type,
    status: params.status,
    limit: params.limit ?? 20,
    cursor: params.cursor,
  });

  // Map service response to API response format
  const response: AuthoritySearchResponse = {
    authorities: results.authorities.map((authority) => ({
      id: authority.id,
      uri: authority.uri,
      name: authority.name,
      type: authority.type,
      alternateNames: authority.alternateNames ? [...authority.alternateNames] : undefined,
      description: authority.description,
      externalIds: authority.externalIds?.map((ext) => ({
        source: ext.source,
        id: ext.id,
        url: ext.url,
      })),
      status: authority.status,
      createdAt: authority.createdAt.toISOString(),
      updatedAt: authority.updatedAt?.toISOString(),
    })),
    cursor: results.cursor,
    hasMore: results.hasMore,
    total: results.total,
  };

  logger.info('Authority search completed', {
    query: params.q,
    total: results.total,
    returned: response.authorities.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.searchAuthorities.
 *
 * @public
 */
export const searchAuthoritiesEndpoint: XRPCEndpoint<
  SearchAuthoritiesParams,
  AuthoritySearchResponse
> = {
  method: 'pub.chive.graph.searchAuthorities' as never,
  type: 'query',
  description: 'Search authority records in the knowledge graph',
  inputSchema: searchAuthoritiesParamsSchema,
  outputSchema: authoritySearchResponseSchema,
  handler: searchAuthoritiesHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
