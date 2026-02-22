/**
 * XRPC handler for pub.chive.collection.getSubcollections.
 *
 * @remarks
 * Retrieves the direct subcollections of a given collection, linked via
 * SUBCOLLECTION_OF edges in the collection hierarchy.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/getSubcollections.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import { mapCollectionToView } from './utils.js';

/** Re-exported query parameters for pub.chive.collection.getSubcollections. */
export type GetSubcollectionsParams = QueryParams;

/** Re-exported output schema for pub.chive.collection.getSubcollections. */
export type GetSubcollectionsOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.getSubcollections query.
 *
 * @public
 */
export const getSubcollections: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');

    if (!params.uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
    }

    if (!collectionService) {
      return {
        encoding: 'application/json',
        body: { subcollections: [] },
      };
    }

    logger.debug('Getting subcollections', { uri: params.uri });

    const subcollections = await collectionService.getSubcollections(params.uri as AtUri);

    const response: OutputSchema = {
      subcollections: subcollections.map(mapCollectionToView),
    };

    logger.info('Subcollections retrieved', {
      uri: params.uri,
      count: response.subcollections.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
