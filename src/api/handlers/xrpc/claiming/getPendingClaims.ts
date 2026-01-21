/**
 * Handler for pub.chive.claiming.getPendingClaims.
 *
 * @remarks
 * Gets pending claims for admin review. Admin only.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/getPendingClaims.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.getPendingClaims.
 *
 * @public
 */
export const getPendingClaims: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
      encoding: 'application/json',
      body: {
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
      },
    };
  },
};
