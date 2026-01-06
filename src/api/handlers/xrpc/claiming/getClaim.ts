/**
 * Handler for pub.chive.claiming.getClaim.
 *
 * @remarks
 * Gets a claim request by ID. Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  getClaimParamsSchema,
  getClaimResponseSchema,
  type GetClaimParams,
  type GetClaimResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.getClaim.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns Claim request or null
 *
 * @public
 */
export async function getClaimHandler(
  c: Context<ChiveEnv>,
  params: GetClaimParams
): Promise<GetClaimResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.debug('Getting claim', {
    claimId: params.claimId,
  });

  const claim = await claiming.getClaim(params.claimId);

  // Only allow viewing own claims or admin viewing any claim
  if (claim && claim.claimantDid !== user.did && !user.isAdmin) {
    return { claim: null };
  }

  if (!claim) {
    return { claim: null };
  }

  return {
    claim: {
      id: claim.id,
      importId: claim.importId,
      claimantDid: claim.claimantDid,
      evidence: [...claim.evidence],
      verificationScore: claim.verificationScore,
      status: claim.status,
      canonicalUri: claim.canonicalUri,
      rejectionReason: claim.rejectionReason,
      reviewedBy: claim.reviewedBy,
      reviewedAt: claim.reviewedAt?.toISOString(),
      createdAt: claim.createdAt.toISOString(),
      expiresAt: claim.expiresAt?.toISOString(),
    },
  };
}

/**
 * Endpoint definition for pub.chive.claiming.getClaim.
 *
 * @public
 */
export const getClaimEndpoint: XRPCEndpoint<GetClaimParams, GetClaimResponse> = {
  method: 'pub.chive.claiming.getClaim' as never,
  type: 'query',
  description: 'Get a claim request by ID',
  inputSchema: getClaimParamsSchema,
  outputSchema: getClaimResponseSchema,
  handler: getClaimHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
