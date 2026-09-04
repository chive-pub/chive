/**
 * XRPC handler for pub.chive.subscription.getFeed.
 *
 * @remarks
 * The eprints published by the authors a reader subscribes to. Subscriptions
 * are records in readers' own repositories, observed on the firehose, so this
 * reports what has been seen rather than any state Chive holds for a reader.
 *
 * @packageDocumentation
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/subscription/getFeed.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.subscription.getFeed query.
 *
 * @public
 */
export const getFeed: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { subscription } = c.get('services');

    if (!params.subscriberDid) {
      throw new ValidationError('Missing required parameter: subscriberDid', 'subscriberDid');
    }

    // An empty feed rather than an error when the graph is not being indexed:
    // a reader with no subscriptions and a deployment with no indexer should
    // look the same to a client, which is to say empty.
    if (!subscription) {
      return { encoding: 'application/json', body: { eprints: [] } };
    }

    const result = await subscription.getSubscribedFeed(params.subscriberDid, {
      ...(params.limit !== undefined ? { limit: params.limit } : {}),
      ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
    });

    return {
      encoding: 'application/json',
      body: {
        eprints: result.eprints.map((eprint) => ({
          uri: eprint.uri,
          title: eprint.title,
          createdAt: eprint.createdAt.toISOString(),
        })),
        ...(result.cursor !== undefined ? { cursor: result.cursor } : {}),
      },
    };
  },
};
