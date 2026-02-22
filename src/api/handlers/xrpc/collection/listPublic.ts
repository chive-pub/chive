/**
 * XRPC handler for pub.chive.collection.listPublic.
 *
 * @remarks
 * Lists publicly visible collections across all users. Supports pagination.
 *
 * @packageDocumentation
 * @public
 */

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
 * Query parameters for pub.chive.collection.listPublic.
 *
 * @public
 */
export interface ListPublicParams {
  /** Maximum results to return. */
  limit?: number;
  /** Pagination cursor. */
  cursor?: string;
  /** Filter by tag. */
  tag?: string;
}

/**
 * Output schema for pub.chive.collection.listPublic.
 *
 * @public
 */
export interface ListPublicOutput {
  collections: CollectionView[];
  cursor?: string;
  hasMore: boolean;
  total: number;
}

/**
 * XRPC method for pub.chive.collection.listPublic query.
 *
 * @public
 */
export const listPublic: XRPCMethod<ListPublicParams, void, ListPublicOutput> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<ListPublicOutput>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');

    if (!collectionService) {
      return {
        encoding: 'application/json',
        body: { collections: [], hasMore: false, total: 0 },
      };
    }

    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    logger.debug('Listing public collections', {
      limit,
      cursor: params.cursor,
      tag: params.tag,
    });

    const result = await collectionService.listPublic({
      limit,
      cursor: params.cursor,
    });

    const response: ListPublicOutput = {
      collections: result.items.map(mapCollectionToView),
      cursor: result.cursor,
      hasMore: result.hasMore,
      total: result.total,
    };

    logger.info('Public collections listed', {
      count: response.collections.length,
      total: response.total,
    });

    return { encoding: 'application/json', body: response };
  },
};
