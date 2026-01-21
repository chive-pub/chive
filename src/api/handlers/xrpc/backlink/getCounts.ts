/**
 * XRPC handler for pub.chive.backlink.getCounts.
 *
 * @remarks
 * Gets aggregated backlink counts for an eprint.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/backlink/getCounts.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.backlink.getCounts.
 *
 * @public
 */
export const getCounts: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { backlink } = c.get('services');

    logger.debug('Getting backlink counts', { targetUri: params.targetUri });

    const counts = await backlink.getCounts(params.targetUri);

    const response: OutputSchema = {
      sembleCollections: counts.sembleCollections,
      leafletLists: counts.leafletLists,
      whitewindBlogs: counts.whitewindBlogs,
      blueskyPosts: counts.blueskyPosts,
      blueskyEmbeds: counts.blueskyEmbeds,
      other: counts.other,
      total: counts.total,
    };

    return { encoding: 'application/json', body: response };
  },
};
