# Roles and access control

Chive uses a role-based access control (RBAC) system backed by Redis. Roles determine what features a user can access, including the admin dashboard.

## Role system overview

Roles are stored in Redis as sets keyed by DID:

```
chive:authz:roles:{did} -> SET { "admin", "alpha-tester", ... }
```

Each role assignment also stores metadata:

```
chive:authz:assignments:{did}:{role} -> JSON { role, assignedAt, assignedBy }
```

The auth middleware reads a user's roles from Redis on every authenticated request and sets boolean flags (`isAdmin`, `isAlphaTester`, `isPremium`) on the user context object.

## Available roles

| Role           | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `admin`        | Full access to the admin dashboard and all admin XRPC endpoints |
| `moderator`    | Knowledge graph governance and proposal review                  |
| `graph-editor` | Knowledge graph editing (node and edge proposals)               |
| `author`       | Eprint submission permissions                                   |
| `reader`       | Standard read access                                            |
| `alpha-tester` | Access to alpha features during the testing phase               |
| `premium`      | Premium tier features                                           |

Admin users implicitly have `alpha-tester` and `premium` access regardless of explicit role assignment. This is enforced in the `pub.chive.actor.getMyRoles` handler.

## Bootstrapping admin access

### ADMIN_DIDS environment variable

On server startup, Chive reads the `ADMIN_DIDS` environment variable (a comma-separated list of DIDs) and assigns the `admin` role to each DID via the authorization service. This is idempotent; Redis `SADD` is a no-op for existing set members.

```bash
ADMIN_DIDS="did:plc:abc123,did:plc:def456"
```

If `ADMIN_DIDS` is not set, the server uses a default DID (the project maintainer's DID).

### seed-admin script

For manual bootstrapping outside the server process (e.g., during initial deployment), run the seed script:

```bash
REDIS_URL="redis://localhost:6379" \
ADMIN_DIDS="did:plc:abc123,did:plc:def456" \
pnpm tsx scripts/seed-admin.ts
```

This script:

1. Connects to Redis at the specified URL
2. For each DID in `ADMIN_DIDS`, adds `admin` to the role set and stores assignment metadata
3. Logs whether each assignment was new or already existed
4. Exits after processing all DIDs

## How admin status is determined

The admin check happens at two levels:

### Backend (auth middleware)

1. The auth middleware extracts the DID from the service auth JWT
2. It reads roles from Redis: `SMEMBERS chive:authz:roles:{did}`
3. It checks if `admin` is in the role set
4. It sets `user.isAdmin = true` on the Hono context

### Frontend (role context)

1. After OAuth login, the frontend calls `pub.chive.actor.getMyRoles`
2. The response includes `isAdmin`, `isAlphaTester`, `isPremium` booleans
3. These are stored in the auth context (React context provider)
4. Components access them via `useAuth()` hook
5. `AdminGuard` component checks `user.isAdmin` and redirects non-admins

## getMyRoles endpoint

The `pub.chive.actor.getMyRoles` endpoint returns the authenticated user's roles and computed flags:

```json
{
  "roles": ["admin", "alpha-tester"],
  "isAdmin": true,
  "isAlphaTester": true,
  "isPremium": true
}
```

This endpoint:

- Is available to any authenticated user (not restricted to admins)
- Reads fresh roles from Redis (not relying on cached middleware state)
- Computes `isAlphaTester` as `roles.includes('alpha-tester') || isAdmin`
- Computes `isPremium` as `roles.includes('premium') || isAdmin`

## AdminGuard component

The `AdminGuard` React component (`web/components/auth/admin-guard.tsx`) restricts frontend access to admin pages:

1. **Loading state**: Renders a skeleton loader while `isAdmin` is being determined
2. **Non-admin redirect**: If the user is authenticated but not an admin, redirects to `/dashboard` via `router.replace()`
3. **Admin access**: If `user.isAdmin` is true, renders children

The component must be nested inside `AuthGuard`, which ensures the user is authenticated before the admin check runs:

```tsx
<AuthGuard>
  <AdminGuard>{/* Admin-only content */}</AdminGuard>
</AuthGuard>
```

## Granting and revoking access

### Via the admin dashboard

1. Navigate to `/admin/users`
2. Search for the user by handle or DID
3. Click on the user to view their detail page
4. Use the role assignment controls to add or remove roles

### Via XRPC endpoints

**Assign a role:**

```
POST /xrpc/pub.chive.admin.assignRole
{
  "did": "did:plc:target-user",
  "role": "moderator"
}
```

**Revoke a role:**

```
POST /xrpc/pub.chive.admin.revokeRole
{
  "did": "did:plc:target-user",
  "role": "moderator"
}
```

Both endpoints require admin authentication and validate the role name against the allowed list.

### Via Redis directly

For emergency access or when the admin dashboard is unavailable:

```bash
redis-cli SADD "chive:authz:roles:did:plc:target-user" "admin"
```

To revoke:

```bash
redis-cli SREM "chive:authz:roles:did:plc:target-user" "admin"
```

## Audit trail

Role changes made through the admin dashboard are tracked in multiple ways:

1. **Structured logging**: Every `assignRole` and `revokeRole` call logs the target DID, role, and acting admin DID
2. **Redis metadata**: Assignment records store `assignedAt` and `assignedBy` fields
3. **Prometheus metrics**: `chive_admin_actions_total{action="assign_role"}` and `chive_admin_actions_total{action="revoke_role"}` counters
4. **Redis pub/sub**: Content deletions publish events to `chive:admin:content-deleted`
5. **Audit log**: The `pub.chive.admin.getAuditLog` endpoint returns a paginated list of all admin actions

## Related documentation

- [Admin Dashboard](./admin-dashboard.md): accessing and navigating the admin UI
- [Admin API Reference](../api-reference/admin-endpoints.md): `assignRole`, `revokeRole`, `getMyRoles` endpoints
- [Admin Architecture](../development/admin-architecture.md): implementation details
