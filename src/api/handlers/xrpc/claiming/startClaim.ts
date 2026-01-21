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

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/startClaim.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.startClaim.
 *
 * @public
 */
export const startClaim: XRPCMethod<void, InputSchema, OutputSchema> = {
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

    logger.debug('Starting claim', {
      importId: params.importId,
      claimantDid: user.did,
    });

    const claimRequest = await claiming.startClaim(params.importId, user.did);

    return {
      encoding: 'application/json',
      body: {
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
      },
    };
  },
};
