/**
 * Handler for pub.chive.sync.checkStaleness.
 *
 * @remarks
 * Checks if a record's index is stale compared to PDS.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  checkStalenessParamsSchema,
  stalenessCheckResultSchema,
  type CheckStalenessParams,
  type StalenessCheckResult,
} from '../../../schemas/sync.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.sync.checkStaleness.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Staleness check result
 *
 * @public
 */
export async function checkStalenessHandler(
  c: Context<ChiveEnv>,
  params: CheckStalenessParams
): Promise<StalenessCheckResult> {
  const logger = c.get('logger');
  const { pdsSync } = c.get('services');

  logger.debug('Checking staleness', { uri: params.uri });

  const result = await pdsSync.checkStaleness(params.uri as AtUri);

  return {
    uri: result.uri,
    isStale: result.isStale,
    indexedCID: result.indexedCID,
    pdsCID: result.pdsCID,
    error: result.error?.message,
  };
}

/**
 * Endpoint definition for pub.chive.sync.checkStaleness.
 *
 * @public
 */
export const checkStalenessEndpoint: XRPCEndpoint<CheckStalenessParams, StalenessCheckResult> = {
  method: 'pub.chive.sync.checkStaleness' as never,
  type: 'query',
  description: 'Check if a record is stale',
  inputSchema: checkStalenessParamsSchema,
  outputSchema: stalenessCheckResultSchema,
  handler: checkStalenessHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
