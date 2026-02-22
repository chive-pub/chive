/**
 * XRPC handler for pub.chive.collection.getContaining.
 *
 * @remarks
 * Finds all collections that contain a given item URI (e.g., an eprint).
 * Visibility-gated: returns only public collections and the authenticated
 * user's private collections.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import type { CollectionView } from './types.js';
import { mapCollectionToView } from './utils.js';

/**
 * Query parameters for pub.chive.collection.getContaining.
 *
 * @public
 */
export interface GetContainingParams {
  /** AT-URI of the item to look up. */
  itemUri: string;
  /** Maximum results to return. */
  limit?: number;
}

/**
 * Output schema for pub.chive.collection.getContaining.
 *
 * @public
 */
export interface GetContainingOutput {
  collections: CollectionView[];
}

/**
 * Default maximum results.
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum allowed results.
 */
const MAX_LIMIT = 100;

/**
 * XRPC method for pub.chive.collection.getContaining query.
 *
 * @public
 */
export const getContaining: XRPCMethod<GetContainingParams, void, GetContainingOutput> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<GetContainingOutput>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!params.itemUri) {
      throw new ValidationError('Missing required parameter: itemUri', 'itemUri');
    }

    if (!collectionService) {
      return {
        encoding: 'application/json',
        body: { collections: [] },
      };
    }

    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    logger.debug('Finding collections containing item', {
      itemUri: params.itemUri,
      limit,
    });

    const collections = await collectionService.getCollectionsContaining(
      params.itemUri as AtUri,
      user?.did
    );

    const response: GetContainingOutput = {
      collections: collections.slice(0, limit).map(mapCollectionToView),
    };

    logger.info('Collections containing item found', {
      itemUri: params.itemUri,
      count: response.collections.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
