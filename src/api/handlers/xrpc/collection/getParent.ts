/**
 * XRPC handler for pub.chive.collection.getParent.
 *
 * @remarks
 * Retrieves the parent collection of a given collection in the hierarchy.
 * Returns null if the collection is a root (has no parent).
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/getParent.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import { mapCollectionToView } from './utils.js';

/** Re-exported query parameters for pub.chive.collection.getParent. */
export type GetParentParams = QueryParams;

/** Re-exported output schema for pub.chive.collection.getParent. */
export type GetParentOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.getParent query.
 *
 * @public
 */
export const getParent: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!params.uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
    }

    if (!collectionService) {
      return {
        encoding: 'application/json',
        body: {},
      };
    }

    logger.debug('Getting parent collection', { uri: params.uri });

    const parent = await collectionService.getParentCollection(params.uri as AtUri, user?.did);

    const response: OutputSchema = {
      parent: parent ? mapCollectionToView(parent) : undefined,
    };

    logger.info('Parent collection retrieved', {
      uri: params.uri,
      hasParent: !!parent,
    });

    return { encoding: 'application/json', body: response };
  },
};
