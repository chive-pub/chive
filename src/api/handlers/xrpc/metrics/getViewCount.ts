/**
 * Handler for pub.chive.metrics.getViewCount.
 *
 * @remarks
 * Gets simple view count for a eprint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  getViewCountParamsSchema,
  viewCountResponseSchema,
  type GetViewCountParams,
  type ViewCountResponse,
} from '../../../schemas/metrics.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.metrics.getViewCount.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns View count
 *
 * @public
 */
export async function getViewCountHandler(
  c: Context<ChiveEnv>,
  params: GetViewCountParams
): Promise<ViewCountResponse> {
  const logger = c.get('logger');
  const { metrics } = c.get('services');

  logger.debug('Getting view count', { uri: params.uri });

  const count = await metrics.getViewCount(params.uri as AtUri);

  return { count };
}

/**
 * Endpoint definition for pub.chive.metrics.getViewCount.
 *
 * @public
 */
export const getViewCountEndpoint: XRPCEndpoint<GetViewCountParams, ViewCountResponse> = {
  method: 'pub.chive.metrics.getViewCount' as never,
  type: 'query',
  description: 'Get view count for a eprint',
  inputSchema: getViewCountParamsSchema,
  outputSchema: viewCountResponseSchema,
  handler: getViewCountHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
