/**
 * Handler for pub.chive.activity.getCorrelationMetrics.
 *
 * @remarks
 * Gets activity correlation metrics (admin only).
 * Shows confirmation rates, latencies, and error counts by category.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/activity/getCorrelationMetrics.js';
import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.activity.getCorrelationMetrics.
 *
 * @public
 */
export const getCorrelationMetrics: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { activity } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!user.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    logger.debug('Getting correlation metrics');

    const [metricsResult, pendingResult] = await Promise.all([
      activity.getCorrelationMetrics(),
      activity.getPendingCount(),
    ]);

    if (!metricsResult.ok) {
      throw metricsResult.error;
    }

    if (!pendingResult.ok) {
      throw pendingResult.error;
    }

    // Map to response format
    const mappedMetrics = metricsResult.value.map((m) => ({
      hour: m.hour.toISOString(),
      category: m.category,
      total: m.total,
      confirmed: m.confirmed,
      failed: m.failed,
      timeout: m.timeout,
      pending: m.pending,
      confirmationRatePct: m.confirmationRatePct,
      avgLatencyMs: m.avgLatencyMs ?? undefined,
      p95LatencyMs: m.p95LatencyMs ?? undefined,
    }));

    return {
      encoding: 'application/json',
      body: {
        metrics: mappedMetrics,
        pendingCount: pendingResult.value,
      },
    };
  },
};
