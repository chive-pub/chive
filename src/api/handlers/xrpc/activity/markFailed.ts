/**
 * Handler for pub.chive.activity.markFailed.
 *
 * @remarks
 * Marks a pending activity as failed when PDS write fails.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { NSID } from '../../../../types/atproto.js';
import { AuthenticationError } from '../../../../types/errors.js';
import {
  markFailedParamsSchema,
  markFailedResponseSchema,
  type MarkFailedParams,
  type MarkFailedResponse,
} from '../../../schemas/activity.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.activity.markFailed.
 *
 * @param c - Hono context
 * @param params - Mark failed parameters
 * @returns Success status
 *
 * @public
 */
export async function markFailedHandler(
  c: Context<ChiveEnv>,
  params: MarkFailedParams
): Promise<MarkFailedResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { activity } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.debug('Marking activity as failed', {
    actorDid: user.did,
    collection: params.collection,
    rkey: params.rkey,
    errorCode: params.errorCode,
  });

  const result = await activity.markFailed(
    user.did,
    params.collection as NSID,
    params.rkey,
    params.errorCode,
    params.errorMessage
  );

  if (!result.ok) {
    throw result.error;
  }

  return { success: true };
}

/**
 * Endpoint definition for pub.chive.activity.markFailed.
 *
 * @public
 */
export const markFailedEndpoint: XRPCEndpoint<MarkFailedParams, MarkFailedResponse> = {
  method: 'pub.chive.activity.markFailed' as never,
  type: 'procedure',
  description: 'Mark a pending activity as failed when PDS write fails',
  inputSchema: markFailedParamsSchema,
  outputSchema: markFailedResponseSchema,
  handler: markFailedHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
