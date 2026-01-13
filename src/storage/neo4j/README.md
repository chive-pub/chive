# Neo4j Knowledge Graph

Neo4j 5+ implementation for Chive's field taxonomy and authority control.

## Overview

This is the knowledge graph layer for Chive. It stores field taxonomy (hierarchical relationships between academic fields), authority records using the IFLA LRM 2024-2025 standard, and community governance data. The graph also maintains a 10-dimensional faceted classification system combining Ranganathan's PMEST with OCLC FAST.

**Critical note**: Neo4j is an index only. All source data lives in user PDSes and the Governance PDS. If Neo4j is deleted, rebuild from ATProto firehose. No user data is lost.

## Files

The `connection.ts` file handles connection pooling, health checks, and session management. Schema setup happens in `setup.ts`, which creates constraints and indexes from the `.cypher` files in the schema directory.

Field operations live in `field-repository.ts`, which handles CRUD operations and hierarchy queries using materialized paths. Authority control is in `authority-repository.ts`, implementing IFLA LRM with variant detection and USE chain resolution.

The `facet-manager.ts` file manages the 10-dimensional classification system. User tags are handled by `tag-manager.ts`, which supports promotion from folksonomy to formal taxonomy.

Community governance is split between `moderation-service.ts` (voting, consensus calculation, role weights) and `proposal-handler.ts` (proposal lifecycle, discussion threads).

Wikidata integration uses `sparql-client.ts` for rate-limited SPARQL queries and `wikidata-connector.ts` for bootstrapping the taxonomy and enriching entities.

Graph algorithms are in `graph-algorithms.ts`, which wraps Neo4j GDS library procedures for PageRank, betweenness, Dijkstra shortest path, and Louvain community detection.

## Authority Records

Authority records follow IFLA Library Reference Model 2024-2025. Each record has an authorized form (the canonical heading), variant forms (synonyms, abbreviations, alternate spellings), and a scope note that clarifies boundaries.

```typescript
const authorityRepo = container.resolve(AuthorityRepository);

await authorityRepo.createAuthorityRecord({
  id: 'neural-networks-cs',
  uri: 'at://did:plc:gov/pub.chive.graph.authority/nn-cs',
  authorizedForm: 'Neural networks (Computer science)',
  variantForms: ['Neural nets', 'ANNs'],
  scopeNote: 'For biological networks, see Nervous system',
  status: 'established',
  sources: [
    {
      system: 'wikidata',
      identifier: 'Q43479',
      uri: 'https://www.wikidata.org/wiki/Q43479',
      matchType: 'exact-match',
    },
  ],
  language: 'en',
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

Search uses fuzzy matching with Levenshtein distance. Variant detection runs at 0.85 similarity threshold by default. USE chains are resolved recursively to find the canonical authority.

## Faceted Classification

The system combines Ranganathan's PMEST (Personality, Matter, Energy, Space, Time) with OCLC FAST (Form, Topical, Geographic, Chronological, Event) for 10 total dimensions. Each facet can have a parent facet, creating hierarchies within dimensions.

```typescript
const facetManager = container.resolve(FacetManager);

const facetUri = await facetManager.createFacet({
  type: 'matter',
  value: 'Proteins',
  authorityRecordUri: proteinAuthorityUri,
  parentUri: biologyFacetUri,
});

await facetManager.assignFacets(eprintUri, [
  { facetUri: proteinFacetUri, confidence: 0.95 },
  { facetUri: metaAnalysisFacetUri, confidence: 0.88 },
]);
```

Queries use AND logic across facets. The system also tracks facet usage statistics and suggests candidates for promotion to formal fields based on usage patterns.

## Community Governance

Voting follows Wikipedia's model with weighted roles. Community members get weight 1.0, trusted editors get 2.0, domain experts get 2.5, authority editors get 3.0, and administrators have veto power.

Consensus requires 67% approval, minimum 5 votes, and at least 2 trusted editors. The voting period is 14 days. Proposals can be approved, rejected, or marked as needing changes.

```typescript
const moderation = container.resolve(ModerationService);

await moderation.castVote({
  proposalUri,
  voterDid: 'did:plc:user123',
  voteType: 'approve',
  comment: 'Well-sourced with clear evidence',
});

const summary = await moderation.getVotingSummary(proposalUri);
```

The proposal handler manages lifecycle state transitions. Proposals start pending, move to in-discussion when opened, then get approved, rejected, or marked for changes based on consensus.

## Wikidata Integration

Bootstrap the taxonomy from Wikidata using SPARQL queries. The client enforces rate limiting (180 requests per minute) and retries on server errors or rate limit responses.

```typescript
const connector = container.resolve(WikidataConnector);

const results = await connector.search('quantum computing');
const entity = await connector.getEntityFull(results[0].qid);

const count = await connector.bootstrap(
  {
    rootQids: ['Q11862829'], // academic discipline
    maxDepth: 3,
    maxEntities: 500,
  },
  (progress) => {
    console.log(`${progress.entitiesProcessed}/${progress.entitiesTotal}`);
  }
);
```

The bootstrap process creates authority records for each entity, including labels, descriptions, and relationship data from Wikidata's property graph.

## Graph Algorithms

All algorithms use Neo4j's Graph Data Science library. Create an in-memory projection first, then run algorithms on the projection for performance.

```typescript
const algorithms = container.resolve(GraphAlgorithms);

await algorithms.projectGraph({
  name: 'fields-graph',
  nodeLabels: ['FieldNode'],
  relationshipTypes: ['RELATED_TO', 'SUBFIELD_OF'],
});

const rankings = await algorithms.pageRank('fields-graph', {
  maxIterations: 20,
  dampingFactor: 0.85,
});

const path = await algorithms.shortestPath('fields-graph', sourceUri, targetUri);
const communities = await algorithms.louvain('fields-graph');

await algorithms.dropGraph('fields-graph');
```

PageRank uses the standard damping factor (0.85) and runs up to 20 iterations. Shortest path uses Dijkstra's algorithm. Community detection uses Louvain method with modularity optimization.

## Schema

Constraints ensure uniqueness on node IDs and composite keys for relationships:

```cypher
CREATE CONSTRAINT field_id_unique FOR (f:FieldNode) REQUIRE f.id IS UNIQUE;
CREATE CONSTRAINT facet_composite_key FOR (f:Facet) REQUIRE (f.type, f.value) IS NODE KEY;
CREATE CONSTRAINT vote_composite_key FOR (v:Vote) REQUIRE (v.proposalUri, v.voterDid) IS NODE KEY;
```

Indexes cover label lookups, full-text search, and composite queries:

```cypher
CREATE INDEX field_label_idx FOR (f:FieldNode) ON (f.label);
CREATE FULLTEXT INDEX field_fulltext FOR (f:FieldNode) ON EACH [f.label, f.description];
CREATE INDEX field_level_path_idx FOR (f:FieldNode) ON (f.level, f.materialized_path);
```

## Configuration

```typescript
const config: Neo4jConfig = {
  uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  username: process.env.NEO4J_USERNAME || 'neo4j',
  password: process.env.NEO4J_PASSWORD,
  database: process.env.NEO4J_DATABASE || 'neo4j',
  maxConnectionPoolSize: 50,
  connectionAcquisitionTimeout: 60000,
  connectionTimeout: 30000,
  maxTransactionRetryTime: 30000,
};
```

Memory tuning for production:

```properties
dbms.memory.heap.max_size=4G
dbms.memory.pagecache.size=4G
dbms.security.procedures.unrestricted=gds.*
gds.enterprise.max_memory=8G
```

## Testing

Integration tests verify constraints, indexes, and initial data. Performance benchmarks measure hierarchy traversal, authority search, and graph algorithm execution times. Compliance tests validate ATProto requirements (no writes to user PDSes, no blob storage, rebuildable from firehose).

```bash
npm run test:integration -- neo4j-schema.test.ts
npm run test:performance -- neo4j-benchmarks.test.ts
npm run test:compliance
```

## ATProto Compliance

Source data lives in user PDSes (eprints, reviews, votes, tags) and the Governance PDS (authority records, approved fields). Neo4j indexes this data for discovery but does not own it. If Neo4j is deleted, rebuild from the ATProto firehose. No user data is lost because the source remains in PDSes.

## References

Neo4j documentation: https://neo4j.com/docs/
Neo4j GDS library: https://neo4j.com/docs/graph-data-science/current/
IFLA LRM specification: https://www.ifla.org/publications/node/11412
Wikidata Query Service: https://query.wikidata.org/
