# Admin XRPC endpoints

This page documents all XRPC endpoints in the `pub.chive.admin.*` namespace, plus the related `pub.chive.actor.getMyRoles` endpoint. All admin endpoints require authentication and the `admin` role.

Every admin handler follows the same authorization pattern: the middleware resolves the user's DID from the service auth JWT, then the handler checks `user.isAdmin`. Non-admin requests receive a `403 AuthorizationError`. If a required backend service is not configured, the handler returns a `503 ServiceUnavailableError`.

## System

### pub.chive.admin.getOverview

Returns aggregate counts from all index tables.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "eprints": 1234,
  "authors": 567,
  "reviews": 89,
  "endorsements": 42,
  "collections": 15,
  "tags": 203
}
```

---

### pub.chive.admin.getSystemHealth

Returns health status for each database connection and overall system status.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "status": "healthy",
  "databases": [
    { "name": "PostgreSQL", "healthy": true, "latencyMs": 3 },
    { "name": "Elasticsearch", "healthy": true, "latencyMs": 12 },
    { "name": "Neo4j", "healthy": true, "latencyMs": 8 },
    { "name": "Redis", "healthy": true, "latencyMs": 1 }
  ],
  "uptime": 86400,
  "timestamp": "2026-03-04T12:00:00.000Z"
}
```

The `status` field is one of: `healthy` (all databases healthy), `degraded` (some databases unhealthy), `unhealthy` (no databases healthy).

---

### pub.chive.admin.getPrometheusMetrics

Returns all registered Prometheus metrics as JSON.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "metrics": [
    { "name": "chive_http_requests_total", "type": "counter", "values": [...] }
  ],
  "timestamp": "2026-03-04T12:00:00.000Z"
}
```

The `metrics` array contains the raw output of `prom-client`'s `getMetricsAsJSON()`. If `prom-client` is not configured, returns an empty array.

---

### pub.chive.admin.getEndpointMetrics

Returns structured per-endpoint performance data parsed from Prometheus histograms and counters.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "metrics": [
    {
      "method": "GET",
      "path": "/xrpc/pub.chive.eprint.getSubmission",
      "requestCount": 15234,
      "errorCount": 12,
      "errorRate": 79,
      "p50": 23400,
      "p95": 89200,
      "p99": 234000
    }
  ]
}
```

| Field               | Description                           |
| ------------------- | ------------------------------------- |
| `errorRate`         | Error rate in basis points (100 = 1%) |
| `p50`, `p95`, `p99` | Latency percentiles in microseconds   |

Metrics are sorted by `requestCount` descending. Percentiles are computed via linear interpolation within histogram buckets.

---

### pub.chive.admin.getNodeMetrics

Returns Node.js runtime metrics and structured process information.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "metrics": [
    {
      "name": "nodejs_heap_size_total_bytes",
      "value": "52428800",
      "type": "gauge",
      "unit": "bytes"
    }
  ],
  "processInfo": {
    "pid": 12345,
    "uptime": 3600,
    "heapUsed": 41943040,
    "heapTotal": 52428800,
    "rss": 104857600,
    "external": 2097152,
    "cpuUser": 1500000,
    "cpuSystem": 300000,
    "eventLoopLag": 1200
  }
}
```

The `eventLoopLag` is in microseconds. The `metrics` array includes all `nodejs_*`, `process_*`, and `chive_*` Prometheus metrics (excluding histogram sub-metrics).

---

## Alpha applications

### pub.chive.admin.listAlphaApplications

Lists alpha applications with optional status filter and cursor-based pagination.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name     | Type   | Required | Description                                                |
| -------- | ------ | -------- | ---------------------------------------------------------- |
| `status` | string | No       | Filter by status (e.g., `pending`, `approved`, `rejected`) |
| `limit`  | number | No       | Maximum results to return (default: 50)                    |
| `cursor` | string | No       | Pagination cursor                                          |

#### Response

```json
{
  "items": [
    {
      "id": "uuid",
      "did": "did:plc:abc123",
      "handle": "researcher.bsky.social",
      "email": "researcher@example.com",
      "status": "pending",
      "sector": "academia",
      "careerStage": "postdoc",
      "affiliations": [],
      "researchKeywords": [],
      "motivation": "Interested in open science",
      "createdAt": "2026-03-01T10:00:00Z",
      "updatedAt": "2026-03-01T10:00:00Z"
    }
  ],
  "total": 42,
  "cursor": "next-page-cursor"
}
```

Handles are resolved via DID document lookup for applications that have no stored handle.

---

### pub.chive.admin.getAlphaApplication

Returns a single alpha application by DID.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name  | Type   | Required | Description          |
| ----- | ------ | -------- | -------------------- |
| `did` | string | Yes      | DID of the applicant |

#### Response

Returns the full `AlphaApplication` object. Throws `NotFoundError` if no application exists for the given DID.

---

### pub.chive.admin.updateAlphaApplication

Updates an alpha application status. On approval, assigns the `alpha-tester` role in Redis and sends an email notification (best-effort).

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name     | Type   | Required | Description                           |
| -------- | ------ | -------- | ------------------------------------- |
| `did`    | string | Yes      | DID of the applicant                  |
| `action` | string | Yes      | One of: `approve`, `reject`, `revoke` |

#### Response

Returns the updated `AlphaApplication` object. On `approve`, adds `alpha-tester` role. On `reject` or `revoke`, removes `alpha-tester` role.

Increments the `chive_admin_actions_total` counter with labels `action={action}` and `target=alpha_application`.

---

### pub.chive.admin.getAlphaStats

Returns aggregate statistics for alpha applications.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "byStatus": { "pending": 12, "approved": 28, "rejected": 2 },
  "bySector": { "academia": 30, "industry": 10, "government": 2 },
  "byCareerStage": { "postdoc": 15, "faculty": 10, "student": 12, "other": 5 },
  "recentByDay": [
    { "date": "2026-03-04", "count": 3 },
    { "date": "2026-03-03", "count": 5 }
  ],
  "total": 42
}
```

---

## Users

### pub.chive.admin.searchUsers

Searches users by handle or DID.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name    | Type   | Required | Description                        |
| ------- | ------ | -------- | ---------------------------------- |
| `query` | string | Yes      | Search term (handle or DID prefix) |
| `limit` | number | No       | Maximum results (default: 20)      |

#### Response

```json
{
  "users": [
    {
      "did": "did:plc:abc123",
      "handle": "researcher.bsky.social",
      "displayName": "Dr. Smith",
      "eprintCount": 5,
      "reviewCount": 3,
      "endorsementCount": 1,
      "roles": ["alpha-tester"],
      "createdAt": "2026-01-15T08:00:00Z"
    }
  ]
}
```

---

### pub.chive.admin.getUserDetail

Returns detailed information for a single user.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name  | Type   | Required | Description     |
| ----- | ------ | -------- | --------------- |
| `did` | string | Yes      | DID of the user |

#### Response

Returns a `UserDetail` object with eprint count, review count, endorsement count, roles, and timestamps. Throws `NotFoundError` if the user is not in the index.

---

### pub.chive.admin.assignRole

Assigns a role to a user. Stores the assignment in Redis with metadata (timestamp, assigning admin DID).

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name   | Type   | Required | Description            |
| ------ | ------ | -------- | ---------------------- |
| `did`  | string | Yes      | DID of the target user |
| `role` | string | Yes      | Role to assign         |

Valid roles: `admin`, `moderator`, `graph-editor`, `author`, `reader`, `alpha-tester`.

#### Response

```json
{
  "success": true,
  "did": "did:plc:abc123",
  "role": "moderator"
}
```

Increments `chive_admin_actions_total{action="assign_role", target="user"}`.

---

### pub.chive.admin.revokeRole

Revokes a role from a user. Removes both the role set member and the assignment metadata from Redis.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name   | Type   | Required | Description            |
| ------ | ------ | -------- | ---------------------- |
| `did`  | string | Yes      | DID of the target user |
| `role` | string | Yes      | Role to revoke         |

#### Response

```json
{
  "success": true,
  "did": "did:plc:abc123",
  "role": "moderator"
}
```

Increments `chive_admin_actions_total{action="revoke_role", target="user"}`.

---

## Content

### pub.chive.admin.listEprints

Queries indexed eprints with optional text search and pagination.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name     | Type   | Required | Description                        |
| -------- | ------ | -------- | ---------------------------------- |
| `q`      | string | No       | Text search query                  |
| `limit`  | number | No       | Maximum results (default: 50)      |
| `offset` | number | No       | Offset for pagination (default: 0) |

#### Response

```json
{
  "items": [
    {
      "uri": "at://did:plc:abc123/pub.chive.eprint.submission/rkey",
      "title": "An Eprint Title",
      "authorDid": "did:plc:abc123",
      "createdAt": "2026-03-01T10:00:00Z"
    }
  ],
  "total": 1234
}
```

---

### pub.chive.admin.listReviews

Queries indexed reviews with pagination.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name     | Type   | Required | Description                     |
| -------- | ------ | -------- | ------------------------------- |
| `limit`  | number | No       | Maximum results (default: 50)   |
| `cursor` | string | No       | Numeric offset as cursor string |

#### Response

```json
{
  "items": [
    {
      "uri": "at://did:plc:abc123/pub.chive.review.comment/rkey",
      "eprintUri": "at://did:plc:def456/pub.chive.eprint.submission/rkey",
      "reviewerDid": "did:plc:abc123",
      "motivation": "minor-revision"
    }
  ],
  "total": 89
}
```

---

### pub.chive.admin.listEndorsements

Queries indexed endorsements with pagination.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name     | Type   | Required | Description                     |
| -------- | ------ | -------- | ------------------------------- |
| `limit`  | number | No       | Maximum results (default: 50)   |
| `cursor` | string | No       | Numeric offset as cursor string |

#### Response

```json
{
  "items": [
    {
      "uri": "at://did:plc:abc123/pub.chive.review.endorsement/rkey",
      "eprintUri": "at://did:plc:def456/pub.chive.eprint.submission/rkey",
      "endorserDid": "did:plc:abc123"
    }
  ],
  "total": 42
}
```

---

### pub.chive.admin.deleteContent

Soft-deletes content by setting `deleted_at` in the database. Publishes a deletion event to Redis for audit trail.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name         | Type   | Required | Description                     |
| ------------ | ------ | -------- | ------------------------------- |
| `uri`        | string | Yes      | AT URI of the content to delete |
| `collection` | string | Yes      | Lexicon collection name         |
| `reason`     | string | No       | Reason for deletion             |

Supported collections: `pub.chive.eprint.submission`, `pub.chive.review.comment`, `pub.chive.review.endorsement`, `pub.chive.eprint.userTag`.

#### Response

```json
{
  "success": true,
  "uri": "at://did:plc:abc123/pub.chive.eprint.submission/rkey"
}
```

The deletion event is published to `chive:admin:content-deleted` Redis channel with the URI, collection, reason, deleting admin DID, and timestamp. Increments `chive_admin_actions_total{action="delete", target="{collection}"}`.

---

## Firehose and DLQ

### pub.chive.admin.getFirehoseStatus

Returns firehose cursor position and DLQ entry count.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "cursor": "1709553600000000",
  "dlqCount": 3,
  "timestamp": "2026-03-04T12:00:00.000Z"
}
```

The `cursor` is the current firehose cursor stored in Redis (`chive:firehose:cursor`). A `null` cursor means the firehose consumer has not yet started or the cursor was lost.

---

### pub.chive.admin.listDLQEntries

Returns entries from the firehose dead-letter queue.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name     | Type   | Required | Description                           |
| -------- | ------ | -------- | ------------------------------------- |
| `limit`  | number | No       | Maximum entries (default: 50)         |
| `offset` | number | No       | Offset into the DLQ list (default: 0) |

#### Response

```json
{
  "entries": [
    {
      "uri": "at://did:plc:abc123/pub.chive.eprint.submission/rkey",
      "error": "ValidationError",
      "errorType": "VALIDATION_ERROR",
      "timestamp": "2026-03-04T11:30:00Z"
    }
  ],
  "total": 3
}
```

Updates the `chive_dlq_entries_total` gauge to the current DLQ length.

---

### pub.chive.admin.retryDLQEntry

Requeues a single DLQ entry for reprocessing.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name    | Type   | Required | Description                                   |
| ------- | ------ | -------- | --------------------------------------------- |
| `index` | number | Yes      | Zero-based index of the entry in the DLQ list |

#### Response

```json
{
  "success": true,
  "message": "Entry requeued for retry"
}
```

The entry is pushed to `chive:firehose:retry` for reprocessing. If the index is out of range, returns `success: false`.

---

### pub.chive.admin.retryAllDLQ

Batch retries all DLQ entries, optionally filtered by error type.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name        | Type   | Required | Description                                  |
| ----------- | ------ | -------- | -------------------------------------------- |
| `errorType` | string | No       | Filter entries by error type before retrying |

#### Response

```json
{
  "success": true,
  "retriedCount": 3
}
```

If no `errorType` filter is provided, all entries are retried and the DLQ is cleared. If a filter is provided, only matching entries are moved to the retry queue; non-matching entries remain in the DLQ.

---

### pub.chive.admin.dismissDLQEntry

Removes a single DLQ entry without retrying it.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name    | Type   | Required | Description                              |
| ------- | ------ | -------- | ---------------------------------------- |
| `index` | number | Yes      | Zero-based index of the entry to dismiss |

#### Response

```json
{
  "success": true,
  "message": "Entry dismissed"
}
```

Uses a sentinel-and-remove pattern to atomically delete the entry at the given index. Decrements `chive_dlq_entries_total`.

---

### pub.chive.admin.purgeOldDLQ

Purges DLQ entries older than a specified number of days.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name            | Type   | Required | Description                        |
| --------------- | ------ | -------- | ---------------------------------- |
| `olderThanDays` | number | No       | Age threshold in days (default: 7) |

#### Response

```json
{
  "success": true,
  "purgedCount": 5
}
```

Iterates through all DLQ entries, parses the `timestamp` or `createdAt` field, and removes entries older than the cutoff. Entries that fail to parse are skipped.

---

## Backfill operations

### pub.chive.admin.triggerPDSScan

Triggers a PDS scan against registered PDSes.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

None.

#### Response

```json
{
  "operationId": "uuid",
  "status": "running"
}
```

The scan runs in the background. It fetches PDSes ready for scanning from the registry and invokes the PDS scanner against each (batch size 10, concurrency 2). Monitor progress with `getBackfillStatus`.

---

### pub.chive.admin.triggerFreshnessScan

Triggers a freshness scan to detect and refresh stale records.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

None.

#### Response

```json
{
  "operationId": "uuid",
  "status": "running"
}
```

Detects stale records via `PDSSyncService.detectStaleRecords()`, then refreshes each from its source PDS. Progress is updated as each record is processed.

---

### pub.chive.admin.triggerCitationExtraction

Triggers citation extraction for all indexed eprints.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

None.

#### Response

```json
{
  "operationId": "uuid",
  "status": "running"
}
```

Fetches all eprint URIs in batches of 500, then runs the `CitationExtractionService` against each eprint using GROBID, Crossref, and Semantic Scholar. Progress is updated every 10 eprints.

---

### pub.chive.admin.triggerFullReindex

Triggers a full Elasticsearch reindex from PostgreSQL.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

None.

#### Response

```json
{
  "operationId": "uuid",
  "status": "running"
}
```

Reads all eprints from PostgreSQL (via the admin service, in batches of 500), builds `IndexableEprintDocument` objects, and indexes each into Elasticsearch. Progress is updated every 50 eprints.

---

### pub.chive.admin.triggerGovernanceSync

Triggers an immediate governance sync from the Chive Governance PDS.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

None.

#### Response

```json
{
  "operationId": "uuid",
  "status": "running"
}
```

Creates a temporary `GovernanceSyncJob` instance and runs a single sync cycle, pulling authority records from the Governance PDS at `GRAPH_PDS_URL` (default: `https://governance.chive.pub`).

---

### pub.chive.admin.triggerDIDSync

Triggers a sync for a specific DID by resolving it to a PDS and scanning all Chive collections.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name  | Type   | Required | Description                          |
| ----- | ------ | -------- | ------------------------------------ |
| `did` | string | Yes      | DID to sync (e.g., `did:plc:abc123`) |

#### Response

```json
{
  "operationId": "uuid",
  "did": "did:plc:abc123",
  "status": "running"
}
```

Resolves the DID to its PDS endpoint via PLC directory (for `did:plc:`) or `.well-known/did.json` (for `did:web:`), then scans all `pub.chive.*` collections for that user. Registers the PDS in the discovery registry as a side effect.

---

### pub.chive.admin.triggerBackfill

Generic handler for triggering any supported backfill operation type.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name         | Type   | Required | Description                              |
| ------------ | ------ | -------- | ---------------------------------------- |
| `type`       | string | Yes      | Operation type                           |
| (additional) | any    | No       | Extra metadata stored with the operation |

Valid types: `pdsScan`, `freshnessScan`, `citationExtraction`, `fullReindex`, `governanceSync`, `didSync`.

#### Response

```json
{
  "operation": {
    "id": "uuid",
    "type": "pdsScan",
    "status": "running",
    "startedAt": "2026-03-04T12:00:00Z",
    "progress": 0,
    "recordsProcessed": 0
  }
}
```

This is a lower-level endpoint compared to the specific trigger endpoints. It creates the operation record in Redis but does not start the actual work (the specific trigger endpoints do both).

---

### pub.chive.admin.getBackfillStatus

Returns status of a specific operation or lists all operations.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name     | Type   | Required | Description                                                     |
| -------- | ------ | -------- | --------------------------------------------------------------- |
| `id`     | string | No       | Specific operation ID to query                                  |
| `status` | string | No       | Filter by status: `running`, `completed`, `failed`, `cancelled` |

#### Response

When `id` is provided:

```json
{
  "operation": {
    "id": "uuid",
    "type": "fullReindex",
    "status": "running",
    "startedAt": "2026-03-04T12:00:00Z",
    "progress": 45,
    "recordsProcessed": 230
  }
}
```

When `id` is omitted:

```json
{
  "operations": [...]
}
```

---

### pub.chive.admin.getBackfillHistory

Returns completed, failed, and cancelled backfill operations sorted by start time (newest first).

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "operations": [
    {
      "id": "uuid",
      "type": "fullReindex",
      "status": "completed",
      "startedAt": "2026-03-04T10:00:00Z",
      "completedAt": "2026-03-04T10:15:00Z",
      "progress": 100,
      "recordsProcessed": 1234
    }
  ]
}
```

Running operations are excluded from the history.

---

### pub.chive.admin.cancelBackfill

Cancels a running backfill operation by signaling its AbortController.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name | Type   | Required | Description            |
| ---- | ------ | -------- | ---------------------- |
| `id` | string | Yes      | Operation ID to cancel |

#### Response

```json
{
  "success": true,
  "id": "uuid"
}
```

Returns `success: false` if the operation is not found or not in `running` status.

---

## PDS and imports

### pub.chive.admin.listPDSes

Returns registered PDS entries with status, record counts, and user counts.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "stats": {
    "total": 15,
    "healthy": 12,
    "unhealthy": 3,
    "withRecords": 8,
    "items": [
      {
        "pdsUrl": "https://bsky.social",
        "status": "active",
        "recordCount": 42,
        "userCount": 5,
        "lastScanAt": "2026-03-04T10:00:00Z"
      }
    ]
  }
}
```

---

### pub.chive.admin.rescanPDS

Triggers a rescan of a specific PDS by re-registering it in the PDS discovery registry.

| Property | Value            |
| -------- | ---------------- |
| Type     | Procedure (POST) |
| Auth     | Required (admin) |

#### Input

| Name     | Type   | Required | Description              |
| -------- | ------ | -------- | ------------------------ |
| `pdsUrl` | string | Yes      | URL of the PDS to rescan |

#### Response

```json
{
  "success": true,
  "pdsUrl": "https://bsky.social"
}
```

Increments `chive_admin_actions_total{action="rescan", target="pds"}`.

---

### pub.chive.admin.listImports

Queries imported eprints with optional source filter.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name     | Type   | Required | Description                   |
| -------- | ------ | -------- | ----------------------------- |
| `limit`  | number | No       | Maximum results (default: 50) |
| `source` | string | No       | Filter by import source       |

#### Response

```json
{
  "items": [
    {
      "uri": "at://did:plc:abc123/pub.chive.eprint.submission/rkey",
      "source": "firehose",
      "importedAt": "2026-03-01T10:00:00Z"
    }
  ],
  "total": 1234
}
```

---

## Knowledge graph

### pub.chive.admin.getGraphStats

Returns knowledge graph statistics including node counts by type, edge count, and pending governance proposals.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "totalNodes": 5000,
  "totalEdges": 12000,
  "fieldNodes": 3500,
  "authorNodes": 1200,
  "institutionNodes": 300,
  "pendingProposals": 7
}
```

Queries the node and edge repositories in parallel. Falls back to zero on errors.

---

## Analytics and metrics

### pub.chive.admin.getMetricsOverview

Returns trending eprints for a given time window.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name   | Type   | Required | Description                                         |
| ------ | ------ | -------- | --------------------------------------------------- |
| `days` | number | No       | Number of days for the trending window (default: 7) |

The `days` value is mapped to the closest supported window: 1 day maps to `24h`, 2-7 days to `7d`, 8+ days to `30d`.

#### Response

```json
{
  "trending": [{ "uri": "at://did:plc:abc123/...", "score": 42 }],
  "periodInfo": {
    "days": 7,
    "startDate": "2026-02-25T12:00:00Z",
    "endDate": "2026-03-04T12:00:00Z"
  }
}
```

---

### pub.chive.admin.getSearchAnalytics

Returns search analytics data including top queries and click-through metrics.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

Returns analytics data from `AdminService.getSearchAnalytics()`. The shape depends on the search analytics implementation.

---

### pub.chive.admin.getActivityCorrelation

Returns cross-metric activity correlation data.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

None.

#### Response

```json
{
  "metrics": [...],
  "timestamp": "2026-03-04T12:00:00.000Z"
}
```

Reads from the activity correlation service. Returns an empty `metrics` array if the service is not configured.

---

### pub.chive.admin.getTrendingVelocity

Returns trending eprints enriched with velocity scores, view counts, and download counts.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name     | Type   | Required | Description                                             |
| -------- | ------ | -------- | ------------------------------------------------------- |
| `limit`  | number | No       | Maximum results (default: 20)                           |
| `window` | string | No       | Trending window: `24h`, `7d`, or `30d` (default: `24h`) |

#### Response

```json
{
  "items": [
    {
      "uri": "at://did:plc:abc123/...",
      "title": "An Eprint Title",
      "velocity": 0.523,
      "views": 142,
      "downloads": 38,
      "trend": "rising"
    }
  ]
}
```

The `trend` field is determined by velocity: `rising` (> 0.1), `falling` (< -0.1), or `stable` (between -0.1 and 0.1).

---

### pub.chive.admin.getViewDownloadTimeSeries

Returns view and download time series data, optionally filtered to a specific eprint.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name          | Type   | Required | Description                                      |
| ------------- | ------ | -------- | ------------------------------------------------ |
| `uri`         | string | No       | AT URI of a specific eprint (omit for aggregate) |
| `granularity` | string | No       | Time bucket granularity (e.g., `hour`, `day`)    |

#### Response

Returns time series data from `AdminService.getViewDownloadTimeSeries()`.

---

## Governance and audit

### pub.chive.admin.getAuditLog

Returns paginated audit log entries.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name       | Type   | Required | Description                     |
| ---------- | ------ | -------- | ------------------------------- |
| `limit`    | number | No       | Maximum entries (default: 50)   |
| `cursor`   | string | No       | Numeric offset as cursor string |
| `actorDid` | string | No       | Filter by acting admin DID      |

#### Response

```json
{
  "entries": [
    {
      "action": "assign_role",
      "actorDid": "did:plc:admin123",
      "targetDid": "did:plc:user456",
      "details": { "role": "moderator" },
      "timestamp": "2026-03-04T12:00:00Z"
    }
  ],
  "cursor": "50",
  "total": 120
}
```

---

### pub.chive.admin.listWarnings

Returns content warnings, optionally filtered by user DID.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name    | Type   | Required | Description                        |
| ------- | ------ | -------- | ---------------------------------- |
| `limit` | number | No       | Maximum results (default: 50)      |
| `did`   | string | No       | Filter warnings by target user DID |

#### Response

```json
{
  "warnings": [...]
}
```

---

### pub.chive.admin.listViolations

Returns content violations, optionally filtered by user DID.

| Property | Value            |
| -------- | ---------------- |
| Type     | Query (GET)      |
| Auth     | Required (admin) |

#### Parameters

| Name    | Type   | Required | Description                          |
| ------- | ------ | -------- | ------------------------------------ |
| `limit` | number | No       | Maximum results (default: 50)        |
| `did`   | string | No       | Filter violations by target user DID |

#### Response

```json
{
  "violations": [...]
}
```

---

## Actor endpoint

### pub.chive.actor.getMyRoles

Returns the authenticated user's roles and boolean flags. This is not an admin endpoint; any authenticated user can call it.

| Property | Value                             |
| -------- | --------------------------------- |
| Type     | Query (GET)                       |
| Auth     | Required (any authenticated user) |

#### Parameters

None.

#### Response

```json
{
  "roles": ["admin", "alpha-tester"],
  "isAdmin": true,
  "isAlphaTester": true
}
```

Reads roles from Redis (`chive:authz:roles:{did}`). The `isAlphaTester` flag is true for admins regardless of explicit role assignment.

## Next steps

- [XRPC endpoints](./xrpc-endpoints): Full endpoint reference for non-admin namespaces
- [Authentication](./authentication): Auth flows and service auth JWT details
- [API overview](./overview): Base URLs, rate limits, and error handling
