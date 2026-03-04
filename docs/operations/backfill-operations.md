# Backfill operations

Backfill operations rebuild or update Chive's indexes from upstream data sources. These are long-running tasks managed by the `BackfillManager` service, triggered via the admin dashboard or XRPC endpoints.

## When to use backfill operations

| Scenario                                            | Operation           |
| --------------------------------------------------- | ------------------- |
| A new PDS starts hosting Chive records              | PDS Scan            |
| Indexed records may be out of date                  | Freshness Scan      |
| Citation data needs to be extracted or re-extracted | Citation Extraction |
| Elasticsearch index is corrupted or schema changed  | Full Reindex        |
| Governance PDS has new authority records            | Governance Sync     |
| A specific user's records need re-indexing          | DID Sync            |

All backfill operations are read-only. They fetch data from user PDSes and external services; they never write to user PDSes.

## Operation types

### PDS scan

Scans registered PDSes for `pub.chive.*` records and indexes them into PostgreSQL and Elasticsearch.

**How it works:**

1. Queries the PDS registry for PDSes due for scanning
2. Scans up to 10 PDSes per batch with concurrency of 2
3. For each PDS, lists all repositories and checks for `pub.chive.*` collections
4. Indexes discovered records into the local database
5. Updates PDS registry with scan results

**Trigger:** `pub.chive.admin.triggerPDSScan` or the "Trigger Scan" button on the Backfill Operations page.

### Freshness scan

Detects stale records (records whose local index may not match the source PDS) and refreshes them.

**How it works:**

1. Calls `PDSSyncService.detectStaleRecords()` to find records that need refreshing
2. For each stale record, fetches the current version from the source PDS
3. Updates the local index with the fresh data
4. Reports progress as a percentage of total stale records processed

**Trigger:** `pub.chive.admin.triggerFreshnessScan`

### Citation extraction

Extracts citation data from all indexed eprints using GROBID, Crossref, and Semantic Scholar.

**How it works:**

1. Fetches all eprint URIs from PostgreSQL in batches of 500
2. For each eprint, runs the `CitationExtractionService` with all three sources enabled
3. Extracted citations are stored in the citations index
4. Reports progress every 10 eprints

**Trigger:** `pub.chive.admin.triggerCitationExtraction`

**Note:** This operation can be slow for large datasets because it makes external API calls for each eprint. Plan for extended runtimes.

### Full reindex (Elasticsearch)

Rebuilds the Elasticsearch search index from the PostgreSQL source of truth.

**How it works:**

1. Fetches all eprint URIs from PostgreSQL in batches of 500
2. For each eprint, loads the full record from the eprint service
3. Builds an `IndexableEprintDocument` with title, abstract, keywords, author, and field nodes
4. Indexes the document into Elasticsearch
5. Reports progress every 50 eprints

**Trigger:** `pub.chive.admin.triggerFullReindex`

**Use when:** Elasticsearch mapping changes require a full reindex, or the ES index has become corrupted or empty.

### Governance sync

Synchronizes authority records from the Chive Governance PDS.

**How it works:**

1. Creates a temporary `GovernanceSyncJob` with the configured `GRAPH_PDS_URL`
2. Runs a single sync cycle (not the periodic timer)
3. Fetches `pub.chive.graph.authorityRecord` records from the Governance PDS
4. Updates the local knowledge graph (nodes and edges)

**Trigger:** `pub.chive.admin.triggerGovernanceSync`

**Environment variable:** `GRAPH_PDS_URL` (default: `https://governance.chive.pub`)

### DID sync

Syncs all Chive records for a specific user by resolving their DID to a PDS.

**How it works:**

1. Resolves the DID to a PDS endpoint via PLC directory (`did:plc:`) or `.well-known/did.json` (`did:web:`)
2. Registers the PDS in the discovery registry (side effect)
3. Scans all `pub.chive.*` collections for the given DID
4. Indexes discovered records

**Trigger:** `pub.chive.admin.triggerDIDSync` with the target DID.

**Use when:** A specific user reports missing or stale records.

## Triggering via the dashboard

1. Navigate to `/admin/backfill`
2. Select the operation type from the available buttons
3. For DID sync, enter the target DID in the input field
4. Click the trigger button
5. The operation starts in the background and the page shows the running operation with a progress bar

## Monitoring progress

Each backfill operation stores its state in Redis and reports:

| Field              | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `id`               | UUID of the operation                                 |
| `type`             | Operation type (e.g., `pdsScan`, `fullReindex`)       |
| `status`           | One of: `running`, `completed`, `failed`, `cancelled` |
| `startedAt`        | ISO 8601 timestamp of when the operation started      |
| `completedAt`      | ISO 8601 timestamp of completion (if finished)        |
| `progress`         | Percentage (0-100)                                    |
| `recordsProcessed` | Number of records processed so far                    |
| `error`            | Error message (if failed)                             |
| `metadata`         | Additional metadata (e.g., DID for DID sync)          |

**Dashboard:** The Backfill Operations page shows running operations with real-time progress bars. The page polls `pub.chive.admin.getBackfillStatus` on an interval.

**API:** Query `pub.chive.admin.getBackfillStatus` with an operation ID for a specific operation, or omit the ID to list all operations. Use the `status` parameter to filter by state.

## Cancelling operations

To cancel a running operation:

1. **Dashboard:** Click the "Cancel" button next to the running operation on the Backfill Operations page
2. **API:** Call `pub.chive.admin.cancelBackfill` with the operation ID

Cancellation works by signaling the operation's `AbortController`. The background task checks this signal periodically and stops processing. The operation status changes to `cancelled`.

Note: cancellation is cooperative. If the operation is in the middle of a network request or database write, it finishes that unit of work before stopping.

## Operation history

Completed, failed, and cancelled operations are stored in Redis with a 24-hour TTL. After 24 hours, operation records expire automatically.

**Dashboard:** The Backfill Operations page shows operation history below the active operations section, sorted by start time (newest first).

**API:** Call `pub.chive.admin.getBackfillHistory` to retrieve all non-running operations.

## Prometheus metrics

Backfill operations emit the following Prometheus metrics:

| Metric                             | Type      | Labels           | Description                                   |
| ---------------------------------- | --------- | ---------------- | --------------------------------------------- |
| `chive_backfill_operations_total`  | Counter   | `type`, `status` | Total backfill operations by type and outcome |
| `chive_backfill_records_processed` | Counter   | `type`           | Total records processed across all backfills  |
| `chive_backfill_duration_seconds`  | Histogram | `type`           | Operation duration (buckets: 1s to 1h)        |

## Related documentation

- [Admin API Reference](../api-reference/admin-endpoints.md): full endpoint documentation for all backfill triggers
- [Admin Dashboard](./admin-dashboard.md): dashboard navigation and page overview
- [Observability & Metrics](./observability-metrics.md): all Prometheus metrics reference
