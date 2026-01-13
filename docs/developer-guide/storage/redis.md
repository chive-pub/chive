# Redis storage

Redis provides caching, rate limiting, session management, and job queues for Chive.

## Key namespaces

All Redis keys follow a namespace pattern:

| Prefix            | Purpose                    | TTL             |
| ----------------- | -------------------------- | --------------- |
| `session:`        | User sessions              | 7 days          |
| `user_sessions:`  | User's active session list | 7 days          |
| `ratelimit:`      | Rate limit counters        | 1 minute        |
| `cache:eprint:`   | Eprint cache               | 5 minutes       |
| `cache:search:`   | Search result cache        | 5 minutes       |
| `cache:user:`     | User profile cache         | 10 minutes      |
| `blob:`           | Blob cache (L1)            | 1 hour          |
| `firehose:cursor` | Firehose cursor backup     | Persistent      |
| `queue:`          | BullMQ job queues          | Until processed |
| `metrics:`        | Metrics counters           | 24 hours        |

## Data structures

### Strings (simple values)

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Session data
await redis.set('session:abc123', JSON.stringify(sessionData), 'EX', 604800);

// Firehose cursor (persistent)
await redis.set('firehose:cursor', cursor.toString());
```

### Hashes (object storage)

```typescript
// User profile cache
await redis.hset('cache:user:did:plc:abc', {
  name: 'Alice',
  bio: 'Researcher',
  orcid: '0000-0001-2345-6789',
});
await redis.expire('cache:user:did:plc:abc', 600);

// Get specific field
const name = await redis.hget('cache:user:did:plc:abc', 'name');

// Get all fields
const profile = await redis.hgetall('cache:user:did:plc:abc');
```

### Sets (unique collections)

```typescript
// User's active sessions
await redis.sadd('user_sessions:did:plc:abc', 'session:abc123', 'session:def456');

// Check if session exists
const isActive = await redis.sismember('user_sessions:did:plc:abc', 'session:abc123');

// Remove session on logout
await redis.srem('user_sessions:did:plc:abc', 'session:abc123');

// Get all sessions
const sessions = await redis.smembers('user_sessions:did:plc:abc');
```

### Sorted sets (ranked data)

```typescript
// Trending eprints (score = view count)
await redis.zadd('metrics:trending:24h', viewCount, eprintUri);

// Get top 10
const trending = await redis.zrevrange('metrics:trending:24h', 0, 9, 'WITHSCORES');

// Increment score
await redis.zincrby('metrics:trending:24h', 1, eprintUri);

// Remove old entries
const dayAgo = Date.now() - 86400000;
await redis.zremrangebyscore('metrics:trending:24h', '-inf', dayAgo);
```

### HyperLogLog (unique counts)

```typescript
// Unique viewers (probabilistic)
await redis.pfadd('metrics:unique:' + eprintUri, viewerDid);

// Get approximate count
const uniqueViews = await redis.pfcount('metrics:unique:' + eprintUri);

// Merge multiple HLLs
await redis.pfmerge('metrics:unique:total', 'metrics:unique:uri1', 'metrics:unique:uri2');
```

## Rate limiting

### Sliding window rate limiter

```typescript
import { RateLimiter } from '@/storage/redis/structures.js';

const limiter = new RateLimiter(redis, {
  keyPrefix: 'ratelimit:',
  windowMs: 60000, // 1 minute
});

// Check rate limit
const result = await limiter.check('api:did:plc:abc', {
  limit: 100,
  cost: 1,
});

if (result.allowed) {
  // Process request
} else {
  // Return 429 with retry-after header
  const retryAfter = Math.ceil(result.resetAt - Date.now()) / 1000;
}
```

### Rate limit tiers

| Tier            | Requests/minute | Use case         |
| --------------- | --------------- | ---------------- |
| `anonymous`     | 30              | Unauthenticated  |
| `authenticated` | 100             | Logged-in users  |
| `trusted`       | 500             | Trusted editors  |
| `service`       | 1000            | Service accounts |

## Caching patterns

### Cache-aside pattern

```typescript
async function getEprint(uri: string): Promise<Eprint | null> {
  // Check cache
  const cached = await redis.get('cache:eprint:' + uri);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const eprint = await db.findEprintByUri(uri);
  if (eprint) {
    await redis.set('cache:eprint:' + uri, JSON.stringify(eprint), 'EX', 300);
  }

  return eprint;
}
```

### Probabilistic early expiration (XFetch)

Prevent cache stampedes by refreshing before expiration:

```typescript
import { XFetchCache } from '@/storage/redis/structures.js';

const cache = new XFetchCache(redis, {
  beta: 1.0, // Expiration randomness factor
  keyPrefix: 'cache:',
});

const result = await cache.get('eprint:' + uri);
if (result.shouldRefresh) {
  // Background refresh before TTL expires
  refreshInBackground(uri);
}
return result.value;
```

### Cache invalidation

```typescript
// Invalidate single key
await redis.del('cache:eprint:' + uri);

// Invalidate by pattern
const keys = await redis.keys('cache:eprint:*');
if (keys.length > 0) {
  await redis.del(...keys);
}

// Invalidate with pipeline
const pipeline = redis.pipeline();
for (const uri of invalidatedUris) {
  pipeline.del('cache:eprint:' + uri);
}
await pipeline.exec();
```

## Session management

```typescript
import { SessionStore } from '@/storage/redis/structures.js';

const sessions = new SessionStore(redis, {
  keyPrefix: 'session:',
  userSessionsPrefix: 'user_sessions:',
  ttl: 604800, // 7 days
});

// Create session
const sessionId = await sessions.create(userDid, {
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  createdAt: Date.now(),
});

// Get session
const session = await sessions.get(sessionId);

// Extend session
await sessions.touch(sessionId);

// Revoke session
await sessions.revoke(sessionId);

// Revoke all user sessions
await sessions.revokeAll(userDid);
```

## Job queues

BullMQ for background job processing:

```typescript
import { Queue, Worker } from 'bullmq';

const indexingQueue = new Queue('indexing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

// Add job
await indexingQueue.add('index-eprint', {
  uri: eprintUri,
  event: firehoseEvent,
});

// Process jobs
const worker = new Worker(
  'indexing',
  async (job) => {
    await indexEprint(job.data.uri, job.data.event);
  },
  { connection: redis }
);
```

### Queue types

| Queue           | Purpose                   | Concurrency |
| --------------- | ------------------------- | ----------- |
| `indexing`      | Firehose event processing | 10          |
| `enrichment`    | External API enrichment   | 5           |
| `notifications` | Email/push notifications  | 3           |
| `cleanup`       | Data cleanup tasks        | 1           |

## Pub/Sub

Real-time event broadcasting:

```typescript
// Publisher
await redis.publish(
  'eprint:indexed',
  JSON.stringify({
    uri: eprintUri,
    action: 'create',
  })
);

// Subscriber
const subscriber = redis.duplicate();
await subscriber.subscribe('eprint:indexed');

subscriber.on('message', (channel, message) => {
  const event = JSON.parse(message);
  // Handle event
});
```

## Metrics storage

```typescript
import { MetricsStore } from '@/storage/redis/structures.js';

const metrics = new MetricsStore(redis, {
  keyPrefix: 'metrics:',
});

// Increment counter
await metrics.increment('views:' + eprintUri);

// Record in time window
await metrics.recordInWindow('views:24h:' + eprintUri, 86400);

// Get count
const count = await metrics.get('views:' + eprintUri);

// Get time-windowed count
const last24h = await metrics.getWindowCount('views:24h:' + eprintUri);
```

## Configuration

Environment variables:

| Variable         | Default     | Description         |
| ---------------- | ----------- | ------------------- |
| `REDIS_HOST`     | `localhost` | Redis host          |
| `REDIS_PORT`     | `6379`      | Redis port          |
| `REDIS_PASSWORD` | None        | Password (optional) |
| `REDIS_DB`       | `0`         | Database number     |
| `REDIS_TLS`      | `false`     | Enable TLS          |

### Connection options

```typescript
import { Redis } from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});
```

## Persistence

Redis persistence settings for production:

```conf
# RDB snapshots
save 900 1      # Save if 1 key changed in 15 min
save 300 10     # Save if 10 keys changed in 5 min
save 60 10000   # Save if 10000 keys changed in 1 min

# AOF for durability
appendonly yes
appendfsync everysec
```

Note: Redis data is not critical. All data can be rebuilt from PostgreSQL or regenerated.

## Testing

```bash
# Redis integration tests
pnpm test tests/integration/storage/redis-cache.test.ts

# Rate limiter tests
pnpm test tests/unit/storage/redis/rate-limiter.test.ts
```

## Monitoring

### Memory usage

```bash
redis-cli INFO memory
```

### Key statistics

```bash
redis-cli INFO keyspace
```

### Slow log

```bash
redis-cli SLOWLOG GET 10
```

## Related documentation

- [Core Services](../core-business-services.md): Service layer caching
- [BlobProxyService](../core-business-services.md#blobproxyservice): L1 blob cache
- [MetricsService](../core-business-services.md#metricsservice): Metrics storage
