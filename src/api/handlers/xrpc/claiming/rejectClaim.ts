/**
 * Handler for pub.chive.claiming.rejectClaim.
 *
 * @remarks
 * Rejects a pending claim with a reason. Admin only.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import {
  rejectClaimParamsSchema,
  rejectClaimResponseSchema,
  type RejectClaimParams,
  type RejectClaimResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.rejectClaim.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns Success status
 *
 * @public
 */
export async function rejectClaimHandler(
  c: Context<ChiveEnv>,
  params: RejectClaimParams
): Promise<RejectClaimResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (!user.isAdmin) {
    throw new ValidationError('Admin access required', 'authorization', 'forbidden');
  }

  logger.debug('Rejecting claim', {
    claimId: params.claimId,
    reason: params.reason,
    reviewerDid: user.did,
  });

  await claiming.rejectClaim(params.claimId, params.reason, user.did);

  return {
    success: true,
  };
}

/**
 * Endpoint definition for pub.chive.claiming.rejectClaim.
 *
 * @public
 */
export const rejectClaimEndpoint: XRPCEndpoint<RejectClaimParams, RejectClaimResponse> = {
  method: 'pub.chive.claiming.rejectClaim' as never,
  type: 'procedure',
  description: 'Reject a pending claim with reason (admin only)',
  inputSchema: rejectClaimParamsSchema,
  outputSchema: rejectClaimResponseSchema,
  handler: rejectClaimHandler,
  auth: 'required',
  rateLimit: 'admin',
};
