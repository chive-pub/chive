/**
 * XRPC handler for pub.chive.collection.get.
 *
 * @remarks
 * Retrieves a single collection by AT-URI with item count. Visibility-gated:
 * public collections are accessible to anyone; private collections are visible
 * only to the owner.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import type { CollectionView } from './types.js';
import { mapCollectionToView } from './utils.js';

/**
 * Query parameters for pub.chive.collection.get.
 *
 * @public
 */
export interface GetCollectionParams {
  /** AT-URI of the collection to retrieve. */
  uri: string;
}

/**
 * Output schema for pub.chive.collection.get.
 *
 * @public
 */
export interface GetCollectionOutput {
  collection: CollectionView;
}

/**
 * XRPC method for pub.chive.collection.get query.
 *
 * @public
 */
export const get: XRPCMethod<GetCollectionParams, void, GetCollectionOutput> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<GetCollectionOutput>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!params.uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
    }

    if (!collectionService) {
      throw new NotFoundError('Collection', params.uri);
    }

    logger.debug('Getting collection', { uri: params.uri });

    const result = await collectionService.getCollection(params.uri as AtUri, user?.did);

    if (!result) {
      throw new NotFoundError('Collection', params.uri);
    }

    const response: GetCollectionOutput = {
      collection: mapCollectionToView(result),
    };

    logger.info('Collection retrieved', { uri: params.uri, itemCount: result.itemCount });

    return { encoding: 'application/json', body: response };
  },
};
