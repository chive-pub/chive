/**
 * XRPC handler for pub.chive.metrics.recordSearchClick.
 *
 * @remarks
 * Records a click event on a search result for LTR training data.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/metrics/recordSearchClick.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.metrics.recordSearchClick.
 *
 * @public
 */
export const recordSearchClick: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: 'optional',
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { relevanceLogger } = c.get('services');

    if (!input) {
      return { encoding: 'application/json', body: { success: false } };
    }

    logger.debug('Recording search click', {
      impressionId: input.impressionId,
      uri: input.uri,
      position: input.position,
    });

    await relevanceLogger.logClick({
      impressionId: input.impressionId,
      uri: input.uri,
      position: input.position,
      clickedAt: new Date(),
    });

    return { encoding: 'application/json', body: { success: true } };
  },
};
