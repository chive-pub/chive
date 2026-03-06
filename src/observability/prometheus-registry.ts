/**
 * Prometheus metrics registry and default metrics.
 *
 * @remarks
 * Provides a centralized Prometheus registry with pre-defined metrics
 * for Chive services. Collects default Node.js metrics with `chive_` prefix.
 *
 * @packageDocumentation
 * @module observability/prometheus-registry
 * @public
 */

import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  type CounterConfiguration,
  type GaugeConfiguration,
  type HistogramConfiguration,
} from 'prom-client';

/**
 * Default histogram buckets for duration measurements.
 *
 * @remarks
 * Covers latencies from 10ms to 10s, suitable for HTTP request durations.
 * Buckets: 10ms, 50ms, 100ms, 500ms, 1s, 5s, 10s
 *
 * @public
 */
export const DEFAULT_HISTOGRAM_BUCKETS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10] as const;

/**
 * Maximum cardinality (unique label combinations) per metric.
 *
 * @remarks
 * Prometheus performance degrades with high cardinality.
 * This limit helps prevent runaway metric growth.
 *
 * @public
 */
export const MAX_CARDINALITY = 10000;

/**
 * Centralized Prometheus registry for Chive metrics.
 *
 * @remarks
 * All metrics should be registered with this registry.
 * Exposed via `/metrics` endpoint for Prometheus scraping.
 *
 * @example
 * ```typescript
 * import { prometheusRegistry } from './prometheus-registry.js';
 *
 * // In HTTP handler
 * app.get('/metrics', async (req, res) => {
 *   res.set('Content-Type', prometheusRegistry.contentType);
 *   res.end(await prometheusRegistry.metrics());
 * });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export const prometheusRegistry = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop, GC, etc.)
collectDefaultMetrics({
  register: prometheusRegistry,
  prefix: 'chive_',
});

/**
 * Pre-defined metrics for HTTP request tracking.
 *
 * @remarks
 * These metrics follow the RED method (Rate, Errors, Duration).
 *
 * @public
 */
export const httpMetrics = {
  /**
   * Total HTTP requests counter.
   *
   * @remarks
   * Labels: method, endpoint, status
   *
   * @example
   * ```typescript
   * httpMetrics.requestsTotal.inc({ method: 'GET', endpoint: '/api/eprints', status: '200' });
   * ```
   */
  requestsTotal: new Counter({
    name: 'chive_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'endpoint', 'status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'method' | 'endpoint' | 'status'>),

  /**
   * HTTP request duration histogram.
   *
   * @remarks
   * Labels: method, endpoint, status
   * Buckets: 10ms to 10s
   *
   * @example
   * ```typescript
   * const end = httpMetrics.requestDuration.startTimer({ method: 'GET', endpoint: '/api/eprints' });
   * // ... handle request ...
   * end({ status: '200' });
   * ```
   */
  requestDuration: new Histogram({
    name: 'chive_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'endpoint', 'status'] as const,
    buckets: [...DEFAULT_HISTOGRAM_BUCKETS],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'method' | 'endpoint' | 'status'>),
};

/**
 * Pre-defined metrics for eprint indexing.
 *
 * @remarks
 * Tracks eprint indexing operations and errors.
 *
 * @public
 */
export const eprintMetrics = {
  /**
   * Total eprints indexed counter.
   *
   * @remarks
   * Labels: field (knowledge graph field), status (success/error)
   *
   * @example
   * ```typescript
   * eprintMetrics.indexedTotal.inc({ field: 'cs.AI', status: 'success' });
   * ```
   */
  indexedTotal: new Counter({
    name: 'chive_eprints_indexed_total',
    help: 'Total number of eprints indexed',
    labelNames: ['field', 'status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'field' | 'status'>),

  /**
   * Eprint indexing duration histogram.
   *
   * @remarks
   * Labels: status (success/error)
   *
   * @example
   * ```typescript
   * const end = eprintMetrics.indexingDuration.startTimer();
   * // ... index eprint ...
   * end({ status: 'success' });
   * ```
   */
  indexingDuration: new Histogram({
    name: 'chive_eprint_indexing_duration_seconds',
    help: 'Eprint indexing duration in seconds',
    labelNames: ['status'] as const,
    buckets: [...DEFAULT_HISTOGRAM_BUCKETS],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'status'>),
};

/**
 * Pre-defined metrics for firehose consumer.
 *
 * @remarks
 * Tracks firehose event processing and lag.
 *
 * @public
 */
export const firehoseMetrics = {
  /**
   * Total firehose events processed counter.
   *
   * @remarks
   * Labels: event_type (commit, identity, account, handle)
   *
   * @example
   * ```typescript
   * firehoseMetrics.eventsTotal.inc({ event_type: 'commit' });
   * ```
   */
  eventsTotal: new Counter({
    name: 'chive_firehose_events_total',
    help: 'Total number of firehose events processed',
    labelNames: ['event_type'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'event_type'>),

  /**
   * Firehose cursor lag gauge.
   *
   * @remarks
   * Measures how far behind the consumer is from the relay.
   *
   * @example
   * ```typescript
   * firehoseMetrics.cursorLag.set(lagSeconds);
   * ```
   */
  cursorLag: new Gauge({
    name: 'chive_firehose_cursor_lag_seconds',
    help: 'Firehose cursor lag in seconds',
    registers: [prometheusRegistry],
  } satisfies GaugeConfiguration<string>),

  /**
   * Active firehose connections gauge.
   *
   * @remarks
   * Number of active WebSocket connections to relay.
   *
   * @example
   * ```typescript
   * firehoseMetrics.activeConnections.inc();
   * // ... on disconnect ...
   * firehoseMetrics.activeConnections.dec();
   * ```
   */
  activeConnections: new Gauge({
    name: 'chive_firehose_active_connections',
    help: 'Number of active firehose connections',
    registers: [prometheusRegistry],
  } satisfies GaugeConfiguration<string>),

  /**
   * Total firehose parse errors counter.
   *
   * @remarks
   * Counts events that failed to parse from the Jetstream JSON format.
   * Labels: error_type (json_parse, validation, unknown)
   *
   * @example
   * ```typescript
   * firehoseMetrics.parseErrorsTotal.inc({ error_type: 'json_parse' });
   * ```
   */
  parseErrorsTotal: new Counter({
    name: 'chive_firehose_parse_errors_total',
    help: 'Total number of firehose events that failed to parse',
    labelNames: ['error_type'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'error_type'>),
};

/**
 * Pre-defined metrics for database connections.
 *
 * @remarks
 * Tracks connection pool status for PostgreSQL, Redis, etc.
 *
 * @public
 */
export const databaseMetrics = {
  /**
   * Active database connections gauge.
   *
   * @remarks
   * Labels: database (postgresql, redis, elasticsearch, neo4j)
   *
   * @example
   * ```typescript
   * databaseMetrics.activeConnections.set({ database: 'postgresql' }, pool.totalCount);
   * ```
   */
  activeConnections: new Gauge({
    name: 'chive_database_connections_active',
    help: 'Number of active database connections',
    labelNames: ['database'] as const,
    registers: [prometheusRegistry],
  } satisfies GaugeConfiguration<'database'>),

  /**
   * Database query duration histogram.
   *
   * @remarks
   * Labels: database, operation
   *
   * @example
   * ```typescript
   * const end = databaseMetrics.queryDuration.startTimer({ database: 'postgresql', operation: 'select' });
   * // ... execute query ...
   * end();
   * ```
   */
  queryDuration: new Histogram({
    name: 'chive_database_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['database', 'operation'] as const,
    buckets: [...DEFAULT_HISTOGRAM_BUCKETS],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'database' | 'operation'>),
};

/**
 * Pre-defined metrics for PDS scanning and backfilling.
 *
 * @remarks
 * Tracks PDS discovery, scanning, and record indexing operations.
 *
 * @public
 */
export const pdsMetrics = {
  /**
   * Total PDS scans counter.
   *
   * @remarks
   * Labels: status (success/error/skipped)
   *
   * @example
   * ```typescript
   * pdsMetrics.scansTotal.inc({ status: 'success' });
   * ```
   */
  scansTotal: new Counter({
    name: 'chive_pds_scans_total',
    help: 'Total number of PDS scans',
    labelNames: ['status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'status'>),

  /**
   * PDS scan duration histogram.
   *
   * @remarks
   * Labels: status (success/error)
   *
   * @example
   * ```typescript
   * const end = pdsMetrics.scanDuration.startTimer();
   * // ... scan PDS ...
   * end({ status: 'success' });
   * ```
   */
  scanDuration: new Histogram({
    name: 'chive_pds_scan_duration_seconds',
    help: 'PDS scan duration in seconds',
    labelNames: ['status'] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'status'>),

  /**
   * Total records scanned counter.
   *
   * @remarks
   * Labels: collection (pub.chive.eprint.submission, etc.)
   *
   * @example
   * ```typescript
   * pdsMetrics.recordsScanned.inc({ collection: 'pub.chive.eprint.submission' });
   * ```
   */
  recordsScanned: new Counter({
    name: 'chive_pds_records_scanned_total',
    help: 'Total number of records scanned from PDSes',
    labelNames: ['collection'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'collection'>),

  /**
   * Total records indexed counter.
   *
   * @remarks
   * Labels: collection, status (success/error)
   *
   * @example
   * ```typescript
   * pdsMetrics.recordsIndexed.inc({ collection: 'pub.chive.eprint.submission', status: 'success' });
   * ```
   */
  recordsIndexed: new Counter({
    name: 'chive_pds_records_indexed_total',
    help: 'Total number of records indexed from PDS scans',
    labelNames: ['collection', 'status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'collection' | 'status'>),

  /**
   * Record indexing duration histogram.
   *
   * @remarks
   * Labels: collection, status
   *
   * @example
   * ```typescript
   * const end = pdsMetrics.recordIndexDuration.startTimer({ collection: 'pub.chive.eprint.submission' });
   * // ... index record ...
   * end({ status: 'success' });
   * ```
   */
  recordIndexDuration: new Histogram({
    name: 'chive_pds_record_index_duration_seconds',
    help: 'PDS record indexing duration in seconds',
    labelNames: ['collection', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'collection' | 'status'>),

  /**
   * PDSes discovered gauge.
   *
   * @remarks
   * Total number of PDSes known to the system.
   *
   * @example
   * ```typescript
   * pdsMetrics.pdsesDiscovered.set(count);
   * ```
   */
  pdsesDiscovered: new Gauge({
    name: 'chive_pdses_discovered_total',
    help: 'Total number of PDSes discovered',
    registers: [prometheusRegistry],
  } satisfies GaugeConfiguration<string>),

  /**
   * PDSes with Chive records gauge.
   *
   * @remarks
   * Number of PDSes that have pub.chive.* records.
   *
   * @example
   * ```typescript
   * pdsMetrics.pdsesWithRecords.set(count);
   * ```
   */
  pdsesWithRecords: new Gauge({
    name: 'chive_pdses_with_records_total',
    help: 'Number of PDSes with Chive records',
    registers: [prometheusRegistry],
  } satisfies GaugeConfiguration<string>),
};

/**
 * Pre-defined metrics for citation extraction.
 *
 * @remarks
 * Tracks GROBID extraction, Semantic Scholar enrichment,
 * and Chive matching operations.
 *
 * @public
 */
export const citationMetrics = {
  /**
   * Total citation extractions counter.
   *
   * @remarks
   * Labels: source (grobid, semantic-scholar, crossref), status (success/error)
   *
   * @example
   * ```typescript
   * citationMetrics.extractionsTotal.inc({ source: 'grobid', status: 'success' });
   * ```
   */
  extractionsTotal: new Counter({
    name: 'chive_citation_extractions_total',
    help: 'Total number of citation extraction operations',
    labelNames: ['source', 'status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'source' | 'status'>),

  /**
   * Total citations extracted counter.
   *
   * @remarks
   * Labels: source (grobid, semantic-scholar, crossref)
   *
   * @example
   * ```typescript
   * citationMetrics.citationsExtracted.inc({ source: 'grobid' }, refCount);
   * ```
   */
  citationsExtracted: new Counter({
    name: 'chive_citations_extracted_total',
    help: 'Total number of individual citations extracted',
    labelNames: ['source'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'source'>),

  /**
   * Citations matched to Chive eprints counter.
   *
   * @remarks
   * Labels: match_method (doi, title)
   *
   * @example
   * ```typescript
   * citationMetrics.citationsMatched.inc({ match_method: 'doi' });
   * ```
   */
  citationsMatched: new Counter({
    name: 'chive_citations_matched_total',
    help: 'Total number of citations matched to Chive eprints',
    labelNames: ['match_method'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'match_method'>),

  /**
   * Citation extraction duration histogram.
   *
   * @remarks
   * Labels: source (grobid, semantic-scholar, crossref), status (success/error)
   *
   * @example
   * ```typescript
   * const end = citationMetrics.extractionDuration.startTimer({ source: 'grobid' });
   * // ... extract ...
   * end({ status: 'success' });
   * ```
   */
  extractionDuration: new Histogram({
    name: 'chive_citation_extraction_duration_seconds',
    help: 'Citation extraction duration in seconds',
    labelNames: ['source', 'status'] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'source' | 'status'>),
};

/**
 * Pre-defined metrics for background job execution.
 *
 * @remarks
 * Tracks job executions, duration, last run timestamps, and items processed.
 *
 * @public
 */
export const jobMetrics = {
  /**
   * Total job executions counter.
   *
   * @remarks
   * Labels: job, status (success/error)
   */
  executionsTotal: new Counter({
    name: 'chive_job_executions_total',
    help: 'Total job executions',
    labelNames: ['job', 'status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'job' | 'status'>),

  /**
   * Job execution duration histogram.
   *
   * @remarks
   * Labels: job, status (success/error)
   * Buckets: 100ms to 5 minutes
   */
  duration: new Histogram({
    name: 'chive_job_duration_seconds',
    help: 'Job execution duration',
    labelNames: ['job', 'status'] as const,
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'job' | 'status'>),

  /**
   * Unix timestamp of last job run.
   *
   * @remarks
   * Labels: job
   */
  lastRunTimestamp: new Gauge({
    name: 'chive_job_last_run_timestamp',
    help: 'Unix timestamp of last job run',
    labelNames: ['job'] as const,
    registers: [prometheusRegistry],
  } satisfies GaugeConfiguration<'job'>),

  /**
   * Total items processed by jobs.
   *
   * @remarks
   * Labels: job, status (success/error)
   */
  itemsProcessed: new Counter({
    name: 'chive_job_items_processed_total',
    help: 'Total items processed by jobs',
    labelNames: ['job', 'status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'job' | 'status'>),
};

/**
 * Pre-defined metrics for background worker tasks.
 *
 * @remarks
 * Tracks worker task counts, duration, queue depth, and active counts.
 *
 * @public
 */
export const workerMetrics = {
  /**
   * Total worker tasks processed counter.
   *
   * @remarks
   * Labels: worker, status (success/error)
   */
  tasksTotal: new Counter({
    name: 'chive_worker_tasks_total',
    help: 'Total worker tasks processed',
    labelNames: ['worker', 'status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'worker' | 'status'>),

  /**
   * Worker task duration histogram.
   *
   * @remarks
   * Labels: worker
   * Buckets: 10ms to 30s
   */
  taskDuration: new Histogram({
    name: 'chive_worker_task_duration_seconds',
    help: 'Worker task duration',
    labelNames: ['worker'] as const,
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'worker'>),

  /**
   * Current worker queue depth gauge.
   *
   * @remarks
   * Labels: worker
   */
  queueDepth: new Gauge({
    name: 'chive_worker_queue_depth',
    help: 'Current worker queue depth',
    labelNames: ['worker'] as const,
    registers: [prometheusRegistry],
  } satisfies GaugeConfiguration<'worker'>),

  /**
   * Currently active workers gauge.
   *
   * @remarks
   * Labels: worker
   */
  activeCount: new Gauge({
    name: 'chive_worker_active_count',
    help: 'Currently active workers',
    labelNames: ['worker'] as const,
    registers: [prometheusRegistry],
  } satisfies GaugeConfiguration<'worker'>),
};

/**
 * Pre-defined metrics for authentication operations.
 *
 * @remarks
 * Tracks auth attempts, duration, and role lookups.
 *
 * @public
 */
export const authMetrics = {
  /**
   * Total authentication attempts counter.
   *
   * @remarks
   * Labels: method (service_auth), result (success/failure/anonymous)
   */
  attemptsTotal: new Counter({
    name: 'chive_auth_attempts_total',
    help: 'Total authentication attempts',
    labelNames: ['method', 'result'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'method' | 'result'>),

  /**
   * Authentication duration histogram.
   *
   * @remarks
   * Labels: method (service_auth)
   * Buckets: 10ms to 5s
   */
  duration: new Histogram({
    name: 'chive_auth_duration_seconds',
    help: 'Authentication duration',
    labelNames: ['method'] as const,
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'method'>),

  /**
   * Total role lookups counter.
   *
   * @remarks
   * Labels: result (cache_hit/cache_miss)
   */
  roleLookups: new Counter({
    name: 'chive_role_lookups_total',
    help: 'Total role lookups',
    labelNames: ['result'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'result'>),
};

/**
 * Pre-defined metrics for search operations.
 *
 * @remarks
 * Tracks search queries, results returned, and duration by phase.
 *
 * @public
 */
export const searchMetrics = {
  /**
   * Total search queries counter.
   *
   * @remarks
   * Labels: type
   */
  queriesTotal: new Counter({
    name: 'chive_search_queries_total',
    help: 'Total search queries',
    labelNames: ['type'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'type'>),

  /**
   * Total search results returned counter.
   *
   * @remarks
   * Labels: type
   */
  resultsTotal: new Counter({
    name: 'chive_search_results_total',
    help: 'Total search results returned',
    labelNames: ['type'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'type'>),

  /**
   * Search duration histogram by phase.
   *
   * @remarks
   * Labels: phase
   * Buckets: 10ms to 5s
   */
  duration: new Histogram({
    name: 'chive_search_duration_seconds',
    help: 'Search duration by phase',
    labelNames: ['phase'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'phase'>),
};

/**
 * Pre-defined metrics for blob proxy operations.
 *
 * @remarks
 * Tracks blob proxy requests, bytes transferred, and duration.
 *
 * @public
 */
export const blobProxyMetrics = {
  /**
   * Total blob proxy requests counter.
   *
   * @remarks
   * Labels: status, cache (redis/cdn/pds)
   */
  requestsTotal: new Counter({
    name: 'chive_blob_proxy_requests_total',
    help: 'Total blob proxy requests',
    labelNames: ['status', 'cache'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'status' | 'cache'>),

  /**
   * Total bytes transferred counter.
   *
   * @remarks
   * Labels: direction (in/out)
   */
  bytesTotal: new Counter({
    name: 'chive_blob_proxy_bytes_total',
    help: 'Total bytes transferred',
    labelNames: ['direction'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'direction'>),

  /**
   * Blob proxy request duration histogram.
   *
   * @remarks
   * Buckets: 10ms to 10s
   */
  duration: new Histogram({
    name: 'chive_blob_proxy_duration_seconds',
    help: 'Blob proxy request duration',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<string>),
};

/**
 * Pre-defined metrics for the dead letter queue.
 *
 * @remarks
 * Tracks DLQ entry count and retry operations.
 *
 * @public
 */
export const dlqMetrics = {
  /**
   * Current DLQ entry count gauge.
   */
  entriesTotal: new Gauge({
    name: 'chive_dlq_entries_total',
    help: 'Current DLQ entry count',
    registers: [prometheusRegistry],
  } satisfies GaugeConfiguration<string>),

  /**
   * Total DLQ retries counter.
   *
   * @remarks
   * Labels: status (success/failure)
   */
  retriesTotal: new Counter({
    name: 'chive_dlq_retries_total',
    help: 'Total DLQ retries',
    labelNames: ['status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'status'>),
};

/**
 * Pre-defined metrics for admin actions.
 *
 * @remarks
 * Tracks administrative operations performed via the admin dashboard.
 *
 * @public
 */
export const adminMetrics = {
  /**
   * Total admin actions counter.
   *
   * @remarks
   * Labels: action, target
   */
  actionsTotal: new Counter({
    name: 'chive_admin_actions_total',
    help: 'Total admin actions',
    labelNames: ['action', 'target'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'action' | 'target'>),
};

/**
 * Pre-defined metrics for backfill operations.
 *
 * @remarks
 * Tracks backfill operations, records processed, and duration.
 *
 * @public
 */
export const backfillMetrics = {
  /**
   * Total backfill operations counter.
   *
   * @remarks
   * Labels: type, status (success/error)
   */
  operationsTotal: new Counter({
    name: 'chive_backfill_operations_total',
    help: 'Total backfill operations',
    labelNames: ['type', 'status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'type' | 'status'>),

  /**
   * Total records processed during backfills counter.
   *
   * @remarks
   * Labels: type
   */
  recordsProcessed: new Counter({
    name: 'chive_backfill_records_processed',
    help: 'Total records processed during backfills',
    labelNames: ['type'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'type'>),

  /**
   * Backfill operation duration histogram.
   *
   * @remarks
   * Labels: type
   * Buckets: 1s to 1 hour
   */
  duration: new Histogram({
    name: 'chive_backfill_duration_seconds',
    help: 'Backfill operation duration',
    labelNames: ['type'] as const,
    buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
    registers: [prometheusRegistry],
  } satisfies HistogramConfiguration<'type'>),
};

/**
 * Retrieves all metrics in Prometheus text format.
 *
 * @returns Promise resolving to metrics string
 *
 * @remarks
 * Use this in the `/metrics` endpoint handler.
 *
 * @example
 * ```typescript
 * app.get('/metrics', async (req, res) => {
 *   res.set('Content-Type', prometheusRegistry.contentType);
 *   res.end(await getMetrics());
 * });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export async function getMetrics(): Promise<string> {
  return prometheusRegistry.metrics();
}

/**
 * Content type for Prometheus metrics response.
 *
 * @remarks
 * Set this as the Content-Type header when serving `/metrics`.
 *
 * @public
 */
export const metricsContentType = prometheusRegistry.contentType;
