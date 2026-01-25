# Pre-Deployment Verification Tests

These tests run before every deployment to ensure all services, jobs, and scripts function correctly.

## What's Tested

### 1. Script Execution

- `reindex-all-eprints.ts` - Full reindex with field label resolution
- `db/setup-elasticsearch.ts` - Index template and mapping setup
- `db/reindex-governance-to-neo4j.ts` - Governance sync

### 2. Background Jobs

- `governance-sync-job.ts` - Syncs governance records
- `graph-algorithm-job.ts` - Runs PageRank, community detection
- `freshness-scan-job.ts` - Detects stale records
- `pds-scan-scheduler-job.ts` - Schedules PDS discovery
- `tag-sync-job.ts` - Syncs tags to Neo4j

### 3. Workers

- `index-retry-worker.ts` - Retries failed indexing
- `enrichment-worker.ts` - Enriches records with metadata
- `freshness-worker.ts` - Updates freshness scores

### 4. Core Services

- Firehose indexing pipeline (create, update, delete)
- Search indexing with nested field_nodes
- Knowledge graph operations

## Running Locally

```bash
# Start test stack
./scripts/start-test-stack.sh

# Run pre-deployment tests
pnpm test:pre-deployment
```

## CI Integration

These tests run automatically:

- On every PR to `main`
- Before every deployment
- Can be triggered manually via workflow_dispatch
