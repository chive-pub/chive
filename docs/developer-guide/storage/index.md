# Storage layer

Chive uses multiple specialized databases, each optimized for different access patterns:

| Database      | Purpose                                           | Documentation                       |
| ------------- | ------------------------------------------------- | ----------------------------------- |
| PostgreSQL    | Primary data store for eprints, reviews, profiles | [PostgreSQL](./postgresql.md)       |
| Elasticsearch | Full-text search, faceted navigation              | [Elasticsearch](./elasticsearch.md) |
| Neo4j         | Knowledge graph, citations, field hierarchy       | [Neo4j](./neo4j.md)                 |
| Redis         | Caching, rate limiting, sessions                  | [Redis](./redis.md)                 |

## Architecture

All storage adapters implement consistent interfaces for dependency injection:

```typescript
interface IStorageBackend {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
}
```

## Data flow

1. **Write path**: Firehose events → Services → PostgreSQL → Async sync to ES/Neo4j
2. **Read path**: API → Services → PostgreSQL/ES/Neo4j (based on query type)
3. **Cache**: Redis sits in front of expensive queries

## See also

- [Core services](../core-business-services.md) - How services use storage adapters
- [Observability](../observability-monitoring.md) - Database monitoring and metrics
