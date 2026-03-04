/**
 * XRPC handler for pub.chive.admin.getBackfillHistory.
 *
 * @remarks
 * Returns completed, failed, and cancelled backfill operations
 * sorted by startedAt descending. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const getBackfillHistory: XRPCMethod<void, void, unknown> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const backfillManager = c.get('services').backfillManager;
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }

    const allOps = await backfillManager.listOperations();
    const history = allOps
      .filter((op) => op.status !== 'running')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return { encoding: 'application/json', body: { operations: history } };
  },
};
