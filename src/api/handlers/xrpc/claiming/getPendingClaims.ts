/**
 * Handler for pub.chive.claiming.getPendingClaims.
 *
 * @remarks
 * Gets pending claims for admin review. Admin only.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import {
  getPendingClaimsParamsSchema,
  getPendingClaimsResponseSchema,
  type GetPendingClaimsParams,
  type GetPendingClaimsResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.getPendingClaims.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns Pending claims
 *
 * @public
 */
export async function getPendingClaimsHandler(
  c: Context<ChiveEnv>,
  params: GetPendingClaimsParams
): Promise<GetPendingClaimsResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (!user.isAdmin) {
    throw new ValidationError('Admin access required', 'authorization', 'forbidden');
  }

  logger.debug('Getting pending claims', {
    minScore: params.minScore,
    maxScore: params.maxScore,
    reviewerDid: user.did,
  });

  const result = await claiming.getPendingClaims({
    minScore: params.minScore,
    maxScore: params.maxScore,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

  return {
    claims: result.claims.map((claim) => ({
      id: claim.id,
      importId: claim.importId,
      claimantDid: claim.claimantDid,
      status: claim.status,
      canonicalUri: claim.canonicalUri,
      rejectionReason: claim.rejectionReason,
      reviewedBy: claim.reviewedBy,
      reviewedAt: claim.reviewedAt?.toISOString(),
      createdAt: claim.createdAt.toISOString(),
      expiresAt: claim.expiresAt?.toISOString(),
    })),
    cursor: result.cursor,
    hasMore: result.cursor !== undefined,
  };
}

/**
 * Endpoint definition for pub.chive.claiming.getPendingClaims.
 *
 * @public
 */
export const getPendingClaimsEndpoint: XRPCEndpoint<
  GetPendingClaimsParams,
  GetPendingClaimsResponse
> = {
  method: 'pub.chive.claiming.getPendingClaims' as never,
  type: 'query',
  description: 'Get pending claims for review (admin only)',
  inputSchema: getPendingClaimsParamsSchema,
  outputSchema: getPendingClaimsResponseSchema,
  handler: getPendingClaimsHandler,
  auth: 'required',
  rateLimit: 'admin',
};
