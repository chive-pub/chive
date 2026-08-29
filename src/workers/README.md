# Background Workers

BullMQ-based background workers for async processing.

## Overview

Workers process background jobs queued via Redis/BullMQ. Each worker handles a specific type of work with configurable concurrency and retry policies.

## Workers

| Worker            | Queue              | Description                                  |
| ----------------- | ------------------ | -------------------------------------------- |
| `FreshnessWorker` | `eprint-freshness` | Checks record freshness against source PDSes |

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
