# Advanced features

This guide covers Chive's performance and real-time features: multi-layer caching, blob proxying, notifications, governance connector, and metrics.

## Multi-layer caching

Chive uses a 3-tier cache to minimize latency and reduce PDS load.

### Cache hierarchy

| Layer | Technology    | TTL      | Hit Rate | Use Case                       |
| ----- | ------------- | -------- | -------- | ------------------------------ |
| L1    | Redis         | 1 hour   | ~45%     | Hot blobs, frequently accessed |
| L2    | Cloudflare R2 | 24 hours | ~85%     | Warm blobs, CDN-served         |
| L3    | User PDS      | N/A      | Source   | Source of truth                |

### Configuration

Set these environment variables:

```bash
# L1 Redis cache
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL_SECONDS=3600
REDIS_MAX_BLOB_SIZE_MB=100

# L2 CDN cache (Cloudflare R2)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=chive-blobs
R2_CACHE_TTL_SECONDS=86400
```

### Probabilistic early expiration

The cache uses probabilistic early expiration (Vattani et al., 2015) to prevent cache stampedes. When a request arrives for a key nearing expiration, the cache may proactively refresh it before TTL expires.

```typescript
// Cache fetch with early expiration
const blob = await redisCache.get(uri, cid, {
  beta: 1.0, // Expiration probability factor
});
```

### Cache invalidation

Invalidate cache when records change:

```typescript
// Via firehose consumer
firehose.on('delete', async (event) => {
  await blobProxy.invalidateCache(event.uri);
});
```

## Blob proxy service

The blob proxy fetches PDFs and images from user PDSes, caching them locally.

### Request flow

```
Client → Chive AppView → L1 Redis → L2 R2 → User PDS
                           ↓ miss      ↓ miss    ↓ fetch
                           cache       cache     blob
```

### Usage

```typescript
import { BlobProxyService } from '@chive/services/blob-proxy';

const proxy = new BlobProxyService({
  redis,
  cdn: r2Adapter,
  repository,
  logger,
});

// Proxy a blob
const response = await proxy.proxyBlob(uri, cid);
// Returns Response with blob stream
```

### Request coalescing

The proxy coalesces duplicate concurrent requests to prevent thundering herd:

```typescript
// Multiple concurrent requests for same blob
// Only ONE PDS fetch, all requests share result
const results = await Promise.all([
  proxy.proxyBlob(uri, cid),
  proxy.proxyBlob(uri, cid),
  proxy.proxyBlob(uri, cid),
]);
```

### CID verification

All blobs are verified against their CID to ensure integrity:

```typescript
// Automatic verification
const blob = await proxy.proxyBlob(uri, cid);
// Throws if CID doesn't match content hash
```

## Real-time notifications

Chive supports push notifications via WebSocket and Server-Sent Events (SSE).

### Notification types

| Type                | Description              | Example                            |
| ------------------- | ------------------------ | ---------------------------------- |
| `new-review`        | Eprint received a review | "Alice reviewed your eprint"       |
| `new-endorsement`   | Eprint endorsed          | "Bob endorsed your methodology"    |
| `proposal-approved` | Field proposal approved  | "Your field proposal was approved" |
| `proposal-rejected` | Field proposal rejected  | "Your field proposal was rejected" |
| `new-version`       | Eprint updated           | "New version of eprint available"  |
| `mention`           | Mentioned in a comment   | "Carol mentioned you in a comment" |
| `citation`          | Eprint cited             | "Your eprint was cited"            |
| `system`            | System notification      | "Maintenance scheduled"            |

### Creating notifications

```typescript
import { NotificationService } from '@chive/services/notification';

const notifications = new NotificationService({ logger, redis });

// Create notification
const result = await notifications.createNotification({
  type: 'new-review',
  recipient: 'did:plc:author123' as DID,
  subject: 'New review on your eprint',
  message: 'Alice reviewed "Quantum Computing Advances"',
  resourceUri: 'at://did:plc:author123/pub.chive.eprint.submission/xyz' as AtUri,
  actorDid: 'did:plc:reviewer456' as DID,
});

if (result.ok) {
  console.log('Notification created:', result.value.id);
}
```

### Fetching notifications

```typescript
// Get user's notifications
const notifications = await service.getNotifications(userDid, {
  limit: 20,
  unreadOnly: true,
});

// Get unread count
const unreadCount = await service.getUnreadCount(userDid);
```

### Marking as read

```typescript
// Mark single notification
await service.markAsRead(notificationId, userDid);

// Mark all as read
const result = await service.markAllAsRead(userDid);
if (result.ok) {
  console.log(`Marked ${result.value} notifications as read`);
}
```

### WebSocket connection

```typescript
import { WebSocketHandler } from '@chive/services/notification/websocket-handler';

const wsHandler = new WebSocketHandler({
  notificationService: notifications,
  logger,
});

// Hono route
app.get('/ws/notifications', async (c) => {
  const did = c.get('did'); // From auth middleware
  return wsHandler.handleUpgrade(c.req.raw, did);
});
```

Client-side:

```javascript
const ws = new WebSocket('wss://api.chive.pub/ws/notifications');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'notification') {
    console.log('New notification:', message.data);
  }
};

// Mark notification as read
ws.send(
  JSON.stringify({
    type: 'mark-read',
    id: 'notification-id',
  })
);
```

### SSE connection

```typescript
import { SSEHandler } from '@chive/services/notification/sse-handler';

const sseHandler = new SSEHandler({
  notificationService: notifications,
  logger,
});

// Hono route
app.get('/events/notifications', async (c) => {
  const did = c.get('did');
  return sseHandler.createStream(did);
});
```

Client-side:

```javascript
const events = new EventSource('/events/notifications', {
  withCredentials: true,
});

events.addEventListener('notification', (e) => {
  const notification = JSON.parse(e.data);
  console.log('New notification:', notification);
});

events.addEventListener('ping', () => {
  console.log('Connection alive');
});
```

## Governance PDS connector

Read community authority records from the Graph PDS (`did:plc:chive-governance`).

### Fetching authority records

```typescript
import { GovernancePDSConnector } from '@chive/services/governance';

const connector = new GovernancePDSConnector({
  graphPdsDid: 'did:plc:chive-governance' as DID,
  repository,
  identity,
  logger,
  cache: redis,
});

// Get single authority record
const record = await governance.getAuthorityRecord(uri);
if (record) {
  console.log('Authorized form:', record.authorizedForm);
  console.log('Variants:', record.variantForms.join(', '));
}
```

### Listing authority records

```typescript
// List established authority records
for await (const record of governance.listAuthorityRecords({
  status: 'established',
  limit: 100,
})) {
  console.log(record.authorizedForm);
}
```

### Fetching facets

```typescript
// List facets by dimension
for await (const facet of governance.listFacets('matter')) {
  console.log(`${facet.value}: ${facet.description}`);
}
```

### Subscribing to updates

```typescript
// Subscribe to governance record changes
const subscription = governance.subscribeToUpdates(async (event) => {
  console.log(`${event.type}: ${event.uri}`);

  if (event.type === 'authority-created') {
    // Re-index affected eprints
    await reindexEprints(event.uri);
  }
});

// Later, unsubscribe
subscription.unsubscribe();
```

## Metrics and analytics

Track eprint views, downloads, and trending.

### Recording metrics

```typescript
import { MetricsService } from '@chive/services/metrics';

const metrics = new MetricsService({ redis, storage, logger });

// Record view
await metrics.recordView(eprintUri, viewerDid);

// Record download
await metrics.recordDownload(eprintUri, viewerDid);
```

### Fetching metrics

```typescript
// Get eprint metrics
const stats = await metrics.getMetrics(eprintUri);
console.log('Total views:', stats.totalViews);
console.log('Unique views:', stats.uniqueViews);
console.log('Downloads:', stats.downloads);
console.log('Views (24h):', stats.views24h);
console.log('Views (7d):', stats.views7d);
console.log('Views (30d):', stats.views30d);
```

### Trending eprints

```typescript
// Get trending eprints
const trending = await metrics.getTrending('24h', 10);
for (const item of trending) {
  console.log(`${item.uri}: ${item.score} views`);
}
```

### Batch operations

```typescript
// Record multiple metrics
await metrics.batchIncrement([
  { uri: uri1, metric: 'views', count: 1 },
  { uri: uri2, metric: 'views', count: 1 },
  { uri: uri3, metric: 'downloads', count: 1 },
]);
```

## Configuration reference

### Environment variables

| Variable                   | Description                  | Default                    |
| -------------------------- | ---------------------------- | -------------------------- |
| `REDIS_URL`                | Redis connection string      | `redis://localhost:6379`   |
| `REDIS_CACHE_TTL_SECONDS`  | L1 cache TTL                 | `3600`                     |
| `REDIS_MAX_BLOB_SIZE_MB`   | Max blob size for L1 cache   | `100`                      |
| `R2_BUCKET_NAME`           | Cloudflare R2 bucket         | -                          |
| `R2_CACHE_TTL_SECONDS`     | L2 CDN cache TTL             | `86400`                    |
| `GRAPH_PDS_DID`            | Graph PDS DID                | `did:plc:chive-governance` |
| `NOTIFICATION_TTL_SECONDS` | Notification storage TTL     | `2592000`                  |
| `WS_PING_INTERVAL_MS`      | WebSocket keepalive interval | `30000`                    |
| `WS_CONNECTION_TIMEOUT_MS` | WebSocket inactivity timeout | `60000`                    |

### Cache TTL defaults

| Cache                  | Default TTL | Max Size        |
| ---------------------- | ----------- | --------------- |
| L1 Redis blob cache    | 1 hour      | 100 MB per blob |
| L2 CDN blob cache      | 24 hours    | 200 GB total    |
| Authority record cache | 1 hour      | N/A             |
| Notification storage   | 30 days     | 1000 per user   |

### Rate limits

| Endpoint              | Limit                |
| --------------------- | -------------------- |
| Blob proxy            | 100 req/min per user |
| Notifications fetch   | 60 req/min per user  |
| WebSocket connections | 5 per user           |
| SSE streams           | 5 per user           |

## Troubleshooting

### Cache miss rate too high

Check Redis connectivity and memory usage:

```bash
redis-cli INFO memory
redis-cli INFO stats | grep keyspace
```

### WebSocket disconnects

Enable debug logging:

```bash
DEBUG=chive:ws npm start
```

Check for proxy timeout settings if behind a load balancer.

### Notifications not delivered

1. Verify delivery handler is registered
2. Check WebSocket/SSE connection state
3. Verify Redis pub/sub is working

```typescript
// Debug: Log delivery attempts
service.registerDeliveryHandler(async (notification) => {
  console.log('Delivering:', notification.id, 'to:', notification.recipient);
});
```
