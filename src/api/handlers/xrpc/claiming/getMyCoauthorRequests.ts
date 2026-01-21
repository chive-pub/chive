/**
 * Handler for pub.chive.claiming.getMyCoauthorRequests.
 *
 * @remarks
 * Gets co-author requests made by the authenticated user (as claimant).
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/getMyCoauthorRequests.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.getMyCoauthorRequests.
 *
 * @public
 */
export const getMyCoauthorRequests: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params: _params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { claiming } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    logger.debug('Getting my co-author requests', {
      claimantDid: user.did,
    });

    const requests = await claiming.getCoauthorRequestsByClaimant(user.did);

    return {
      encoding: 'application/json',
      body: {
        requests: requests.map((r) => ({
          id: r.id,
          eprintUri: r.eprintUri,
          eprintOwnerDid: r.eprintOwnerDid,
          claimantDid: r.claimantDid,
          claimantName: r.claimantName,
          authorIndex: r.authorIndex,
          authorName: r.authorName,
          status: r.status,
          message: r.message,
          rejectionReason: r.rejectionReason,
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString(),
        })),
        cursor: undefined,
      },
    };
  },
};
