# Background Jobs

Scheduled jobs for maintenance and synchronization tasks.

## Overview

Jobs run on configured schedules to perform maintenance, sync data, and queue background work. They are distinct from workers - jobs scan and schedule work, workers execute it.

## Jobs

| Job                   | Schedule     | Description                                           |
| --------------------- | ------------ | ----------------------------------------------------- |
| `FreshnessScanJob`    | Hourly       | Scans for stale records, queues freshness checks      |
| `GovernanceSyncJob`   | Daily        | Syncs governance data from Governance PDS             |
| `GraphAlgorithmJob`   | Daily        | Runs graph algorithms (PageRank, community detection) |
| `TagSyncJob`          | Hourly       | Syncs trending tags and promotes popular tags         |
| `PDSScanSchedulerJob` | Configurable | Schedules scans of registered external PDSes          |

## Freshness Scan Job

Scans for stale records and queues freshness check jobs:

```typescript
import { FreshnessScanJob } from './jobs/freshness-scan-job.js';

const job = new FreshnessScanJob({
  pool,
  freshnessWorker,
  logger,
  scanIntervalMs: 3600000, // 1 hour
  batchSize: 500,
});

await job.start();
```

**Staleness Tiers:**
| Tier | Threshold | Priority |
|------|-----------|----------|
| URGENT | < 6 hours since last failure | 1 |
| RECENT | < 24 hours | 3 |
| NORMAL | 1-7 days | 5 |
| BACKGROUND | > 7 days | 10 |

## Governance Sync Job

Syncs authority records and approved proposals from Governance PDS:

```typescript
import { GovernanceSyncJob } from './jobs/governance-sync-job.js';

const job = new GovernanceSyncJob({
  governanceDid: 'did:plc:chive-governance',
  repository,
  knowledgeGraphService,
  logger,
});

await job.start();
```

## Graph Algorithm Job

Runs graph algorithms on the knowledge graph:

```typescript
import { GraphAlgorithmJob } from './jobs/graph-algorithm-job.js';

const job = new GraphAlgorithmJob({
  neo4jDriver,
  logger,
  algorithms: ['pagerank', 'community_detection', 'centrality'],
});

await job.start();
```

## PDS Scan Scheduler Job

Schedules scans of registered external PDSes for eprints:

```typescript
import { PDSScanSchedulerJob } from './jobs/pds-scan-scheduler-job.js';

const job = new PDSScanSchedulerJob({
  pdsRegistry,
  scanQueue,
  logger,
});

await job.start();
```

## ATProto Compliance

All jobs follow ATProto principles:

- READ-ONLY scans of local indexes
- Does not write to user PDSes
- All data rebuildable from source

## Related Documentation

- [Workers](../workers/README.md) - Background workers that execute jobs
- [Services](../services/README.md) - Services jobs depend on
