/**
 * XRPC handler for pub.chive.admin.getMetricsOverview.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface MetricsOverviewParams {
  readonly days?: number;
}

export const getMetricsOverview: XRPCMethod<MetricsOverviewParams, void, unknown> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const metricsService = c.get('services').metrics;
    const days = params.days ?? 7;

    // Map days to the closest supported trending window
    const window: '24h' | '7d' | '30d' = days <= 1 ? '24h' : days <= 7 ? '7d' : '30d';

    const trending = await metricsService.getTrending(window, 20).catch(() => []);

    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - days * 86_400_000).toISOString();

    return {
      encoding: 'application/json',
      body: { trending, periodInfo: { days, startDate, endDate } },
    };
  },
};
