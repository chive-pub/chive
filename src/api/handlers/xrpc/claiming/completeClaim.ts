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

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/completeClaim.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.completeClaim.
 *
 * @public
 */
export const completeClaim: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
      encoding: 'application/json',
      body: {
        success: true,
      },
    };
  },
};
