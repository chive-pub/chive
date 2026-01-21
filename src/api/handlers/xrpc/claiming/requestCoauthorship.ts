/**
 * Handler for pub.chive.claiming.requestCoauthorship.
 *
 * @remarks
 * Requests co-authorship on an existing eprint in another user's PDS.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/requestCoauthorship.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.requestCoauthorship.
 *
 * @public
 */
export const requestCoauthorship: XRPCMethod<void, InputSchema, OutputSchema> = {
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

    logger.debug('Requesting co-authorship', {
      eprintUri: params.eprintUri,
      claimantDid: user.did,
    });

    const request = await claiming.requestCoauthorship(
      params.eprintUri,
      params.eprintOwnerDid,
      user.did,
      params.claimantName,
      params.authorIndex,
      params.authorName,
      params.message
    );

    return {
      encoding: 'application/json',
      body: {
        request: {
          id: request.id,
          eprintUri: request.eprintUri,
          eprintOwnerDid: request.eprintOwnerDid,
          claimantDid: request.claimantDid,
          claimantName: request.claimantName,
          authorIndex: request.authorIndex,
          authorName: request.authorName,
          status: request.status,
          message: request.message,
          rejectionReason: request.rejectionReason,
          createdAt: request.createdAt.toISOString(),
          reviewedAt: request.reviewedAt?.toISOString(),
        },
      },
    };
  },
};
