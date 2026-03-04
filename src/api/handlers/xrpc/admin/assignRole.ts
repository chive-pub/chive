/**
 * XRPC handler for pub.chive.admin.assignRole.
 *
 * @remarks
 * Assigns a role to a user via the authorization service.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { adminMetrics } from '../../../../observability/prometheus-registry.js';
import { AuthorizationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface AssignRoleInput {
  readonly did: string;
  readonly role: string;
}

interface AssignRoleOutput {
  readonly success: boolean;
  readonly did: string;
  readonly role: string;
}

const VALID_ROLES: readonly string[] = [
  'admin',
  'moderator',
  'graph-editor',
  'author',
  'reader',
  'alpha-tester',
  'premium',
];

export const assignRole: XRPCMethod<void, AssignRoleInput, AssignRoleOutput> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<AssignRoleOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!input?.did || !input.role) {
      throw new ValidationError('DID and role are required', 'input', 'required');
    }

    if (!VALID_ROLES.includes(input.role)) {
      throw new ValidationError(
        `Invalid role: ${input.role}. Valid roles: ${VALID_ROLES.join(', ')}`,
        'role',
        'enum'
      );
    }

    const redis = c.get('redis');
    const roleKey = `chive:authz:roles:${input.did}`;
    await redis.sadd(roleKey, input.role);

    // Store assignment metadata
    const assignmentKey = `chive:authz:assignments:${input.did}:${input.role}`;
    await redis.set(
      assignmentKey,
      JSON.stringify({
        role: input.role,
        assignedAt: new Date().toISOString(),
        assignedBy: user.did,
      })
    );

    adminMetrics.actionsTotal.inc({ action: 'assign_role', target: 'user' });

    const logger = c.get('logger');
    logger.info('Role assigned via admin dashboard', {
      targetDid: input.did,
      role: input.role,
      assignedBy: user.did,
    });

    return {
      encoding: 'application/json',
      body: { success: true, did: input.did, role: input.role },
    };
  },
};
