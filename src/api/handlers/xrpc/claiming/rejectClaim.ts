/**
 * Handler for pub.chive.claiming.rejectClaim.
 *
 * @remarks
 * Rejects a pending claim with a reason. Admin only.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/rejectClaim.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.rejectClaim.
 *
 * @public
 */
export const rejectClaim: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    if (!input) {
      throw new ValidationError('Input is required', 'input');
    }
    const params = input;
    const logger = c.get('logger');
    const user = c.get('user');
    const { claiming } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!user.isAdmin) {
      throw new ValidationError('Admin access required', 'authorization', 'forbidden');
    }

    logger.debug('Rejecting claim', {
      claimId: params.claimId,
      reason: params.reason,
      reviewerDid: user.did,
    });

    await claiming.rejectClaim(params.claimId, params.reason, user.did);

    return {
      encoding: 'application/json',
      body: {
        success: true,
      },
    };
  },
};
