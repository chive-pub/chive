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

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/getContaining.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ServiceUnavailableError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import { mapCollectionToView } from './utils.js';

/**
 * Default maximum results.
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum allowed results.
 */
const MAX_LIMIT = 100;

/** Re-exported query parameters for pub.chive.collection.getContaining. */
export type GetContainingParams = QueryParams;

/** Re-exported output schema for pub.chive.collection.getContaining. */
export type GetContainingOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.getContaining query.
 *
 * @public
 */
export const getContaining: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!params.itemUri) {
      throw new ValidationError('Missing required parameter: itemUri', 'itemUri');
    }

    if (!collectionService) {
      // The collection service is not configured. Returning an empty result
      // is indistinguishable from a genuine empty one, so a client renders
      // "no collections" for a feature that is switched off. 503 says which.
      throw new ServiceUnavailableError(
        'Collections are not configured on this instance',
        'collection'
      );
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

    const response: OutputSchema = {
      collections: collections.slice(0, limit).map(mapCollectionToView),
    };

    logger.info('Collections containing item found', {
      itemUri: params.itemUri,
      count: response.collections.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
