/**
 * XRPC handler for pub.chive.metrics.recordView.
 *
 * @remarks
 * Records a view event for an eprint.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/metrics/recordView.js';
import type { AtUri, DID } from '../../../../types/atproto.js';
import { DatabaseError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.metrics.recordView.
 *
 * @public
 */
export const recordView: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: 'optional',
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { metrics } = c.get('services');

    if (!input) {
      throw new DatabaseError('WRITE', 'Missing input');
    }

    logger.debug('Recording view', { uri: input.uri, viewerDid: input.viewerDid });

    const result = await metrics.recordView(input.uri as AtUri, input.viewerDid as DID | undefined);

    if (!result.ok) {
      const error = result.error;
      throw new DatabaseError('WRITE', error.message);
    }

    return { encoding: 'application/json', body: { success: true } };
  },
};
