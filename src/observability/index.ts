/**
 * Observability module exports.
 *
 * @remarks
 * Re-exports all observability components:
 * - {@link PinoLogger} and {@link createLogger} for structured logging
 * - {@link PrometheusMetrics} and {@link createMetrics} for Prometheus metrics
 * - {@link initTelemetry} and {@link shutdownTelemetry} for OpenTelemetry SDK
 * - Tracer utilities for distributed tracing
 * - Prometheus registry for /metrics endpoint
 *
 * @example
 * ```typescript
 * // Import all observability components
 * import {
 *   initTelemetry,
 *   PinoLogger,
 *   PrometheusMetrics,
 *   withSpan,
 *   prometheusRegistry,
 * } from './observability/index.js';
 *
 * // Initialize telemetry at application startup
 * initTelemetry({ serviceName: 'chive-appview' });
 *
 * // Create logger and metrics
 * const logger = new PinoLogger({ level: 'info' });
 * const metrics = new PrometheusMetrics();
 *
 * // Use in application
 * logger.info('Server started', { port: 3000 });
 * metrics.incrementCounter('requests_total', { method: 'GET' });
 *
 * // Trace operations
 * await withSpan('processRequest', async () => {
 *   // ... processing
 * });
 * ```
 *
 * @packageDocumentation
 * @module observability
 * @public
 */

// Logger exports
export { PinoLogger, createLogger, type PinoLoggerOptions } from './logger.js';

// Metrics exports
export {
  PrometheusMetrics,
  createMetrics,
  type PrometheusMetricsOptions,
} from './metrics-exporter.js';

// Prometheus registry exports
export {
  prometheusRegistry,
  getMetrics,
  metricsContentType,
  httpMetrics,
  eprintMetrics,
  firehoseMetrics,
  databaseMetrics,
  pdsMetrics,
  DEFAULT_HISTOGRAM_BUCKETS,
  MAX_CARDINALITY,
} from './prometheus-registry.js';

// Telemetry exports
export {
  initTelemetry,
  shutdownTelemetry,
  isTelemetryInitialized,
  type TelemetryOptions,
} from './telemetry.js';

// Tracer exports
export {
  getTracer,
  getActiveSpan,
  addSpanAttributes,
  recordSpanError,
  withSpan,
  withSpanSync,
  withChildSpans,
  getTraceContext,
  SpanAttributes,
  TRACER_NAME,
  TRACER_VERSION,
  type WithSpanOptions,
} from './tracer.js';
