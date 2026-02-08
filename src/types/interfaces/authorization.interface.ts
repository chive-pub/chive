/**
 * Authorization service interfaces for role-based access control.
 *
 * @remarks
 * Provides type definitions for authorization including:
 * - Role-based access control (RBAC)
 * - Resource-based permissions
 * - Scope enforcement
 *
 * Uses Casbin policy engine for flexible policy evaluation.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, DID } from '../atproto.js';

/**
 * System roles with hierarchical permissions.
 *
 * @remarks
 * Role hierarchy (higher includes lower permissions):
 * - admin > moderator > graph-editor > author > reader
 *
 * @public
 */
export type Role =
  | 'admin'
  | 'moderator'
  | 'graph-editor'
  | 'author'
  | 'reader'
  | 'alpha-tester'
  | 'premium';

/**
 * Resource types for authorization.
 *
 * @public
 */
export type ResourceType =
  | 'eprint'
  | 'review'
  | 'endorsement'
  | 'field_node'
  | 'authority'
  | 'facet'
  | 'tag'
  | 'user'
  | 'plugin'
  | 'oauth_client';

/**
 * Actions that can be performed on resources.
 *
 * @public
 */
export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'moderate'
  | 'approve'
  | 'reject'
  | 'admin';

/**
 * Permission string format.
 *
 * @remarks
 * Format: `{resource}:{action}` or `{resource}:*` for all actions.
 *
 * @example "eprint:read", "review:create", "authority:approve"
 *
 * @public
 */
export type Permission = `${ResourceType}:${Action}` | `${ResourceType}:*`;

/**
 * Subject identity for authorization.
 *
 * @public
 */
export interface SubjectIdentity {
  /**
   * User's DID.
   */
  readonly did: DID;

  /**
   * User's assigned roles.
   */
  readonly roles: readonly Role[];

  /**
   * OAuth scopes (if authenticated via OAuth).
   */
  readonly scopes?: readonly string[];
}

/**
 * Resource identifier for authorization.
 *
 * @public
 */
export interface ResourceIdentifier {
  /**
   * Resource type.
   */
  readonly type: ResourceType;

  /**
   * Resource AT URI (if applicable).
   */
  readonly uri?: AtUri;

  /**
   * Resource owner's DID (for ownership checks).
   */
  readonly ownerDid?: DID;

  /**
   * Resource visibility.
   *
   * @remarks
   * Private resources require explicit permission.
   */
  readonly visibility?: 'public' | 'private';
}

/**
 * Authorization request context.
 *
 * @remarks
 * Additional context for policy evaluation.
 *
 * @public
 */
export interface AuthorizationContext {
  /**
   * Client IP address.
   */
  readonly ipAddress?: string;

  /**
   * Request timestamp.
   */
  readonly timestamp?: Date;

  /**
   * Request path.
   */
  readonly path?: string;

  /**
   * Additional context attributes.
   */
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/**
 * Authorization request.
 *
 * @public
 */
export interface AuthorizationRequest {
  /**
   * Subject attempting the action.
   */
  readonly subject: SubjectIdentity;

  /**
   * Action being attempted.
   */
  readonly action: Action;

  /**
   * Resource being accessed.
   */
  readonly resource: ResourceIdentifier;

  /**
   * Additional context.
   */
  readonly context?: AuthorizationContext;
}

/**
 * Authorization result.
 *
 * @public
 */
export interface AuthorizationResult {
  /**
   * Whether the action is allowed.
   */
  readonly allowed: boolean;

  /**
   * Reason for the decision.
   *
   * @remarks
   * Useful for debugging and audit logging.
   *
   * @example "role_permission", "resource_owner", "scope_missing"
   */
  readonly reason?: string;

  /**
   * Roles that would grant access (if denied).
   */
  readonly requiredRoles?: readonly Role[];

  /**
   * Scopes that would grant access (if denied).
   */
  readonly requiredScopes?: readonly string[];
}

/**
 * Role assignment record.
 *
 * @public
 */
export interface RoleAssignment {
  /**
   * User's DID.
   */
  readonly did: DID;

  /**
   * Assigned role.
   */
  readonly role: Role;

  /**
   * Assignment timestamp.
   */
  readonly assignedAt: Date;

  /**
   * DID of user who assigned the role.
   */
  readonly assignedBy?: DID;

  /**
   * Optional expiration.
   */
  readonly expiresAt?: Date;
}

/**
 * Authorization service interface.
 *
 * @remarks
 * Provides role-based access control using Casbin policy engine.
 * Supports resource ownership checks and scope-based permissions.
 *
 * @example
 * ```typescript
 * const authzService = container.resolve<IAuthorizationService>('IAuthorizationService');
 *
 * const result = await authzService.authorize({
 *   subject: { did, roles: ['author'] },
 *   action: 'update',
 *   resource: {
 *     type: 'eprint',
 *     uri: eprintUri,
 *     ownerDid: did,
 *   },
 * });
 *
 * if (!result.allowed) {
 *   throw new AuthorizationError(result.reason ?? 'Access denied');
 * }
 * ```
 *
 * @public
 */
export interface IAuthorizationService {
  /**
   * Check if subject is authorized to perform action on resource.
   *
   * @param request - Authorization request
   * @returns Authorization decision
   *
   * @public
   */
  authorize(request: AuthorizationRequest): Promise<AuthorizationResult>;

  /**
   * Assign role to user.
   *
   * @remarks
   * Requires admin or appropriate moderator permissions.
   *
   * @param did - User's DID
   * @param role - Role to assign
   * @param assignedBy - DID of assigning user (for audit)
   *
   * @public
   */
  assignRole(did: DID, role: Role, assignedBy?: DID): Promise<void>;

  /**
   * Revoke role from user.
   *
   * @param did - User's DID
   * @param role - Role to revoke
   *
   * @public
   */
  revokeRole(did: DID, role: Role): Promise<void>;

  /**
   * Get all roles for user.
   *
   * @param did - User's DID
   * @returns Array of assigned roles
   *
   * @public
   */
  getRoles(did: DID): Promise<readonly Role[]>;

  /**
   * Get role assignments with metadata.
   *
   * @param did - User's DID
   * @returns Array of role assignments
   *
   * @public
   */
  getRoleAssignments(did: DID): Promise<readonly RoleAssignment[]>;

  /**
   * Check if user has specific permission.
   *
   * @remarks
   * Convenience method for checking a single permission.
   *
   * @param did - User's DID
   * @param permission - Permission string
   * @returns True if permission granted
   *
   * @public
   */
  hasPermission(did: DID, permission: Permission): Promise<boolean>;

  /**
   * Get all permissions for a role.
   *
   * @param role - Role to query
   * @returns Array of permissions
   *
   * @public
   */
  getPermissionsForRole(role: Role): Promise<readonly Permission[]>;

  /**
   * Check if user has any of the specified roles.
   *
   * @param did - User's DID
   * @param roles - Roles to check
   * @returns True if user has at least one role
   *
   * @public
   */
  hasAnyRole(did: DID, roles: readonly Role[]): Promise<boolean>;

  /**
   * Reload policies from storage.
   *
   * @remarks
   * Used when policies are updated externally.
   *
   * @public
   */
  reloadPolicies(): Promise<void>;
}
