# Neo4j storage

Neo4j stores Chive's knowledge graph: field taxonomy, authority records, citations, and collaboration networks.

## Graph schema

### Node types

| Label             | Description                      | Key Properties                  |
| ----------------- | -------------------------------- | ------------------------------- |
| `Field`           | Hierarchical field taxonomy      | `id`, `label`, `description`    |
| `AuthorityRecord` | Controlled vocabulary terms      | `id`, `name`, `type`, `aliases` |
| `WikidataEntity`  | Wikidata Q-IDs for linking       | `qid`, `label`, `description`   |
| `Preprint`        | Preprint nodes for graph queries | `uri`, `title`                  |
| `Author`          | Author nodes for collaboration   | `did`, `name`                   |
| `FacetDimension`  | PMEST dimension templates        | `id`, `type`, `name`            |

### Relationship types

| Type                | From            | To             | Description          |
| ------------------- | --------------- | -------------- | -------------------- |
| `PARENT_OF`         | Field           | Field          | Hierarchy            |
| `RELATED_TO`        | Field           | Field          | Semantic similarity  |
| `MAPPED_TO`         | AuthorityRecord | WikidataEntity | External linking     |
| `TAGGED_WITH`       | Preprint        | Field          | Field classification |
| `AUTHORED`          | Author          | Preprint       | Authorship           |
| `CITES`             | Preprint        | Preprint       | Citations            |
| `COLLABORATES_WITH` | Author          | Author         | Co-authorship        |

## Constraints and indexes

### Uniqueness constraints

```cypher
CREATE CONSTRAINT field_id_unique
FOR (f:Field) REQUIRE f.id IS UNIQUE;

CREATE CONSTRAINT authority_id_unique
FOR (a:AuthorityRecord) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT wikidata_qid_unique
FOR (w:WikidataEntity) REQUIRE w.qid IS UNIQUE;

CREATE CONSTRAINT preprint_uri_unique
FOR (p:Preprint) REQUIRE p.uri IS UNIQUE;

CREATE CONSTRAINT author_did_unique
FOR (a:Author) REQUIRE a.did IS UNIQUE;
```

### Performance indexes

```cypher
-- Field search
CREATE INDEX field_label_idx FOR (f:Field) ON (f.label);
CREATE TEXT INDEX field_label_text FOR (f:Field) ON (f.label);

-- Authority search
CREATE INDEX authority_name_idx FOR (a:AuthorityRecord) ON (a.name);
CREATE INDEX authority_type_idx FOR (a:AuthorityRecord) ON (a.type);

-- Preprint lookup
CREATE INDEX preprint_created_idx FOR (p:Preprint) ON (p.createdAt);
```

## Adapter usage

### Connection

```typescript
import { Neo4jAdapter } from '@/storage/neo4j/adapter.js';
import { createNeo4jConnection } from '@/storage/neo4j/connection.js';

const driver = await createNeo4jConnection({
  uri: process.env.NEO4J_URI,
  user: process.env.NEO4J_USER,
  password: process.env.NEO4J_PASSWORD,
});

const adapter = new Neo4jAdapter(driver, logger);
```

### Field operations

```typescript
// Get field by ID
const field = await adapter.getField('cs.AI');

// Get children
const children = await adapter.getFieldChildren('cs');

// Get ancestors (path to root)
const ancestors = await adapter.getFieldAncestors('cs.AI.ML');

// Search fields
const matches = await adapter.searchFields('artificial intelligence', {
  limit: 10,
  includeAliases: true,
});

// Get related fields
const related = await adapter.getRelatedFields('cs.AI', {
  limit: 5,
  minScore: 0.5,
});
```

### Authority records

```typescript
import { AuthorityRepository } from '@/storage/neo4j/authority-repository.js';

const repo = new AuthorityRepository(driver, logger);

// Get by ID
const authority = await repo.findById('authority-123');

// Search
const results = await repo.search('machine learning', {
  type: 'concept',
  limit: 20,
});

// Get with external links
const withLinks = await repo.findWithExternalIds('authority-123');
console.log(withLinks.wikidataQid); // Q2539
```

## Citation graph

```typescript
import { CitationGraph } from '@/storage/neo4j/citation-graph.js';

const graph = new CitationGraph(driver, logger);

// Add citation
await graph.addCitation(citingUri, citedUri);

// Get citations for a preprint
const citations = await graph.getCitations(preprintUri, {
  direction: 'outgoing', // or 'incoming'
  limit: 50,
});

// Get citation count
const count = await graph.getCitationCount(preprintUri);

// Find co-citation clusters
const clusters = await graph.findCoCitationClusters(preprintUri, {
  minSharedCitations: 3,
});
```

## Graph algorithms

Neo4j Graph Data Science library powers advanced queries:

```typescript
import { GraphAlgorithms } from '@/storage/neo4j/graph-algorithms.js';

const algorithms = new GraphAlgorithms(driver, logger);

// PageRank for field importance
const ranked = await algorithms.fieldPageRank({
  dampingFactor: 0.85,
  maxIterations: 20,
});

// Louvain community detection
const communities = await algorithms.detectCommunities('Author', 'COLLABORATES_WITH');

// Shortest path between fields
const path = await algorithms.shortestPath('cs.AI', 'physics.comp-ph');

// Node similarity
const similar = await algorithms.nodeSimilarity('Preprint', 'TAGGED_WITH', {
  topK: 10,
});
```

## Wikidata integration

```typescript
import { WikidataConnector } from '@/storage/neo4j/wikidata-connector.js';

const wikidata = new WikidataConnector(driver, sparqlClient, logger);

// Reconcile authority record with Wikidata
const match = await wikidata.reconcile('machine learning', {
  type: 'concept',
  threshold: 0.8,
});

if (match) {
  console.log(`Matched to ${match.qid}: ${match.label}`);
}

// Sync Wikidata properties
await wikidata.syncProperties('Q2539', ['description', 'aliases', 'sitelinks']);

// Get Wikidata hierarchy
const hierarchy = await wikidata.getHierarchy('Q2539', {
  relationshipType: 'P279', // subclass of
  depth: 3,
});
```

## SPARQL queries

```typescript
import { SparqlClient } from '@/storage/neo4j/sparql-client.js';

const sparql = new SparqlClient('https://query.wikidata.org/sparql');

// Find related Wikidata entities
const results = await sparql.query(`
  SELECT ?item ?itemLabel WHERE {
    ?item wdt:P31 wd:Q11862829 .  # instance of academic discipline
    ?item wdt:P361 wd:Q21198 .    # part of computer science
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
  }
  LIMIT 100
`);
```

## Facet management

```typescript
import { FacetManager } from '@/storage/neo4j/facet-manager.js';

const facets = new FacetManager(driver, logger);

// Get PMEST dimensions
const dimensions = await facets.getDimensions();

// Get facet values for a dimension
const values = await facets.getFacetValues('matter', {
  limit: 100,
  includeCount: true,
});

// Assign facets to preprint
await facets.assignFacets(preprintUri, [
  { dimension: 'matter', value: 'cs.AI' },
  { dimension: 'energy', value: 'empirical' },
]);
```

## Tag management

```typescript
import { TagManager } from '@/storage/neo4j/tag-manager.js';

const tags = new TagManager(driver, logger);

// Get trending tags
const trending = await tags.getTrending({
  period: '7d',
  limit: 20,
});

// Get tag suggestions for preprint
const suggestions = await tags.getSuggestions(preprintUri, {
  basedOn: 'similar-preprints',
  limit: 10,
});

// Check for spam tags
import { TagSpamDetector } from '@/storage/neo4j/tag-spam-detector.js';

const detector = new TagSpamDetector(driver, logger);
const isSpam = await detector.check(tagText, authorDid);
```

## Proposal handling

```typescript
import { ProposalHandler } from '@/storage/neo4j/proposal-handler.js';

const proposals = new ProposalHandler(driver, storage, logger);

// Create field proposal
const proposal = await proposals.createFieldProposal({
  type: 'create',
  field: {
    id: 'cs.QML',
    label: 'Quantum Machine Learning',
    parent: 'cs.AI',
  },
  proposerDid: userDid,
});

// Apply approved proposal
await proposals.applyProposal(proposalId);

// Revert proposal (if needed)
await proposals.revertProposal(proposalId);
```

## Configuration

Environment variables:

| Variable              | Default                 | Description          |
| --------------------- | ----------------------- | -------------------- |
| `NEO4J_URI`           | `bolt://localhost:7687` | Bolt connection URI  |
| `NEO4J_USER`          | `neo4j`                 | Username             |
| `NEO4J_PASSWORD`      | Required                | Password             |
| `NEO4J_DATABASE`      | `neo4j`                 | Database name        |
| `NEO4J_MAX_POOL_SIZE` | `50`                    | Connection pool size |

## Setup

```bash
# Initialize schema and bootstrap data
tsx scripts/db/setup-neo4j.ts

# Or via npm script
pnpm db:setup:neo4j
```

### Bootstrap data

Initial data includes:

- Root field node (`id: 'root'`)
- Top-level field categories (cs, physics, math, bio, etc.)
- 10 PMEST facet dimension templates
- Initial authority records from LCSH

## Testing

```bash
# Integration tests
pnpm test tests/integration/storage/neo4j-operations.test.ts

# Citation graph tests
pnpm test tests/unit/storage/neo4j/citation-graph.test.ts

# Algorithm tests
pnpm test tests/integration/storage/neo4j-algorithms.test.ts
```

## Monitoring

### Query performance

```cypher
// Show slow queries
CALL dbms.listQueries() YIELD query, elapsedTimeMillis
WHERE elapsedTimeMillis > 1000
RETURN query, elapsedTimeMillis;

// Profile a query
PROFILE MATCH (f:Field)-[:PARENT_OF*]->(child)
WHERE f.id = 'cs'
RETURN child;
```

### Database statistics

```cypher
// Node counts by label
MATCH (n)
RETURN labels(n)[0] AS label, count(*) AS count
ORDER BY count DESC;

// Relationship counts
MATCH ()-[r]->()
RETURN type(r) AS type, count(*) AS count
ORDER BY count DESC;
```

## Related documentation

- [Knowledge Graph Concepts](../../concepts/knowledge-graph.md): Taxonomy design
- [Governance](../../governance/overview.md): Proposal workflow
- [PostgreSQL Storage](./postgresql.md): Primary metadata storage
