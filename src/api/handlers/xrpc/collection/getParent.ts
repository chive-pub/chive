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

import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import type { CollectionView } from './types.js';
import { mapCollectionToView } from './utils.js';

/**
 * Query parameters for pub.chive.collection.getParent.
 *
 * @public
 */
export interface GetParentParams {
  /** AT-URI of the child collection. */
  uri: string;
}

/**
 * Output schema for pub.chive.collection.getParent.
 *
 * @public
 */
export interface GetParentOutput {
  parent?: CollectionView;
}

/**
 * XRPC method for pub.chive.collection.getParent query.
 *
 * @public
 */
export const getParent: XRPCMethod<GetParentParams, void, GetParentOutput> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<GetParentOutput>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');

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

    const parent = await collectionService.getParentCollection(params.uri as AtUri);

    const response: GetParentOutput = {
      parent: parent ? mapCollectionToView(parent) : undefined,
    };

    logger.info('Parent collection retrieved', {
      uri: params.uri,
      hasParent: !!parent,
    });

    return { encoding: 'application/json', body: response };
  },
};
