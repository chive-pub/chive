/**
 * XRPC handler for pub.chive.metrics.recordSearchDownload.
 *
 * @remarks
 * Records a download event from a search result. This is a strong
 * positive relevance signal (Grade 4 in judgment list).
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/metrics/recordSearchDownload.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.metrics.recordSearchDownload.
 *
 * @public
 */
export const recordSearchDownload: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: 'optional',
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { relevanceLogger } = c.get('services');

    if (!input) {
      return { encoding: 'application/json', body: { success: false } };
    }

    logger.debug('Recording search download', {
      impressionId: input.impressionId,
      uri: input.uri,
    });

    await relevanceLogger.logDownload(input.impressionId, input.uri);

    return { encoding: 'application/json', body: { success: true } };
  },
};
