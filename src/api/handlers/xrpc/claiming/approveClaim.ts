/**
 * Handler for pub.chive.claiming.approveClaim.
 *
 * @remarks
 * Approves a pending claim. Admin only.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import {
  approveClaimParamsSchema,
  approveClaimResponseSchema,
  type ApproveClaimParams,
  type ApproveClaimResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.approveClaim.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns Success status
 *
 * @public
 */
export async function approveClaimHandler(
  c: Context<ChiveEnv>,
  params: ApproveClaimParams
): Promise<ApproveClaimResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (!user.isAdmin) {
    throw new ValidationError('Admin access required', 'authorization', 'forbidden');
  }

  logger.debug('Approving claim', {
    claimId: params.claimId,
    reviewerDid: user.did,
  });

  await claiming.approveClaim(params.claimId, user.did);

  return {
    success: true,
  };
}

/**
 * Endpoint definition for pub.chive.claiming.approveClaim.
 *
 * @public
 */
export const approveClaimEndpoint: XRPCEndpoint<ApproveClaimParams, ApproveClaimResponse> = {
  method: 'pub.chive.claiming.approveClaim' as never,
  type: 'procedure',
  description: 'Approve a pending claim (admin only)',
  inputSchema: approveClaimParamsSchema,
  outputSchema: approveClaimResponseSchema,
  handler: approveClaimHandler,
  auth: 'required',
  rateLimit: 'admin',
};
