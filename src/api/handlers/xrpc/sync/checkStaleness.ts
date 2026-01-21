/**
 * XRPC handler for pub.chive.sync.checkStaleness.
 *
 * @remarks
 * Checks if a record's index is stale compared to PDS.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/sync/checkStaleness.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.sync.checkStaleness.
 *
 * @public
 */
export const checkStaleness: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { pdsSync } = c.get('services');

    logger.debug('Checking staleness', { uri: params.uri });

    const result = await pdsSync.checkStaleness(params.uri as AtUri);

    const body: OutputSchema = {
      uri: result.uri,
      isStale: result.isStale,
      indexedCid: result.indexedCID,
      pdsCid: result.pdsCID,
    };

    return { encoding: 'application/json', body };
  },
};
