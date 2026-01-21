/**
 * Handler for pub.chive.claiming.approveCoauthor.
 *
 * @remarks
 * Approves a pending co-author request. Only the PDS owner can approve.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/approveCoauthor.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.approveCoauthor.
 *
 * @public
 */
export const approveCoauthor: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { claiming } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    logger.debug('Approving co-author request', {
      requestId: params.requestId,
      ownerDid: user.did,
    });

    await claiming.approveCoauthorRequest(params.requestId, user.did);

    return {
      encoding: 'application/json',
      body: {
        success: true,
      },
    };
  },
};
