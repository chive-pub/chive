/**
 * XRPC handler for pub.chive.metrics.getViewCount.
 *
 * @remarks
 * Gets simple view count for an eprint.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/metrics/getViewCount.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.metrics.getViewCount.
 *
 * @public
 */
export const getViewCount: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { metrics } = c.get('services');

    logger.debug('Getting view count', { uri: params.uri });

    const count = await metrics.getViewCount(params.uri as AtUri);

    return { encoding: 'application/json', body: { count } };
  },
};
