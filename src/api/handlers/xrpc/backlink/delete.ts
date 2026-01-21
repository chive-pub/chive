/**
 * XRPC handler for pub.chive.backlink.delete.
 *
 * @remarks
 * Deletes (marks as deleted) a backlink record. Internal/plugin use only.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/backlink/delete.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.backlink.delete.
 *
 * @public
 */
export const deleteBacklink: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { backlink } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input) {
      throw new Error('Input required');
    }

    logger.debug('Deleting backlink', { sourceUri: input.sourceUri });

    await backlink.deleteBacklink(input.sourceUri);

    return { encoding: 'application/json', body: { success: true } };
  },
};
