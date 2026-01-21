/**
 * Handler for pub.chive.activity.markFailed.
 *
 * @remarks
 * Marks a pending activity as failed when PDS write fails.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/activity/markFailed.js';
import type { NSID } from '../../../../types/atproto.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.activity.markFailed.
 *
 * @public
 */
export const markFailed: XRPCMethod<void, InputSchema, OutputSchema> = {
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

    return {
      encoding: 'application/json',
      body: { success: true },
    };
  },
};
