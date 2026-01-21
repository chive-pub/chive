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

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/activity/log.js';
import type {
  ActivityAction,
  ActivityCategory,
} from '../../../../services/activity/activity-service.js';
import type { AtUri, NSID } from '../../../../types/atproto.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.activity.log.
 *
 * @remarks
 * Requires authentication. The actor DID is taken from the authenticated
 * user context and cannot be spoofed.
 *
 * @public
 */
export const logActivity: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    if (!input) {
      throw new AuthenticationError('Input is required');
    }
    const params = input;
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
      action: params.action as ActivityAction,
      category: params.category as ActivityCategory,
      targetUri: params.targetUri as AtUri | undefined,
      targetTitle: params.targetTitle,
      traceId: params.traceId,
      spanId: params.spanId,
      sessionId: user.sessionId,
      userAgent: c.req.header('user-agent'),
      ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
      uiContext: params.uiContext
        ? (JSON.parse(params.uiContext) as Record<string, unknown>)
        : undefined,
      recordSnapshot: params.recordSnapshot
        ? (JSON.parse(params.recordSnapshot) as Record<string, unknown>)
        : undefined,
    });

    if (!result.ok) {
      throw result.error;
    }

    logger.debug('Activity logged', {
      activityId: result.value,
      category: params.category,
    });

    return {
      encoding: 'application/json',
      body: { activityId: result.value },
    };
  },
};
