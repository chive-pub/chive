# Services overview

Chive's backend is organized into 18 specialized services that handle distinct responsibilities. All services follow ATProto compliance principles: they index data from the firehose but never write to user PDSes.

## Service architecture

Services use TSyringe for dependency injection with abstract `I*` interfaces:

```typescript
import { injectable, inject } from 'tsyringe';

@injectable()
export class EprintService {
  constructor(
    @inject('IStorageBackend') private storage: IStorageBackend,
    @inject('ISearchEngine') private search: ISearchEngine,
    @inject('ILogger') private logger: ILogger
  ) {}
}
```

All services return `Result<T, Error>` types for explicit error handling.

## Core services

### Data ingestion

| Service                          | Purpose                     | Key operations                     |
| -------------------------------- | --------------------------- | ---------------------------------- |
| [IndexingService](./indexing.md) | Firehose consumption        | `start()`, `stop()`, `getStatus()` |
| EprintService                    | Eprint indexing             | `indexEprint()`, `getEprint()`     |
| ReviewService                    | Review/endorsement indexing | `indexReview()`, `getReviews()`    |

### Search and discovery

| Service                            | Purpose          | Key operations                                  |
| ---------------------------------- | ---------------- | ----------------------------------------------- |
| SearchService                      | Full-text search | `search()`, `autocomplete()`                    |
| [DiscoveryService](./discovery.md) | Recommendations  | `getRecommendationsForUser()`, `enrichEprint()` |
| KnowledgeGraphService              | Field taxonomy   | `getField()`, `browseFaceted()`                 |

### User engagement

| Service             | Purpose                 | Key operations                             |
| ------------------- | ----------------------- | ------------------------------------------ |
| MetricsService      | View/download tracking  | `recordView()`, `getTrending()`            |
| ActivityService     | Activity logging        | `logActivity()`, `correlateWithFirehose()` |
| NotificationService | Real-time notifications | `createNotification()`, `getUnreadCount()` |

### Author and identity

| Service                          | Purpose               | Key operations                                 |
| -------------------------------- | --------------------- | ---------------------------------------------- |
| [ClaimingService](./claiming.md) | Paper claiming        | `getSubmissionData()`, `requestCoauthorship()` |
| ReconciliationService            | Import reconciliation | `createReconciliation()`, `updateStatus()`     |

### Infrastructure

| Service                | Purpose               | Key operations                         |
| ---------------------- | --------------------- | -------------------------------------- |
| BlobProxyService       | Blob fetching         | `getBlob()`, `proxyBlob()`             |
| BacklinkService        | ATProto backlinks     | `createBacklink()`, `getCounts()`      |
| GovernancePDSConnector | Governance PDS access | `getAuthorityRecord()`, `listFacets()` |

## Service initialization order

Services are initialized in dependency order:

```
1. Storage adapters (PostgreSQL, Redis, Elasticsearch, Neo4j)
2. Infrastructure services (BlobProxy, GovernancePDS)
3. Core indexing services (Eprint, Review)
4. Query services (Search, Discovery, KnowledgeGraph)
5. Engagement services (Metrics, Activity, Notification)
6. Application services (Claiming, Reconciliation)
7. IndexingService (starts firehose consumption)
```

## Error handling patterns

Services use the Result type for operations that can fail:

```typescript
import { Result, ok, err } from 'neverthrow';

async getEprint(uri: AtUri): Promise<Result<EprintView, EprintError>> {
  const record = await this.storage.getEprint(uri);
  if (!record) {
    return err(new EprintNotFoundError(uri));
  }
  return ok(this.toView(record));
}
```

Callers handle both success and failure:

```typescript
const result = await eprintService.getEprint(uri);
result.match(
  (eprint) => console.log(eprint.title),
  (error) => console.error(error.message)
);
```

## Caching strategies

Services use a 3-tier caching strategy:

| Tier | Storage    | TTL       | Use case                |
| ---- | ---------- | --------- | ----------------------- |
| L1   | Redis      | 5 min     | Hot data, session state |
| L2   | PostgreSQL | 24 hours  | Indexed metadata        |
| L3   | PDS fetch  | On demand | Authoritative source    |

The BlobProxyService demonstrates this pattern:

```typescript
async getBlob(did: string, cid: CID): Promise<Blob> {
  // L1: Check Redis
  const cached = await this.redis.get(`blob:${cid}`);
  if (cached) return cached;

  // L2: Check CDN
  const cdnUrl = await this.cdn.getUrl(cid);
  if (cdnUrl) return this.fetchFromCdn(cdnUrl);

  // L3: Fetch from user's PDS
  const blob = await this.repository.getBlob(did, cid);
  await this.redis.set(`blob:${cid}`, blob, 'EX', 300);
  return blob;
}
```

## Health checks

Each service exposes health status:

```typescript
interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  details?: Record<string, unknown>;
}

// Usage
const health = await indexingService.getStatus();
// { status: 'healthy', cursor: 12345678, lag: '2s' }
```

## Testing services

Services are tested at multiple levels:

```typescript
// Unit test with mocked dependencies
describe('EprintService', () => {
  let service: EprintService;
  let mockStorage: MockStorageBackend;

  beforeEach(() => {
    mockStorage = new MockStorageBackend();
    service = new EprintService(mockStorage, mockSearch, mockLogger);
  });

  it('indexes eprint from firehose event', async () => {
    const result = await service.indexEprint(record, metadata);
    expect(result.isOk()).toBe(true);
    expect(mockStorage.store).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: record.uri,
      })
    );
  });
});
```

## Next steps

- [IndexingService](./indexing.md): Firehose consumption pipeline
- [DiscoveryService](./discovery.md): Recommendation engine
- [ClaimingService](./claiming.md): Authorship verification
- [PDSDiscoveryService](./pds-discovery.md): PDS registration and scanning
