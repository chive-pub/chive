# Troubleshooting

Common issues and their solutions when operating Chive.

## Quick diagnostics

### Health check

```bash
# API health
curl -s https://api.chive.pub/health | jq

# Detailed health
curl -s https://api.chive.pub/health/ready | jq
```

### Service status

```bash
# Kubernetes pods
kubectl get pods -n chive

# Docker containers
docker compose ps
```

## API issues

### 5xx errors

**Symptoms**: API returning 500 errors, high error rate in metrics.

**Diagnosis**:

```bash
# Check API logs
kubectl logs -f deploy/chive-api -n chive | grep -i error

# Check error rate
curl -s localhost:9090/metrics | grep http_requests_total | grep status=\"5
```

**Common causes**:

| Cause                         | Solution                                |
| ----------------------------- | --------------------------------------- |
| Database connection exhausted | Increase pool size, add PgBouncer       |
| Memory exhaustion             | Increase memory limits, check for leaks |
| External API failures         | Check circuit breaker status            |

### Slow responses

**Symptoms**: P95 latency above 500ms.

**Diagnosis**:

```bash
# Check slow query log
kubectl logs deploy/chive-api -n chive | grep "slow query"

# Check database connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

**Solutions**:

1. Add missing database indexes
2. Enable query caching
3. Scale API replicas horizontally

### Rate limiting issues

**Symptoms**: Users receiving 429 errors.

**Diagnosis**:

```bash
# Check rate limit counters
redis-cli KEYS "ratelimit:*" | head -20

# Check specific user
redis-cli GET "ratelimit:api:did:plc:example"
```

**Solutions**:

- Increase rate limits for authenticated users
- Add user to higher tier
- Check for misbehaving clients

## Firehose issues

### Processing lag

**Symptoms**: `firehose_lag_seconds` metric increasing.

**Diagnosis**:

```bash
# Check indexer logs
kubectl logs deploy/chive-indexer -n chive

# Check cursor position
redis-cli GET firehose:cursor
```

**Solutions**:

| Cause               | Solution                       |
| ------------------- | ------------------------------ |
| Slow event handlers | Optimize or offload to workers |
| Database bottleneck | Scale database, add indexes    |
| Network issues      | Check relay connectivity       |

### Connection drops

**Symptoms**: Frequent reconnects in indexer logs.

**Diagnosis**:

```bash
# Check connection errors
kubectl logs deploy/chive-indexer -n chive | grep -i "disconnect\|reconnect"
```

**Solutions**:

1. Check network connectivity to relay
2. Increase connection timeout
3. Verify relay URL is correct

### Dead letter queue growth

**Symptoms**: Events accumulating in DLQ.

**Diagnosis**:

```sql
SELECT error, count(*)
FROM firehose_dlq
GROUP BY error
ORDER BY count(*) DESC;
```

**Solutions**:

1. Fix the error causing failures
2. Retry DLQ events: `pnpm dlq:retry`
3. Clear stale events: `pnpm dlq:clear --older-than 7d`

## Database issues

### PostgreSQL

#### Connection exhaustion

**Symptoms**: "too many connections" errors.

```sql
-- Check active connections
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;

-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < NOW() - INTERVAL '10 minutes';
```

#### Slow queries

```sql
-- Find slow queries
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'eprints_index';
```

#### Lock contention

```sql
-- Find blocked queries
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.query AS blocked_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype;
```

### Elasticsearch

#### Cluster health

```bash
# Check cluster status
curl -s localhost:9200/_cluster/health?pretty

# Check shard allocation
curl -s localhost:9200/_cat/shards?v
```

#### Unassigned shards

```bash
# Find unassigned shards
curl -s localhost:9200/_cat/shards | grep UNASSIGNED

# Explain allocation
curl -s localhost:9200/_cluster/allocation/explain?pretty
```

**Solutions**:

1. Check disk space
2. Increase `cluster.routing.allocation.disk.threshold`
3. Add more nodes

#### Index corruption

```bash
# Rebuild index from PostgreSQL
tsx scripts/db/reindex-from-pg.ts --target eprints-new

# Switch alias
curl -X POST "localhost:9200/_aliases" -H 'Content-Type: application/json' -d'
{
  "actions": [
    { "remove": { "index": "eprints-old", "alias": "eprints" }},
    { "add": { "index": "eprints-new", "alias": "eprints" }}
  ]
}'
```

### Neo4j

#### Memory issues

```cypher
-- Check memory usage
CALL dbms.queryJmx("org.neo4j:name=Page cache")
YIELD name, attributes
RETURN attributes.Faults.value AS faults,
       attributes.Evictions.value AS evictions;
```

**Solution**: Increase `dbms.memory.pagecache.size`.

#### Slow queries

```cypher
-- Profile query
PROFILE MATCH (f:Field)-[:PARENT_OF*]->(child)
WHERE f.id = 'cs'
RETURN child;
```

### Redis

#### Memory pressure

```bash
# Check memory usage
redis-cli INFO memory

# Find big keys
redis-cli --bigkeys
```

**Solutions**:

1. Increase `maxmemory`
2. Set appropriate `maxmemory-policy` (default: `volatile-lru`)
3. Reduce TTLs on cached data

#### Connection issues

```bash
# Check client list
redis-cli CLIENT LIST

# Check connection count
redis-cli INFO clients
```

## Worker issues

### Job failures

**Diagnosis**:

```bash
# Check failed jobs
redis-cli LRANGE bull:indexing:failed 0 10
```

**Solutions**:

1. Check worker logs for specific errors
2. Retry failed jobs: `pnpm queue:retry indexing`
3. Clear stale jobs: `pnpm queue:clean indexing`

### Queue backup

**Symptoms**: Jobs accumulating faster than processed.

```bash
# Check queue depth
redis-cli LLEN bull:indexing:wait
```

**Solutions**:

1. Scale worker replicas
2. Increase concurrency setting
3. Optimize job processing

## Frontend issues

### Build failures

```bash
# Clear cache and rebuild
rm -rf .next
pnpm build
```

### Hydration errors

Check for:

1. Server/client content mismatch
2. Date/time rendering differences
3. Browser extension interference

## Recovery procedures

### Full index rebuild

If all indexes are corrupted:

```bash
# 1. Stop indexer
kubectl scale deploy/chive-indexer --replicas=0 -n chive

# 2. Truncate PostgreSQL indexes
psql -c "TRUNCATE eprints_index, reviews_index, endorsements_index CASCADE;"

# 3. Reset firehose cursor
psql -c "UPDATE firehose_cursor SET cursor = 0;"

# 4. Clear Elasticsearch
curl -X DELETE "localhost:9200/eprints-*"
tsx scripts/db/setup-elasticsearch.ts

# 5. Clear Neo4j graph data (keep schema)
cypher-shell "MATCH (n) DETACH DELETE n;"

# 6. Restart indexer
kubectl scale deploy/chive-indexer --replicas=1 -n chive

# 7. Monitor rebuild progress
watch 'redis-cli GET firehose:cursor'
```

### Database restore

```bash
# PostgreSQL
pg_restore -d chive backup.dump

# Elasticsearch
curl -X POST "localhost:9200/_snapshot/backup/snapshot_1/_restore"

# Neo4j
neo4j-admin restore --from=/backup/neo4j --database=neo4j
```

## Getting help

### Logs to collect

When reporting issues, include:

1. Service logs (last 100 lines)
2. Metrics snapshot
3. Database query stats
4. Error traces

### Support channels

- GitHub Issues: https://github.com/chive-pub/chive/issues
- Discussions: https://github.com/chive-pub/chive/discussions

## Related documentation

- [Deployment](./deployment.md): Setup reference
- [Monitoring](./monitoring.md): Observability tools
- [Scaling](./scaling.md): Performance tuning
