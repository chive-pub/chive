/**
 * Handler for pub.chive.metrics.getMetrics.
 *
 * @remarks
 * Gets comprehensive metrics for a eprint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  getMetricsParamsSchema,
  eprintMetricsSchema,
  type GetMetricsParams,
  type EprintMetrics,
} from '../../../schemas/metrics.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.metrics.getMetrics.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Comprehensive eprint metrics
 *
 * @public
 */
export async function getMetricsHandler(
  c: Context<ChiveEnv>,
  params: GetMetricsParams
): Promise<EprintMetrics> {
  const logger = c.get('logger');
  const { metrics } = c.get('services');

  logger.debug('Getting metrics', { uri: params.uri });

  const result = await metrics.getMetrics(params.uri as AtUri);

  return {
    totalViews: result.totalViews,
    uniqueViews: result.uniqueViews,
    totalDownloads: result.totalDownloads,
    views24h: result.views24h,
    views7d: result.views7d,
    views30d: result.views30d,
  };
}

/**
 * Endpoint definition for pub.chive.metrics.getMetrics.
 *
 * @public
 */
export const getMetricsEndpoint: XRPCEndpoint<GetMetricsParams, EprintMetrics> = {
  method: 'pub.chive.metrics.getMetrics' as never,
  type: 'query',
  description: 'Get comprehensive metrics for a eprint',
  inputSchema: getMetricsParamsSchema,
  outputSchema: eprintMetricsSchema,
  handler: getMetricsHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
