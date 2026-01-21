/**
 * Handler for pub.chive.claiming.getCoauthorRequests.
 *
 * @remarks
 * Gets pending co-author requests for the authenticated user's eprints.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/getCoauthorRequests.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.getCoauthorRequests.
 *
 * @public
 */
export const getCoauthorRequests: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params: _params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { claiming } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    logger.debug('Getting co-author requests for owner', {
      ownerDid: user.did,
    });

    const requests = await claiming.getCoauthorRequestsForOwner(user.did);

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
