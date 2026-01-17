/**
 * Authorization service using Casbin policy engine.
 *
 * @remarks
 * Implements role-based access control with:
 * - Hierarchical roles (admin > moderator > author > reader)
 * - Resource ownership checks
 * - Scope-based permissions for OAuth
 *
 * @packageDocumentation
 * @public
 */

import { newEnforcer, newModelFromString, StringAdapter } from 'casbin';
import type { Enforcer } from 'casbin';
import type { Redis } from 'ioredis';

import type { DID } from '../../types/atproto.js';
import type {
  IAuthorizationService,
  AuthorizationRequest,
  AuthorizationResult,
  Role,
  Permission,
  RoleAssignment,
} from '../../types/interfaces/authorization.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Authorization service configuration.
 *
 * @public
 */
export interface AuthorizationServiceConfig {
  /**
   * Redis key prefix for role storage.
   *
   * @defaultValue 'chive:authz:roles:'
   */
  readonly rolePrefix?: string;

  /**
   * Redis key prefix for role assignments metadata.
   *
   * @defaultValue 'chive:authz:assignments:'
   */
  readonly assignmentPrefix?: string;

  /**
   * Enable caching of role lookups.
   *
   * @defaultValue true
   */
  readonly enableCache?: boolean;

  /**
   * Cache TTL in seconds.
   *
   * @defaultValue 300
   */
  readonly cacheTtlSeconds?: number;
}

/**
 * Authorization service options.
 *
 * @public
 */
export interface AuthorizationServiceOptions {
  /**
   * Redis client for role storage.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config?: AuthorizationServiceConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<AuthorizationServiceConfig> = {
  rolePrefix: 'chive:authz:roles:',
  assignmentPrefix: 'chive:authz:assignments:',
  enableCache: true,
  cacheTtlSeconds: 300,
};

/**
 * Role hierarchy for permission inheritance.
 */
const ROLE_HIERARCHY: Record<Role, readonly Role[]> = {
  admin: ['admin', 'moderator', 'graph-editor', 'author', 'reader', 'alpha-tester'],
  moderator: ['moderator', 'graph-editor', 'author', 'reader'],
  'graph-editor': ['graph-editor', 'author', 'reader'],
  author: ['author', 'reader'],
  reader: ['reader'],
  'alpha-tester': ['alpha-tester', 'author', 'reader'],
};

/**
 * Default permissions per role.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    'eprint:*',
    'review:*',
    'endorsement:*',
    'field_node:*',
    'authority:*',
    'facet:*',
    'tag:*',
    'user:*',
    'plugin:*',
    'oauth_client:*',
  ],
  moderator: [
    'eprint:read',
    'eprint:moderate',
    'review:read',
    'review:moderate',
    'endorsement:read',
    'endorsement:moderate',
    'tag:read',
    'tag:moderate',
    'field_node:read',
    'user:read',
  ],
  'graph-editor': [
    'field_node:read',
    'field_node:create',
    'field_node:update',
    'field_node:approve',
    'authority:read',
    'authority:create',
    'authority:update',
    'authority:approve',
    'facet:read',
    'facet:create',
    'facet:update',
  ],
  author: [
    'eprint:read',
    'eprint:create',
    'review:read',
    'review:create',
    'endorsement:read',
    'endorsement:create',
    'tag:read',
    'tag:create',
    'field_node:read',
    'authority:read',
    'facet:read',
  ],
  reader: [
    'eprint:read',
    'review:read',
    'endorsement:read',
    'tag:read',
    'field_node:read',
    'authority:read',
    'facet:read',
    'user:read',
  ],
  'alpha-tester': [
    'eprint:read',
    'eprint:create',
    'eprint:update',
    'review:read',
    'review:create',
    'endorsement:read',
    'endorsement:create',
    'tag:read',
    'tag:create',
    'field_node:read',
    'authority:read',
    'facet:read',
    'user:read',
    'user:update',
  ],
};

/**
 * Casbin model definition.
 */
const CASBIN_MODEL = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && (p.obj == r.obj || p.obj == "*") && (p.act == r.act || p.act == "*")
`;

/**
 * Authorization service implementation using Casbin.
 *
 * @remarks
 * Provides RBAC with role hierarchy and resource ownership checks.
 * Roles are stored in Redis for scalability.
 *
 * @example
 * ```typescript
 * const authzService = new AuthorizationService({
 *   redis,
 *   logger,
 * });
 *
 * await authzService.initialize();
 *
 * const result = await authzService.authorize({
 *   subject: { did: 'did:plc:abc123', roles: ['author'] },
 *   action: 'create',
 *   resource: { type: 'eprint' },
 * });
 * ```
 *
 * @public
 */
export class AuthorizationService implements IAuthorizationService {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<AuthorizationServiceConfig>;
  private enforcer: Enforcer | null = null;
  private readonly roleCache = new Map<string, { roles: Role[]; expiresAt: number }>();

  /**
   * Creates a new AuthorizationService.
   *
   * @param options - Service options
   */
  constructor(options: AuthorizationServiceOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Initializes the Casbin enforcer.
   *
   * @remarks
   * Must be called before using authorization methods.
   */
  async initialize(): Promise<void> {
    const model = newModelFromString(CASBIN_MODEL);
    const policies = this.generatePolicies();
    const adapter = new StringAdapter(policies);

    this.enforcer = await newEnforcer(model, adapter);

    this.logger.info('Authorization service initialized');
  }

  /**
   * Checks if subject is authorized for action on resource.
   *
   * @param request - Authorization request
   * @returns Authorization decision
   */
  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const { subject, action, resource } = request;

    // Resource ownership check: owners can always manage their resources
    if (resource.ownerDid && subject.did === resource.ownerDid) {
      const ownerActions = ['read', 'update', 'delete'];
      if (ownerActions.includes(action)) {
        return {
          allowed: true,
          reason: 'resource_owner',
        };
      }
    }

    // Get effective roles (stored + hierarchy)
    const userRoles = await this.getRoles(subject.did);
    const effectiveRoles = this.getEffectiveRoles([...subject.roles, ...userRoles]);

    // Check if any role grants the permission
    for (const role of effectiveRoles) {
      const hasPermission = this.checkRolePermission(role, resource.type, action);
      if (hasPermission) {
        return {
          allowed: true,
          reason: 'role_permission',
        };
      }
    }

    // Check OAuth scopes if present
    if (subject.scopes && subject.scopes.length > 0) {
      const requiredScope = `${resource.type}:${action}`;
      const wildcardScope = `${resource.type}:*`;

      if (subject.scopes.includes(requiredScope) || subject.scopes.includes(wildcardScope)) {
        return {
          allowed: true,
          reason: 'oauth_scope',
        };
      }
    }

    // Determine required roles for this action
    const requiredRoles = this.getRolesWithPermission(resource.type, action);

    return {
      allowed: false,
      reason: 'insufficient_permissions',
      requiredRoles,
      requiredScopes: [`${resource.type}:${action}`],
    };
  }

  /**
   * Assigns a role to a user.
   *
   * @param did - User's DID
   * @param role - Role to assign
   * @param assignedBy - Assigning user's DID
   */
  async assignRole(did: DID, role: Role, assignedBy?: DID): Promise<void> {
    const roleKey = `${this.config.rolePrefix}${did}`;
    const assignmentKey = `${this.config.assignmentPrefix}${did}:${role}`;

    // Add role to user's role set
    await this.redis.sadd(roleKey, role);

    // Store assignment metadata
    const assignment: Omit<RoleAssignment, 'did'> = {
      role,
      assignedAt: new Date(),
      assignedBy,
    };

    await this.redis.set(assignmentKey, JSON.stringify(assignment));

    // Invalidate cache
    this.roleCache.delete(did);

    this.logger.info('Role assigned', { did, role, assignedBy });
  }

  /**
   * Revokes a role from a user.
   *
   * @param did - User's DID
   * @param role - Role to revoke
   */
  async revokeRole(did: DID, role: Role): Promise<void> {
    const roleKey = `${this.config.rolePrefix}${did}`;
    const assignmentKey = `${this.config.assignmentPrefix}${did}:${role}`;

    await this.redis.srem(roleKey, role);
    await this.redis.del(assignmentKey);

    // Invalidate cache
    this.roleCache.delete(did);

    this.logger.info('Role revoked', { did, role });
  }

  /**
   * Gets all roles assigned to a user.
   *
   * @param did - User's DID
   * @returns Array of roles
   */
  async getRoles(did: DID): Promise<readonly Role[]> {
    // Check cache first
    if (this.config.enableCache) {
      const cached = this.roleCache.get(did);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.roles;
      }
    }

    const roleKey = `${this.config.rolePrefix}${did}`;
    const roles = (await this.redis.smembers(roleKey)) as Role[];

    // Update cache
    if (this.config.enableCache) {
      this.roleCache.set(did, {
        roles,
        expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
      });
    }

    return roles;
  }

  /**
   * Gets role assignments with metadata.
   *
   * @param did - User's DID
   * @returns Array of role assignments
   */
  async getRoleAssignments(did: DID): Promise<readonly RoleAssignment[]> {
    const roles = await this.getRoles(did);
    const assignments: RoleAssignment[] = [];

    for (const role of roles) {
      const assignmentKey = `${this.config.assignmentPrefix}${did}:${role}`;
      const data = await this.redis.get(assignmentKey);

      if (data) {
        const stored = JSON.parse(data) as {
          assignedAt: string;
          assignedBy?: string;
          expiresAt?: string;
        };

        assignments.push({
          did,
          role,
          assignedAt: new Date(stored.assignedAt),
          assignedBy: stored.assignedBy as DID | undefined,
          expiresAt: stored.expiresAt ? new Date(stored.expiresAt) : undefined,
        });
      } else {
        // Role exists but no metadata; create minimal assignment
        assignments.push({
          did,
          role,
          assignedAt: new Date(),
        });
      }
    }

    return assignments;
  }

  /**
   * Checks if user has a specific permission.
   *
   * @param did - User's DID
   * @param permission - Permission to check
   * @returns True if permission granted
   */
  async hasPermission(did: DID, permission: Permission): Promise<boolean> {
    const [resource, action] = permission.split(':') as [string, string];
    const roles = await this.getRoles(did);
    const effectiveRoles = this.getEffectiveRoles(roles);

    for (const role of effectiveRoles) {
      const hasPermission = this.checkRolePermission(role, resource, action);
      if (hasPermission) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets all permissions for a role.
   *
   * @param role - Role to query
   * @returns Array of permissions
   */
  getPermissionsForRole(role: Role): Promise<readonly Permission[]> {
    return Promise.resolve(ROLE_PERMISSIONS[role] ?? []);
  }

  /**
   * Checks if user has any of the specified roles.
   *
   * @param did - User's DID
   * @param roles - Roles to check
   * @returns True if user has at least one role
   */
  async hasAnyRole(did: DID, roles: readonly Role[]): Promise<boolean> {
    const userRoles = await this.getRoles(did);
    return roles.some((role) => userRoles.includes(role));
  }

  /**
   * Reloads policies from storage.
   */
  async reloadPolicies(): Promise<void> {
    if (this.enforcer) {
      const policies = this.generatePolicies();
      const adapter = new StringAdapter(policies);
      this.enforcer.setAdapter(adapter);
      await this.enforcer.loadPolicy();
    }

    // Clear cache
    this.roleCache.clear();

    this.logger.info('Policies reloaded');
  }

  /**
   * Gets effective roles including inherited roles.
   *
   * @param roles - Base roles
   * @returns All effective roles
   */
  private getEffectiveRoles(roles: readonly Role[]): Role[] {
    const effective = new Set<Role>();

    for (const role of roles) {
      const inherited = ROLE_HIERARCHY[role] ?? [role];
      for (const r of inherited) {
        effective.add(r);
      }
    }

    return Array.from(effective);
  }

  /**
   * Checks if a role has a specific permission.
   *
   * @param role - Role to check
   * @param resource - Resource type
   * @param action - Action
   * @returns True if role has permission
   */
  private checkRolePermission(role: Role, resource: string, action: string): boolean {
    const permissions = ROLE_PERMISSIONS[role] ?? [];

    for (const perm of permissions) {
      const [permResource, permAction] = perm.split(':');

      // Check for exact match or wildcard
      const resourceMatch = permResource === resource || permResource === '*';
      const actionMatch = permAction === action || permAction === '*';

      if (resourceMatch && actionMatch) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets roles that have a specific permission.
   *
   * @param resource - Resource type
   * @param action - Action
   * @returns Array of roles with permission
   */
  private getRolesWithPermission(resource: string, action: string): Role[] {
    const roles: Role[] = [];
    const allRoles: Role[] = [
      'admin',
      'moderator',
      'graph-editor',
      'author',
      'reader',
      'alpha-tester',
    ];

    for (const role of allRoles) {
      const permissions = ROLE_PERMISSIONS[role] ?? [];
      for (const perm of permissions) {
        const [permResource, permAction] = perm.split(':');
        const resourceMatch = permResource === resource || permResource === '*';
        const actionMatch = permAction === action || permAction === '*';

        if (resourceMatch && actionMatch) {
          roles.push(role);
          break;
        }
      }
    }

    return roles;
  }

  /**
   * Generates Casbin policy string.
   *
   * @returns Policy CSV string
   */
  private generatePolicies(): string {
    const policies: string[] = [];

    // Generate role-permission policies
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      for (const perm of permissions) {
        const [resource, action] = perm.split(':');
        policies.push(`p, ${role}, ${resource}, ${action}`);
      }
    }

    // Generate role hierarchy
    policies.push('g, admin, moderator');
    policies.push('g, moderator, graph-editor');
    policies.push('g, graph-editor, author');
    policies.push('g, author, reader');

    return policies.join('\n');
  }
}
