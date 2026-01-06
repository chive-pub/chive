/**
 * Handler for pub.chive.graph.getAuthority.
 *
 * @remarks
 * Returns detailed information about an authority record including
 * linked preprints and reconciliation counts.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getAuthorityParamsSchema,
  authorityDetailSchema,
  type GetAuthorityParams,
  type AuthorityDetail,
} from '../../../schemas/graph.js';
import type { ExternalId } from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.getAuthority.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Authority record details
 *
 * @throws {NotFoundError} When authority record is not found
 */
export async function getAuthorityHandler(
  c: Context<ChiveEnv>,
  params: GetAuthorityParams
): Promise<AuthorityDetail> {
  const logger = c.get('logger');
  const { graph } = c.get('services');

  logger.debug('Getting authority record', { id: params.id });

  // Search for the authority by ID
  // The searchAuthorities method is the only available way to query authorities
  const searchResult = await graph.searchAuthorities({
    query: params.id,
    limit: 10,
  });

  // Find the exact match by ID
  const authority = searchResult.authorities.find((a) => a.id === params.id);
  if (!authority) {
    throw new NotFoundError('Authority', params.id);
  }

  return {
    id: authority.id,
    uri: authority.uri,
    name: authority.name,
    type: authority.type,
    alternateNames: authority.alternateNames as string[] | undefined,
    description: authority.description,
    externalIds: authority.externalIds?.map(
      (ext): ExternalId => ({
        source: ext.source,
        id: ext.id,
        url: ext.url,
      })
    ),
    status: authority.status,
    createdAt:
      authority.createdAt instanceof Date
        ? authority.createdAt.toISOString()
        : String(authority.createdAt),
    updatedAt:
      authority.updatedAt instanceof Date
        ? authority.updatedAt.toISOString()
        : authority.updatedAt
          ? String(authority.updatedAt)
          : undefined,
    // Counts not available yet (would need service extension)
    linkedPreprints: 0,
    reconciliationCount: 0,
  };
}

/**
 * Endpoint definition for pub.chive.graph.getAuthority.
 *
 * @public
 */
export const getAuthorityEndpoint: XRPCEndpoint<GetAuthorityParams, AuthorityDetail> = {
  method: 'pub.chive.graph.getAuthority' as never,
  type: 'query',
  description: 'Get authority record details',
  inputSchema: getAuthorityParamsSchema,
  outputSchema: authorityDetailSchema,
  handler: getAuthorityHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
