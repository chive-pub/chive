/**
 * Handler for pub.chive.claiming.approveClaim.
 *
 * @remarks
 * Approves a pending claim. Admin only.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/approveClaim.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.approveClaim.
 *
 * @public
 */
export const approveClaim: XRPCMethod<QueryParams, void, OutputSchema> = {
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

    logger.debug('Approving claim', {
      claimId: params.claimId,
      reviewerDid: user.did,
    });

    await claiming.approveClaim(params.claimId, user.did);

    return {
      encoding: 'application/json',
      body: {
        success: true,
      },
    };
  },
};
