# Scaling

This guide covers horizontal and vertical scaling strategies for Chive.

## Scaling principles

### Stateless services

API, web, and worker services are stateless and can scale horizontally:

| Service | Scalable | Notes                                          |
| ------- | -------- | ---------------------------------------------- |
| API     | Yes      | Load-balanced, any replica handles any request |
| Web     | Yes      | Static assets via CDN, SSR scales horizontally |
| Worker  | Yes      | Jobs distributed via BullMQ                    |
| Indexer | Limited  | Single consumer for event ordering (see below) |

### Stateful services

Databases require different scaling strategies:

| Database      | Scaling approach                   |
| ------------- | ---------------------------------- |
| PostgreSQL    | Read replicas, connection pooling  |
| Elasticsearch | Add nodes, increase shards         |
| Neo4j         | Single instance or causal cluster  |
| Redis         | Sentinel for HA, Cluster for scale |

## Horizontal scaling

### API service

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: chive-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: chive-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Worker service

Scale workers based on queue depth:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: chive-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: chive-worker
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: External
      external:
        metric:
          name: bullmq_queue_depth
          selector:
            matchLabels:
              queue: indexing
        target:
          type: AverageValue
          averageValue: 100
```

### Indexer scaling

The indexer must remain a single instance to preserve event ordering. Scale by:

1. **Faster processing**: Optimize event handlers
2. **Parallel non-ordered work**: Offload to workers via queue
3. **Multiple firehose subscriptions**: Partition by collection (advanced)

## Vertical scaling

### Resource recommendations

| Service | CPU        | Memory | Notes                      |
| ------- | ---------- | ------ | -------------------------- |
| API     | 1-2 cores  | 1-2 GB | Scale horizontally first   |
| Indexer | 0.5-1 core | 512 MB | Memory for event buffering |
| Worker  | 0.5-1 core | 512 MB | CPU-bound for enrichment   |
| Web     | 0.5-1 core | 512 MB | Memory for SSR cache       |

### Database sizing

#### PostgreSQL

| Metric    | Small | Medium | Large |
| --------- | ----- | ------ | ----- |
| Eprints | 100K  | 1M     | 10M   |
| Storage   | 50 GB | 200 GB | 1 TB  |
| RAM       | 4 GB  | 16 GB  | 64 GB |
| CPUs      | 2     | 8      | 32    |

#### Elasticsearch

| Metric       | Small | Medium | Large  |
| ------------ | ----- | ------ | ------ |
| Documents    | 100K  | 1M     | 10M    |
| Storage      | 20 GB | 100 GB | 500 GB |
| Nodes        | 1     | 3      | 5+     |
| RAM per node | 4 GB  | 16 GB  | 32 GB  |

#### Neo4j

| Metric  | Small | Medium | Large  |
| ------- | ----- | ------ | ------ |
| Nodes   | 100K  | 1M     | 10M    |
| Storage | 10 GB | 50 GB  | 200 GB |
| RAM     | 4 GB  | 16 GB  | 64 GB  |

## Connection pooling

### PgBouncer

Use PgBouncer for PostgreSQL connection pooling:

```ini
# pgbouncer.ini
[databases]
chive = host=postgres port=5432 dbname=chive

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 50
min_pool_size = 10
```

### Application-level pooling

```typescript
// src/storage/postgresql/connection.ts
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  min: 5,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

## Caching strategies

### Multi-tier caching

```
Request → L1 (Memory) → L2 (Redis) → L3 (Database)
                ↓              ↓
            ~1ms           ~5ms        ~50ms
```

### Cache warming

Pre-populate caches on startup:

```typescript
async function warmCache(): Promise<void> {
  // Warm trending eprints
  const trending = await db.getTrendingEprints(100);
  await Promise.all(trending.map((p) => cache.set(`eprint:${p.uri}`, p, 600)));

  // Warm field taxonomy
  const fields = await neo4j.getAllFields();
  await cache.set('fields:all', fields, 3600);
}
```

### Cache invalidation

Event-driven invalidation via Redis Pub/Sub:

```typescript
// On eprint update
await redis.publish(
  'cache:invalidate',
  JSON.stringify({
    type: 'eprint',
    uri: eprintUri,
  })
);

// Subscriber
subscriber.on('message', (channel, message) => {
  const { type, uri } = JSON.parse(message);
  cache.del(`${type}:${uri}`);
});
```

## Load balancing

### Kubernetes Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: chive
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: '50m'
    nginx.ingress.kubernetes.io/proxy-read-timeout: '300'
spec:
  ingressClassName: nginx
  rules:
    - host: api.chive.pub
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: chive-api
                port:
                  number: 3000
```

### Session affinity

For WebSocket connections (notifications):

```yaml
annotations:
  nginx.ingress.kubernetes.io/affinity: 'cookie'
  nginx.ingress.kubernetes.io/session-cookie-name: 'chive-affinity'
  nginx.ingress.kubernetes.io/session-cookie-max-age: '3600'
```

## CDN configuration

### Static assets

Serve frontend assets via CDN:

```yaml
# Cloudflare page rules
- url: 'chive.pub/_next/static/*'
  cache_level: 'Cache Everything'
  edge_cache_ttl: 2592000 # 30 days

- url: 'chive.pub/api/*'
  cache_level: 'Bypass'
```

### Blob caching

PDF and image blobs:

```yaml
- url: 'blobs.chive.pub/*'
  cache_level: 'Cache Everything'
  edge_cache_ttl: 86400 # 24 hours
```

## Performance tuning

### Node.js options

```bash
# Increase memory for large datasets
NODE_OPTIONS="--max-old-space-size=4096"

# Enable clustering (handled by K8s, not needed)
# PM2_INSTANCES=4
```

### Database tuning

#### PostgreSQL

```sql
-- Increase shared buffers
ALTER SYSTEM SET shared_buffers = '4GB';

-- Increase work memory for complex queries
ALTER SYSTEM SET work_mem = '256MB';

-- Increase max connections
ALTER SYSTEM SET max_connections = 200;
```

#### Elasticsearch

```yaml
# elasticsearch.yml
indices.memory.index_buffer_size: 30%
thread_pool.write.queue_size: 1000
```

## Capacity planning

### Request rate estimates

| Scenario | RPS  | API replicas |
| -------- | ---- | ------------ |
| Low      | 100  | 2            |
| Medium   | 500  | 5            |
| High     | 2000 | 15           |
| Peak     | 5000 | 30           |

### Storage growth

| Metric     | Growth rate |
| ---------- | ----------- |
| Eprints  | ~1000/day   |
| Reviews    | ~500/day    |
| Blob cache | ~10 GB/day  |
| Logs       | ~5 GB/day   |

## Related documentation

- [Deployment](./deployment.md): Production setup
- [Monitoring](./monitoring.md): Observability
- [Troubleshooting](./troubleshooting.md): Common issues
