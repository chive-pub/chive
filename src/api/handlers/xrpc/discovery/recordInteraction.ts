/**
 * Handler for pub.chive.discovery.recordInteraction.
 *
 * @remarks
 * Records user interactions with recommendations for the feedback loop.
 * Used to improve personalization over time.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import { AuthenticationError } from '../../../../types/errors.js';
import {
  recordInteractionParamsSchema,
  recordInteractionResponseSchema,
  type RecordInteractionParams,
  type RecordInteractionResponse,
} from '../../../schemas/discovery.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.discovery.recordInteraction.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Recording confirmation
 *
 * @remarks
 * Records user interactions to improve recommendations:
 * - 'view': User viewed a preprint detail page
 * - 'click': User clicked a recommendation
 * - 'endorse': User endorsed the preprint
 * - 'dismiss': User dismissed a recommendation (negative signal)
 * - 'claim': User claimed authorship
 *
 * Requires authentication.
 *
 * @public
 */
export async function recordInteractionHandler(
  c: Context<ChiveEnv>,
  params: RecordInteractionParams
): Promise<RecordInteractionResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { discovery } = c.get('services');

  // Require authentication
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const userDid = user.did;

  logger.debug('Recording interaction', {
    userDid,
    preprintUri: params.preprintUri,
    type: params.type,
    recommendationId: params.recommendationId,
  });

  // Record the interaction if discovery service is available
  if (discovery) {
    await discovery.recordInteraction(userDid, {
      preprintUri: params.preprintUri as AtUri,
      type: params.type,
      recommendationId: params.recommendationId,
      timestamp: new Date(),
    });
  }

  logger.info('Interaction recorded', {
    userDid,
    preprintUri: params.preprintUri,
    type: params.type,
  });

  return { recorded: true };
}

/**
 * Endpoint definition for pub.chive.discovery.recordInteraction.
 *
 * @public
 */
export const recordInteractionEndpoint: XRPCEndpoint<
  RecordInteractionParams,
  RecordInteractionResponse
> = {
  method: 'pub.chive.discovery.recordInteraction' as never,
  type: 'procedure',
  description: 'Record user interaction with a recommendation',
  inputSchema: recordInteractionParamsSchema,
  outputSchema: recordInteractionResponseSchema,
  handler: recordInteractionHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
