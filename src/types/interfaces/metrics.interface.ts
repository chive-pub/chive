/**
 * Metrics interface for Prometheus-compatible metrics.
 *
 * @remarks
 * This interface provides metrics collection for monitoring and alerting.
 * All metrics are exposed in Prometheus format for scraping.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Metric type enumeration.
 *
 * @remarks
 * Prometheus metric types:
 * - **Counter**: Monotonically increasing value (e.g., request count)
 * - **Gauge**: Value that can go up or down (e.g., queue size)
 * - **Histogram**: Distribution of values (e.g., request duration)
 * - **Summary**: Similar to histogram with quantiles
 *
 * @public
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

/**
 * Metric labels for dimensionality.
 *
 * @remarks
 * Labels enable filtering and grouping metrics in queries.
 *
 * Common labels:
 * - `method`: HTTP method (GET, POST, etc.)
 * - `status`: HTTP status code
 * - `endpoint`: API endpoint path
 * - `operation`: Operation name
 *
 * @public
 */
export type MetricLabels = Readonly<Record<string, string>>;

/**
 * Metrics interface for Prometheus.
 *
 * @remarks
 * Provides metrics collection with Prometheus-compatible output.
 *
 * Implementation notes:
 * - Uses `prom-client` library
 * - Exposes `/metrics` endpoint for scraping
 * - Default buckets for histograms: [0.01, 0.05, 0.1, 0.5, 1, 5, 10]
 *
 * @public
 */
export interface IMetrics {
  /**
   * Increments a counter.
   *
   * @param name - Metric name
   * @param labels - Metric labels
   * @param value - Increment value (default: 1)
   *
   * @example
   * ```typescript
   * metrics.incrementCounter('http_requests_total', { method: 'GET', endpoint: '/api/preprints' });
   * ```
   *
   * @public
   */
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;

  /**
   * Sets a gauge value.
   *
   * @param name - Metric name
   * @param value - Gauge value
   * @param labels - Metric labels
   *
   * @example
   * ```typescript
   * metrics.setGauge('indexing_queue_size', queueSize, { queue: 'preprints' });
   * ```
   *
   * @public
   */
  setGauge(name: string, value: number, labels?: MetricLabels): void;

  /**
   * Observes a histogram value.
   *
   * @param name - Metric name
   * @param value - Observed value
   * @param labels - Metric labels
   *
   * @remarks
   * Typically used for request durations and sizes.
   *
   * @example
   * ```typescript
   * metrics.observeHistogram('http_request_duration_seconds', duration, {
   *   method: 'GET',
   *   endpoint: '/api/preprints'
   * });
   * ```
   *
   * @public
   */
  observeHistogram(name: string, value: number, labels?: MetricLabels): void;

  /**
   * Starts a timer for duration measurement.
   *
   * @param name - Metric name
   * @param labels - Metric labels
   * @returns End function to stop timer
   *
   * @remarks
   * Convenience method for measuring operation duration.
   * Call the returned function to record the duration.
   *
   * @example
   * ```typescript
   * const endTimer = metrics.startTimer('operation_duration_seconds', { operation: 'indexPreprint' });
   * try {
   *   await indexPreprint(preprint);
   * } finally {
   *   endTimer(); // Records duration in histogram
   * }
   * ```
   *
   * @public
   */
  startTimer(name: string, labels?: MetricLabels): () => void;
}
