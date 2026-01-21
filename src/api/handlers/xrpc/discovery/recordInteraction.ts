/**
 * XRPC method for pub.chive.discovery.recordInteraction.
 *
 * @remarks
 * Records user interactions with recommendations for the feedback loop.
 * Used to improve personalization over time.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/discovery/recordInteraction.js';
import type { AtUri } from '../../../../types/atproto.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { UserInteractionType } from '../../../../types/interfaces/discovery.interface.js';
// Use generated types from lexicons
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.discovery.recordInteraction.
 *
 * @remarks
 * Records user interactions to improve recommendations:
 * - 'view': User viewed an eprint detail page
 * - 'click': User clicked a recommendation
 * - 'endorse': User endorsed the eprint
 * - 'dismiss': User dismissed a recommendation (negative signal)
 * - 'claim': User claimed authorship
 *
 * Requires authentication.
 *
 * @public
 */
export const recordInteraction: XRPCMethod<InputSchema, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
      eprintUri: params.eprintUri,
      type: params.type,
      recommendationId: params.recommendationId,
    });

    // Record the interaction if discovery service is available
    if (discovery) {
      await discovery.recordInteraction(userDid, {
        eprintUri: params.eprintUri as AtUri,
        // Cast to UserInteractionType - lexicon type is extensible
        type: params.type as UserInteractionType,
        recommendationId: params.recommendationId,
        timestamp: new Date(),
      });
    }

    logger.info('Interaction recorded', {
      userDid,
      eprintUri: params.eprintUri,
      type: params.type,
    });

    return {
      encoding: 'application/json',
      body: { recorded: true },
    };
  },
};
