/**
 * XRPC handler for pub.chive.collection.findContainsEdge.
 *
 * @remarks
 * Finds the CONTAINS edge between a collection and a specific item.
 * Used by the frontend to look up edge URIs in parent collections
 * during delete propagation.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/findContainsEdge.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters for pub.chive.collection.findContainsEdge. */
export type FindContainsEdgeParams = QueryParams;

/** Re-exported output schema for pub.chive.collection.findContainsEdge. */
export type FindContainsEdgeOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.findContainsEdge query.
 *
 * @public
 */
export const findContainsEdge: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');

    if (!params.collectionUri || !params.itemUri) {
      throw new ValidationError('Missing required parameters', 'collectionUri');
    }

    if (!collectionService) {
      return { encoding: 'application/json', body: { found: false } };
    }

    logger.debug('Finding contains edge', {
      collectionUri: params.collectionUri,
      itemUri: params.itemUri,
    });

    const result = await collectionService.findContainsEdge(
      params.collectionUri as AtUri,
      params.itemUri
    );

    if (!result) {
      return { encoding: 'application/json', body: { found: false } };
    }

    // Extract Cosmik mapping for the specific item
    const cosmikItems = result.cosmikItems;
    let cosmikCardUri: string | undefined;
    let cosmikLinkUri: string | undefined;
    let cosmikItemUrl: string | undefined;

    if (cosmikItems) {
      const entry = Object.entries(cosmikItems).find(([url]) => url === params.itemUri);
      if (entry) {
        cosmikCardUri = entry[1].cardUri;
        cosmikLinkUri = entry[1].linkUri;
        cosmikItemUrl = entry[0];
      }
    }

    return {
      encoding: 'application/json',
      body: {
        found: true,
        edgeUri: result.edgeUri,
        parentCollectionUri: result.parentCollectionUri,
        cosmikCardUri,
        cosmikLinkUri,
        cosmikItemUrl,
      },
    };
  },
};
