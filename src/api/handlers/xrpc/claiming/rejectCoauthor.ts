/**
 * Handler for pub.chive.claiming.rejectCoauthor.
 *
 * @remarks
 * Rejects a pending co-author request. Only the PDS owner can reject.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/rejectCoauthor.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.rejectCoauthor.
 *
 * @public
 */
export const rejectCoauthor: XRPCMethod<void, InputSchema, OutputSchema> = {
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

    logger.debug('Rejecting co-author request', {
      requestId: params.requestId,
      ownerDid: user.did,
    });

    await claiming.rejectCoauthorRequest(params.requestId, user.did, params.reason);

    return {
      encoding: 'application/json',
      body: {
        success: true,
      },
    };
  },
};
