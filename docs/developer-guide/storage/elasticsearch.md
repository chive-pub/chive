# Elasticsearch storage

Elasticsearch provides full-text search and faceted filtering for Chive. Like all Chive databases, it stores indexes only.

## Index architecture

### Index naming

Eprint indexes use time-based naming with aliases:

```
eprints-000001  ← Current write index
eprints-000002  ← Rolled over index
eprints         ← Write alias (points to current)
eprints-read    ← Read alias (points to all)
```

### Index template

The `eprints` template applies to all `eprints-*` indexes:

```json
{
  "index_patterns": ["eprints-*"],
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 2,
      "analysis": {
        "analyzer": {
          "eprint_analyzer": {
            "type": "custom",
            "tokenizer": "standard",
            "filter": ["lowercase", "porter_stem", "asciifolding"]
          }
        }
      }
    },
    "mappings": {
      "properties": {
        "uri": { "type": "keyword" },
        "title": {
          "type": "text",
          "analyzer": "eprint_analyzer",
          "fields": {
            "keyword": { "type": "keyword" },
            "suggest": { "type": "completion" }
          }
        },
        "abstract": { "type": "text", "analyzer": "eprint_analyzer" },
        "keywords": { "type": "keyword" },
        "author_did": { "type": "keyword" },
        "author_name": { "type": "text" },
        "fields": { "type": "keyword" },
        "created_at": { "type": "date" },
        "indexed_at": { "type": "date" }
      }
    }
  }
}
```

## Index lifecycle management

### ILM policy

Indexes rotate through hot/warm/cold tiers:

| Phase | Duration   | Actions                                   |
| ----- | ---------- | ----------------------------------------- |
| Hot   | 0-30 days  | Rollover at 50GB or 30 days               |
| Warm  | 30-90 days | Force merge to 1 segment, reduce replicas |
| Cold  | 90+ days   | Move to cold storage, reduce priority     |

```json
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_size": "50gb",
            "max_age": "30d"
          }
        }
      },
      "warm": {
        "min_age": "30d",
        "actions": {
          "forcemerge": { "max_num_segments": 1 },
          "allocate": { "number_of_replicas": 1 }
        }
      },
      "cold": {
        "min_age": "90d",
        "actions": {
          "allocate": { "number_of_replicas": 0 }
        }
      }
    }
  }
}
```

## Adapter usage

### Indexing documents

```typescript
import { ElasticsearchAdapter } from '@/storage/elasticsearch/adapter.js';

const adapter = new ElasticsearchAdapter(client, logger);

// Index an eprint
await adapter.indexEprint({
  uri: 'at://did:plc:abc/pub.chive.eprint.submission/xyz',
  title: 'Attention Is All You Need',
  abstract: 'We propose a new simple network architecture...',
  keywords: ['transformers', 'attention', 'neural networks'],
  authorDid: 'did:plc:abc',
  authorName: 'Vaswani et al.',
  fields: ['cs.AI', 'cs.CL'],
  createdAt: new Date('2017-06-12'),
});

// Bulk index
await adapter.bulkIndex(eprints, { chunkSize: 500 });

// Delete
await adapter.delete(uri);
```

### Searching

```typescript
// Full-text search
const results = await adapter.search({
  query: 'attention mechanisms transformer',
  fields: ['title^2', 'abstract'],
  limit: 20,
  offset: 0,
});

// With filters
const filtered = await adapter.search({
  query: 'machine learning',
  filters: {
    fields: ['cs.AI', 'cs.LG'],
    dateRange: { from: '2024-01-01' },
    authors: ['did:plc:author1'],
  },
  sort: [{ created_at: 'desc' }],
});
```

## Search query builder

The `SearchQueryBuilder` constructs Elasticsearch queries:

```typescript
import { SearchQueryBuilder } from '@/storage/elasticsearch/search-query-builder.js';

const builder = new SearchQueryBuilder()
  .query('neural networks')
  .fields(['title^3', 'abstract^1', 'keywords^2'])
  .filter('fields', ['cs.AI'])
  .filter('dateRange', { from: '2024-01-01', to: '2024-12-31' })
  .highlight(['title', 'abstract'])
  .sort('created_at', 'desc')
  .paginate(20, 0);

const esQuery = builder.build();
```

### Query types

| Method                  | Elasticsearch Query                |
| ----------------------- | ---------------------------------- |
| `.query(text)`          | `multi_match` with cross_fields    |
| `.phrase(text)`         | `match_phrase` for exact sequences |
| `.prefix(text)`         | `prefix` for autocomplete          |
| `.filter(field, value)` | `term` in filter context           |
| `.range(field, opts)`   | `range` query                      |

## Faceted search

### Aggregations

```typescript
import { AggregationsBuilder } from '@/storage/elasticsearch/aggregations-builder.js';

const aggs = new AggregationsBuilder()
  .terms('fields', { size: 20 })
  .terms('keywords', { size: 50 })
  .dateHistogram('created_at', { interval: 'month' })
  .build();

const result = await adapter.searchWithAggregations({
  query: 'machine learning',
  aggregations: aggs,
});

// Access facet counts
for (const bucket of result.aggregations.fields.buckets) {
  console.log(`${bucket.key}: ${bucket.doc_count}`);
}
```

### PMEST facets

Chive uses PMEST classification for faceted navigation:

| Dimension   | Examples                               |
| ----------- | -------------------------------------- |
| Personality | Author, institution, funder            |
| Matter      | Subject field, methodology             |
| Energy      | Research type (theoretical, empirical) |
| Space       | Geographic focus, language             |
| Time        | Publication date, era studied          |

## Autocomplete

```typescript
import { AutocompleteService } from '@/storage/elasticsearch/autocomplete-service.js';

const autocomplete = new AutocompleteService(client, logger);

// Title suggestions
const suggestions = await autocomplete.suggest('atten', {
  field: 'title.suggest',
  size: 8,
});

// Keyword suggestions
const keywords = await autocomplete.suggestKeywords('mach', { size: 10 });

// Author suggestions
const authors = await autocomplete.suggestAuthors('vas', { size: 5 });
```

## Query caching

```typescript
import { QueryCache } from '@/storage/elasticsearch/query-cache.js';

const cache = new QueryCache(redis, {
  ttl: 300, // 5 minutes
  keyPrefix: 'es:cache:',
});

// Cached search
const results = await cache.getOrFetch({ query: 'neural networks', limit: 20 }, () =>
  adapter.search({ query: 'neural networks', limit: 20 })
);
```

## Index management

```typescript
import { IndexManager } from '@/storage/elasticsearch/index-manager.js';

const manager = new IndexManager(client, logger);

// Create index with template
await manager.createIndex('eprints-000001');

// Apply template updates
await manager.updateTemplate('eprints', templateDefinition);

// Reindex (e.g., after mapping changes)
await manager.reindex('eprints-000001', 'eprints-000002');

// Force merge for read optimization
await manager.forceMerge('eprints-000001', { maxSegments: 1 });
```

## Pipelines

### Ingest pipeline

Pre-process documents before indexing:

```json
{
  "description": "Eprint ingest pipeline",
  "processors": [
    {
      "set": {
        "field": "indexed_at",
        "value": "{{_ingest.timestamp}}"
      }
    },
    {
      "lowercase": {
        "field": "keywords"
      }
    }
  ]
}
```

### Usage

```typescript
await adapter.indexEprint(doc, { pipeline: 'eprint-ingest' });
```

## Configuration

Environment variables:

| Variable                     | Default                 | Description         |
| ---------------------------- | ----------------------- | ------------------- |
| `ELASTICSEARCH_URL`          | `http://localhost:9200` | Cluster URL         |
| `ELASTICSEARCH_USER`         | None                    | Username (optional) |
| `ELASTICSEARCH_PASSWORD`     | None                    | Password (optional) |
| `ELASTICSEARCH_INDEX_PREFIX` | `chive`                 | Index name prefix   |
| `ELASTICSEARCH_SHARDS`       | `3`                     | Number of shards    |
| `ELASTICSEARCH_REPLICAS`     | `2`                     | Number of replicas  |

## Setup

```bash
# Apply templates and create initial index
tsx scripts/db/setup-elasticsearch.ts

# Or via npm script
pnpm db:setup:elasticsearch
```

## Monitoring

### Cluster health

```bash
curl http://localhost:9200/_cluster/health?pretty
```

### Index stats

```bash
curl http://localhost:9200/eprints/_stats?pretty
```

### Slow queries

Enable slow query logging:

```json
{
  "index.search.slowlog.threshold.query.warn": "10s",
  "index.search.slowlog.threshold.query.info": "5s"
}
```

## Rebuilding

If search indexes need rebuilding:

```bash
# 1. Create new index
tsx scripts/db/create-index.ts eprints-new

# 2. Reindex from PostgreSQL
tsx scripts/db/reindex-from-pg.ts --target eprints-new

# 3. Switch alias
tsx scripts/db/switch-alias.ts eprints eprints-new

# 4. Delete old index
curl -X DELETE http://localhost:9200/eprints-old
```

## Testing

```bash
# Integration tests
pnpm test tests/integration/storage/elasticsearch-search.test.ts

# Search relevance tests
pnpm test tests/integration/storage/elasticsearch-relevance.test.ts
```

## Related documentation

- [PostgreSQL Storage](./postgresql.md): Primary index storage
- [SearchService](../core-business-services.md#searchservice): Search service layer
- [API Layer](../api-layer.md): Search endpoints
