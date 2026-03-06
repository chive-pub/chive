# Observability and metrics reference

This page documents all Prometheus metrics registered in Chive's centralized `prometheus-registry.ts`. These metrics are exposed via the `/metrics` endpoint for Prometheus scraping and are also available as JSON through `pub.chive.admin.getPrometheusMetrics`.

All metrics use the `chive_` prefix. Default Node.js metrics (CPU, memory, event loop, GC) are collected automatically with the same prefix.

## HTTP metrics

Instrumented in the HTTP middleware layer. Follow the RED method (Rate, Errors, Duration).

| Metric                                | Type      | Labels                         | Description                             |
| ------------------------------------- | --------- | ------------------------------ | --------------------------------------- |
| `chive_http_requests_total`           | Counter   | `method`, `endpoint`, `status` | Total HTTP requests                     |
| `chive_http_request_duration_seconds` | Histogram | `method`, `endpoint`, `status` | Request duration (buckets: 10ms to 10s) |

**Source:** `src/observability/prometheus-registry.ts` (exported as `httpMetrics`)

**Instrumented in:** HTTP middleware (wraps all Hono route handlers)

## Eprint indexing metrics

Tracks eprint record indexing from the firehose.

| Metric                                   | Type      | Labels            | Description                                                 |
| ---------------------------------------- | --------- | ----------------- | ----------------------------------------------------------- |
| `chive_eprints_indexed_total`            | Counter   | `field`, `status` | Total eprints indexed, by knowledge graph field and outcome |
| `chive_eprint_indexing_duration_seconds` | Histogram | `status`          | Indexing duration per eprint (buckets: 10ms to 10s)         |

**Source:** `src/observability/prometheus-registry.ts` (exported as `eprintMetrics`)

**Instrumented in:** Firehose event handlers, eprint indexing service

## Firehose metrics

Tracks the ATProto firehose consumer connection and event processing.

| Metric                              | Type    | Labels       | Description                                                         |
| ----------------------------------- | ------- | ------------ | ------------------------------------------------------------------- |
| `chive_firehose_events_total`       | Counter | `event_type` | Total events processed, by type (commit, identity, account, handle) |
| `chive_firehose_cursor_lag_seconds` | Gauge   | (none)       | How far behind the consumer is from the relay                       |
| `chive_firehose_active_connections` | Gauge   | (none)       | Number of active WebSocket connections to the relay                 |
| `chive_firehose_parse_errors_total` | Counter | `error_type` | Events that failed to parse (json_parse, validation, unknown)       |

**Source:** `src/observability/prometheus-registry.ts` (exported as `firehoseMetrics`)

**Instrumented in:** `src/atproto/` firehose consumer

## Database metrics

Tracks connection pool status and query performance for all databases.

| Metric                                  | Type      | Labels                  | Description                                                  |
| --------------------------------------- | --------- | ----------------------- | ------------------------------------------------------------ |
| `chive_database_connections_active`     | Gauge     | `database`              | Active connections (postgresql, redis, elasticsearch, neo4j) |
| `chive_database_query_duration_seconds` | Histogram | `database`, `operation` | Query duration (buckets: 10ms to 10s)                        |

**Source:** `src/observability/prometheus-registry.ts` (exported as `databaseMetrics`)

**Instrumented in:** Database connection wrappers in `src/storage/`

## PDS scanning metrics

Tracks PDS discovery, scanning, and record indexing during backfill and periodic scan operations.

| Metric                                    | Type      | Labels                 | Description                                           |
| ----------------------------------------- | --------- | ---------------------- | ----------------------------------------------------- |
| `chive_pds_scans_total`                   | Counter   | `status`               | Total PDS scans (success, error, skipped)             |
| `chive_pds_scan_duration_seconds`         | Histogram | `status`               | Scan duration per PDS (buckets: 100ms to 60s)         |
| `chive_pds_records_scanned_total`         | Counter   | `collection`           | Total records scanned from PDSes, by collection       |
| `chive_pds_records_indexed_total`         | Counter   | `collection`, `status` | Records indexed from scans, by collection and outcome |
| `chive_pds_record_index_duration_seconds` | Histogram | `collection`, `status` | Per-record indexing duration (buckets: 10ms to 5s)    |
| `chive_pdses_discovered_total`            | Gauge     | (none)                 | Total PDSes known to the system                       |
| `chive_pdses_with_records_total`          | Gauge     | (none)                 | PDSes that have `pub.chive.*` records                 |

**Source:** `src/observability/prometheus-registry.ts` (exported as `pdsMetrics`)

**Instrumented in:** `src/services/pds/` scanner and registry

## Citation extraction metrics

Tracks GROBID extraction, Crossref lookups, Semantic Scholar enrichment, and internal matching.

| Metric                                       | Type      | Labels             | Description                                                                      |
| -------------------------------------------- | --------- | ------------------ | -------------------------------------------------------------------------------- |
| `chive_citation_extractions_total`           | Counter   | `source`, `status` | Extraction operations by source (grobid, semantic-scholar, crossref) and outcome |
| `chive_citations_extracted_total`            | Counter   | `source`           | Individual citations extracted, by source                                        |
| `chive_citations_matched_total`              | Counter   | `match_method`     | Citations matched to Chive eprints (doi, title)                                  |
| `chive_citation_extraction_duration_seconds` | Histogram | `source`, `status` | Extraction duration (buckets: 100ms to 60s)                                      |

**Source:** `src/observability/prometheus-registry.ts` (exported as `citationMetrics`)

**Instrumented in:** `src/services/citation/` extraction service

## Background job metrics

Tracks execution of periodic background jobs (PDS scanning, governance sync, etc.).

| Metric                            | Type      | Labels          | Description                                      |
| --------------------------------- | --------- | --------------- | ------------------------------------------------ |
| `chive_job_executions_total`      | Counter   | `job`, `status` | Total job executions by name and outcome         |
| `chive_job_duration_seconds`      | Histogram | `job`, `status` | Execution duration (buckets: 100ms to 5 minutes) |
| `chive_job_last_run_timestamp`    | Gauge     | `job`           | Unix timestamp of last execution                 |
| `chive_job_items_processed_total` | Counter   | `job`, `status` | Items processed by jobs                          |

**Source:** `src/observability/prometheus-registry.ts` (exported as `jobMetrics`)

**Instrumented in:** `src/jobs/` job runners

## Worker metrics

Tracks background worker task processing (thread pool workers, queue consumers).

| Metric                               | Type      | Labels             | Description                                      |
| ------------------------------------ | --------- | ------------------ | ------------------------------------------------ |
| `chive_worker_tasks_total`           | Counter   | `worker`, `status` | Total tasks processed by worker name and outcome |
| `chive_worker_task_duration_seconds` | Histogram | `worker`           | Task duration (buckets: 10ms to 30s)             |
| `chive_worker_queue_depth`           | Gauge     | `worker`           | Current pending items in worker queue            |
| `chive_worker_active_count`          | Gauge     | `worker`           | Currently active workers                         |

**Source:** `src/observability/prometheus-registry.ts` (exported as `workerMetrics`)

**Instrumented in:** `src/workers/` worker implementations

## Authentication metrics

Tracks authentication attempts, token validation, and role lookups.

| Metric                        | Type      | Labels             | Description                                                                     |
| ----------------------------- | --------- | ------------------ | ------------------------------------------------------------------------------- |
| `chive_auth_attempts_total`   | Counter   | `method`, `result` | Auth attempts by method (service_auth) and result (success, failure, anonymous) |
| `chive_auth_duration_seconds` | Histogram | `method`           | Auth processing duration (buckets: 10ms to 5s)                                  |
| `chive_role_lookups_total`    | Counter   | `result`           | Role lookups by result (cache_hit, cache_miss)                                  |

**Source:** `src/observability/prometheus-registry.ts` (exported as `authMetrics`)

**Instrumented in:** `src/auth/` middleware

## Search metrics

Tracks Elasticsearch search queries and results.

| Metric                          | Type      | Labels  | Description                             |
| ------------------------------- | --------- | ------- | --------------------------------------- |
| `chive_search_queries_total`    | Counter   | `type`  | Total search queries by type            |
| `chive_search_results_total`    | Counter   | `type`  | Total results returned by type          |
| `chive_search_duration_seconds` | Histogram | `phase` | Duration by phase (buckets: 10ms to 5s) |

**Source:** `src/observability/prometheus-registry.ts` (exported as `searchMetrics`)

**Instrumented in:** `src/services/search/` search service

## Blob proxy metrics

Tracks blob proxy requests (fetching PDFs and other blobs from user PDSes).

| Metric                              | Type      | Labels            | Description                                                      |
| ----------------------------------- | --------- | ----------------- | ---------------------------------------------------------------- |
| `chive_blob_proxy_requests_total`   | Counter   | `status`, `cache` | Proxy requests by HTTP status and cache source (redis, cdn, pds) |
| `chive_blob_proxy_bytes_total`      | Counter   | `direction`       | Bytes transferred (in/out)                                       |
| `chive_blob_proxy_duration_seconds` | Histogram | (none)            | Request duration (buckets: 10ms to 10s)                          |

**Source:** `src/observability/prometheus-registry.ts` (exported as `blobProxyMetrics`)

**Instrumented in:** `src/api/` blob proxy handler

## Dead letter queue (DLQ) metrics

Tracks the firehose dead-letter queue size and retry operations.

| Metric                    | Type    | Labels   | Description                                    |
| ------------------------- | ------- | -------- | ---------------------------------------------- |
| `chive_dlq_entries_total` | Gauge   | (none)   | Current number of entries in the DLQ           |
| `chive_dlq_retries_total` | Counter | `status` | Retry operations by outcome (success, failure) |

**Source:** `src/observability/prometheus-registry.ts` (exported as `dlqMetrics`)

**Instrumented in:** `src/api/handlers/xrpc/admin/` DLQ handlers (`listDLQEntries`, `retryDLQEntry`, `retryAllDLQ`, `dismissDLQEntry`, `purgeOldDLQ`)

## Admin action metrics

Tracks administrative operations performed through the admin dashboard.

| Metric                      | Type    | Labels             | Description                      |
| --------------------------- | ------- | ------------------ | -------------------------------- |
| `chive_admin_actions_total` | Counter | `action`, `target` | Admin actions by type and target |

Common label combinations:

| `action`      | `target`                      | When                       |
| ------------- | ----------------------------- | -------------------------- |
| `approve`     | `alpha_application`           | Alpha application approved |
| `reject`      | `alpha_application`           | Alpha application rejected |
| `revoke`      | `alpha_application`           | Alpha application revoked  |
| `assign_role` | `user`                        | Role assigned to user      |
| `revoke_role` | `user`                        | Role revoked from user     |
| `delete`      | `pub.chive.eprint.submission` | Eprint soft-deleted        |
| `delete`      | `pub.chive.review.comment`    | Review soft-deleted        |
| `rescan`      | `pds`                         | PDS rescan triggered       |

**Source:** `src/observability/prometheus-registry.ts` (exported as `adminMetrics`)

**Instrumented in:** `src/api/handlers/xrpc/admin/` mutation handlers

## Backfill operation metrics

Tracks backfill operations triggered through the admin dashboard.

| Metric                             | Type      | Labels           | Description                                                            |
| ---------------------------------- | --------- | ---------------- | ---------------------------------------------------------------------- |
| `chive_backfill_operations_total`  | Counter   | `type`, `status` | Operations by type and outcome (started, completed, failed, cancelled) |
| `chive_backfill_records_processed` | Counter   | `type`           | Total records processed across all backfills                           |
| `chive_backfill_duration_seconds`  | Histogram | `type`           | Operation duration (buckets: 1s, 5s, 10s, 30s, 60s, 5m, 10m, 30m, 1h)  |

**Source:** `src/observability/prometheus-registry.ts` (exported as `backfillMetrics`)

**Instrumented in:** `src/services/admin/backfill-manager.ts`

## Grafana dashboard recommendations

### Admin operations dashboard

Create a Grafana dashboard with the following panels:

| Panel                      | Query                                                                                                                         | Visualization                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Admin actions per hour     | `rate(chive_admin_actions_total[1h])`                                                                                         | Time series, split by `action` |
| Active backfill operations | `chive_backfill_operations_total{status="started"} - chive_backfill_operations_total{status=~"completed\|failed\|cancelled"}` | Stat                           |
| Backfill duration P95      | `histogram_quantile(0.95, rate(chive_backfill_duration_seconds_bucket[1h]))`                                                  | Time series, split by `type`   |
| DLQ depth                  | `chive_dlq_entries_total`                                                                                                     | Gauge                          |
| DLQ retry rate             | `rate(chive_dlq_retries_total[5m])`                                                                                           | Time series                    |

### PDS scanning dashboard

| Panel                      | Query                                                                        | Visualization                      |
| -------------------------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| PDS scans per hour         | `rate(chive_pds_scans_total[1h])`                                            | Time series, split by `status`     |
| Records indexed per minute | `rate(chive_pds_records_indexed_total[1m])`                                  | Time series, split by `collection` |
| PDSes discovered           | `chive_pdses_discovered_total`                                               | Stat                               |
| PDSes with records         | `chive_pdses_with_records_total`                                             | Stat                               |
| Scan duration P95          | `histogram_quantile(0.95, rate(chive_pds_scan_duration_seconds_bucket[1h]))` | Time series                        |

### Authentication dashboard

| Panel                      | Query                                                                                         | Visualization                  |
| -------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------ |
| Auth attempts per minute   | `rate(chive_auth_attempts_total[1m])`                                                         | Time series, split by `result` |
| Auth failure rate          | `rate(chive_auth_attempts_total{result="failure"}[5m]) / rate(chive_auth_attempts_total[5m])` | Gauge                          |
| Auth duration P99          | `histogram_quantile(0.99, rate(chive_auth_duration_seconds_bucket[5m]))`                      | Time series                    |
| Role lookup cache hit rate | `rate(chive_role_lookups_total{result="cache_hit"}[5m]) / rate(chive_role_lookups_total[5m])` | Gauge                          |

## Next steps

- [Monitoring](./monitoring): Prometheus configuration, alerting, and Grafana setup
- [Admin dashboard](./admin-dashboard): Accessing metrics through the admin UI
- [Admin API reference](../api-reference/admin-endpoints): `getPrometheusMetrics`, `getEndpointMetrics`, and `getNodeMetrics` endpoints
