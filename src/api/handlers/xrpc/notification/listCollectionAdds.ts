/**
 * XRPC handler for pub.chive.notification.listCollectionAdds.
 *
 * @remarks
 * Lists the authenticated user's eprints that other people added to their
 * collections. Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/notification/listCollectionAdds.js';
import { AuthenticationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.notification.listCollectionAdds.
 *
 * @remarks
 * Returns a paginated list of collection additions covering the authenticated
 * user's eprints, newest first.
 *
 * @public
 */
export const listCollectionAdds: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const collectionService = c.get('services').collection;
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    if (!collectionService) {
      // Returning an empty page would be indistinguishable from nobody having
      // collected the user's work, so a switched-off feature would read as a
      // real answer.
      throw new ServiceUnavailableError(
        'Notifications are not configured on this instance',
        'notification'
      );
    }

    logger.debug('Listing collection-add notifications', {
      did: user.did,
      limit: params.limit,
      cursor: params.cursor,
    });

    const page = await collectionService.listCollectionAdds(user.did, {
      limit: params.limit,
      ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
    });

    const response: OutputSchema = {
      notifications: page.items.map((item) => ({
        uri: item.uri,
        actor: {
          did: item.actorDid,
          ...(item.actorHandle !== undefined ? { handle: item.actorHandle } : {}),
          ...(item.actorDisplayName !== undefined ? { displayName: item.actorDisplayName } : {}),
        },
        collectionUri: item.collectionUri,
        ...(item.collectionLabel !== undefined ? { collectionLabel: item.collectionLabel } : {}),
        eprintUri: item.eprintUri,
        eprintTitle: item.eprintTitle,
        createdAt: item.createdAt.toISOString(),
      })),
      ...(page.cursor !== undefined ? { cursor: page.cursor } : {}),
    };

    logger.info('Collection-add notifications listed', {
      did: user.did,
      count: response.notifications.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
