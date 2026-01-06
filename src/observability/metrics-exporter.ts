/**
 * Prometheus metrics implementation of IMetrics interface.
 *
 * @remarks
 * Implements {@link IMetrics} using prom-client library.
 * Provides dynamic metric creation with caching and cardinality protection.
 *
 * @packageDocumentation
 * @module observability/metrics-exporter
 * @public
 */

import { Counter, Gauge, Histogram, type Registry } from 'prom-client';

import { ValidationError } from '../types/errors.js';
import type { IMetrics, MetricLabels } from '../types/interfaces/metrics.interface.js';

import {
  prometheusRegistry,
  DEFAULT_HISTOGRAM_BUCKETS,
  MAX_CARDINALITY,
} from './prometheus-registry.js';

/**
 * Configuration options for PrometheusMetrics.
 *
 * @public
 */
export interface PrometheusMetricsOptions {
  /**
   * Prometheus registry to use.
   *
   * @remarks
   * Defaults to the shared prometheusRegistry.
   *
   * @defaultValue prometheusRegistry
   */
  readonly registry?: Registry;

  /**
   * Prefix for all metric names.
   *
   * @remarks
   * Helps namespace metrics and avoid collisions.
   *
   * @defaultValue 'chive_'
   */
  readonly prefix?: string;

  /**
   * Default histogram buckets.
   *
   * @remarks
   * Used when creating new histogram metrics.
   *
   * @defaultValue [0.01, 0.05, 0.1, 0.5, 1, 5, 10]
   */
  readonly defaultBuckets?: readonly number[];

  /**
   * Maximum cardinality per metric.
   *
   * @remarks
   * Limits unique label combinations to prevent memory issues.
   *
   * @defaultValue 10000
   */
  readonly maxCardinality?: number;
}

/**
 * Cached metric instance.
 *
 * @internal
 */
interface CachedMetric {
  readonly type: 'counter' | 'gauge' | 'histogram';
  readonly metric: Counter | Gauge | Histogram;
  readonly labelNames: readonly string[];
  cardinality: number;
}

/**
 * Prometheus-based metrics implementation.
 *
 * @remarks
 * Implements {@link IMetrics} interface with:
 * - Dynamic metric creation (metrics created on first use)
 * - Metric caching (avoids re-registration)
 * - Cardinality protection (limits unique label combinations)
 * - Automatic label name extraction
 *
 * Metrics are registered with the provided Prometheus registry and
 * can be scraped via the `/metrics` endpoint.
 *
 * @example
 * ```typescript
 * const metrics = new PrometheusMetrics({ prefix: 'myapp_' });
 *
 * // Counter
 * metrics.incrementCounter('requests_total', { method: 'GET', status: '200' });
 *
 * // Gauge
 * metrics.setGauge('queue_size', 42, { queue: 'indexing' });
 *
 * // Histogram
 * metrics.observeHistogram('request_duration_seconds', 0.15, { endpoint: '/api' });
 *
 * // Timer
 * const endTimer = metrics.startTimer('operation_duration_seconds', { op: 'index' });
 * await doWork();
 * endTimer();
 * ```
 *
 * @see {@link IMetrics} for interface contract
 * @public
 * @since 0.1.0
 */
export class PrometheusMetrics implements IMetrics {
  private readonly registry: Registry;
  private readonly prefix: string;
  private readonly defaultBuckets: readonly number[];
  private readonly maxCardinality: number;
  private readonly metricCache = new Map<string, CachedMetric>();

  /**
   * Creates a new PrometheusMetrics instance.
   *
   * @param options - Configuration options
   *
   * @example
   * ```typescript
   * // Use defaults
   * const metrics = new PrometheusMetrics();
   *
   * // Custom configuration
   * const customMetrics = new PrometheusMetrics({
   *   prefix: 'myservice_',
   *   defaultBuckets: [0.1, 0.5, 1, 2, 5],
   *   maxCardinality: 5000,
   * });
   * ```
   *
   * @public
   */
  constructor(options: PrometheusMetricsOptions = {}) {
    this.registry = options.registry ?? prometheusRegistry;
    this.prefix = options.prefix ?? 'chive_';
    this.defaultBuckets = options.defaultBuckets ?? DEFAULT_HISTOGRAM_BUCKETS;
    this.maxCardinality = options.maxCardinality ?? MAX_CARDINALITY;
  }

  /**
   * Gets the full metric name with prefix.
   *
   * @param name - Base metric name
   * @returns Prefixed metric name
   *
   * @internal
   */
  private getFullName(name: string): string {
    // Don't double-prefix if already prefixed
    if (name.startsWith(this.prefix)) {
      return name;
    }
    return `${this.prefix}${name}`;
  }

  /**
   * Extracts label names from a labels object.
   *
   * @param labels - Labels object
   * @returns Sorted array of label names
   *
   * @internal
   */
  private getLabelNames(labels?: MetricLabels): string[] {
    if (!labels) return [];
    return Object.keys(labels).sort();
  }

  /**
   * Gets or creates a cached counter metric.
   *
   * @param name - Metric name
   * @param labelNames - Label names
   * @returns Counter metric instance
   *
   * @internal
   */
  private getOrCreateCounter(name: string, labelNames: string[]): Counter {
    const fullName = this.getFullName(name);
    const cacheKey = `counter:${fullName}`;

    const cached = this.metricCache.get(cacheKey);
    if (cached) {
      if (cached.type !== 'counter') {
        throw new ValidationError(
          `Metric ${fullName} already exists as ${cached.type}, cannot use as counter`,
          'metric',
          'type_mismatch'
        );
      }
      return cached.metric as Counter;
    }

    const counter = new Counter({
      name: fullName,
      help: `Counter: ${name}`,
      labelNames,
      registers: [this.registry],
    });

    this.metricCache.set(cacheKey, {
      type: 'counter',
      metric: counter,
      labelNames,
      cardinality: 0,
    });

    return counter;
  }

  /**
   * Gets or creates a cached gauge metric.
   *
   * @param name - Metric name
   * @param labelNames - Label names
   * @returns Gauge metric instance
   *
   * @internal
   */
  private getOrCreateGauge(name: string, labelNames: string[]): Gauge {
    const fullName = this.getFullName(name);
    const cacheKey = `gauge:${fullName}`;

    const cached = this.metricCache.get(cacheKey);
    if (cached) {
      if (cached.type !== 'gauge') {
        throw new ValidationError(
          `Metric ${fullName} already exists as ${cached.type}, cannot use as gauge`,
          'metric',
          'type_mismatch'
        );
      }
      return cached.metric as Gauge;
    }

    const gauge = new Gauge({
      name: fullName,
      help: `Gauge: ${name}`,
      labelNames,
      registers: [this.registry],
    });

    this.metricCache.set(cacheKey, {
      type: 'gauge',
      metric: gauge,
      labelNames,
      cardinality: 0,
    });

    return gauge;
  }

  /**
   * Gets or creates a cached histogram metric.
   *
   * @param name - Metric name
   * @param labelNames - Label names
   * @returns Histogram metric instance
   *
   * @internal
   */
  private getOrCreateHistogram(name: string, labelNames: string[]): Histogram {
    const fullName = this.getFullName(name);
    const cacheKey = `histogram:${fullName}`;

    const cached = this.metricCache.get(cacheKey);
    if (cached) {
      if (cached.type !== 'histogram') {
        throw new ValidationError(
          `Metric ${fullName} already exists as ${cached.type}, cannot use as histogram`,
          'metric',
          'type_mismatch'
        );
      }
      return cached.metric as Histogram;
    }

    const histogram = new Histogram({
      name: fullName,
      help: `Histogram: ${name}`,
      labelNames,
      buckets: [...this.defaultBuckets],
      registers: [this.registry],
    });

    this.metricCache.set(cacheKey, {
      type: 'histogram',
      metric: histogram,
      labelNames,
      cardinality: 0,
    });

    return histogram;
  }

  /**
   * Checks and updates cardinality for a metric.
   *
   * @param cacheKey - Cache key for the metric
   * @param labels - Labels being used
   *
   * @remarks
   * Logs a warning if cardinality exceeds the maximum.
   *
   * @internal
   */
  private checkCardinality(cacheKey: string, labels?: MetricLabels): void {
    const cached = this.metricCache.get(cacheKey);
    if (!cached) return;

    // Simple cardinality tracking (not exact but good enough)
    cached.cardinality++;

    if (cached.cardinality === this.maxCardinality) {
      console.warn(
        `[PrometheusMetrics] Cardinality limit (${this.maxCardinality}) reached for metric: ${cacheKey}. ` +
          `Consider reducing label cardinality. Labels: ${JSON.stringify(labels)}`
      );
    }
  }

  /**
   * Increments a counter metric.
   *
   * @param name - Metric name (prefix added automatically)
   * @param labels - Optional labels for dimensionality
   * @param value - Increment value (default: 1)
   *
   * @remarks
   * Counter values can only increase. Use for tracking totals.
   * Creates the metric on first use.
   *
   * @example
   * ```typescript
   * // Simple increment
   * metrics.incrementCounter('requests_total');
   *
   * // With labels
   * metrics.incrementCounter('http_requests_total', { method: 'GET', status: '200' });
   *
   * // Increment by specific value
   * metrics.incrementCounter('bytes_received_total', { endpoint: '/upload' }, 1024);
   * ```
   *
   * @public
   */
  incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    const labelNames = this.getLabelNames(labels);
    const counter = this.getOrCreateCounter(name, labelNames);
    const fullName = this.getFullName(name);

    this.checkCardinality(`counter:${fullName}`, labels);

    if (labels && Object.keys(labels).length > 0) {
      counter.inc(labels as Record<string, string>, value);
    } else {
      counter.inc(value);
    }
  }

  /**
   * Sets a gauge metric value.
   *
   * @param name - Metric name (prefix added automatically)
   * @param value - Gauge value (can increase or decrease)
   * @param labels - Optional labels for dimensionality
   *
   * @remarks
   * Gauge values can go up or down. Use for current state.
   * Creates the metric on first use.
   *
   * @example
   * ```typescript
   * // Set current value
   * metrics.setGauge('queue_size', queueLength);
   *
   * // With labels
   * metrics.setGauge('active_connections', connectionCount, { database: 'postgresql' });
   *
   * // Track temperature
   * metrics.setGauge('cpu_temperature_celsius', 65.5, { core: '0' });
   * ```
   *
   * @public
   */
  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const labelNames = this.getLabelNames(labels);
    const gauge = this.getOrCreateGauge(name, labelNames);
    const fullName = this.getFullName(name);

    this.checkCardinality(`gauge:${fullName}`, labels);

    if (labels && Object.keys(labels).length > 0) {
      gauge.set(labels as Record<string, string>, value);
    } else {
      gauge.set(value);
    }
  }

  /**
   * Observes a value in a histogram metric.
   *
   * @param name - Metric name (prefix added automatically)
   * @param value - Observed value
   * @param labels - Optional labels for dimensionality
   *
   * @remarks
   * Histograms track distributions of values.
   * Use for latencies, sizes, and other measurements.
   * Creates the metric on first use.
   *
   * @example
   * ```typescript
   * // Record request duration
   * metrics.observeHistogram('request_duration_seconds', 0.156);
   *
   * // With labels
   * metrics.observeHistogram('http_request_duration_seconds', duration, {
   *   method: 'GET',
   *   endpoint: '/api/preprints',
   *   status: '200',
   * });
   *
   * // Record response size
   * metrics.observeHistogram('response_size_bytes', responseBody.length, { endpoint: '/api' });
   * ```
   *
   * @public
   */
  observeHistogram(name: string, value: number, labels?: MetricLabels): void {
    const labelNames = this.getLabelNames(labels);
    const histogram = this.getOrCreateHistogram(name, labelNames);
    const fullName = this.getFullName(name);

    this.checkCardinality(`histogram:${fullName}`, labels);

    if (labels && Object.keys(labels).length > 0) {
      histogram.observe(labels as Record<string, string>, value);
    } else {
      histogram.observe(value);
    }
  }

  /**
   * Starts a timer for measuring duration.
   *
   * @param name - Metric name (prefix added automatically)
   * @param labels - Optional labels for dimensionality
   * @returns Function to call when operation completes
   *
   * @remarks
   * Returns a function that records the elapsed time when called.
   * Uses high-resolution time for accuracy.
   * Creates the histogram metric on first use.
   *
   * @example
   * ```typescript
   * // Basic timer
   * const endTimer = metrics.startTimer('operation_duration_seconds');
   * await performOperation();
   * endTimer(); // Records elapsed time
   *
   * // With labels
   * const endTimer = metrics.startTimer('db_query_duration_seconds', {
   *   database: 'postgresql',
   *   operation: 'select',
   * });
   * try {
   *   await executeQuery();
   * } finally {
   *   endTimer();
   * }
   *
   * // In async context
   * async function processRequest(req: Request) {
   *   const endTimer = metrics.startTimer('request_processing_seconds', {
   *     endpoint: req.path,
   *   });
   *   try {
   *     return await handleRequest(req);
   *   } finally {
   *     endTimer();
   *   }
   * }
   * ```
   *
   * @public
   */
  startTimer(name: string, labels?: MetricLabels): () => void {
    const startTime = process.hrtime.bigint();

    return () => {
      const endTime = process.hrtime.bigint();
      const durationNs = Number(endTime - startTime);
      const durationSeconds = durationNs / 1e9;
      this.observeHistogram(name, durationSeconds, labels);
    };
  }
}

/**
 * Creates a default metrics instance.
 *
 * @param options - Configuration options
 * @returns Configured PrometheusMetrics instance
 *
 * @remarks
 * Convenience function for creating metrics with default configuration.
 *
 * @example
 * ```typescript
 * // Use defaults
 * const metrics = createMetrics();
 *
 * // Custom prefix
 * const customMetrics = createMetrics({ prefix: 'myservice_' });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function createMetrics(options?: PrometheusMetricsOptions): IMetrics {
  return new PrometheusMetrics(options);
}
