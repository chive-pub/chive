/**
 * Handler for pub.chive.claiming.approveCoauthor.
 *
 * @remarks
 * Approves a pending co-author request. Only the PDS owner can approve.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  approveCoauthorParamsSchema,
  approveCoauthorResponseSchema,
  type ApproveCoauthorParams,
  type ApproveCoauthorResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.approveCoauthor.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns Success status
 *
 * @public
 */
export async function approveCoauthorHandler(
  c: Context<ChiveEnv>,
  params: ApproveCoauthorParams
): Promise<ApproveCoauthorResponse> {
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
    success: true,
  };
}

/**
 * Endpoint definition for pub.chive.claiming.approveCoauthor.
 *
 * @public
 */
export const approveCoauthorEndpoint: XRPCEndpoint<ApproveCoauthorParams, ApproveCoauthorResponse> =
  {
    method: 'pub.chive.claiming.approveCoauthor' as never,
    type: 'procedure',
    description: 'Approve a co-author request on your eprint',
    inputSchema: approveCoauthorParamsSchema,
    outputSchema: approveCoauthorResponseSchema,
    handler: approveCoauthorHandler,
    auth: 'required',
    rateLimit: 'authenticated',
  };
