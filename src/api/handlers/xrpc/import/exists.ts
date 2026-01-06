/**
 * Handler for pub.chive.import.exists.
 *
 * @remarks
 * Checks if a preprint has been imported.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  importExistsParamsSchema,
  importExistsResponseSchema,
  type ImportExistsParams,
  type ImportExistsResponse,
} from '../../../schemas/import.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.import.exists.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Whether the import exists
 *
 * @public
 */
export async function importExistsHandler(
  c: Context<ChiveEnv>,
  params: ImportExistsParams
): Promise<ImportExistsResponse> {
  const logger = c.get('logger');
  const { import: importService } = c.get('services');

  logger.debug('Checking import exists', { source: params.source, externalId: params.externalId });

  const exists = await importService.exists(params.source, params.externalId);

  return { exists };
}

/**
 * Endpoint definition for pub.chive.import.exists.
 *
 * @public
 */
export const importExistsEndpoint: XRPCEndpoint<ImportExistsParams, ImportExistsResponse> = {
  method: 'pub.chive.import.exists' as never,
  type: 'query',
  description: 'Check if a preprint has been imported',
  inputSchema: importExistsParamsSchema,
  outputSchema: importExistsResponseSchema,
  handler: importExistsHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
