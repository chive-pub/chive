# Monitoring

Chive uses OpenTelemetry for observability with Prometheus metrics, Grafana dashboards, and distributed tracing.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Chive     │────▶│  OTel       │────▶│  Prometheus │
│   Services  │     │  Collector  │     │             │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Jaeger    │     │   Grafana   │
                    │   (Traces)  │     │  (Dashboards)│
                    └─────────────┘     └─────────────┘
```

## Metrics

### Prometheus configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'chive-api'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: chive-api
        action: keep
      - source_labels: [__meta_kubernetes_pod_container_port_number]
        regex: '9090'
        action: keep
```

### Key metrics

#### API metrics

| Metric                          | Type      | Description             |
| ------------------------------- | --------- | ----------------------- |
| `http_requests_total`           | Counter   | Total HTTP requests     |
| `http_request_duration_seconds` | Histogram | Request latency         |
| `http_requests_in_flight`       | Gauge     | Current active requests |

#### Firehose metrics

| Metric                      | Type    | Description                   |
| --------------------------- | ------- | ----------------------------- |
| `firehose_events_total`     | Counter | Events received               |
| `firehose_events_processed` | Counter | Events successfully processed |
| `firehose_lag_seconds`      | Gauge   | Processing lag                |
| `firehose_cursor`           | Gauge   | Current cursor position       |

#### Database metrics

| Metric                      | Type      | Description        |
| --------------------------- | --------- | ------------------ |
| `db_pool_connections`       | Gauge     | Active connections |
| `db_query_duration_seconds` | Histogram | Query latency      |
| `db_errors_total`           | Counter   | Query errors       |

#### Cache metrics

| Metric               | Type    | Description        |
| -------------------- | ------- | ------------------ |
| `cache_hits_total`   | Counter | Cache hits         |
| `cache_misses_total` | Counter | Cache misses       |
| `cache_size_bytes`   | Gauge   | Cache memory usage |

### Custom metrics

Add custom metrics in your code:

```typescript
import { metrics } from '@/observability/metrics.js';

// Counter
metrics.incrementCounter('custom_events_total', { type: 'example' });

// Histogram
metrics.observeHistogram('processing_duration_seconds', durationMs / 1000);

// Gauge
metrics.setGauge('queue_depth', queueLength);
```

## Grafana dashboards

### Pre-built dashboards

| Dashboard       | ID  | Description                    |
| --------------- | --- | ------------------------------ |
| Chive Overview  | 1   | High-level system health       |
| API Performance | 2   | Request latency, error rates   |
| Firehose Status | 3   | Event processing, lag          |
| Database Health | 4   | Connections, query performance |

### Dashboard JSON

Import dashboards from:

```
charts/chive/dashboards/
├── overview.json
├── api-performance.json
├── firehose-status.json
└── database-health.json
```

### Key panels

#### API overview

- Requests per second
- Error rate (%)
- P50/P95/P99 latency
- Active connections

#### Firehose status

- Events per second
- Processing lag
- Error rate
- Queue depth

## Alerting

### Prometheus alerting rules

```yaml
# alerts.yml
groups:
  - name: chive
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: Error rate is {{ $value | humanizePercentage }}

      - alert: FirehoseLag
        expr: firehose_lag_seconds > 300
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Firehose processing lag
          description: Lag is {{ $value | humanizeDuration }}

      - alert: DatabaseConnectionPoolExhausted
        expr: db_pool_connections / db_pool_max_connections > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Database connection pool near capacity
```

### Alert destinations

Configure in Alertmanager:

```yaml
# alertmanager.yml
route:
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - channel: '#chive-alerts'
        send_resolved: true

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: ${PAGERDUTY_KEY}
```

## Distributed tracing

### Jaeger setup

```yaml
# jaeger.yml
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: chive-jaeger
spec:
  strategy: production
  storage:
    type: elasticsearch
    options:
      es:
        server-urls: http://elasticsearch:9200
```

### Trace context

Traces propagate automatically through:

- HTTP requests (via headers)
- Queue jobs (via metadata)
- Database queries (via spans)

### Viewing traces

1. Open Jaeger UI at `https://jaeger.chive.pub`
2. Select service: `chive-api`
3. Search by trace ID or operation name
4. View waterfall diagram

### Key operations

| Operation          | Description        |
| ------------------ | ------------------ |
| `HTTP GET /xrpc/*` | XRPC requests      |
| `firehose.process` | Event processing   |
| `db.query`         | Database queries   |
| `cache.get/set`    | Cache operations   |
| `external.*.call`  | External API calls |

## Logging

### Log aggregation

```yaml
# fluent-bit config
[INPUT]
    Name              tail
    Path              /var/log/containers/chive-*.log
    Parser            docker
    Tag               chive.*

[OUTPUT]
    Name              loki
    Match             chive.*
    Host              loki.monitoring.svc
    Port              3100
    Labels            app=chive
```

### Log levels

| Level   | When to use                            |
| ------- | -------------------------------------- |
| `error` | Unexpected errors requiring attention  |
| `warn`  | Degraded performance or retries        |
| `info`  | Normal operations (requests, events)   |
| `debug` | Detailed debugging (not in production) |

### Structured logging

```typescript
logger.info('Preprint indexed', {
  uri: preprint.uri,
  authorDid: preprint.authorDid,
  duration: indexDurationMs,
});
```

## SLOs and SLIs

### Service Level Indicators

| SLI          | Measurement                                                                      |
| ------------ | -------------------------------------------------------------------------------- |
| Availability | `sum(rate(http_requests_total{status!~"5.."})) / sum(rate(http_requests_total))` |
| Latency      | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket))`           |
| Throughput   | `sum(rate(http_requests_total))`                                                 |

### Service Level Objectives

| SLO              | Target      |
| ---------------- | ----------- |
| API availability | 99.9%       |
| P95 latency      | < 500ms     |
| Firehose lag     | < 5 minutes |
| Error rate       | < 0.1%      |

## Health monitoring

### Kubernetes monitoring

```bash
# View pod status
kubectl get pods -n chive

# View events
kubectl get events -n chive --sort-by=.lastTimestamp

# View resource usage
kubectl top pods -n chive
```

### Database monitoring

```bash
# PostgreSQL
psql -c "SELECT * FROM pg_stat_activity;"

# Elasticsearch
curl http://localhost:9200/_cluster/health?pretty

# Neo4j
cypher-shell "CALL dbms.queryJmx('org.neo4j:*');"

# Redis
redis-cli INFO
```

## Related documentation

- [Deployment](./deployment.md): Production setup
- [Scaling](./scaling.md): Performance tuning
- [Troubleshooting](./troubleshooting.md): Common issues
- [Observability Guide](../developer-guide/observability-monitoring.md): Developer reference
