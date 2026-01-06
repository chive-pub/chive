/**
 * Handler for pub.chive.metrics.recordSearchDownload.
 *
 * @remarks
 * Records a download event from a search result. This is a strong
 * positive relevance signal (Grade 4 in judgment list).
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import {
  recordSearchDownloadInputSchema,
  type RecordSearchDownloadInput,
} from '../../../schemas/metrics.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Response schema for record search download.
 */
const recordSearchDownloadResponseSchema = z.object({
  success: z.boolean(),
});

type RecordSearchDownloadResponse = z.infer<typeof recordSearchDownloadResponseSchema>;

/**
 * Handler for pub.chive.metrics.recordSearchDownload.
 *
 * @param c - Hono context
 * @param input - Download event data
 * @returns Success indicator
 *
 * @public
 */
export async function recordSearchDownloadHandler(
  c: Context<ChiveEnv>,
  input: RecordSearchDownloadInput
): Promise<RecordSearchDownloadResponse> {
  const logger = c.get('logger');
  const { relevanceLogger } = c.get('services');

  logger.debug('Recording search download', {
    impressionId: input.impressionId,
    uri: input.uri,
  });

  await relevanceLogger.logDownload(input.impressionId, input.uri);

  return { success: true };
}

/**
 * Endpoint definition for pub.chive.metrics.recordSearchDownload.
 *
 * @public
 */
export const recordSearchDownloadEndpoint: XRPCEndpoint<
  RecordSearchDownloadInput,
  RecordSearchDownloadResponse
> = {
  method: 'pub.chive.metrics.recordSearchDownload' as never,
  type: 'procedure',
  description: 'Record a download from a search result (strong relevance signal)',
  inputSchema: recordSearchDownloadInputSchema,
  outputSchema: recordSearchDownloadResponseSchema,
  handler: recordSearchDownloadHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
