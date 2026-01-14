/**
 * Handler for pub.chive.claiming.requestCoauthorship.
 *
 * @remarks
 * Requests co-authorship on an existing eprint in another user's PDS.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  requestCoauthorshipParamsSchema,
  requestCoauthorshipResponseSchema,
  type RequestCoauthorshipParams,
  type RequestCoauthorshipResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.requestCoauthorship.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns Created co-author request
 *
 * @public
 */
export async function requestCoauthorshipHandler(
  c: Context<ChiveEnv>,
  params: RequestCoauthorshipParams
): Promise<RequestCoauthorshipResponse> {
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
  };
}

/**
 * Endpoint definition for pub.chive.claiming.requestCoauthorship.
 *
 * @public
 */
export const requestCoauthorshipEndpoint: XRPCEndpoint<
  RequestCoauthorshipParams,
  RequestCoauthorshipResponse
> = {
  method: 'pub.chive.claiming.requestCoauthorship' as never,
  type: 'procedure',
  description: "Request co-authorship on an eprint in another user's PDS",
  inputSchema: requestCoauthorshipParamsSchema,
  outputSchema: requestCoauthorshipResponseSchema,
  handler: requestCoauthorshipHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
