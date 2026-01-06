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

import type { Context } from 'hono';
import { z } from 'zod';

import {
  pendingCountResponseSchema,
  type PendingCountResponse,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Empty input schema for getPendingCount.
 */
const getPendingCountInputSchema = z.object({}).optional();

type GetPendingCountInput = z.infer<typeof getPendingCountInputSchema>;

/**
 * Handler for pub.chive.governance.getPendingCount.
 *
 * @param c - Hono context
 * @returns Count of pending proposals
 */
export async function getPendingCountHandler(
  c: Context<ChiveEnv>,
  _params?: GetPendingCountInput
): Promise<PendingCountResponse> {
  const logger = c.get('logger');
  const { graph } = c.get('services');

  logger.debug('Getting pending proposal count');

  // List pending proposals with limit 0 to get just the count
  const result = await graph.listProposals({
    status: 'pending',
    limit: 0,
  });

  return {
    count: result.total,
  };
}

/**
 * Endpoint definition for pub.chive.governance.getPendingCount.
 *
 * @public
 */
export const getPendingCountEndpoint: XRPCEndpoint<GetPendingCountInput, PendingCountResponse> = {
  method: 'pub.chive.governance.getPendingCount' as never,
  type: 'query',
  description: 'Get count of pending governance proposals',
  inputSchema: getPendingCountInputSchema,
  outputSchema: pendingCountResponseSchema,
  handler: getPendingCountHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
