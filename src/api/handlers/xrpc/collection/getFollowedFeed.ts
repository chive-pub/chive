/**
 * XRPC handler for pub.chive.collection.getFollowedFeed.
 *
 * @remarks
 * One feed across every collection the reader follows. Authenticated: the feed
 * is a fact about the reader, and there is no meaningful anonymous answer.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/getFollowedFeed.js';
import { AuthorizationError, NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters for pub.chive.collection.getFollowedFeed. */
export type GetFollowedFeedParams = QueryParams;

/** Re-exported output schema for pub.chive.collection.getFollowedFeed. */
export type GetFollowedFeedOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.getFollowedFeed query.
 *
 * @public
 */
export const getFollowedFeed: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthorizationError('Sign in to read your feed');
    }
    if (!collectionService) {
      throw new NotFoundError('Collection service', 'unavailable');
    }

    const result = await collectionService.getFollowedFeed(user.did, {
      ...(params.scope
        ? { scope: params.scope as 'subscriptions' | 'mine' | 'followed' | 'all' }
        : {}),
      ...(params.limit !== undefined ? { limit: params.limit } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
      ...(params.types ? { types: params.types } : {}),
    });

    if (!result.ok) {
      throw new NotFoundError('Followed feed', user.did);
    }

    const response: OutputSchema = {
      events: result.value.events.map((event) => ({
        type: event.type,
        eventUri: event.eventUri,
        eventAt: event.eventAt.toISOString(),
        collectionItemUri: event.collectionItemUri,
        collectionItemSubkind: event.collectionItemSubkind,
        collectionItems: event.collectionItems,
        payload: event.payload,
      })),
      cursor: result.value.cursor,
      hasMore: result.value.hasMore,
    };

    logger.info('Followed feed retrieved', {
      did: user.did,
      scope: params.scope ?? 'all',
      eventCount: response.events.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
