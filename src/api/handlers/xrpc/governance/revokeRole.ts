/**
 * XRPC handler for pub.chive.governance.revokeRole.
 *
 * @remarks
 * Revokes a user's governance role. Only accessible to administrators.
 * Also revokes any active delegation.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/revokeRole.js';
import type { DID } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.revokeRole.
 *
 * @public
 */
export const revokeRole: XRPCMethod<void, InputSchema, OutputSchema> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');

    // Check auth first for better error messages
    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input) {
      throw new Error('Input required');
    }

    const trustedEditorService = c.get('services').trustedEditor;
    if (!trustedEditorService) {
      throw new Error('Trusted editor service not configured');
    }

    const adminDid = user.did;

    // Check if caller is administrator
    const callerStatusResult = await trustedEditorService.getEditorStatus(adminDid);
    if (!callerStatusResult.ok || callerStatusResult.value.role !== 'administrator') {
      throw new AuthorizationError('Administrator access required');
    }

    // Cannot revoke own role
    if (input.did === adminDid) {
      throw new ValidationError('Cannot revoke your own role');
    }

    logger.debug('Revoking role', {
      adminDid,
      targetDid: input.did,
      reason: input.reason,
    });

    // Get target user status
    const targetStatusResult = await trustedEditorService.getEditorStatus(input.did as DID);
    if (!targetStatusResult.ok) {
      return {
        encoding: 'application/json',
        body: {
          success: false,
          message: 'User not found',
        },
      };
    }

    const targetStatus = targetStatusResult.value;

    if (targetStatus.role === 'community-member') {
      return {
        encoding: 'application/json',
        body: {
          success: false,
          message: 'User does not have a special role to revoke',
        },
      };
    }

    // Revoke role
    const result = await trustedEditorService.revokeRole(input.did as DID, adminDid, input.reason);

    if (result.ok) {
      logger.info('Role revoked', {
        targetDid: input.did,
        previousRole: targetStatus.role,
        revokedBy: adminDid,
        reason: input.reason,
      });

      return {
        encoding: 'application/json',
        body: {
          success: true,
          message: 'Role revoked successfully. User is now a community member.',
        },
      };
    } else {
      logger.error('Failed to revoke role', result.error, {
        targetDid: input.did,
      });

      return {
        encoding: 'application/json',
        body: {
          success: false,
          message: `Failed to revoke role: ${result.error.message}`,
        },
      };
    }
  },
};
