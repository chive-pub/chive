/**
 * XRPC handler for pub.chive.admin.revokeRole.
 *
 * @remarks
 * Revokes a role from a user. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { adminMetrics } from '../../../../observability/prometheus-registry.js';
import { AuthorizationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface RevokeRoleInput {
  readonly did: string;
  readonly role: string;
}

interface RevokeRoleOutput {
  readonly success: boolean;
  readonly did: string;
  readonly role: string;
}

export const revokeRole: XRPCMethod<void, RevokeRoleInput, RevokeRoleOutput> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<RevokeRoleOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!input?.did || !input.role) {
      throw new ValidationError('DID and role are required', 'input', 'required');
    }

    const redis = c.get('redis');
    const roleKey = `chive:authz:roles:${input.did}`;
    await redis.srem(roleKey, input.role);

    // Remove assignment metadata
    const assignmentKey = `chive:authz:assignments:${input.did}:${input.role}`;
    await redis.del(assignmentKey);

    adminMetrics.actionsTotal.inc({ action: 'revoke_role', target: 'user' });

    const logger = c.get('logger');
    logger.info('Role revoked via admin dashboard', {
      targetDid: input.did,
      role: input.role,
      revokedBy: user.did,
    });

    return {
      encoding: 'application/json',
      body: { success: true, did: input.did, role: input.role },
    };
  },
};
