/**
 * Handler for pub.chive.claiming.collectEvidence.
 *
 * @remarks
 * Collects evidence from multiple authorities for a claim.
 * Requires authentication and claimant ownership.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import {
  collectEvidenceParamsSchema,
  collectEvidenceResponseSchema,
  type CollectEvidenceParams,
  type CollectEvidenceResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.collectEvidence.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns Updated claim with evidence
 *
 * @public
 */
export async function collectEvidenceHandler(
  c: Context<ChiveEnv>,
  params: CollectEvidenceParams
): Promise<CollectEvidenceResponse> {
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
    throw new ValidationError('Not authorized to modify this claim', 'claimId', 'unauthorized');
  }

  logger.debug('Collecting evidence', {
    claimId: params.claimId,
    claimantDid: user.did,
  });

  const updatedClaim = await claiming.collectEvidence(params.claimId);
  const { decision } = claiming.computeScore(updatedClaim.evidence);

  return {
    claim: {
      id: updatedClaim.id,
      importId: updatedClaim.importId,
      claimantDid: updatedClaim.claimantDid,
      evidence: [...updatedClaim.evidence],
      verificationScore: updatedClaim.verificationScore,
      status: updatedClaim.status,
      canonicalUri: updatedClaim.canonicalUri,
      rejectionReason: updatedClaim.rejectionReason,
      reviewedBy: updatedClaim.reviewedBy,
      reviewedAt: updatedClaim.reviewedAt?.toISOString(),
      createdAt: updatedClaim.createdAt.toISOString(),
      expiresAt: updatedClaim.expiresAt?.toISOString(),
    },
    decision,
  };
}

/**
 * Endpoint definition for pub.chive.claiming.collectEvidence.
 *
 * @public
 */
export const collectEvidenceEndpoint: XRPCEndpoint<CollectEvidenceParams, CollectEvidenceResponse> =
  {
    method: 'pub.chive.claiming.collectEvidence' as never,
    type: 'procedure',
    description: 'Collect evidence from multiple authorities for a claim',
    inputSchema: collectEvidenceParamsSchema,
    outputSchema: collectEvidenceResponseSchema,
    handler: collectEvidenceHandler,
    auth: 'required',
    rateLimit: 'authenticated',
  };
