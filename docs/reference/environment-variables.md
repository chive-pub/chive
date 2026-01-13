# Environment variables reference

Complete list of environment variables for configuring Chive.

## Required variables

These must be set for Chive to start:

| Variable            | Description                       | Example               |
| ------------------- | --------------------------------- | --------------------- |
| `POSTGRES_PASSWORD` | PostgreSQL password               | `secretpassword`      |
| `NEO4J_PASSWORD`    | Neo4j password                    | `secretpassword`      |
| `JWT_SECRET`        | JWT signing secret (min 32 chars) | `your-256-bit-secret` |
| `FIREHOSE_URL`      | ATProto relay WebSocket URL       | `wss://bsky.network`  |

## Server

| Variable          | Default       | Description                               |
| ----------------- | ------------- | ----------------------------------------- |
| `NODE_ENV`        | `development` | Environment (development/production/test) |
| `PORT`            | `3000`        | HTTP server port                          |
| `HOST`            | `0.0.0.0`     | Bind address                              |
| `TRUST_PROXY`     | `false`       | Trust X-Forwarded-\* headers              |
| `CORS_ORIGINS`    | `*`           | Allowed CORS origins (comma-separated)    |
| `REQUEST_TIMEOUT` | `30000`       | Request timeout in milliseconds           |
| `BODY_LIMIT`      | `10mb`        | Maximum request body size                 |

## PostgreSQL

| Variable            | Default     | Description                                        |
| ------------------- | ----------- | -------------------------------------------------- |
| `POSTGRES_HOST`     | `localhost` | Database host                                      |
| `POSTGRES_PORT`     | `5432`      | Database port                                      |
| `POSTGRES_DB`       | `chive`     | Database name                                      |
| `POSTGRES_USER`     | `chive`     | Username                                           |
| `POSTGRES_PASSWORD` | Required    | Password                                           |
| `POSTGRES_POOL_MIN` | `5`         | Minimum pool connections                           |
| `POSTGRES_POOL_MAX` | `20`        | Maximum pool connections                           |
| `POSTGRES_SSL`      | `false`     | Enable SSL connection                              |
| `DATABASE_URL`      | None        | Full connection string (overrides individual vars) |

## Elasticsearch

| Variable                     | Default                 | Description            |
| ---------------------------- | ----------------------- | ---------------------- |
| `ELASTICSEARCH_URL`          | `http://localhost:9200` | Cluster URL            |
| `ELASTICSEARCH_USER`         | None                    | Username for auth      |
| `ELASTICSEARCH_PASSWORD`     | None                    | Password for auth      |
| `ELASTICSEARCH_INDEX_PREFIX` | `chive`                 | Prefix for index names |
| `ELASTICSEARCH_SHARDS`       | `3`                     | Shards per index       |
| `ELASTICSEARCH_REPLICAS`     | `2`                     | Replicas per shard     |

## Neo4j

| Variable              | Default                 | Description          |
| --------------------- | ----------------------- | -------------------- |
| `NEO4J_URI`           | `bolt://localhost:7687` | Bolt connection URI  |
| `NEO4J_USER`          | `neo4j`                 | Username             |
| `NEO4J_PASSWORD`      | Required                | Password             |
| `NEO4J_DATABASE`      | `neo4j`                 | Database name        |
| `NEO4J_MAX_POOL_SIZE` | `50`                    | Connection pool size |

## Redis

| Variable         | Default     | Description                                        |
| ---------------- | ----------- | -------------------------------------------------- |
| `REDIS_HOST`     | `localhost` | Redis host                                         |
| `REDIS_PORT`     | `6379`      | Redis port                                         |
| `REDIS_PASSWORD` | None        | Password                                           |
| `REDIS_DB`       | `0`         | Database number (0-15)                             |
| `REDIS_TLS`      | `false`     | Enable TLS                                         |
| `REDIS_URL`      | None        | Full connection string (overrides individual vars) |

## Authentication

| Variable              | Default  | Description                     |
| --------------------- | -------- | ------------------------------- |
| `JWT_SECRET`          | Required | Secret for signing JWTs         |
| `JWT_EXPIRY`          | `7d`     | Token expiration time           |
| `SESSION_TTL`         | `604800` | Session TTL in seconds (7 days) |
| `MFA_REQUIRED`        | `false`  | Require multi-factor auth       |
| `OAUTH_CLIENT_ID`     | None     | OAuth client ID for ATProto     |
| `OAUTH_CLIENT_SECRET` | None     | OAuth client secret             |

## Rate limiting

| Variable                   | Default | Description                         |
| -------------------------- | ------- | ----------------------------------- |
| `RATE_LIMIT_ENABLED`       | `true`  | Enable rate limiting                |
| `RATE_LIMIT_WINDOW`        | `60000` | Window size in milliseconds         |
| `RATE_LIMIT_ANONYMOUS`     | `30`    | Requests per window (anonymous)     |
| `RATE_LIMIT_AUTHENTICATED` | `100`   | Requests per window (authenticated) |
| `RATE_LIMIT_TRUSTED`       | `500`   | Requests per window (trusted)       |
| `RATE_LIMIT_SERVICE`       | `1000`  | Requests per window (service)       |
| `DISABLE_RATE_LIMITING`    | `false` | Disable for E2E tests               |

## Firehose

| Variable                   | Default       | Description                   |
| -------------------------- | ------------- | ----------------------------- |
| `FIREHOSE_URL`             | Required      | Relay WebSocket URL           |
| `FIREHOSE_COLLECTIONS`     | `pub.chive.*` | Collections to subscribe to   |
| `FIREHOSE_RECONNECT_DELAY` | `5000`        | Reconnect delay in ms         |
| `FIREHOSE_MAX_RETRIES`     | `10`          | Maximum reconnection attempts |
| `FIREHOSE_CURSOR`          | None          | Start from specific cursor    |

## Caching

| Variable             | Default | Description                |
| -------------------- | ------- | -------------------------- |
| `CACHE_PREPRINT_TTL` | `300`   | Eprint cache TTL (seconds) |
| `CACHE_SEARCH_TTL`   | `300`   | Search result cache TTL    |
| `CACHE_USER_TTL`     | `600`   | User profile cache TTL     |
| `CACHE_BLOB_TTL`     | `3600`  | Blob cache TTL             |
| `CACHE_FIELD_TTL`    | `3600`  | Field taxonomy cache TTL   |

## Logging

| Variable        | Default | Description                       |
| --------------- | ------- | --------------------------------- |
| `LOG_LEVEL`     | `info`  | Log level (debug/info/warn/error) |
| `LOG_FORMAT`    | `json`  | Log format (json/pretty)          |
| `LOG_TIMESTAMP` | `true`  | Include timestamps                |
| `LOG_CALLER`    | `false` | Include caller info               |

## OpenTelemetry

| Variable                      | Default                    | Description             |
| ----------------------------- | -------------------------- | ----------------------- |
| `OTEL_ENABLED`                | `false`                    | Enable OpenTelemetry    |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | None                       | OTLP collector endpoint |
| `OTEL_SERVICE_NAME`           | `chive`                    | Service name for traces |
| `OTEL_TRACES_SAMPLER`         | `parentbased_traceidratio` | Trace sampler           |
| `OTEL_TRACES_SAMPLER_ARG`     | `0.1`                      | Sampler ratio (0.0-1.0) |

## Prometheus

| Variable          | Default    | Description               |
| ----------------- | ---------- | ------------------------- |
| `METRICS_ENABLED` | `true`     | Enable Prometheus metrics |
| `METRICS_PORT`    | `9090`     | Metrics endpoint port     |
| `METRICS_PATH`    | `/metrics` | Metrics endpoint path     |

## External APIs

### Semantic Scholar

| Variable        | Default | Description              |
| --------------- | ------- | ------------------------ |
| `S2_API_KEY`    | None    | Semantic Scholar API key |
| `S2_RATE_LIMIT` | `100`   | Requests per 5 minutes   |
| `S2_TIMEOUT`    | `10000` | Request timeout (ms)     |

### OpenAlex

| Variable              | Default | Description                     |
| --------------------- | ------- | ------------------------------- |
| `OPENALEX_EMAIL`      | None    | Contact email (for polite pool) |
| `OPENALEX_RATE_LIMIT` | `10`    | Requests per second             |
| `OPENALEX_TIMEOUT`    | `10000` | Request timeout (ms)            |

### ORCID

| Variable              | Default | Description             |
| --------------------- | ------- | ----------------------- |
| `ORCID_CLIENT_ID`     | None    | OAuth client ID         |
| `ORCID_CLIENT_SECRET` | None    | OAuth client secret     |
| `ORCID_SANDBOX`       | `false` | Use sandbox environment |

### Wikidata

| Variable                   | Default                             | Description             |
| -------------------------- | ----------------------------------- | ----------------------- |
| `WIKIDATA_SPARQL_ENDPOINT` | `https://query.wikidata.org/sparql` | SPARQL endpoint         |
| `WIKIDATA_USER_AGENT`      | `Chive/1.0`                         | User agent for requests |

## Feature flags

| Variable             | Default | Description                |
| -------------------- | ------- | -------------------------- |
| `FEATURE_DISCOVERY`  | `true`  | Enable recommendations     |
| `FEATURE_CLAIMING`   | `true`  | Enable authorship claiming |
| `FEATURE_GOVERNANCE` | `true`  | Enable governance features |
| `FEATURE_BACKLINKS`  | `true`  | Enable Bluesky backlinks   |
| `FEATURE_ENRICHMENT` | `true`  | Enable external enrichment |

## Worker

| Variable               | Default               | Description                   |
| ---------------------- | --------------------- | ----------------------------- |
| `WORKER_CONCURRENCY`   | `5`                   | Concurrent jobs per worker    |
| `WORKER_QUEUES`        | `indexing,enrichment` | Queues to process             |
| `WORKER_MAX_STALENESS` | `3600000`             | Max job age before stale (ms) |

## Frontend (Next.js)

| Variable                   | Default             | Description           |
| -------------------------- | ------------------- | --------------------- |
| `NEXT_PUBLIC_API_URL`      | `/api`              | API base URL          |
| `NEXT_PUBLIC_APP_URL`      | `https://chive.pub` | Application URL       |
| `NEXT_PUBLIC_ANALYTICS_ID` | None                | Analytics tracking ID |

## Development

| Variable          | Default | Description                        |
| ----------------- | ------- | ---------------------------------- |
| `DEBUG`           | None    | Debug namespaces (e.g., `chive:*`) |
| `SEED_DATA`       | `false` | Load seed data on startup          |
| `SKIP_MIGRATIONS` | `false` | Skip database migrations           |

## Example .env file

```bash
# Required
POSTGRES_PASSWORD=your-postgres-password
NEO4J_PASSWORD=your-neo4j-password
JWT_SECRET=your-256-bit-jwt-secret-key-here
FIREHOSE_URL=wss://bsky.network

# Optional overrides
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database connections
POSTGRES_HOST=postgres.example.com
ELASTICSEARCH_URL=https://es.example.com:9200
NEO4J_URI=bolt://neo4j.example.com:7687
REDIS_HOST=redis.example.com

# External APIs
S2_API_KEY=your-semantic-scholar-key
OPENALEX_EMAIL=your-email@example.com
ORCID_CLIENT_ID=APP-XXXXXXXX
ORCID_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Observability
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

## Related documentation

- [Configuration](./configuration.md): Configuration file reference
- [Deployment](../operations/deployment.md): Production setup
- [Secrets management](../operations/deployment.md#secrets-management): Secure credential handling
