/**
 * OpenTelemetry SDK initialization.
 *
 * @remarks
 * Configures and initializes the OpenTelemetry Node.js SDK for:
 * - Distributed tracing (via OTLP to OTEL Collector → Tempo)
 * - Metrics (via OTLP to OTEL Collector → Prometheus)
 * - Auto-instrumentation for HTTP, PostgreSQL, Redis
 *
 * Call {@link initTelemetry} before starting the application.
 *
 * @packageDocumentation
 * @module observability/telemetry
 * @public
 */

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

/**
 * Configuration options for OpenTelemetry initialization.
 *
 * @public
 */
export interface TelemetryOptions {
  /**
   * Service name for trace attribution.
   *
   * @remarks
   * Appears in traces and metrics as `service.name`.
   *
   * @defaultValue process.env.OTEL_SERVICE_NAME || 'chive-appview'
   */
  readonly serviceName?: string;

  /**
   * Service version.
   *
   * @remarks
   * Appears in traces and metrics as `service.version`.
   *
   * @defaultValue process.env.OTEL_SERVICE_VERSION || process.env.npm_package_version || '0.0.0'
   */
  readonly serviceVersion?: string;

  /**
   * Deployment environment.
   *
   * @remarks
   * Appears in traces and metrics as `deployment.environment`.
   *
   * @defaultValue process.env.NODE_ENV || 'development'
   */
  readonly environment?: string;

  /**
   * OTEL Collector endpoint for traces.
   *
   * @remarks
   * The OTLP HTTP endpoint for sending traces.
   *
   * @defaultValue process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318'
   */
  readonly otlpEndpoint?: string;

  /**
   * Metric export interval in milliseconds.
   *
   * @remarks
   * How often metrics are sent to the collector.
   *
   * @defaultValue 15000 (15 seconds)
   */
  readonly metricExportIntervalMs?: number;

  /**
   * Enable auto-instrumentation for specific libraries.
   *
   * @remarks
   * Controls which auto-instrumentation plugins are enabled.
   *
   * @defaultValue { http: true, pg: true, redis: true }
   */
  readonly autoInstrumentation?: {
    readonly http?: boolean;
    readonly pg?: boolean;
    readonly redis?: boolean;
  };
}

/**
 * Telemetry state.
 *
 * @internal
 */
interface TelemetryState {
  sdk: NodeSDK | null;
  initialized: boolean;
  sigtermHandler: (() => void) | null;
}

/**
 * Global telemetry state.
 *
 * @internal
 */
const telemetryState: TelemetryState = {
  sdk: null,
  initialized: false,
  sigtermHandler: null,
};

/**
 * Creates the OpenTelemetry resource with service attributes.
 *
 * @param options - Telemetry options
 * @returns Resource with service attributes
 *
 * @internal
 */
function createResource(options: TelemetryOptions): Resource {
  const serviceName = options.serviceName ?? process.env.OTEL_SERVICE_NAME ?? 'chive-appview';
  const serviceVersion =
    options.serviceVersion ??
    process.env.OTEL_SERVICE_VERSION ??
    process.env.npm_package_version ??
    '0.0.0';
  const environment = options.environment ?? process.env.NODE_ENV ?? 'development';

  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });
}

/**
 * Creates the OTLP trace exporter.
 *
 * @param options - Telemetry options
 * @returns Configured trace exporter
 *
 * @internal
 */
function createTraceExporter(options: TelemetryOptions): OTLPTraceExporter {
  const endpoint =
    options.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

  return new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
  });
}

/**
 * Creates the periodic metric reader with OTLP exporter.
 *
 * @param options - Telemetry options
 * @returns Configured metric reader
 *
 * @internal
 */
function createMetricReader(options: TelemetryOptions): PeriodicExportingMetricReader {
  const endpoint =
    options.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';
  const intervalMs = options.metricExportIntervalMs ?? 15000;

  return new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`,
    }),
    exportIntervalMillis: intervalMs,
  });
}

/**
 * Creates auto-instrumentation configuration.
 *
 * @param options - Telemetry options
 * @returns Auto-instrumentation array
 *
 * @internal
 */
function createInstrumentations(
  options: TelemetryOptions
): ReturnType<typeof getNodeAutoInstrumentations> {
  const autoConfig = options.autoInstrumentation ?? { http: true, pg: true, redis: true };

  return getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      enabled: autoConfig.http ?? true,
    },
    '@opentelemetry/instrumentation-pg': {
      enabled: autoConfig.pg ?? true,
    },
    '@opentelemetry/instrumentation-redis': {
      enabled: autoConfig.redis ?? true,
    },
    // Disable other instrumentations by default to reduce noise
    '@opentelemetry/instrumentation-fs': { enabled: false },
    '@opentelemetry/instrumentation-dns': { enabled: false },
    '@opentelemetry/instrumentation-net': { enabled: false },
  });
}

/**
 * Initializes the OpenTelemetry SDK.
 *
 * @param options - Configuration options
 *
 * @remarks
 * Must be called before the application starts to ensure all
 * modules are instrumented. Sets up:
 * - Trace exporter (OTLP → OTEL Collector → Tempo)
 * - Metric exporter (OTLP → OTEL Collector → Prometheus)
 * - Auto-instrumentation for HTTP, PostgreSQL, Redis
 *
 * Registers SIGTERM handler for graceful shutdown.
 *
 * @example
 * ```typescript
 * // At the very start of your application
 * import { initTelemetry } from './observability/telemetry.js';
 *
 * // Initialize with defaults (reads from environment)
 * initTelemetry();
 *
 * // Or with explicit configuration
 * initTelemetry({
 *   serviceName: 'chive-appview',
 *   serviceVersion: '0.1.0',
 *   environment: 'production',
 *   otlpEndpoint: 'http://otel-collector:4318',
 * });
 *
 * // Then import and start your application
 * import { startServer } from './server.js';
 * startServer();
 * ```
 *
 * @throws Error if telemetry is already initialized
 *
 * @public
 * @since 0.1.0
 */
export function initTelemetry(options: TelemetryOptions = {}): void {
  if (telemetryState.initialized) {
    console.warn('[Telemetry] Already initialized, skipping re-initialization');
    return;
  }

  const resource = createResource(options);
  const traceExporter = createTraceExporter(options);
  const metricReader = createMetricReader(options);
  const instrumentations = createInstrumentations(options);

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations,
  });

  sdk.start();
  telemetryState.sdk = sdk;
  telemetryState.initialized = true;

  console.log('[Telemetry] OpenTelemetry SDK initialized', {
    service: resource.attributes[ATTR_SERVICE_NAME],
    version: resource.attributes[ATTR_SERVICE_VERSION],
    environment: resource.attributes[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT],
    endpoint:
      options.otlpEndpoint ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://otel-collector:4318',
  });

  // Register graceful shutdown (only once per initialization)
  const sigtermHandler = (): void => {
    shutdownTelemetry()
      .then(() => {
        console.log('[Telemetry] Graceful shutdown complete');
        process.exit(0);
      })
      .catch((error) => {
        console.error('[Telemetry] Error during shutdown', error);
        process.exit(1);
      });
  };
  telemetryState.sigtermHandler = sigtermHandler;
  process.on('SIGTERM', sigtermHandler);
}

/**
 * Shuts down the OpenTelemetry SDK gracefully.
 *
 * @returns Promise that resolves when shutdown is complete
 *
 * @remarks
 * Flushes any pending telemetry data and releases resources.
 * Called automatically on SIGTERM, but can be called manually.
 *
 * @example
 * ```typescript
 * // Manual shutdown (e.g., in tests)
 * await shutdownTelemetry();
 * ```
 *
 * @public
 * @since 0.1.0
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!telemetryState.sdk) {
    console.warn('[Telemetry] Not initialized, nothing to shut down');
    return;
  }

  try {
    // Add timeout to prevent hanging if collector is unavailable
    const shutdownPromise = telemetryState.sdk.shutdown();
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Telemetry shutdown timed out')), 5000);
    });

    await Promise.race([shutdownPromise, timeoutPromise]).catch((error: unknown) => {
      // Log timeout but don't fail - just proceed with cleanup
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Telemetry shutdown timed out') {
        console.warn('[Telemetry] SDK shutdown timed out, proceeding with cleanup');
      } else {
        throw error;
      }
    });

    telemetryState.sdk = null;
    telemetryState.initialized = false;
    // Remove SIGTERM handler to prevent listener accumulation
    if (telemetryState.sigtermHandler) {
      process.removeListener('SIGTERM', telemetryState.sigtermHandler);
      telemetryState.sigtermHandler = null;
    }
    console.log('[Telemetry] SDK shut down successfully');
  } catch (error) {
    console.error('[Telemetry] Error shutting down SDK', error);
    throw error;
  }
}

/**
 * Checks if telemetry is initialized.
 *
 * @returns true if telemetry is initialized
 *
 * @example
 * ```typescript
 * if (!isTelemetryInitialized()) {
 *   initTelemetry();
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function isTelemetryInitialized(): boolean {
  return telemetryState.initialized;
}
