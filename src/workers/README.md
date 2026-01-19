# Background Workers

BullMQ-based background workers for async processing.

## Overview

Workers process background jobs queued via Redis/BullMQ. Each worker handles a specific type of work with configurable concurrency and retry policies.

## Workers

| Worker             | Queue               | Description                                  |
| ------------------ | ------------------- | -------------------------------------------- |
| `EnrichmentWorker` | `eprint-enrichment` | Enriches eprints with external metadata      |
| `FreshnessWorker`  | `eprint-freshness`  | Checks record freshness against source PDSes |

## Enrichment Worker

Fetches metadata from external APIs and indexes citations:

```typescript
import { EnrichmentWorker, ENRICHMENT_QUEUE_NAME } from './workers/enrichment-worker.js';

const worker = new EnrichmentWorker({
  redis: { host: 'localhost', port: 6379 },
  discoveryService,
  eventBus,
  logger,
});

await worker.start();

// Queue enrichment job
await EnrichmentWorker.enqueue(queue, {
  uri: 'at://did:plc:example/pub.chive.eprint.submission/abc',
  doi: '10.1234/example',
});
```

**Processing Flow:**

1. Receive job with eprint URI/DOI/arXiv ID
2. Fetch data from Semantic Scholar (citations, influence)
3. Fetch data from OpenAlex (concepts, topics)
4. Index Chive-to-Chive citations in Neo4j
5. Update eprint record with enrichment data
6. Emit `eprint.enriched` event

**Priority Levels:**

- `CLAIMED` (1) - User-triggered, highest priority
- `INDEXED` (5) - Recently indexed eprint
- `BACKGROUND` (10) - Background re-enrichment

## Freshness Worker

Verifies indexed records against source PDSes:

```typescript
import { FreshnessWorker, FRESHNESS_QUEUE_NAME } from './workers/freshness-worker.js';

const worker = new FreshnessWorker({
  redis: { host: 'localhost', port: 6379 },
  repository,
  eprintRepository,
  logger,
});

await worker.start();
```

**Priority Levels:**

- `URGENT` (1) - Records failing recent checks
- `RECENT` (3) - Synced within 24 hours
- `NORMAL` (5) - Synced 1-7 days ago
- `BACKGROUND` (10) - Synced 7+ days ago

## ATProto Compliance

All workers follow ATProto principles:

- Read-only external API access
- All data is cached/derived, not source of truth
- Works without external APIs (graceful degradation)
- Does not write to user PDSes

## Related Documentation

- [Jobs](../jobs/README.md) - Scheduled jobs that queue work
- [Services](../services/README.md) - Business logic workers depend on
