/**
 * Handler for pub.chive.metrics.recordView.
 *
 * @remarks
 * Records a view event for an eprint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import type { AtUri, DID } from '../../../../types/atproto.js';
import { DatabaseError } from '../../../../types/errors.js';
import { recordViewInputSchema, type RecordViewInput } from '../../../schemas/metrics.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Response schema for record view.
 */
const recordViewResponseSchema = z.object({
  success: z.boolean(),
});

type RecordViewResponse = z.infer<typeof recordViewResponseSchema>;

/**
 * Handler for pub.chive.metrics.recordView.
 *
 * @param c - Hono context
 * @param input - View event data
 * @returns Success indicator
 *
 * @throws {DatabaseError} When recording fails
 *
 * @public
 */
export async function recordViewHandler(
  c: Context<ChiveEnv>,
  input: RecordViewInput
): Promise<RecordViewResponse> {
  const logger = c.get('logger');
  const { metrics } = c.get('services');

  logger.debug('Recording view', { uri: input.uri, viewerDid: input.viewerDid });

  const result = await metrics.recordView(input.uri as AtUri, input.viewerDid as DID | undefined);

  if (!result.ok) {
    throw new DatabaseError('WRITE', result.error.message);
  }

  return { success: true };
}

/**
 * Endpoint definition for pub.chive.metrics.recordView.
 *
 * @public
 */
export const recordViewEndpoint: XRPCEndpoint<RecordViewInput, RecordViewResponse> = {
  method: 'pub.chive.metrics.recordView' as never,
  type: 'procedure',
  description: 'Record a view event for an eprint',
  inputSchema: recordViewInputSchema,
  outputSchema: recordViewResponseSchema,
  handler: recordViewHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
