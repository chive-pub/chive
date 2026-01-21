/**
 * XRPC handler for pub.chive.sync.verify.
 *
 * @remarks
 * Verifies the sync state of a record.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/sync/verify.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.sync.verify.
 *
 * @public
 */
export const verify: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { pdsSync, eprint } = c.get('services');

    logger.debug('Verifying sync state', { uri: params.uri });

    // Get the indexed eprint
    const indexed = await eprint.getEprint(params.uri as AtUri);

    if (!indexed) {
      const body: OutputSchema = {
        uri: params.uri,
        indexed: false,
        inSync: false,
      };
      return { encoding: 'application/json', body };
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

    const body: OutputSchema = {
      uri: params.uri,
      indexed: true,
      inSync: !stalenessResult.isStale,
      indexedAt:
        indexed.indexedAt instanceof Date ? indexed.indexedAt.toISOString() : indexed.indexedAt,
      lastSyncedAt:
        indexed.indexedAt instanceof Date ? indexed.indexedAt.toISOString() : indexed.indexedAt,
      staleDays,
    };

    return { encoding: 'application/json', body };
  },
};
