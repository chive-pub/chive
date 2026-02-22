/**
 * XRPC handler for pub.chive.collection.listByOwner.
 *
 * @remarks
 * Lists collections owned by a specific user. When the authenticated user
 * is the owner, all collections are returned (including private). For other
 * viewers, only public and unlisted collections are shown.
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import type { CollectionView } from './types.js';
import { mapCollectionToView } from './utils.js';

/**
 * Default number of collections per page.
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum number of collections per page.
 */
const MAX_LIMIT = 100;

/**
 * Query parameters for pub.chive.collection.listByOwner.
 *
 * @public
 */
export interface ListByOwnerParams {
  /** DID of the collection owner. */
  did: string;
  /** Maximum results to return. */
  limit?: number;
  /** Pagination cursor. */
  cursor?: string;
}

/**
 * Output schema for pub.chive.collection.listByOwner.
 *
 * @public
 */
export interface ListByOwnerOutput {
  collections: CollectionView[];
  cursor?: string;
  hasMore: boolean;
  total: number;
}

/**
 * XRPC method for pub.chive.collection.listByOwner query.
 *
 * @public
 */
export const listByOwner: XRPCMethod<ListByOwnerParams, void, ListByOwnerOutput> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<ListByOwnerOutput>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!params.did) {
      throw new ValidationError('Missing required parameter: did', 'did');
    }

    if (!collectionService) {
      return {
        encoding: 'application/json',
        body: { collections: [], hasMore: false, total: 0 },
      };
    }

    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const isOwner = user?.did === params.did;

    logger.debug('Listing collections by owner', {
      did: params.did,
      limit,
      cursor: params.cursor,
      isOwner,
    });

    const result = await collectionService.listByOwner(params.did as DID, {
      limit,
      cursor: params.cursor,
    });

    // Filter out private collections unless the viewer is the owner
    const filtered = isOwner ? result.items : result.items.filter((c) => c.visibility === 'public');

    const response: ListByOwnerOutput = {
      collections: filtered.map(mapCollectionToView),
      cursor: result.cursor,
      hasMore: result.hasMore,
      total: isOwner ? result.total : filtered.length,
    };

    logger.info('Collections listed for owner', {
      did: params.did,
      count: response.collections.length,
      total: response.total,
    });

    return { encoding: 'application/json', body: response };
  },
};
