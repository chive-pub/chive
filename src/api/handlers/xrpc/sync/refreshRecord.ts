/**
 * Handler for pub.chive.sync.refreshRecord.
 *
 * @remarks
 * Refreshes a record from PDS, re-indexing if changed.
 * Admin-only endpoint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
} from '../../../../types/errors.js';
import {
  refreshRecordInputSchema,
  refreshResultSchema,
  type RefreshRecordInput,
  type RefreshResult,
} from '../../../schemas/sync.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.sync.refreshRecord.
 *
 * @param c - Hono context
 * @param input - Request input
 * @returns Refresh result
 *
 * @throws {NotFoundError} When record is not found
 * @throws {DatabaseError} When refresh fails
 *
 * @public
 */
export async function refreshRecordHandler(
  c: Context<ChiveEnv>,
  input: RefreshRecordInput
): Promise<RefreshResult> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { pdsSync } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (!user.isAdmin) {
    throw new AuthorizationError('Admin access required', 'admin');
  }

  logger.info('Refreshing record from PDS', { uri: input.uri });

  const result = await pdsSync.refreshRecord(input.uri as AtUri);

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      throw result.error;
    }
    throw new DatabaseError('QUERY', result.error.message);
  }

  return {
    refreshed: result.value.refreshed,
    changed: result.value.changed,
    previousCID: result.value.previousCID,
    currentCID: result.value.currentCID,
    error: result.value.error?.message,
  };
}

/**
 * Endpoint definition for pub.chive.sync.refreshRecord.
 *
 * @public
 */
export const refreshRecordEndpoint: XRPCEndpoint<RefreshRecordInput, RefreshResult> = {
  method: 'pub.chive.sync.refreshRecord' as never,
  type: 'procedure',
  description: 'Refresh a record from PDS (admin only)',
  inputSchema: refreshRecordInputSchema,
  outputSchema: refreshResultSchema,
  handler: refreshRecordHandler,
  auth: 'required',
  rateLimit: 'admin',
};
