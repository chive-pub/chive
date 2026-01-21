/**
 * XRPC handler for pub.chive.sync.refreshRecord.
 *
 * @remarks
 * Refreshes a record from PDS, re-indexing if changed.
 * Admin-only endpoint.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/sync/refreshRecord.js';
import type { AtUri } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
} from '../../../../types/errors.js';
import { isErr, isOk } from '../../../../types/result.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.sync.refreshRecord.
 *
 * @public
 */
export const refreshRecord: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { pdsSync } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!user.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!input) {
      throw new AuthenticationError('Input required');
    }

    logger.info('Refreshing record from PDS', { uri: input.uri });

    const result = await pdsSync.refreshRecord(input.uri as AtUri);

    if (isErr(result)) {
      const refreshError = result.error;
      if (refreshError instanceof NotFoundError) {
        throw refreshError;
      }
      throw new DatabaseError('QUERY', refreshError.message);
    }

    if (!isOk(result)) {
      throw new DatabaseError('QUERY', 'Unexpected result state');
    }

    const body: OutputSchema = {
      uri: input.uri,
      refreshed: result.value.refreshed,
      newCid: result.value.currentCID,
      error: result.value.error?.message,
    };

    return { encoding: 'application/json', body };
  },
};
