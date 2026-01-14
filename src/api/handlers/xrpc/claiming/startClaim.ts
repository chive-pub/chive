/**
 * Handler for pub.chive.claiming.startClaim.
 *
 * @remarks
 * Initiates a claim request for an imported eprint.
 * Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  startClaimParamsSchema,
  startClaimResponseSchema,
  type StartClaimParams,
  type StartClaimResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.startClaim.
 *
 * @param c - Hono context
 * @param params - Claim parameters
 * @returns Created claim request
 *
 * @public
 */
export async function startClaimHandler(
  c: Context<ChiveEnv>,
  params: StartClaimParams
): Promise<StartClaimResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.debug('Starting claim', {
    importId: params.importId,
    claimantDid: user.did,
  });

  const claimRequest = await claiming.startClaim(params.importId, user.did);

  return {
    claim: {
      id: claimRequest.id,
      importId: claimRequest.importId,
      claimantDid: claimRequest.claimantDid,
      status: claimRequest.status,
      canonicalUri: claimRequest.canonicalUri,
      rejectionReason: claimRequest.rejectionReason,
      reviewedBy: claimRequest.reviewedBy,
      reviewedAt: claimRequest.reviewedAt?.toISOString(),
      createdAt: claimRequest.createdAt.toISOString(),
      expiresAt: claimRequest.expiresAt?.toISOString(),
    },
  };
}

/**
 * Endpoint definition for pub.chive.claiming.startClaim.
 *
 * @public
 */
export const startClaimEndpoint: XRPCEndpoint<StartClaimParams, StartClaimResponse> = {
  method: 'pub.chive.claiming.startClaim' as never,
  type: 'procedure',
  description: 'Start a claim request for an imported eprint',
  inputSchema: startClaimParamsSchema,
  outputSchema: startClaimResponseSchema,
  handler: startClaimHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
