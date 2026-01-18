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

import type { Context } from 'hono';

import type { DID } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '../../../../types/errors.js';
import {
  revokeRoleInputSchema,
  elevationResultSchema,
  type RevokeRoleInput,
  type ElevationResult,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.revokeRole procedure.
 *
 * @param c - Hono context with Chive environment
 * @param input - Validated input
 * @returns Result of the role revocation
 *
 * @public
 */
export async function revokeRoleHandler(
  c: Context<ChiveEnv>,
  input: RevokeRoleInput
): Promise<ElevationResult> {
  const logger = c.get('logger');
  const user = c.get('user');

  // Check auth first for better error messages
  if (!user?.did) {
    throw new AuthenticationError('Authentication required');
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
      success: false,
      message: 'User not found',
    };
  }

  const targetStatus = targetStatusResult.value;

  if (targetStatus.role === 'community-member') {
    return {
      success: false,
      message: 'User does not have a special role to revoke',
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
      success: true,
      message: 'Role revoked successfully. User is now a community member.',
    };
  } else {
    logger.error('Failed to revoke role', result.error, {
      targetDid: input.did,
    });

    return {
      success: false,
      message: `Failed to revoke role: ${result.error.message}`,
    };
  }
}

/**
 * Endpoint definition for pub.chive.governance.revokeRole.
 *
 * @public
 */
export const revokeRoleEndpoint: XRPCEndpoint<RevokeRoleInput, ElevationResult> = {
  method: 'pub.chive.governance.revokeRole' as never,
  type: 'procedure',
  description: "Revoke a user's governance role (admin only)",
  inputSchema: revokeRoleInputSchema,
  outputSchema: elevationResultSchema,
  handler: revokeRoleHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
