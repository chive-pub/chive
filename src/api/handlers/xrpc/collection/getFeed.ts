/**
 * XRPC handler for pub.chive.collection.getFeed.
 *
 * @remarks
 * Returns a chronological activity feed for a collection, aggregating events
 * from tracked items (eprints, people, fields, institutions, events).
 * Visibility-gated: private collection feeds are only accessible to the owner.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/getFeed.js';
import type { AtUri } from '../../../../types/atproto.js';
import { AuthorizationError, NotFoundError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters for pub.chive.collection.getFeed. */
export type GetFeedParams = QueryParams;

/** Re-exported output schema for pub.chive.collection.getFeed. */
export type GetFeedOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.getFeed query.
 *
 * @public
 */
export const getFeed: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!params.uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
    }

    if (!collectionService) {
      throw new NotFoundError('Collection', params.uri);
    }

    // Verify collection exists and user has access
    const collection = await collectionService.getCollection(params.uri as AtUri, user?.did);

    if (!collection) {
      throw new NotFoundError('Collection', params.uri);
    }

    // Visibility gate: private collections are owner-only
    if (collection.visibility === 'private' && user?.did !== collection.ownerDid) {
      throw new AuthorizationError('Cannot access feed for private collection');
    }

    logger.debug('Getting collection feed', {
      uri: params.uri,
      limit: params.limit,
      cursor: params.cursor,
    });

    const feedResult = await collectionService.getCollectionFeed(params.uri as AtUri, {
      limit: params.limit,
      cursor: params.cursor,
    });

    if (!feedResult.ok) {
      throw new NotFoundError('Collection feed', params.uri);
    }

    const response: OutputSchema = {
      events: feedResult.value.events.map((event) => ({
        type: event.type,
        eventUri: event.eventUri,
        eventAt: event.eventAt.toISOString(),
        collectionItemUri: event.collectionItemUri,
        collectionItemSubkind: event.collectionItemSubkind,
        collectionItems: event.collectionItems,
        payload: event.payload,
      })),
      cursor: feedResult.value.cursor,
      hasMore: feedResult.value.hasMore,
    };

    logger.info('Collection feed retrieved', {
      uri: params.uri,
      eventCount: response.events.length,
      hasMore: response.hasMore,
    });

    return { encoding: 'application/json', body: response };
  },
};
