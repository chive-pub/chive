/**
 * Handler for pub.chive.claiming.getCoauthorRequests.
 *
 * @remarks
 * Gets pending co-author requests for the authenticated user's eprints.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  getCoauthorRequestsParamsSchema,
  getCoauthorRequestsResponseSchema,
  type GetCoauthorRequestsParams,
  type GetCoauthorRequestsResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.getCoauthorRequests.
 *
 * @param c - Hono context
 * @param _params - Parameters (unused for now)
 * @returns Pending co-author requests
 *
 * @public
 */
export async function getCoauthorRequestsHandler(
  c: Context<ChiveEnv>,
  _params: GetCoauthorRequestsParams
): Promise<GetCoauthorRequestsResponse> {
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
  };
}

/**
 * Endpoint definition for pub.chive.claiming.getCoauthorRequests.
 *
 * @public
 */
export const getCoauthorRequestsEndpoint: XRPCEndpoint<
  GetCoauthorRequestsParams,
  GetCoauthorRequestsResponse
> = {
  method: 'pub.chive.claiming.getCoauthorRequests' as never,
  type: 'query',
  description: 'Get pending co-author requests on your eprints',
  inputSchema: getCoauthorRequestsParamsSchema,
  outputSchema: getCoauthorRequestsResponseSchema,
  handler: getCoauthorRequestsHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
