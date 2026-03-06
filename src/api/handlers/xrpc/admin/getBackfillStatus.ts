/**
 * XRPC handler for pub.chive.admin.getBackfillStatus.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface GetBackfillParams {
  readonly id?: string;
  readonly status?: string;
}

export const getBackfillStatus: XRPCMethod<GetBackfillParams, void, unknown> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const backfillManager = c.get('services').backfillManager;
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }

    if (params.id) {
      const operation = await backfillManager.getStatus(params.id);
      return { encoding: 'application/json', body: { operation } };
    }

    const statusFilter = params.status as
      | 'running'
      | 'completed'
      | 'failed'
      | 'cancelled'
      | undefined;
    const operations = await backfillManager.listOperations(statusFilter);
    return { encoding: 'application/json', body: { operations } };
  },
};
