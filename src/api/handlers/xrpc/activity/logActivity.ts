/**
 * Handler for pub.chive.activity.log.
 *
 * @remarks
 * Logs a user-initiated write action before performing PDS write.
 * The activity is stored with status='pending' until the firehose
 * event is received and correlated.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri, NSID } from '../../../../types/atproto.js';
import { AuthenticationError } from '../../../../types/errors.js';
import {
  logActivityParamsSchema,
  logActivityResponseSchema,
  type LogActivityParams,
  type LogActivityResponse,
} from '../../../schemas/activity.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.activity.log.
 *
 * @param c - Hono context
 * @param params - Log activity parameters
 * @returns Activity ID
 *
 * @remarks
 * Requires authentication. The actor DID is taken from the authenticated
 * user context and cannot be spoofed.
 *
 * @public
 */
export async function logActivityHandler(
  c: Context<ChiveEnv>,
  params: LogActivityParams
): Promise<LogActivityResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { activity } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required to log activities');
  }

  logger.debug('Logging activity', {
    actorDid: user.did,
    collection: params.collection,
    rkey: params.rkey,
    category: params.category,
  });

  const result = await activity.logActivity({
    actorDid: user.did,
    collection: params.collection as NSID,
    rkey: params.rkey,
    action: params.action,
    category: params.category,
    targetUri: params.targetUri as AtUri | undefined,
    targetTitle: params.targetTitle,
    traceId: params.traceId,
    spanId: params.spanId,
    sessionId: user.sessionId,
    userAgent: c.req.header('user-agent'),
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
    uiContext: params.uiContext,
    recordSnapshot: params.recordSnapshot,
  });

  if (!result.ok) {
    throw result.error;
  }

  logger.debug('Activity logged', {
    activityId: result.value,
    category: params.category,
  });

  return {
    activityId: result.value,
  };
}

/**
 * Endpoint definition for pub.chive.activity.log.
 *
 * @public
 */
export const logActivityEndpoint: XRPCEndpoint<LogActivityParams, LogActivityResponse> = {
  method: 'pub.chive.activity.log' as never,
  type: 'procedure',
  description: 'Log a user-initiated write action before PDS write',
  inputSchema: logActivityParamsSchema,
  outputSchema: logActivityResponseSchema,
  handler: logActivityHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
