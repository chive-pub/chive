/**
 * Handler for pub.chive.claiming.getMyCoauthorRequests.
 *
 * @remarks
 * Gets co-author requests made by the authenticated user (as claimant).
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  getMyCoauthorRequestsParamsSchema,
  getMyCoauthorRequestsResponseSchema,
  type GetMyCoauthorRequestsParams,
  type GetMyCoauthorRequestsResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.getMyCoauthorRequests.
 *
 * @param c - Hono context
 * @param _params - Parameters (unused for now)
 * @returns Co-author requests made by user
 *
 * @public
 */
export async function getMyCoauthorRequestsHandler(
  c: Context<ChiveEnv>,
  _params: GetMyCoauthorRequestsParams
): Promise<GetMyCoauthorRequestsResponse> {
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
 * Endpoint definition for pub.chive.claiming.getMyCoauthorRequests.
 *
 * @public
 */
export const getMyCoauthorRequestsEndpoint: XRPCEndpoint<
  GetMyCoauthorRequestsParams,
  GetMyCoauthorRequestsResponse
> = {
  method: 'pub.chive.claiming.getMyCoauthorRequests' as never,
  type: 'query',
  description: 'Get your co-author requests (as claimant)',
  inputSchema: getMyCoauthorRequestsParamsSchema,
  outputSchema: getMyCoauthorRequestsResponseSchema,
  handler: getMyCoauthorRequestsHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
