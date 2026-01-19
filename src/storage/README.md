# Storage Layer

Database adapters and schema for Chive's local indexes.

## Overview

Chive uses four databases for different purposes:

- **PostgreSQL** - Primary index storage for eprints, reviews, and metadata
- **Elasticsearch** - Full-text search and faceted filtering
- **Neo4j** - Knowledge graph for fields, facets, and authority records
- **Redis** - Caching, rate limiting, and job queues

**CRITICAL**: All databases store **indexes only**, never source data. All indexed data can be rebuilt from the AT Protocol firehose.

## Directory Structure

```
storage/
├── README.md
├── elasticsearch/               # Elasticsearch adapter
│   ├── index.ts                 # Barrel exports
│   ├── adapter.ts               # Storage interface implementation
│   ├── connection.ts            # ES client connection
│   ├── setup.ts                 # Index/template initialization
│   ├── index-manager.ts         # Index lifecycle management
│   ├── search-query-builder.ts  # Query DSL builder
│   ├── aggregations-builder.ts  # Facet aggregations
│   ├── document-mapper.ts       # Record to document mapping
│   ├── autocomplete-service.ts  # Completion suggestions
│   ├── external-paper-search.ts # External paper index
│   ├── query-cache.ts           # Query result caching
│   ├── __tests__/               # Unit tests
│   ├── ilm/                     # Index lifecycle policies
│   │   └── eprints_policy.json
│   ├── pipelines/               # Ingest pipelines
│   │   └── eprint-processing.json
│   └── templates/               # Index templates
│       ├── eprints.json
│       └── external-papers.json
├── neo4j/                       # Neo4j adapter (see neo4j/README.md)
├── postgresql/                  # PostgreSQL adapter
│   ├── index.ts                 # Barrel exports
│   ├── adapter.ts               # Storage interface implementation
│   ├── config.ts                # Connection configuration
│   ├── connection.ts            # Connection pooling
│   ├── transaction.ts           # Transaction utilities
│   ├── query-builder.ts         # SQL query building
│   ├── batch-operations.ts      # Bulk insert/update
│   ├── eprints-repository.ts    # Eprint CRUD
│   ├── reviews-repository.ts    # Review CRUD
│   ├── facet-usage-history-repository.ts  # Facet tracking
│   ├── pds-tracker.ts           # PDS source tracking
│   ├── staleness-detector.ts    # Record staleness checks
│   └── migrations/              # Database migrations
│       ├── 1732910000000_initial-schema.ts
│       ├── 1733400000000_auth-tables.ts
│       ├── ... (20+ migration files)
│       └── 1737400000000_pds-registry-relay-connected.ts
└── redis/                       # Redis utilities
    └── structures.ts            # Key patterns and data structures
```

## ATProto Compliance

### Index Semantics

All user data tables use `_index` suffix to emphasize they are indexes, not authoritative storage:

- `eprints_index`
- `authors_index`
- `reviews_index`
- `endorsements_index`
- `user_tags_index`

### PDS Source Tracking

Every index table tracks its source PDS:

- `pds_url` - URL of the PDS where the record lives
- `indexed_at` - When Chive indexed this record
- `last_synced_at` - Last successful sync with PDS

This enables staleness detection and re-indexing.

### No Blob Data

Chive **never** stores blob data (PDFs, images). Only BlobRef CIDs:

- `pdf_blob_cid` - CID pointing to blob in user's PDS
- `pdf_blob_mime_type` - MIME type
- `pdf_blob_size` - Size in bytes

Blobs are fetched on-demand from the user's PDS and optionally cached.

### Rebuilding from Firehose

All indexes can be rebuilt from scratch by:

1. Connecting to AT Protocol relay firehose
2. Filtering for `pub.chive.*` records
3. Re-indexing all events from sequence 0

The `firehose_cursor` table tracks current position. The `firehose_dlq` table stores failed events for retry.

## PostgreSQL Schema

### Tables

**Index Tables:**

- `eprints_index` - Eprint metadata (title, abstract, keywords)
- `authors_index` - Author profiles (name, bio, affiliations)
- `reviews_index` - Review comments (threaded discussions)
- `endorsements_index` - Endorsements (methods, results, overall)
- `user_tags_index` - User-contributed tags (folksonomy)

**Infrastructure Tables:**

- `firehose_cursor` - Current firehose sequence number
- `firehose_dlq` - Dead letter queue for failed events
- `pds_sync_status` - Per-PDS health tracking

### Primary Keys

All index tables use AT URIs as primary keys (not auto-incrementing IDs):

```sql
CREATE TABLE eprints_index (
  uri TEXT PRIMARY KEY,  -- e.g., at://did:plc:abc/pub.chive.eprint.submission/xyz
  ...
);
```

### Foreign Keys

Foreign keys reference AT URIs:

```sql
CONSTRAINT fk_eprint
  FOREIGN KEY (eprint_uri)
  REFERENCES eprints_index(uri)
  ON DELETE CASCADE
```

### Indexes

Performance indexes on frequently queried columns:

- `eprints_index(author_did)` - Find eprints by author
- `eprints_index(created_at DESC)` - Recent eprints
- `eprints_index(pds_url)` - Find records by PDS
- `eprints_index(keywords) USING GIN` - Keyword search

## Elasticsearch Configuration

### Index Template

Template `eprints` applies to `eprints-*` indexes:

- Custom analyzers (porter stemming, asciifolding)
- Nested facet mappings
- Completion suggester for autocomplete

### ILM Policy

Index lifecycle management with hot/warm/cold tiers:

- **Hot** (0-30 days) - Rollover at 50GB or 30 days
- **Warm** (30-90 days) - Force merge to 1 segment
- **Cold** (90+ days) - Reduce priority

### Aliases

Write alias `eprints` points to current index (`eprints-000001`).

## Neo4j Schema

### Node Types

- `Field` - Knowledge graph nodes (hierarchical)
- `AuthorityRecord` - Controlled vocabulary terms
- `WikidataEntity` - Wikidata Q-IDs for external linking
- `Eprint` - Graph associations for eprints
- `Author` - Author nodes for collaboration graphs
- `FacetDimension` - PMEST + FAST dimension templates

### Constraints

Unique constraints on IDs:

```cypher
CREATE CONSTRAINT field_id_unique
FOR (f:Field) REQUIRE f.id IS UNIQUE;
```

### Indexes

Performance indexes for search:

```cypher
CREATE INDEX field_label_idx
FOR (f:Field) ON (f.label);
```

### Initial Data

Bootstrap data includes:

- Root field node (`id: 'root'`)
- 10 facet dimension templates (PMEST + FAST)

## Redis Data Structures

### Key Patterns

Namespaced keys for different purposes:

- `session:{id}` - Session data
- `user_sessions:{did}` - User's active sessions
- `ratelimit:auth:{did}` - Rate limit counters
- `cache:eprint:{uri}` - L2 cache for eprints
- `firehose:cursor` - Firehose cursor backup
- `queue:indexing` - BullMQ job queue

### TTL Values

- Sessions: 7 days
- Rate limits: 1 minute windows
- Cache: 3-10 minutes (depending on data type)

## Migrations

### Running Migrations

```bash
# Apply pending migrations
pnpm db:migrate:up

# Rollback last migration
pnpm db:migrate:down

# Create new migration
pnpm db:migrate:create <name>
```

### Migration Files

Migrations live in `src/storage/postgresql/migrations/`.

File format: `{timestamp}_{name}.ts`

Each migration exports `up()` and `down()` functions.

## Initialization

### Full Setup

Initialize all databases:

```bash
pnpm db:init
```

This runs:

1. PostgreSQL migrations
2. Elasticsearch template setup
3. Neo4j schema setup
4. Redis connection verification

### Individual Setup

```bash
# PostgreSQL only
pnpm db:migrate:up

# Elasticsearch only
tsx scripts/db/setup-elasticsearch.ts

# Neo4j only
tsx scripts/db/setup-neo4j.ts
```

## Testing

### Integration Tests

```bash
# All storage tests
pnpm test tests/integration/storage/

# Specific database
pnpm test tests/integration/storage/postgresql-schema.test.ts
```

### Compliance Tests

**CRITICAL**: ATProto compliance tests must pass 100%:

```bash
pnpm test:compliance tests/compliance/database-compliance.test.ts
```

Verifies:

- Index semantics (\_index naming)
- PDS source tracking
- No blob data
- AT URI references
- Rebuilding capability

## Development

### Docker Stack

Start all databases:

```bash
pnpm test:stack:start
```

Stop:

```bash
pnpm test:stack:stop
```

### Configuration

Databases load configuration from environment variables:

**PostgreSQL:**

- `POSTGRES_HOST` (default: localhost)
- `POSTGRES_PORT` (default: 5432)
- `POSTGRES_DB` (default: chive_test)
- `POSTGRES_USER` (default: chive)
- `POSTGRES_PASSWORD` (default: chive_test_password)

**Elasticsearch:**

- `ELASTICSEARCH_URL` (default: http://localhost:9200)
- `ELASTICSEARCH_USER` (optional)
- `ELASTICSEARCH_PASSWORD` (optional)

**Neo4j:**

- `NEO4J_URI` (default: bolt://localhost:7687)
- `NEO4J_USER` (default: neo4j)
- `NEO4J_PASSWORD` (default: chive_test_password)

**Redis:**

- `REDIS_HOST` (default: localhost)
- `REDIS_PORT` (default: 6379)
- `REDIS_PASSWORD` (optional)

## Production Deployment

### Database Sizing

**PostgreSQL:**

- 3 shards, 2 replicas
- Connection pool: 20-50 connections

**Elasticsearch:**

- 3 shards per index
- 2 replicas for HA
- ILM-managed storage tiers

**Neo4j:**

- Single instance (can cluster for HA)
- APOC and Graph Data Science plugins

**Redis:**

- Single instance with persistence
- Optional Redis Sentinel for HA

### Backups

**PostgreSQL:**

- Point-in-time recovery (WAL archiving)
- Daily full backups

**Elasticsearch:**

- Snapshot repository (S3, GCS)
- Daily automated snapshots

**Neo4j:**

- Graph database backups via Neo4j Admin
- Transaction log retention

**Redis:**

- RDB snapshots + AOF persistence
- Not critical (can rebuild from PostgreSQL)

### Monitoring

Monitor:

- Database connection pools
- Query performance
- Index sizes
- Replication lag
- Cache hit rates

## Troubleshooting

### Migration Failures

```bash
# Check migration status
pnpm db:migrate:up

# Rollback and retry
pnpm db:migrate:down
pnpm db:migrate:up
```

### Index Corruption

If PostgreSQL indexes are corrupted, rebuild from firehose:

1. Truncate all `*_index` tables
2. Reset firehose cursor to 0
3. Restart firehose consumer
4. Wait for full re-index

### Elasticsearch Issues

```bash
# Check cluster health
curl http://localhost:9200/_cluster/health

# Reapply templates
tsx scripts/db/setup-elasticsearch.ts
```

### Neo4j Schema Issues

```bash
# Drop and recreate
tsx scripts/db/setup-neo4j.ts
```
