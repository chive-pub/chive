# PostgreSQL storage

PostgreSQL serves as Chive's primary index storage for preprints, reviews, and metadata. All tables store **indexes only**, never source data.

## ATProto compliance

### Index semantics

All user data tables use `_index` suffix to emphasize they are indexes, not authoritative storage:

| Table                | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `preprints_index`    | Preprint metadata (title, abstract, keywords) |
| `authors_index`      | Author profiles (name, bio, affiliations)     |
| `reviews_index`      | Review comments (threaded discussions)        |
| `endorsements_index` | Endorsements (methods, results, overall)      |
| `user_tags_index`    | User-contributed tags (folksonomy)            |

### PDS source tracking

Every index table tracks its source PDS:

| Column           | Description                           |
| ---------------- | ------------------------------------- |
| `pds_url`        | URL of the PDS where the record lives |
| `indexed_at`     | When Chive indexed this record        |
| `last_synced_at` | Last successful sync with PDS         |

This enables staleness detection and re-indexing.

### No blob data

Chive never stores blob data (PDFs, images). Only BlobRef CIDs:

```sql
pdf_blob_cid TEXT,       -- CID pointing to blob in user's PDS
pdf_blob_mime_type TEXT, -- MIME type
pdf_blob_size BIGINT     -- Size in bytes
```

Blobs are fetched on-demand from the user's PDS and optionally cached.

## Schema

### Primary keys

All index tables use AT URIs as primary keys (not auto-incrementing IDs):

```sql
CREATE TABLE preprints_index (
  uri TEXT PRIMARY KEY,  -- e.g., at://did:plc:abc/pub.chive.preprint.submission/xyz
  cid TEXT NOT NULL,
  author_did TEXT NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  keywords TEXT[],
  pdf_blob_cid TEXT,
  pdf_blob_mime_type TEXT,
  pdf_blob_size BIGINT,
  pds_url TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL
);
```

### Foreign keys

Foreign keys reference AT URIs:

```sql
CREATE TABLE reviews_index (
  uri TEXT PRIMARY KEY,
  preprint_uri TEXT NOT NULL,
  author_did TEXT NOT NULL,
  parent_uri TEXT,  -- For threaded replies

  CONSTRAINT fk_preprint
    FOREIGN KEY (preprint_uri)
    REFERENCES preprints_index(uri)
    ON DELETE CASCADE,

  CONSTRAINT fk_parent
    FOREIGN KEY (parent_uri)
    REFERENCES reviews_index(uri)
    ON DELETE SET NULL
);
```

### Performance indexes

Indexes on frequently queried columns:

```sql
-- Find preprints by author
CREATE INDEX idx_preprints_author ON preprints_index(author_did);

-- Recent preprints
CREATE INDEX idx_preprints_created ON preprints_index(created_at DESC);

-- Find records by PDS (for staleness detection)
CREATE INDEX idx_preprints_pds ON preprints_index(pds_url);

-- Keyword search
CREATE INDEX idx_preprints_keywords ON preprints_index USING GIN(keywords);
```

## Infrastructure tables

### Firehose cursor

Tracks current position in the ATProto firehose:

```sql
CREATE TABLE firehose_cursor (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cursor BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT single_row CHECK (id = 1)
);
```

### Dead letter queue

Stores failed events for retry:

```sql
CREATE TABLE firehose_dlq (
  id SERIAL PRIMARY KEY,
  event_seq BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  error TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_retry_at TIMESTAMPTZ
);
```

### PDS sync status

Per-PDS health tracking:

```sql
CREATE TABLE pds_sync_status (
  pds_url TEXT PRIMARY KEY,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  is_healthy BOOLEAN NOT NULL DEFAULT true
);
```

## Repositories

### PreprintsRepository

```typescript
import { PreprintsRepository } from '@/storage/postgresql/preprints-repository.js';

const repo = new PreprintsRepository(pool, logger);

// Store indexed preprint
await repo.upsert({
  uri,
  cid,
  authorDid,
  title,
  abstract,
  keywords,
  pdfBlobCid,
  pdsUrl,
});

// Retrieve by URI
const preprint = await repo.findByUri(uri);

// List by author
const preprints = await repo.findByAuthor(authorDid, { limit: 20 });

// Find stale records (older than 7 days)
const stale = await repo.findStale({ olderThan: 7 * 24 * 60 * 60 * 1000 });

// Delete (when record deleted from PDS)
await repo.delete(uri);
```

### ReviewsRepository

```typescript
import { ReviewsRepository } from '@/storage/postgresql/reviews-repository.js';

const repo = new ReviewsRepository(pool, logger);

// Store review
await repo.upsert({
  uri,
  preprintUri,
  authorDid,
  parentUri,
  text,
  reviewType,
});

// Get thread for preprint
const reviews = await repo.findByPreprint(preprintUri, {
  includeReplies: true,
  sort: 'oldest',
});

// Get review with ancestors (for context)
const thread = await repo.findThreadContext(reviewUri);
```

## Query builder

The `QueryBuilder` class provides type-safe query construction:

```typescript
import { QueryBuilder } from '@/storage/postgresql/query-builder.js';

const query = new QueryBuilder('preprints_index')
  .select(['uri', 'title', 'author_did'])
  .where('author_did', '=', authorDid)
  .where('created_at', '>=', startDate)
  .orderBy('created_at', 'DESC')
  .limit(20)
  .offset(cursor);

const { sql, params } = query.build();
const result = await pool.query(sql, params);
```

### Filtering operators

| Operator             | SQL     | Example                                       |
| -------------------- | ------- | --------------------------------------------- |
| `=`                  | `=`     | `where('status', '=', 'published')`           |
| `!=`                 | `<>`    | `where('status', '!=', 'draft')`              |
| `>`, `>=`, `<`, `<=` | Same    | `where('created_at', '>=', date)`             |
| `in`                 | `IN`    | `where('status', 'in', ['draft', 'pending'])` |
| `like`               | `ILIKE` | `where('title', 'like', '%quantum%')`         |
| `contains`           | `@>`    | `where('keywords', 'contains', ['AI'])`       |

## Batch operations

For high-throughput indexing:

```typescript
import { BatchOperations } from '@/storage/postgresql/batch-operations.js';

const batch = new BatchOperations(pool, logger);

// Upsert many preprints
await batch.upsertPreprints(preprints, {
  chunkSize: 100,
  onConflict: 'update',
});

// Bulk delete
await batch.deletePreprints(uris);

// Bulk update sync timestamps
await batch.updateSyncTimestamps(uris, new Date());
```

## Transactions

```typescript
import { withTransaction } from '@/storage/postgresql/transaction.js';

await withTransaction(pool, async (client) => {
  // All operations use same transaction
  await preprintsRepo.upsert(preprint, client);
  await reviewsRepo.upsert(review, client);

  // Automatic commit on success, rollback on error
});
```

## Migrations

### Running migrations

```bash
# Apply pending migrations
pnpm db:migrate:up

# Rollback last migration
pnpm db:migrate:down

# Create new migration
pnpm db:migrate:create add-endorsements-table
```

### Migration structure

Migrations live in `src/storage/postgresql/migrations/`:

```typescript
// 1734567890000_add-endorsements-table.ts
import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('endorsements_index')
    .addColumn('uri', 'text', (col) => col.primaryKey())
    .addColumn('preprint_uri', 'text', (col) => col.notNull())
    .addColumn('endorser_did', 'text', (col) => col.notNull())
    .addColumn('endorsement_type', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('endorsements_index').execute();
}
```

## Configuration

Environment variables:

| Variable            | Default     | Description              |
| ------------------- | ----------- | ------------------------ |
| `POSTGRES_HOST`     | `localhost` | Database host            |
| `POSTGRES_PORT`     | `5432`      | Database port            |
| `POSTGRES_DB`       | `chive`     | Database name            |
| `POSTGRES_USER`     | `chive`     | Username                 |
| `POSTGRES_PASSWORD` | Required    | Password                 |
| `POSTGRES_POOL_MIN` | `5`         | Minimum pool connections |
| `POSTGRES_POOL_MAX` | `20`        | Maximum pool connections |

## Rebuilding from firehose

If indexes become corrupted, rebuild from scratch:

```bash
# 1. Truncate all index tables
psql -c "TRUNCATE preprints_index, reviews_index, endorsements_index CASCADE;"

# 2. Reset firehose cursor
psql -c "UPDATE firehose_cursor SET cursor = 0;"

# 3. Restart the indexing service
pnpm start:indexer
```

The indexer will replay all events from the firehose.

## Testing

```bash
# Run PostgreSQL integration tests
pnpm test tests/integration/storage/postgresql-schema.test.ts

# Run compliance tests
pnpm test:compliance tests/compliance/database-compliance.test.ts
```

## Related documentation

- [Elasticsearch Storage](./elasticsearch.md): Full-text search
- [Neo4j Storage](./neo4j.md): Knowledge graph
- [Core Services](../core-business-services.md): Service layer
