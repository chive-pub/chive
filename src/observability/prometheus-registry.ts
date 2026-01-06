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
   * httpMetrics.requestsTotal.inc({ method: 'GET', endpoint: '/api/preprints', status: '200' });
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
   * const end = httpMetrics.requestDuration.startTimer({ method: 'GET', endpoint: '/api/preprints' });
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
 * Pre-defined metrics for preprint indexing.
 *
 * @remarks
 * Tracks preprint indexing operations and errors.
 *
 * @public
 */
export const preprintMetrics = {
  /**
   * Total preprints indexed counter.
   *
   * @remarks
   * Labels: field (knowledge graph field), status (success/error)
   *
   * @example
   * ```typescript
   * preprintMetrics.indexedTotal.inc({ field: 'cs.AI', status: 'success' });
   * ```
   */
  indexedTotal: new Counter({
    name: 'chive_preprints_indexed_total',
    help: 'Total number of preprints indexed',
    labelNames: ['field', 'status'] as const,
    registers: [prometheusRegistry],
  } satisfies CounterConfiguration<'field' | 'status'>),

  /**
   * Preprint indexing duration histogram.
   *
   * @remarks
   * Labels: status (success/error)
   *
   * @example
   * ```typescript
   * const end = preprintMetrics.indexingDuration.startTimer();
   * // ... index preprint ...
   * end({ status: 'success' });
   * ```
   */
  indexingDuration: new Histogram({
    name: 'chive_preprint_indexing_duration_seconds',
    help: 'Preprint indexing duration in seconds',
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
