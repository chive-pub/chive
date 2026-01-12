/**
 * XRPC handler for pub.chive.contribution.getType.
 *
 * @remarks
 * Gets a single contribution type by ID with full metadata.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getContributionTypeParamsSchema,
  contributionTypeSchema,
  type GetContributionTypeParams,
  type ContributionTypeResponse,
} from '../../../schemas/contribution.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.contribution.getType query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Contribution type with full metadata
 * @throws NotFoundError if type not found
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.contribution.getType?id=conceptualization
 *
 * Response:
 * {
 *   "uri": "at://did:plc:governance/pub.chive.contribution.type/conceptualization",
 *   "id": "conceptualization",
 *   "label": "Conceptualization",
 *   "description": "Ideas; formulation or evolution of overarching research goals and aims.",
 *   "externalMappings": [...],
 *   "status": "established",
 *   "createdAt": "2025-01-08T00:00:00Z"
 * }
 * ```
 *
 * @public
 */
export async function getContributionTypeHandler(
  c: Context<ChiveEnv>,
  params: GetContributionTypeParams
): Promise<ContributionTypeResponse> {
  const { contributionTypeManager } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Getting contribution type', { id: params.id });

  const type = await contributionTypeManager.getContributionType(params.id);

  if (!type) {
    throw new NotFoundError('ContributionType', params.id);
  }

  const response: ContributionTypeResponse = {
    uri: type.uri,
    id: type.id,
    label: type.label,
    description: type.description,
    externalMappings: type.externalMappings.map((mapping) => ({
      system: mapping.system,
      identifier: mapping.identifier,
      uri: mapping.uri,
      matchType: mapping.matchType,
    })),
    status: type.status,
    proposalUri: type.proposalUri,
    deprecatedBy: type.deprecatedBy,
    createdAt: new Date(type.createdAt).toISOString(),
    updatedAt: type.updatedAt ? new Date(type.updatedAt).toISOString() : undefined,
  };

  logger.info('Contribution type retrieved', { id: params.id });

  return response;
}

/**
 * Endpoint definition for pub.chive.contribution.getType.
 *
 * @public
 */
export const getContributionTypeEndpoint: XRPCEndpoint<
  GetContributionTypeParams,
  ContributionTypeResponse
> = {
  method: 'pub.chive.contribution.getType' as never,
  type: 'query',
  description: 'Get a contribution type by ID',
  inputSchema: getContributionTypeParamsSchema,
  outputSchema: contributionTypeSchema,
  handler: getContributionTypeHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
