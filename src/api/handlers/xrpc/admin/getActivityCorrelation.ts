/**
 * XRPC handler for pub.chive.admin.getActivityCorrelation.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const getActivityCorrelation: XRPCMethod<void, void, unknown> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const activityService = c.get('services').activity;
    if (!activityService) {
      return {
        encoding: 'application/json',
        body: { metrics: [], timestamp: new Date().toISOString() },
      };
    }

    const result = await activityService.getCorrelationMetrics().catch(() => ({
      ok: false as const,
      error: { message: 'Service unavailable' },
    }));

    const metrics = result.ok ? result.value : [];

    return {
      encoding: 'application/json',
      body: { metrics, timestamp: new Date().toISOString() },
    };
  },
};
