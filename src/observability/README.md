# Observability

OpenTelemetry-based observability infrastructure for Chive AppView.

## Overview

This module provides comprehensive telemetry, logging, and metrics collection using OpenTelemetry standards. All components are designed for production Kubernetes deployments with Prometheus/Grafana monitoring.

## Components

| File                     | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `index.ts`               | Module exports                                   |
| `logger.ts`              | Pino-based structured logging with trace context |
| `telemetry.ts`           | OpenTelemetry SDK initialization                 |
| `tracer.ts`              | Distributed tracing utilities                    |
| `metrics-exporter.ts`    | Prometheus metrics exporter                      |
| `prometheus-registry.ts` | Metric registries and definitions                |
| `freshness-metrics.ts`   | Freshness-specific metric collectors             |

## Usage

```typescript
import {
  initTelemetry,
  PinoLogger,
  PrometheusMetrics,
  withSpan,
  prometheusRegistry,
} from './observability/index.js';

// Initialize telemetry at startup
initTelemetry({ serviceName: 'chive-appview' });

// Create logger with trace context
const logger = new PinoLogger({ level: 'info' });
logger.info('Server started', { port: 3000 });

// Create metrics
const metrics = new PrometheusMetrics();
metrics.incrementCounter('requests_total', { method: 'GET' });

// Trace operations
await withSpan('processRequest', async () => {
  // ... processing
});
```

## Metric Categories

### HTTP Metrics

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency histogram

### Eprint Metrics

- `eprints_indexed_total` - Total eprints indexed
- `eprint_indexing_duration_seconds` - Indexing latency

### Firehose Metrics

- `firehose_events_total` - Events consumed from relay
- `firehose_lag_seconds` - Processing lag behind live

### Database Metrics

- `db_query_duration_seconds` - Query latency by operation
- `db_connections_active` - Active connection count

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Application                    │
├─────────────────────────────────────────────────┤
│  PinoLogger    │  Tracer      │  Metrics        │
│  (structured)  │  (spans)     │  (counters)     │
├─────────────────────────────────────────────────┤
│              OpenTelemetry SDK                   │
├─────────────────────────────────────────────────┤
│  OTLP Exporter │ Prometheus  │  Jaeger/Tempo    │
└─────────────────────────────────────────────────┘
```

## Configuration

Environment variables:

- `OTEL_SERVICE_NAME` - Service name for traces
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OTLP collector endpoint
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `METRICS_PORT` - Prometheus scrape port (default: 9090)

## Related Documentation

- [Operations guide](../../docs/developer-guide/operations.md)
- [OpenTelemetry docs](https://opentelemetry.io/docs/)
