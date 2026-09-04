/**
 * XRPC handler for pub.chive.subscription.getStatus.
 *
 * @remarks
 * Subscriptions are `site.standard.graph.subscription` records written by
 * readers into their own repositories. Chive indexes them from the firehose and
 * neither writes nor owns them, so this reports what has been observed rather
 * than any state Chive holds on a reader's behalf.
 *
 * @packageDocumentation
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/subscription/getStatus.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.subscription.getStatus query.
 *
 * @public
 */
export const getStatus: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { subscription } = c.get('services');

    if (!params.did) {
      throw new ValidationError('Missing required parameter: did', 'did');
    }

    // Without the service the honest answer is "none observed", not an error:
    // a profile should render whether or not the graph is being indexed.
    if (!subscription) {
      return {
        encoding: 'application/json',
        body: { subscriberCount: 0, subscribed: false },
      };
    }

    const [subscriberCount, subscribed, publicationUri] = await Promise.all([
      subscription.getSubscriberCount(params.did),
      params.viewerDid
        ? subscription.isSubscribed(params.viewerDid, params.did)
        : Promise.resolve(false),
      subscription.getPublicationUri(params.did),
    ]);

    return {
      encoding: 'application/json',
      // Omitted rather than empty when the author holds no publication: there
      // is nothing to subscribe to, and a client should hide the control rather
      // than offer one that writes a record naming nothing.
      body: {
        subscriberCount,
        subscribed,
        ...(publicationUri !== undefined ? { publicationUri } : {}),
      },
    };
  },
};
