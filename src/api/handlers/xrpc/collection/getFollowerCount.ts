/**
 * XRPC handler for pub.chive.collection.getFollowerCount.
 *
 * @remarks
 * Returns the number of network.cosmik.follow records targeting a collection.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/getFollowerCount.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ServiceUnavailableError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters. */
export type GetFollowerCountParams = QueryParams;

/** Re-exported output schema. */
export type GetFollowerCountOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.getFollowerCount query.
 *
 * @public
 */
export const getFollowerCount: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');

    if (!params.uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
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

    const count = await collectionService.getFollowerCount(params.uri as AtUri);

    logger.debug('Follower count retrieved', { uri: params.uri, count });

    return { encoding: 'application/json', body: { count } };
  },
};
