/**
 * Handler for pub.chive.claiming.completeClaim.
 *
 * @remarks
 * Completes a claim after the user creates their canonical record in their PDS.
 * Requires authentication and claimant ownership.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import {
  completeClaimParamsSchema,
  completeClaimResponseSchema,
  type CompleteClaimParams,
  type CompleteClaimResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.completeClaim.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns Success status
 *
 * @public
 */
export async function completeClaimHandler(
  c: Context<ChiveEnv>,
  params: CompleteClaimParams
): Promise<CompleteClaimResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Verify ownership
  const existingClaim = await claiming.getClaim(params.claimId);
  if (!existingClaim) {
    throw new ValidationError('Claim not found', 'claimId', 'not_found');
  }
  if (existingClaim.claimantDid !== user.did) {
    throw new ValidationError('Not authorized to complete this claim', 'claimId', 'unauthorized');
  }

  logger.debug('Completing claim', {
    claimId: params.claimId,
    canonicalUri: params.canonicalUri,
    claimantDid: user.did,
  });

  await claiming.completeClaim(params.claimId, params.canonicalUri);

  return {
    success: true,
  };
}

/**
 * Endpoint definition for pub.chive.claiming.completeClaim.
 *
 * @public
 */
export const completeClaimEndpoint: XRPCEndpoint<CompleteClaimParams, CompleteClaimResponse> = {
  method: 'pub.chive.claiming.completeClaim' as never,
  type: 'procedure',
  description: 'Complete a claim after user creates canonical record',
  inputSchema: completeClaimParamsSchema,
  outputSchema: completeClaimResponseSchema,
  handler: completeClaimHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
