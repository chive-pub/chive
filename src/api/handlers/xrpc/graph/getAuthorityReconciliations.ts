/**
 * Handler for pub.chive.graph.getAuthorityReconciliations.
 *
 * @remarks
 * Returns reconciliation records for an authority, showing mappings
 * to external systems like arXiv, ORCID, Wikidata, etc.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getAuthorityReconciliationsParamsSchema,
  authorityReconciliationsResponseSchema,
  type GetAuthorityReconciliationsParams,
  type AuthorityReconciliationsResponse,
  type ReconciliationRecord,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.getAuthorityReconciliations.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Authority reconciliation records
 *
 * @throws {NotFoundError} When authority record is not found
 */
export async function getAuthorityReconciliationsHandler(
  c: Context<ChiveEnv>,
  params: GetAuthorityReconciliationsParams
): Promise<AuthorityReconciliationsResponse> {
  const logger = c.get('logger');
  const { graph } = c.get('services');

  logger.debug('Getting authority reconciliations', { authorityId: params.authorityId });

  // Verify authority exists by searching for it
  const searchResult = await graph.searchAuthorities({
    query: params.authorityId,
    limit: 10,
  });

  const authority = searchResult.authorities.find((a) => a.id === params.authorityId);
  if (!authority) {
    throw new NotFoundError('Authority', params.authorityId);
  }

  // Build reconciliation records from the authority's external IDs
  // Until a proper reconciliation service is implemented, we derive these
  // from the external IDs on the authority record
  const reconciliations: ReconciliationRecord[] = (authority.externalIds ?? []).map(
    (ext, index) => ({
      id: `${params.authorityId}:${ext.source}:${index}`,
      authorityId: params.authorityId,
      externalSource: ext.source,
      externalId: ext.id,
      externalUrl: ext.url,
      status: 'approved' as const,
      createdAt:
        authority.createdAt instanceof Date
          ? authority.createdAt.toISOString()
          : String(authority.createdAt),
    })
  );

  return {
    reconciliations,
    hasMore: false,
    total: reconciliations.length,
  };
}

/**
 * Endpoint definition for pub.chive.graph.getAuthorityReconciliations.
 *
 * @public
 */
export const getAuthorityReconciliationsEndpoint: XRPCEndpoint<
  GetAuthorityReconciliationsParams,
  AuthorityReconciliationsResponse
> = {
  method: 'pub.chive.graph.getAuthorityReconciliations' as never,
  type: 'query',
  description: 'Get reconciliation records for an authority',
  inputSchema: getAuthorityReconciliationsParamsSchema,
  outputSchema: authorityReconciliationsResponseSchema,
  handler: getAuthorityReconciliationsHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
