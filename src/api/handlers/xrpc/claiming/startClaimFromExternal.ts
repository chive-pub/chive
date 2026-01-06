/**
 * Handler for pub.chive.claiming.startClaimFromExternal.
 *
 * @remarks
 * Starts a claim directly from an external search result.
 * Imports the preprint on-demand if not already imported.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  startClaimFromExternalParamsSchema,
  startClaimFromExternalResponseSchema,
  type StartClaimFromExternalParams,
  type StartClaimFromExternalResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.startClaimFromExternal.
 *
 * @param c - Hono context
 * @param params - Claim parameters
 * @returns Created claim request
 *
 * @remarks
 * Implements "import on demand" - only imports the preprint when
 * a user actually wants to claim it.
 *
 * Flow:
 * 1. Check if preprint already imported
 * 2. If not, fetch from external source and import
 * 3. Create claim request
 *
 * @public
 */
export async function startClaimFromExternalHandler(
  c: Context<ChiveEnv>,
  params: StartClaimFromExternalParams
): Promise<StartClaimFromExternalResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required to claim preprints');
  }

  logger.info('Starting claim from external', {
    source: params.source,
    externalId: params.externalId,
    claimantDid: user.did,
  });

  // Start claim (imports on demand if needed)
  const claim = await claiming.startClaimFromExternal(params.source, params.externalId, user.did);

  logger.info('Claim started from external', {
    claimId: claim.id,
    source: params.source,
    externalId: params.externalId,
    claimantDid: user.did,
  });

  return {
    claim: {
      id: claim.id,
      importId: claim.importId,
      claimantDid: claim.claimantDid,
      evidence: claim.evidence.map((e) => ({
        type: e.type,
        score: e.score,
        details: e.details,
        data: e.data,
      })),
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
 * Endpoint definition for pub.chive.claiming.startClaimFromExternal.
 *
 * @public
 */
export const startClaimFromExternalEndpoint: XRPCEndpoint<
  StartClaimFromExternalParams,
  StartClaimFromExternalResponse
> = {
  method: 'pub.chive.claiming.startClaimFromExternal' as never,
  type: 'procedure',
  description: 'Start a claim from an external search result (imports on demand)',
  inputSchema: startClaimFromExternalParamsSchema,
  outputSchema: startClaimFromExternalResponseSchema,
  handler: startClaimFromExternalHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
