/**
 * XRPC handler for pub.chive.collection.listByOwner.
 *
 * @remarks
 * Lists collections owned by a specific user. When the authenticated user
 * is the owner, all collections are returned (including unlisted). For other
 * viewers, only listed collections are shown.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/listByOwner.js';
import type { DID } from '../../../../types/atproto.js';
import { ServiceUnavailableError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import { mapCollectionToView } from './utils.js';

/**
 * Default number of collections per page.
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum number of collections per page.
 */
const MAX_LIMIT = 100;

/** Re-exported query parameters for pub.chive.collection.listByOwner. */
export type ListByOwnerParams = QueryParams;

/** Re-exported output schema for pub.chive.collection.listByOwner. */
export type ListByOwnerOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.listByOwner query.
 *
 * @public
 */
export const listByOwner: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!params.did) {
      throw new ValidationError('Missing required parameter: did', 'did');
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

    // Filter out unlisted collections unless the viewer is the owner
    const filtered = isOwner ? result.items : result.items.filter((c) => c.visibility === 'listed');

    const response: OutputSchema = {
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
