/**
 * Handler for pub.chive.claiming.rejectCoauthor.
 *
 * @remarks
 * Rejects a pending co-author request. Only the PDS owner can reject.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  rejectCoauthorParamsSchema,
  rejectCoauthorResponseSchema,
  type RejectCoauthorParams,
  type RejectCoauthorResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.rejectCoauthor.
 *
 * @param c - Hono context
 * @param params - Parameters
 * @returns Success status
 *
 * @public
 */
export async function rejectCoauthorHandler(
  c: Context<ChiveEnv>,
  params: RejectCoauthorParams
): Promise<RejectCoauthorResponse> {
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
    success: true,
  };
}

/**
 * Endpoint definition for pub.chive.claiming.rejectCoauthor.
 *
 * @public
 */
export const rejectCoauthorEndpoint: XRPCEndpoint<RejectCoauthorParams, RejectCoauthorResponse> = {
  method: 'pub.chive.claiming.rejectCoauthor' as never,
  type: 'procedure',
  description: 'Reject a co-author request on your eprint',
  inputSchema: rejectCoauthorParamsSchema,
  outputSchema: rejectCoauthorResponseSchema,
  handler: rejectCoauthorHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
