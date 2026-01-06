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

import type { Context } from 'hono';

import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import {
  getCorrelationMetricsParamsSchema,
  getCorrelationMetricsResponseSchema,
  type GetCorrelationMetricsParams,
  type GetCorrelationMetricsResponse,
} from '../../../schemas/activity.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.activity.getCorrelationMetrics.
 *
 * @param c - Hono context
 * @param _params - Query parameters (empty)
 * @returns Correlation metrics
 *
 * @public
 */
export async function getCorrelationMetricsHandler(
  c: Context<ChiveEnv>,
  _params: GetCorrelationMetricsParams
): Promise<GetCorrelationMetricsResponse> {
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
    avgLatencyMs: m.avgLatencyMs,
    p95LatencyMs: m.p95LatencyMs,
  }));

  return {
    metrics: mappedMetrics,
    pendingCount: pendingResult.value,
  };
}

/**
 * Endpoint definition for pub.chive.activity.getCorrelationMetrics.
 *
 * @public
 */
export const getCorrelationMetricsEndpoint: XRPCEndpoint<
  GetCorrelationMetricsParams,
  GetCorrelationMetricsResponse
> = {
  method: 'pub.chive.activity.getCorrelationMetrics' as never,
  type: 'query',
  description: 'Get activity correlation metrics (admin only)',
  inputSchema: getCorrelationMetricsParamsSchema,
  outputSchema: getCorrelationMetricsResponseSchema,
  handler: getCorrelationMetricsHandler,
  auth: 'required',
  rateLimit: 'admin',
};
