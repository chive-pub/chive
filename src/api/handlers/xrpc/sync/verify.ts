/**
 * Handler for pub.chive.sync.verify.
 *
 * @remarks
 * Verifies the sync state of a record.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  verifySyncParamsSchema,
  verifySyncResponseSchema,
  type VerifySyncParams,
  type VerifySyncResponse,
} from '../../../schemas/sync.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.sync.verify.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Sync verification result
 *
 * @public
 */
export async function verifySyncHandler(
  c: Context<ChiveEnv>,
  params: VerifySyncParams
): Promise<VerifySyncResponse> {
  const logger = c.get('logger');
  const { pdsSync, eprint } = c.get('services');

  logger.debug('Verifying sync state', { uri: params.uri });

  // Get the indexed eprint
  const indexed = await eprint.getEprint(params.uri as AtUri);

  if (!indexed) {
    return {
      uri: params.uri,
      indexed: false,
      inSync: false,
    };
  }

  // Check staleness
  const stalenessResult = await pdsSync.checkStaleness(params.uri as AtUri);

  // Calculate stale days if applicable
  let staleDays: number | undefined;
  if (indexed.indexedAt) {
    const now = Date.now();
    const indexedTime = new Date(indexed.indexedAt).getTime();
    const daysSinceIndexed = Math.floor((now - indexedTime) / (1000 * 60 * 60 * 24));
    if (daysSinceIndexed > 7) {
      staleDays = daysSinceIndexed;
    }
  }

  return {
    uri: params.uri,
    indexed: true,
    inSync: !stalenessResult.isStale,
    indexedAt:
      indexed.indexedAt instanceof Date ? indexed.indexedAt.toISOString() : indexed.indexedAt,
    lastSyncedAt:
      indexed.indexedAt instanceof Date ? indexed.indexedAt.toISOString() : indexed.indexedAt,
    staleDays,
  };
}

/**
 * Endpoint definition for pub.chive.sync.verify.
 *
 * @public
 */
export const verifySyncEndpoint: XRPCEndpoint<VerifySyncParams, VerifySyncResponse> = {
  method: 'pub.chive.sync.verify' as never,
  type: 'query',
  description: 'Verify sync state of a record',
  inputSchema: verifySyncParamsSchema,
  outputSchema: verifySyncResponseSchema,
  handler: verifySyncHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
