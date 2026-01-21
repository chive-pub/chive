/**
 * XRPC handler for pub.chive.metrics.getMetrics.
 *
 * @remarks
 * Gets comprehensive metrics for an eprint.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/metrics/getMetrics.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.metrics.getMetrics.
 *
 * @public
 */
export const getMetrics: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { metrics } = c.get('services');

    logger.debug('Getting metrics', { uri: params.uri });

    const result = await metrics.getMetrics(params.uri as AtUri);

    return {
      encoding: 'application/json',
      body: {
        totalViews: result.totalViews,
        uniqueViews: result.uniqueViews,
        totalDownloads: result.totalDownloads,
        views24h: result.views24h,
        views7d: result.views7d,
        views30d: result.views30d,
      },
    };
  },
};
