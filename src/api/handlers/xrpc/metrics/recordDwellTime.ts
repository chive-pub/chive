/**
 * XRPC handler for pub.chive.metrics.recordDwellTime.
 *
 * @remarks
 * Records dwell time for a clicked search result. Called via beacon API
 * when user leaves the page.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/metrics/recordDwellTime.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.metrics.recordDwellTime.
 *
 * @public
 */
export const recordDwellTime: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: 'optional',
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { relevanceLogger } = c.get('services');

    if (!input) {
      return { encoding: 'application/json', body: { success: false } };
    }

    logger.debug('Recording dwell time', {
      impressionId: input.impressionId,
      uri: input.uri,
      dwellTimeMs: input.dwellTimeMs,
    });

    await relevanceLogger.logDwellTime(input.impressionId, input.uri, input.dwellTimeMs);

    return { encoding: 'application/json', body: { success: true } };
  },
};
