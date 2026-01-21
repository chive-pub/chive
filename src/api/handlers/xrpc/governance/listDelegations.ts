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

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/listDelegations.js';
import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.listDelegations.
 *
 * @public
 */
export const listDelegations: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
      encoding: 'application/json',
      body: {
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
      },
    };
  },
};
