/**
 * Handler for pub.chive.metrics.recordDownload.
 *
 * @remarks
 * Records a download event for a preprint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import type { AtUri, DID } from '../../../../types/atproto.js';
import { DatabaseError } from '../../../../types/errors.js';
import { recordDownloadInputSchema, type RecordDownloadInput } from '../../../schemas/metrics.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Response schema for record download.
 */
const recordDownloadResponseSchema = z.object({
  success: z.boolean(),
});

type RecordDownloadResponse = z.infer<typeof recordDownloadResponseSchema>;

/**
 * Handler for pub.chive.metrics.recordDownload.
 *
 * @param c - Hono context
 * @param input - Download event data
 * @returns Success indicator
 *
 * @throws {DatabaseError} When recording fails
 *
 * @public
 */
export async function recordDownloadHandler(
  c: Context<ChiveEnv>,
  input: RecordDownloadInput
): Promise<RecordDownloadResponse> {
  const logger = c.get('logger');
  const { metrics } = c.get('services');

  logger.debug('Recording download', { uri: input.uri, viewerDid: input.viewerDid });

  const result = await metrics.recordDownload(
    input.uri as AtUri,
    input.viewerDid as DID | undefined
  );

  if (!result.ok) {
    throw new DatabaseError('WRITE', result.error.message);
  }

  return { success: true };
}

/**
 * Endpoint definition for pub.chive.metrics.recordDownload.
 *
 * @public
 */
export const recordDownloadEndpoint: XRPCEndpoint<RecordDownloadInput, RecordDownloadResponse> = {
  method: 'pub.chive.metrics.recordDownload' as never,
  type: 'procedure',
  description: 'Record a download event for a preprint',
  inputSchema: recordDownloadInputSchema,
  outputSchema: recordDownloadResponseSchema,
  handler: recordDownloadHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
