/**
 * Handler for pub.chive.metrics.recordSearchClick.
 *
 * @remarks
 * Records a click event on a search result for LTR training data.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import {
  recordSearchClickInputSchema,
  type RecordSearchClickInput,
} from '../../../schemas/metrics.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Response schema for record search click.
 */
const recordSearchClickResponseSchema = z.object({
  success: z.boolean(),
});

type RecordSearchClickResponse = z.infer<typeof recordSearchClickResponseSchema>;

/**
 * Handler for pub.chive.metrics.recordSearchClick.
 *
 * @param c - Hono context
 * @param input - Click event data
 * @returns Success indicator
 *
 * @public
 */
export async function recordSearchClickHandler(
  c: Context<ChiveEnv>,
  input: RecordSearchClickInput
): Promise<RecordSearchClickResponse> {
  const logger = c.get('logger');
  const { relevanceLogger } = c.get('services');

  logger.debug('Recording search click', {
    impressionId: input.impressionId,
    uri: input.uri,
    position: input.position,
  });

  await relevanceLogger.logClick({
    impressionId: input.impressionId,
    uri: input.uri,
    position: input.position,
    clickedAt: new Date(),
  });

  return { success: true };
}

/**
 * Endpoint definition for pub.chive.metrics.recordSearchClick.
 *
 * @public
 */
export const recordSearchClickEndpoint: XRPCEndpoint<
  RecordSearchClickInput,
  RecordSearchClickResponse
> = {
  method: 'pub.chive.metrics.recordSearchClick' as never,
  type: 'procedure',
  description: 'Record a click on a search result for LTR training',
  inputSchema: recordSearchClickInputSchema,
  outputSchema: recordSearchClickResponseSchema,
  handler: recordSearchClickHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
