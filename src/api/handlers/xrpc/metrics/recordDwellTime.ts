/**
 * Handler for pub.chive.metrics.recordDwellTime.
 *
 * @remarks
 * Records dwell time for a clicked search result. Called via beacon API
 * when user leaves the page.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import { recordDwellTimeInputSchema, type RecordDwellTimeInput } from '../../../schemas/metrics.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Response schema for record dwell time.
 */
const recordDwellTimeResponseSchema = z.object({
  success: z.boolean(),
});

type RecordDwellTimeResponse = z.infer<typeof recordDwellTimeResponseSchema>;

/**
 * Handler for pub.chive.metrics.recordDwellTime.
 *
 * @param c - Hono context
 * @param input - Dwell time data
 * @returns Success indicator
 *
 * @public
 */
export async function recordDwellTimeHandler(
  c: Context<ChiveEnv>,
  input: RecordDwellTimeInput
): Promise<RecordDwellTimeResponse> {
  const logger = c.get('logger');
  const { relevanceLogger } = c.get('services');

  logger.debug('Recording dwell time', {
    impressionId: input.impressionId,
    uri: input.uri,
    dwellTimeMs: input.dwellTimeMs,
  });

  await relevanceLogger.logDwellTime(input.impressionId, input.uri, input.dwellTimeMs);

  return { success: true };
}

/**
 * Endpoint definition for pub.chive.metrics.recordDwellTime.
 *
 * @public
 */
export const recordDwellTimeEndpoint: XRPCEndpoint<RecordDwellTimeInput, RecordDwellTimeResponse> =
  {
    method: 'pub.chive.metrics.recordDwellTime' as never,
    type: 'procedure',
    description: 'Record dwell time for a clicked search result',
    inputSchema: recordDwellTimeInputSchema,
    outputSchema: recordDwellTimeResponseSchema,
    handler: recordDwellTimeHandler,
    auth: 'optional',
    rateLimit: 'anonymous',
  };
