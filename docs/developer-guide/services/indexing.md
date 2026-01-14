# IndexingService

The IndexingService orchestrates firehose consumption and event processing. It consumes the ATProto relay firehose, filters for `pub.chive.*` records, and dispatches events to appropriate handlers.

## Architecture

```
FirehoseConsumer → EventFilter → CommitHandler → EventQueue → Processor → DLQ
```

### Components

| Component           | File                      | Purpose                              |
| ------------------- | ------------------------- | ------------------------------------ |
| FirehoseConsumer    | `firehose-consumer.ts`    | WebSocket connection to relay        |
| EventFilter         | `event-filter.ts`         | Filters for pub.chive.\* collections |
| CommitHandler       | `commit-handler.ts`       | Parses CAR files, extracts records   |
| CursorManager       | `cursor-manager.ts`       | Persists cursor for resumption       |
| EventQueue          | `event-queue.ts`          | BullMQ async processing queue        |
| ReconnectionManager | `reconnection-manager.ts` | Exponential backoff reconnection     |
| DLQHandler          | `dlq-handler.ts`          | Dead letter queue for failures       |

## Usage

```typescript
import { IndexingService } from '@/services/indexing';

const indexingService = container.resolve(IndexingService);

// Start consuming firehose
await indexingService.start();

// Check status
const status = await indexingService.getStatus();
// { status: 'running', cursor: 12345678, lag: '2s', eventsProcessed: 50000 }

// Graceful shutdown
await indexingService.stop();
```

## Firehose consumption

The service connects to the configured relay (default: `wss://bsky.network`) and subscribes to the `com.atproto.sync.subscribeRepos` stream:

```typescript
// Connection options
const options = {
  relay: process.env.RELAY_URL || 'wss://bsky.network',
  cursor: await this.cursorManager.getCursor(),
  collections: ['pub.chive.*'],
};
```

### Event filtering

Only events matching `pub.chive.*` collections are processed:

```typescript
const CHIVE_COLLECTIONS = [
  'pub.chive.eprint.submission',
  'pub.chive.eprint.version',
  'pub.chive.review.comment',
  'pub.chive.review.endorsement',
  'pub.chive.graph.fieldProposal',
  'pub.chive.graph.vote',
  'pub.chive.eprint.userTag',
];
```

### Commit parsing

CAR files are parsed to extract individual records:

```typescript
interface ParsedCommit {
  repo: string; // DID of the repository
  rev: string; // Revision/CID of the commit
  ops: Operation[]; // Create, update, delete operations
  blobs: CID[]; // Referenced blob CIDs
}

interface Operation {
  action: 'create' | 'update' | 'delete';
  path: string; // Collection + rkey
  cid?: CID; // Record CID (null for deletes)
  record?: unknown; // Decoded record (null for deletes)
}
```

## Event processing

Events are dispatched to the appropriate service based on collection:

```typescript
async processEvent(event: RepoEvent): Promise<void> {
  for (const op of event.ops) {
    const collection = op.path.split('/')[0];

    switch (collection) {
      case 'pub.chive.eprint.submission':
        await this.eprintService.indexEprint(op.record, {
          uri: `at://${event.repo}/${op.path}`,
          cid: op.cid,
          pdsEndpoint: await this.resolvePds(event.repo)
        });
        break;
      case 'pub.chive.review.comment':
        await this.reviewService.indexReview(op.record, metadata);
        break;
      // ... other collections
    }
  }
}
```

## Cursor management

The cursor tracks the last processed event for resumption:

```typescript
class CursorManager {
  private cursor: number;
  private flushInterval: NodeJS.Timeout;

  async getCursor(): Promise<number> {
    // Load from PostgreSQL on startup
    const row = await this.db.query('SELECT cursor FROM indexing_state WHERE id = $1', [
      'firehose',
    ]);
    return row?.cursor ?? 0;
  }

  async updateCursor(cursor: number): Promise<void> {
    this.cursor = cursor;
    // Batched flush every 5 seconds
  }

  async flush(): Promise<void> {
    await this.db.query('UPDATE indexing_state SET cursor = $1 WHERE id = $2', [
      this.cursor,
      'firehose',
    ]);
  }
}
```

## Error handling

### Dead letter queue

Failed events are sent to a dead letter queue for manual inspection:

```typescript
interface DLQEntry {
  id: number;
  seq: number;
  repoDid: string;
  eventType: string;
  eventData: DLQEvent;
  errorMessage: string;
  errorType: ErrorType;
  retryCount: number;
  createdAt: Date;
  lastRetryAt?: Date;
}

// Events are retried 3 times with exponential backoff
// After 3 failures, moved to DLQ
```

### Error classification

Errors are classified to determine retry behavior:

```typescript
enum ErrorType {
  TRANSIENT = 'transient', // Network errors, timeouts - retry
  PERMANENT = 'permanent', // Invalid record, schema mismatch - DLQ
  RATE_LIMIT = 'rate_limit', // Rate limit - backoff and retry
}
```

## Backpressure handling

The service implements backpressure to prevent memory exhaustion:

```typescript
const MAX_QUEUE_SIZE = 10000;

if (this.eventQueue.size() > MAX_QUEUE_SIZE) {
  this.logger.warn('Queue full, applying backpressure');
  await this.pauseConsumer();
  await this.eventQueue.drain(MAX_QUEUE_SIZE / 2);
  await this.resumeConsumer();
}
```

## Reconnection

The ReconnectionManager handles network failures:

```typescript
const RECONNECTION_CONFIG = {
  initialDelay: 1000, // 1 second
  maxDelay: 300000, // 5 minutes
  multiplier: 2, // Exponential backoff
  jitter: 0.1, // 10% randomization
};
```

## Graceful shutdown

The service drains queues and flushes cursor before shutdown:

```typescript
async stop(): Promise<void> {
  this.logger.info('Initiating graceful shutdown');

  // Stop accepting new events
  await this.consumer.disconnect();

  // Wait for queue to drain (max 30 seconds)
  await this.eventQueue.drain(30000);

  // Flush cursor to database
  await this.cursorManager.flush();

  this.logger.info('Shutdown complete');
}
```

## Metrics

The service exposes Prometheus metrics:

| Metric                         | Type    | Description               |
| ------------------------------ | ------- | ------------------------- |
| `chive_indexing_events_total`  | Counter | Total events processed    |
| `chive_indexing_events_failed` | Counter | Failed events             |
| `chive_indexing_lag_seconds`   | Gauge   | Time behind firehose head |
| `chive_indexing_queue_size`    | Gauge   | Current queue depth       |
| `chive_indexing_cursor`        | Gauge   | Current cursor position   |

## Running the Indexer

The indexer runs as a separate process from the API server. In production, it's deployed as the `chive-indexer` container.

### Entry Point

The indexer entry point is `src/indexer.ts`, which:

1. Initializes all database connections (PostgreSQL, Redis, Elasticsearch, Neo4j)
2. Creates the services needed for event processing (EprintService, ReviewService, KnowledgeGraphService, ActivityService)
3. Creates the event processor using `createEventProcessor()`
4. Starts the IndexingService to consume the firehose
5. Handles graceful shutdown on SIGTERM/SIGINT

### Development

```bash
# Run the indexer locally
pnpm exec tsx src/indexer.ts
```

### Production (Docker)

In production, the indexer runs as the `chive-indexer` service:

```yaml
chive-indexer:
  image: chive:latest
  command: ['node', '--enable-source-maps', 'dist/src/indexer.js']
  environment:
    - ATPROTO_RELAY_URL=wss://bsky.network
    - INDEXER_CONCURRENCY=10
```

### Why a Separate Process?

The indexer runs separately from the API for several reasons:

1. **Resource isolation**: Firehose consumption is CPU/memory intensive
2. **Independent scaling**: Can scale indexer independently from API
3. **Failure isolation**: Indexer failures don't affect API availability
4. **Different lifecycle**: Indexer runs continuously, API handles request/response

## Configuration

```typescript
interface IndexingConfig {
  relay: string; // Relay WebSocket URL
  collections: string[]; // Collections to filter
  batchSize: number; // Events per batch
  flushInterval: number; // Cursor flush interval (ms)
  maxRetries: number; // Max retry attempts
  queueConcurrency: number; // Parallel processors
}
```

Environment variables:

| Variable                     | Default              | Description           |
| ---------------------------- | -------------------- | --------------------- |
| `RELAY_URL`                  | `wss://bsky.network` | ATProto relay URL     |
| `INDEXING_BATCH_SIZE`        | `100`                | Events per batch      |
| `INDEXING_FLUSH_INTERVAL`    | `5000`               | Cursor flush interval |
| `INDEXING_MAX_RETRIES`       | `3`                  | Max retry attempts    |
| `INDEXING_QUEUE_CONCURRENCY` | `10`                 | Parallel processors   |
