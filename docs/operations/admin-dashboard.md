# Admin dashboard

The admin dashboard provides a web-based interface for managing Chive's indexing infrastructure, user roles, content, and system health. It is available to authenticated users with the `admin` role.

## Accessing the dashboard

Navigate to `/admin` in the Chive web application. The dashboard requires:

1. An authenticated AT Protocol session (via OAuth)
2. The `admin` role assigned to your DID in Redis

If you are not an admin, the `AdminGuard` component redirects you to `/dashboard`. If you are not authenticated at all, the `AuthGuard` component redirects you to the login page.

To bootstrap the first admin account, run the seed script:

```bash
REDIS_URL="redis://localhost:6379" \
ADMIN_DIDS="did:plc:your-did-here" \
pnpm tsx scripts/seed-admin.ts
```

Alternatively, the server reads `ADMIN_DIDS` on startup and seeds the admin role automatically.

## Navigation structure

The sidebar organizes pages into four groups:

### System

| Page          | Path            | Description                                                                                                      |
| ------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Overview      | `/admin`        | Aggregate content counts, system health summary, firehose status, active backfill operations, quick action links |
| System Health | `/admin/health` | Per-database health checks (PostgreSQL, Elasticsearch, Neo4j, Redis) with latency, overall status badge, uptime  |

### Operations

| Page               | Path                | Description                                                                                                                   |
| ------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Alpha Applications | `/admin/alpha`      | List, review, approve, reject, and revoke alpha tester applications; view aggregate stats by status, sector, and career stage |
| Users & Roles      | `/admin/users`      | Search users by handle or DID; view user detail (eprint count, review count, roles); assign and revoke roles                  |
| Content            | `/admin/content`    | Browse indexed eprints, reviews, and endorsements; soft-delete content with a reason for audit trail                          |
| Governance         | `/admin/governance` | View audit log, list warnings and violations; filter by actor DID                                                             |

### Infrastructure

| Page                | Path              | Description                                                                                                                                                  |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Firehose & Indexing | `/admin/firehose` | Current firehose cursor position, DLQ entry count, DLQ entry list with retry/dismiss/purge actions                                                           |
| Backfill Operations | `/admin/backfill` | Trigger PDS scan, freshness scan, citation extraction, full ES reindex, governance sync, DID sync; monitor progress; cancel running operations; view history |
| PDS Registry        | `/admin/pds`      | List registered PDSes with status (active/unreachable), record counts, user counts; trigger rescan for individual PDSes                                      |
| Knowledge Graph     | `/admin/graph`    | Node counts by type (field, author, institution), edge count, pending governance proposals                                                                   |

### Analytics

| Page                   | Path                      | Description                                                                                           |
| ---------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Metrics & Trending     | `/admin/metrics`          | Trending eprints by velocity (24h/7d/30d window), view and download counts                            |
| Search Analytics       | `/admin/search-analytics` | Top search queries, zero-result queries, click-through rates                                          |
| Activity & Correlation | `/admin/activity`         | Cross-metric correlation analysis for submissions, reviews, endorsements                              |
| Endpoint Performance   | `/admin/endpoints`        | Per-endpoint request counts, error rates, P50/P95/P99 latency (computed from Prometheus histograms)   |
| Node.js Runtime        | `/admin/runtime`          | Process memory (heap, RSS, external), CPU usage, event loop lag, Prometheus-collected Node.js metrics |

## Overview page details

The overview page (`/admin`) is the landing page for the dashboard. It combines data from four XRPC queries, each polled on an interval via TanStack Query:

- **Content Statistics**: six stat cards (eprints, authors, reviews, endorsements, collections, tags) from `pub.chive.admin.getOverview`
- **System Health**: database connection badges with latency from `pub.chive.admin.getSystemHealth`
- **Firehose Panel**: cursor position and DLQ count from `pub.chive.admin.getFirehoseStatus`
- **Active Backfill Operations**: progress bars for running operations from `pub.chive.admin.getBackfillStatus`

A "Quick Actions" card at the bottom links to the most common admin tasks: View DLQ, Alpha Applications, Trigger Scan, PDS Registry, User Management, Metrics, Governance, and Endpoints.

## Authentication flow

All admin XRPC endpoints follow the same pattern:

1. The request includes a `Bearer` token in the `Authorization` header (service auth JWT)
2. Auth middleware validates the token and resolves the user's DID
3. The handler checks `user.isAdmin` (set by middleware from Redis role lookup)
4. If the user is not an admin, the handler throws `AuthorizationError`
5. If the required service (e.g., `AdminService`, `BackfillManager`) is not configured, the handler throws `ServiceUnavailableError`

## Next steps

- [Admin API reference](../api-reference/admin-endpoints): All admin XRPC endpoints
- [Backfill operations](./backfill-operations): Running and monitoring backfill tasks
- [Observability and metrics](./observability-metrics): Prometheus metrics reference
- [Roles and access control](./roles-and-access): Role system and admin provisioning
