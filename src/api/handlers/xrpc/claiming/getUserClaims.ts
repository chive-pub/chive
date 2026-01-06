/**
 * Handler for pub.chive.claiming.getUserClaims.
 *
 * @remarks
 * Gets claims for the authenticated user.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  getUserClaimsParamsSchema,
  getUserClaimsResponseSchema,
  type GetUserClaimsParams,
  type GetUserClaimsResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.getUserClaims.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns User's claims
 *
 * @public
 */
export async function getUserClaimsHandler(
  c: Context<ChiveEnv>,
  params: GetUserClaimsParams
): Promise<GetUserClaimsResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.debug('Getting user claims', {
    claimantDid: user.did,
    status: params.status,
  });

  const allClaims = await claiming.getUserClaims(user.did);

  // Filter by status if provided
  let filteredClaims = allClaims;
  if (params.status) {
    filteredClaims = allClaims.filter((c) => c.status === params.status);
  }

  // Apply pagination
  const limit = params.limit ?? 50;
  const startIndex = params.cursor ? parseInt(params.cursor, 10) : 0;
  const endIndex = startIndex + limit;
  const paginatedClaims = filteredClaims.slice(startIndex, endIndex + 1);
  const hasMore = paginatedClaims.length > limit;
  const resultClaims = hasMore ? paginatedClaims.slice(0, limit) : paginatedClaims;

  return {
    claims: resultClaims.map((claim) => ({
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
    })),
    cursor: hasMore ? (startIndex + limit).toString() : undefined,
    hasMore,
  };
}

/**
 * Endpoint definition for pub.chive.claiming.getUserClaims.
 *
 * @public
 */
export const getUserClaimsEndpoint: XRPCEndpoint<GetUserClaimsParams, GetUserClaimsResponse> = {
  method: 'pub.chive.claiming.getUserClaims' as never,
  type: 'query',
  description: "Get authenticated user's claims",
  inputSchema: getUserClaimsParamsSchema,
  outputSchema: getUserClaimsResponseSchema,
  handler: getUserClaimsHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
