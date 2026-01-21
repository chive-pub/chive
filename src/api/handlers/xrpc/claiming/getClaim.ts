/**
 * Handler for pub.chive.claiming.getClaim.
 *
 * @remarks
 * Gets a claim request by ID. Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/getClaim.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.getClaim.
 *
 * @public
 */
export const getClaim: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
      return {
        encoding: 'application/json',
        body: {},
      };
    }

    if (!claim) {
      return {
        encoding: 'application/json',
        body: {},
      };
    }

    return {
      encoding: 'application/json',
      body: {
        claim: {
          $type: 'pub.chive.claiming.getClaim#claimRequest',
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
        },
      },
    };
  },
};
