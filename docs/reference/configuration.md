# Configuration reference

Chive configuration is managed through environment variables and configuration files.

## Configuration sources

Configuration is loaded in order (later sources override earlier):

1. Default values (hardcoded)
2. Configuration files (`config/*.yaml`)
3. Environment variables
4. Command-line arguments

## Server configuration

### API server

| Option                  | Env var           | Default   | Description               |
| ----------------------- | ----------------- | --------- | ------------------------- |
| `server.port`           | `PORT`            | `3000`    | HTTP port                 |
| `server.host`           | `HOST`            | `0.0.0.0` | Bind address              |
| `server.trustProxy`     | `TRUST_PROXY`     | `false`   | Trust X-Forwarded headers |
| `server.corsOrigins`    | `CORS_ORIGINS`    | `*`       | Allowed CORS origins      |
| `server.requestTimeout` | `REQUEST_TIMEOUT` | `30000`   | Request timeout (ms)      |
| `server.bodyLimit`      | `BODY_LIMIT`      | `10mb`    | Request body limit        |

### Worker

| Option               | Env var              | Default               | Description       |
| -------------------- | -------------------- | --------------------- | ----------------- |
| `worker.concurrency` | `WORKER_CONCURRENCY` | `5`                   | Concurrent jobs   |
| `worker.queues`      | `WORKER_QUEUES`      | `indexing,enrichment` | Queues to process |

## Database configuration

### PostgreSQL

| Option              | Env var             | Default     | Description          |
| ------------------- | ------------------- | ----------- | -------------------- |
| `postgres.host`     | `POSTGRES_HOST`     | `localhost` | Database host        |
| `postgres.port`     | `POSTGRES_PORT`     | `5432`      | Database port        |
| `postgres.database` | `POSTGRES_DB`       | `chive`     | Database name        |
| `postgres.user`     | `POSTGRES_USER`     | `chive`     | Username             |
| `postgres.password` | `POSTGRES_PASSWORD` | Required    | Password             |
| `postgres.poolMin`  | `POSTGRES_POOL_MIN` | `5`         | Min pool connections |
| `postgres.poolMax`  | `POSTGRES_POOL_MAX` | `20`        | Max pool connections |
| `postgres.ssl`      | `POSTGRES_SSL`      | `false`     | Enable SSL           |

### Elasticsearch

| Option                      | Env var                      | Default                 | Description      |
| --------------------------- | ---------------------------- | ----------------------- | ---------------- |
| `elasticsearch.url`         | `ELASTICSEARCH_URL`          | `http://localhost:9200` | Cluster URL      |
| `elasticsearch.user`        | `ELASTICSEARCH_USER`         | None                    | Username         |
| `elasticsearch.password`    | `ELASTICSEARCH_PASSWORD`     | None                    | Password         |
| `elasticsearch.indexPrefix` | `ELASTICSEARCH_INDEX_PREFIX` | `chive`                 | Index prefix     |
| `elasticsearch.shards`      | `ELASTICSEARCH_SHARDS`       | `3`                     | Shards per index |
| `elasticsearch.replicas`    | `ELASTICSEARCH_REPLICAS`     | `2`                     | Replicas         |

### Neo4j

| Option              | Env var               | Default                 | Description     |
| ------------------- | --------------------- | ----------------------- | --------------- |
| `neo4j.uri`         | `NEO4J_URI`           | `bolt://localhost:7687` | Bolt URI        |
| `neo4j.user`        | `NEO4J_USER`          | `neo4j`                 | Username        |
| `neo4j.password`    | `NEO4J_PASSWORD`      | Required                | Password        |
| `neo4j.database`    | `NEO4J_DATABASE`      | `neo4j`                 | Database name   |
| `neo4j.maxPoolSize` | `NEO4J_MAX_POOL_SIZE` | `50`                    | Connection pool |

### Redis

| Option           | Env var          | Default     | Description     |
| ---------------- | ---------------- | ----------- | --------------- |
| `redis.host`     | `REDIS_HOST`     | `localhost` | Redis host      |
| `redis.port`     | `REDIS_PORT`     | `6379`      | Redis port      |
| `redis.password` | `REDIS_PASSWORD` | None        | Password        |
| `redis.db`       | `REDIS_DB`       | `0`         | Database number |
| `redis.tls`      | `REDIS_TLS`      | `false`     | Enable TLS      |

## Authentication

| Option             | Env var        | Default  | Description           |
| ------------------ | -------------- | -------- | --------------------- |
| `auth.jwtSecret`   | `JWT_SECRET`   | Required | JWT signing secret    |
| `auth.jwtExpiry`   | `JWT_EXPIRY`   | `7d`     | Token expiration      |
| `auth.sessionTtl`  | `SESSION_TTL`  | `604800` | Session TTL (seconds) |
| `auth.mfaRequired` | `MFA_REQUIRED` | `false`  | Require MFA           |

## Rate limiting

| Option                    | Env var                    | Default | Description               |
| ------------------------- | -------------------------- | ------- | ------------------------- |
| `rateLimit.enabled`       | `RATE_LIMIT_ENABLED`       | `true`  | Enable rate limiting      |
| `rateLimit.windowMs`      | `RATE_LIMIT_WINDOW`        | `60000` | Window size (ms)          |
| `rateLimit.anonymous`     | `RATE_LIMIT_ANONYMOUS`     | `30`    | Anonymous requests/window |
| `rateLimit.authenticated` | `RATE_LIMIT_AUTHENTICATED` | `100`   | Auth requests/window      |
| `rateLimit.trusted`       | `RATE_LIMIT_TRUSTED`       | `500`   | Trusted requests/window   |

## Firehose

| Option                    | Env var                    | Default       | Description            |
| ------------------------- | -------------------------- | ------------- | ---------------------- |
| `firehose.url`            | `FIREHOSE_URL`             | Required      | Relay URL              |
| `firehose.collections`    | `FIREHOSE_COLLECTIONS`     | `pub.chive.*` | Collections to index   |
| `firehose.reconnectDelay` | `FIREHOSE_RECONNECT_DELAY` | `5000`        | Reconnect delay (ms)   |
| `firehose.maxRetries`     | `FIREHOSE_MAX_RETRIES`     | `10`          | Max reconnect attempts |

## Caching

| Option            | Env var              | Default | Description          |
| ----------------- | -------------------- | ------- | -------------------- |
| `cache.eprintTtl` | `CACHE_PREPRINT_TTL` | `300`   | Eprint cache TTL (s) |
| `cache.searchTtl` | `CACHE_SEARCH_TTL`   | `300`   | Search cache TTL (s) |
| `cache.userTtl`   | `CACHE_USER_TTL`     | `600`   | User cache TTL (s)   |
| `cache.blobTtl`   | `CACHE_BLOB_TTL`     | `3600`  | Blob cache TTL (s)   |

## Observability

| Option             | Env var                       | Default | Description              |
| ------------------ | ----------------------------- | ------- | ------------------------ |
| `log.level`        | `LOG_LEVEL`                   | `info`  | Log level                |
| `log.format`       | `LOG_FORMAT`                  | `json`  | Log format (json/pretty) |
| `otel.enabled`     | `OTEL_ENABLED`                | `false` | Enable OpenTelemetry     |
| `otel.endpoint`    | `OTEL_EXPORTER_OTLP_ENDPOINT` | None    | OTLP endpoint            |
| `otel.serviceName` | `OTEL_SERVICE_NAME`           | `chive` | Service name             |
| `metrics.port`     | `METRICS_PORT`                | `9090`  | Prometheus port          |

## External services

### Semantic Scholar

| Option                      | Env var         | Default | Description        |
| --------------------------- | --------------- | ------- | ------------------ |
| `semanticScholar.apiKey`    | `S2_API_KEY`    | None    | API key            |
| `semanticScholar.rateLimit` | `S2_RATE_LIMIT` | `100`   | Requests per 5 min |

### OpenAlex

| Option               | Env var               | Default | Description         |
| -------------------- | --------------------- | ------- | ------------------- |
| `openAlex.email`     | `OPENALEX_EMAIL`      | None    | Contact email       |
| `openAlex.rateLimit` | `OPENALEX_RATE_LIMIT` | `10`    | Requests per second |

### ORCID

| Option               | Env var               | Default | Description         |
| -------------------- | --------------------- | ------- | ------------------- |
| `orcid.clientId`     | `ORCID_CLIENT_ID`     | None    | OAuth client ID     |
| `orcid.clientSecret` | `ORCID_CLIENT_SECRET` | None    | OAuth client secret |

## Feature flags

| Option                | Env var              | Default | Description              |
| --------------------- | -------------------- | ------- | ------------------------ |
| `features.discovery`  | `FEATURE_DISCOVERY`  | `true`  | Enable recommendations   |
| `features.claiming`   | `FEATURE_CLAIMING`   | `true`  | Enable authorship claims |
| `features.governance` | `FEATURE_GOVERNANCE` | `true`  | Enable governance        |
| `features.backlinks`  | `FEATURE_BACKLINKS`  | `true`  | Enable Bluesky backlinks |

## Configuration files

### config/default.yaml

```yaml
server:
  port: 3000
  host: 0.0.0.0
  trustProxy: false

postgres:
  host: localhost
  port: 5432
  database: chive
  poolMin: 5
  poolMax: 20

redis:
  host: localhost
  port: 6379
  db: 0

cache:
  eprintTtl: 300
  searchTtl: 300

log:
  level: info
  format: json
```

### config/production.yaml

```yaml
server:
  trustProxy: true

postgres:
  ssl: true
  poolMin: 10
  poolMax: 50

elasticsearch:
  replicas: 2

cache:
  eprintTtl: 600

log:
  level: warn
```

## Loading configuration

```typescript
import { loadConfig } from '@/config/index.js';

const config = loadConfig();

console.log(config.server.port); // 3000
console.log(config.postgres.host); // localhost
```

## Validation

Configuration is validated on startup:

```typescript
// All required fields must be set
if (!config.postgres.password) {
  throw new ConfigurationError('POSTGRES_PASSWORD is required');
}

// Values must be within bounds
if (config.rateLimit.anonymous < 1) {
  throw new ConfigurationError('Rate limit must be positive');
}
```

## Related documentation

- [Environment Variables](./environment-variables.md): Complete env var list
- [Deployment](../operations/deployment.md): Production configuration
- [CLI Commands](./cli-commands.md): Configuration commands
