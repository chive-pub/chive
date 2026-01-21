/**
 * Handler for pub.chive.governance.getPendingCount.
 *
 * @remarks
 * Returns the count of pending governance proposals.
 * Used for notification badges in the UI.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/getPendingCount.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.getPendingCount.
 *
 * @public
 */
export const getPendingCount: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { graph } = c.get('services');

    logger.debug('Getting pending proposal count');

    // List pending proposals with limit 0 to get just the count
    const result = await graph.listProposals({
      status: 'pending',
      limit: 0,
    });

    return {
      encoding: 'application/json',
      body: { count: result.total },
    };
  },
};
