/**
 * XRPC handler for pub.chive.admin.assignRole.
 *
 * @remarks
 * Assigns a platform role to a user via the authorization service.
 * Requires admin authentication. Governance roles are rejected here; they are
 * granted through the pub.chive.governance.* endpoints.
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

/**
 * Roles this endpoint can grant.
 *
 * @remarks
 * These are the platform roles held in Redis and read back by the
 * authentication middleware. Governance roles are deliberately absent: they
 * live in the `governance_roles` table and are granted through the governance
 * endpoints, so writing one here would report success while changing nothing
 * the governance code reads.
 */
const VALID_ROLES: readonly string[] = [
  'admin',
  'moderator',
  'author',
  'reader',
  'alpha-tester',
  'premium',
];

/**
 * Roles that only the governance endpoints can grant.
 *
 * @remarks
 * Listed separately from the generic invalid-role case so the caller is told
 * which endpoint actually grants the role rather than that it does not exist.
 * `graph-editor` overlaps the platform role vocabulary, which is what made the
 * silent no-op easy to hit.
 */
const GOVERNANCE_ROLES: readonly string[] = [
  'community-member',
  'trusted-editor',
  'graph-editor',
  'domain-expert',
  'administrator',
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

    if (GOVERNANCE_ROLES.includes(input.role)) {
      throw new ValidationError(
        `Role ${input.role} is a governance role and cannot be assigned here; grant it with pub.chive.governance.approveElevation`,
        'role',
        'governance-role'
      );
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

    // Record it where the audit log can see it. Writing the assignment to
    // Redis alone meant `pub.chive.admin.getAuditLog` could not show role
    // grants — one of the two actions an admin audit log exists for.
    const admin = c.get('services').admin;
    if (admin) {
      await admin.recordAuditEntry({
        action: 'assign_role',
        collection: 'chive.admin.role',
        uri: `did:role:${input.did}:${input.role}`,
        actorDid: user.did,
        targetDid: input.did,
        ipAddress: c.req.header('x-forwarded-for'),
        details: { role: input.role },
      });
    }

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
