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
import { ValidationError } from '../../../../types/errors.js';
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
      return { encoding: 'application/json', body: { count: 0 } };
    }

    const count = await collectionService.getFollowerCount(params.uri as AtUri);

    logger.debug('Follower count retrieved', { uri: params.uri, count });

    return { encoding: 'application/json', body: { count } };
  },
};
