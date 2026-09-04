/**
 * XRPC handler for pub.chive.notification.listFollowers.
 *
 * @remarks
 * Lists the people who follow the authenticated user. Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/notification/listFollowers.js';
import { AuthenticationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.notification.listFollowers.
 *
 * @remarks
 * Returns a paginated list of the authenticated user's followers, newest first.
 *
 * @public
 */
export const listFollowers: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const collectionService = c.get('services').collection;
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    if (!collectionService) {
      // Returning an empty page would be indistinguishable from having no
      // followers, so a switched-off feature would read as a real answer.
      throw new ServiceUnavailableError(
        'Notifications are not configured on this instance',
        'notification'
      );
    }

    logger.debug('Listing follower notifications', {
      did: user.did,
      limit: params.limit,
      cursor: params.cursor,
    });

    const page = await collectionService.listFollowers(user.did, {
      limit: params.limit,
      ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
    });

    const response: OutputSchema = {
      notifications: page.items.map((item) => ({
        collectionUri: item.collectionUri,
        collectionLabel: item.collectionLabel,
        follower: {
          did: item.followerDid,
          ...(item.followerHandle !== undefined ? { handle: item.followerHandle } : {}),
          ...(item.followerDisplayName !== undefined
            ? { displayName: item.followerDisplayName }
            : {}),
        },
        ...(item.activityTypes !== undefined ? { activityTypes: [...item.activityTypes] } : {}),
        createdAt: item.createdAt.toISOString(),
      })),
      ...(page.cursor !== undefined ? { cursor: page.cursor } : {}),
    };

    logger.info('Follower notifications listed', {
      did: user.did,
      count: response.notifications.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
