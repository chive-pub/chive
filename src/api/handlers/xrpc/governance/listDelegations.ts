/**
 * XRPC handler for pub.chive.governance.listDelegations.
 *
 * @remarks
 * Lists active PDS delegations.
 * Only accessible by administrators.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import {
  listTrustedEditorsParamsSchema,
  delegationsResponseSchema,
  type ListTrustedEditorsParams,
  type DelegationsResponse,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.listDelegations query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns List of active delegations
 *
 * @public
 */
export async function listDelegationsHandler(
  c: Context<ChiveEnv>,
  params: ListTrustedEditorsParams
): Promise<DelegationsResponse> {
  const logger = c.get('logger');
  const user = c.get('user');

  if (!user?.did) {
    throw new AuthenticationError('Authentication required');
  }

  // Check if user is admin
  const trustedEditorService = c.get('services').trustedEditor;
  if (!trustedEditorService) {
    throw new Error('Trusted editor service not configured');
  }

  const statusResult = await trustedEditorService.getEditorStatus(user.did);
  if (!statusResult.ok || statusResult.value.role !== 'administrator') {
    throw new AuthorizationError('Administrator access required');
  }

  const limit = params.limit ?? 20;

  logger.debug('Listing delegations', { limit, cursor: params.cursor });

  // Use service method to list delegations
  const result = await trustedEditorService.listDelegations(limit, params.cursor);

  if (!result.ok) {
    throw new Error(`Failed to list delegations: ${result.error.message}`);
  }

  logger.info('Delegations listed', {
    count: result.value.delegations.length,
    total: result.value.total,
  });

  return {
    delegations: result.value.delegations.map((del) => ({
      id: del.id,
      delegateDid: del.delegateDid,
      handle: del.handle,
      displayName: del.displayName,
      collections: del.collections,
      expiresAt: del.expiresAt,
      maxRecordsPerDay: del.maxRecordsPerDay,
      recordsCreatedToday: del.recordsCreatedToday,
      grantedAt: del.grantedAt,
      grantedBy: del.grantedBy,
      active: del.active,
    })),
    cursor: result.value.cursor,
    total: result.value.total,
  };
}

/**
 * Endpoint definition for pub.chive.governance.listDelegations.
 *
 * @public
 */
export const listDelegationsEndpoint: XRPCEndpoint<ListTrustedEditorsParams, DelegationsResponse> =
  {
    method: 'pub.chive.governance.listDelegations' as never,
    type: 'query',
    description: 'List active PDS delegations (admin only)',
    inputSchema: listTrustedEditorsParamsSchema,
    outputSchema: delegationsResponseSchema,
    handler: listDelegationsHandler,
    auth: 'required',
    rateLimit: 'authenticated',
  };
