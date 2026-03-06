/**
 * XRPC handler for pub.chive.collection.search.
 *
 * @remarks
 * Searches listed collections by text query across label and description fields.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/search.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import { mapCollectionToView } from './utils.js';

/**
 * Default number of search results per page.
 */
const DEFAULT_LIMIT = 20;

/**
 * Maximum number of search results per page.
 */
const MAX_LIMIT = 100;

/** Re-exported query parameters for pub.chive.collection.search. */
export type SearchCollectionsParams = QueryParams;

/** Re-exported output schema for pub.chive.collection.search. */
export type SearchCollectionsOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.search query.
 *
 * @public
 */
export const search: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');

    if (!params.query) {
      throw new ValidationError('Missing required parameter: query', 'query');
    }

    if (!collectionService) {
      return {
        encoding: 'application/json',
        body: { collections: [], hasMore: false, total: 0 },
      };
    }

    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    logger.debug('Searching collections', {
      query: params.query,
      limit,
      cursor: params.cursor,
    });

    const result = await collectionService.searchCollections(params.query, {
      limit,
      cursor: params.cursor,
      visibility: 'listed',
    });

    const response: OutputSchema = {
      collections: result.items.map(mapCollectionToView),
      cursor: result.cursor,
      hasMore: result.hasMore,
      total: result.total,
    };

    logger.info('Collection search completed', {
      query: params.query,
      count: response.collections.length,
      total: response.total,
    });

    return { encoding: 'application/json', body: response };
  },
};
