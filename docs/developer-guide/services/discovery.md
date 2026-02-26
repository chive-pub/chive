# DiscoveryService

The DiscoveryService provides personalized eprint recommendations and related paper discovery using a weighted multi-signal system. It combines citation analysis, semantic similarity, concept overlap, and author networks, with graceful degradation when external APIs are unavailable.

## Features

- Multi-signal related paper discovery with configurable weights
- Personalized recommendations based on user's claimed papers, fields, and co-authors
- SPECTER2 embedding similarity via Semantic Scholar, with Elasticsearch MLT fallback
- Co-citation and bibliographic coupling via Neo4j
- OpenAlex concept and topic overlap scoring
- Author network signals from shared authorship
- Eprint enrichment with citation data, concepts, and topics
- Graceful degradation when external services are unavailable

## Usage

```typescript
import { DiscoveryService } from '@/services/discovery';

const discovery = container.resolve(DiscoveryService);

// Get personalized recommendations
const recommendations = await discovery.getRecommendationsForUser(userDid, {
  limit: 20,
  signals: ['fields', 'citations', 'semantic', 'collaborators'],
});

// Find related eprints with signal selection
const similar = await discovery.findRelatedEprints(eprintUri, {
  signals: ['citations', 'concepts', 'semantic', 'authors'],
  limit: 10,
  minScore: 0.2,
});

// Enrich eprint with external metadata
const enriched = await discovery.enrichEprint(eprint);
```

## Recommendation algorithm

The service combines multiple weighted signals to score related papers. Each signal collector adds entries to a shared `Map<string, SignalAccumulatorEntry>`, and the final score is a weighted sum of per-signal contributions.

### Signal sources

| Signal                               | Weight | Source                                   | Implementation                                |
| ------------------------------------ | ------ | ---------------------------------------- | --------------------------------------------- |
| SPECTER2 similarity                  | 30%    | Semantic Scholar API                     | `collectSemanticSignals` with ES MLT fallback |
| Co-citation + bibliographic coupling | 25%    | Neo4j `RecommendationService.getSimilar` | `collectCitationSignals`                      |
| OpenAlex concept/topic overlap       | 20%    | `eprint_enrichment` table                | `collectConceptSignals`                       |
| Author network                       | 15%    | `eprints_index` JSONB authors            | `collectAuthorSignals`                        |
| Collaborative filtering              | 10%    | User engagement patterns                 | Planned                                       |

These weights are defined in `DEFAULT_DISCOVERY_WEIGHTS` in `discovery-service.ts`:

```typescript
const DEFAULT_DISCOVERY_WEIGHTS: Required<DiscoverySignalWeights> = {
  specter2: 0.3,
  coCitation: 0.25,
  conceptOverlap: 0.2,
  authorNetwork: 0.15,
  collaborative: 0.1,
};
```

### Signal accumulator pattern

`findRelatedEprints` uses a signal accumulator to merge results from independent collectors:

1. Each signal collector (`collectCitationSignals`, `collectConceptSignals`, `collectSemanticSignals`, `collectAuthorSignals`) adds entries to a `Map<string, SignalAccumulatorEntry>` keyed by eprint URI
2. When a paper appears in multiple signals, `mergeSignal` takes the max score per dimension (not the sum)
3. The final combined score is a weighted sum: `(semantic * 0.30) + (citations * 0.25) + (concepts * 0.20) + (authors * 0.15)`
4. Papers scoring below `minScore` (default 0.2) are filtered out
5. Results are sorted by combined score and truncated to `limit`

```typescript
interface SignalAccumulatorEntry {
  title: string;
  abstract?: string;
  categories?: readonly string[];
  publicationDate?: Date;
  relationshipType: RelatedEprint['relationshipType'];
  explanation: string;
  scores: {
    citations?: number;
    concepts?: number;
    semantic?: number;
    authors?: number;
  };
}
```

### Citation signals

`collectCitationSignals` gathers co-citation, bibliographic coupling, and direct citation data.

When the optional `recommendationEngine` (`RecommendationService` from Neo4j) is injected, it calls `getSimilar()`, which combines co-citation AND bibliographic coupling in a single Cypher query. Similarity scores are normalized using a saturation function: `score / (score + 5)`.

When the recommendation engine is not available, the method falls back to `citationGraph.findCoCitedPapers()` (co-citation only).

In both cases, direct citations (papers citing this one, and papers this one cites) are also added to the accumulator with a base score of 0.7 (or 0.9 for influential citations).

### Concept overlap signals

`collectConceptSignals` queries the `eprint_enrichment` table for the source paper's OpenAlex concepts and topics, then finds other papers with overlapping entries using JSONB operators.

Topic hierarchy depth determines the score:

| Match level   | Score |
| ------------- | ----- |
| Same topic    | 0.9   |
| Same subfield | 0.7   |
| Same field    | 0.5   |
| Same domain   | 0.3   |

Concept overlap (flat, non-hierarchical) is scored as the ratio of shared concepts to the larger set, discounted by 0.8 relative to hierarchical topic scores. The overall concept signal is `max(topicScore, conceptScore * 0.8)`.

### Semantic similarity signals

`collectSemanticSignals` prefers SPECTER2 embeddings via the Semantic Scholar recommendations API when the source paper has a Semantic Scholar ID and the plugin is available. Results are filtered to papers present in Chive's index.

When SPECTER2 is unavailable, the method falls back to Elasticsearch More Like This (MLT) queries matching on title, abstract, and keywords. MLT scores are discounted by 0.6 relative to SPECTER2 to reflect lower precision.

### Author network signals

`collectAuthorSignals` extracts author DIDs from the source eprint, then queries the `eprints_index` table for other papers sharing authors via `jsonb_array_elements`. The score is based on the author overlap ratio:

```
score = min(1.0, 0.4 + (overlap_count / total_authors) * 0.6)
```

A single shared author yields a minimum score of 0.4; full author overlap yields 1.0.

### Result type

Each result includes per-signal breakdowns in `signalScores`:

```typescript
interface RelatedEprint {
  /** AT-URI of the related eprint. */
  readonly uri: AtUri;

  /** Eprint title. */
  readonly title: string;

  /** Overall weighted similarity score (0-1). */
  readonly score: number;

  /** Primary relationship type. */
  readonly relationshipType:
    | 'cites'
    | 'cited-by'
    | 'co-cited'
    | 'bibliographic-coupling'
    | 'same-author'
    | 'similar-topics'
    | 'semantically-similar';

  /** Human-readable explanation. */
  readonly explanation: string;

  /** Per-signal score contributions. */
  readonly signalScores?: {
    readonly citations?: number;
    readonly concepts?: number;
    readonly semantic?: number;
    readonly authors?: number;
  };
}
```

### Personalization

User preferences are built from:

```typescript
interface UserProfile {
  readHistory: AtUri[]; // Eprints viewed > 30 seconds
  endorsedEprints: AtUri[]; // Eprints user endorsed
  taggedEprints: AtUri[]; // Eprints user tagged
  followedFields: string[]; // Subscribed fields
  researchInterests: string[]; // Profile keywords
}
```

## Personalized recommendations

`getRecommendationsForUser` combines five signal sources to build a ranked list for a specific user:

1. **Field-based**: Text search matching the user's research fields via Elasticsearch
2. **Citation-based**: Papers citing the user's claimed work, via the citation graph
3. **SPECTER2-based**: Semantic similarity to the user's claimed papers using `getRecommendationsFromLists` (multi-example recommendations)
4. **Topic-based discovery**: Aggregates OpenAlex topics from the user's claimed papers (via `eprint_enrichment`), then queries for other papers with matching topics at the topic, field, or domain level
5. **Co-author papers**: Finds co-authors from the user's claimed papers, then retrieves papers by those co-authors that the user has not claimed

Candidates from all signals are merged, deduplicated, and ranked using the `IRankingService`. Papers the user has claimed or dismissed are excluded.

## Enrichment

The service enriches eprints with external metadata:

```typescript
interface EnrichedEprint extends Eprint {
  enrichment: {
    citationCount: number;
    influentialCitationCount: number;
    concepts: Concept[];
    topics: Topic[];
    relatedPapers: RelatedPaper[];
    externalIds: {
      doi?: string;
      arxivId?: string;
      semanticScholarId?: string;
      openAlexId?: string;
    };
  };
}
```

### External API integration

The service uses plugins for external APIs:

```typescript
async enrichEprint(eprint: EnrichmentInput): Promise<EnrichmentResult> {
  // try Semantic Scholar first (by DOI or arXiv ID)
  if (s2Plugin) {
    const paper = await s2Plugin.getPaperByDoi(eprint.doi);
    if (paper) {
      enrichment.citationCount = paper.citationCount;
      enrichment.influentialCitationCount = paper.influentialCitationCount;

      // fetch citations and index Chive-to-Chive relationships in Neo4j
      const citations = await s2Plugin.getCitations(paper.paperId, { limit: 100 });
      await this.citationGraph.upsertCitationsBatch(chiveCitations);
    }
  }

  // fetch concepts/topics from OpenAlex (by DOI or title/abstract classification)
  if (oaPlugin) {
    const work = await oaPlugin.getWorkByDoi(eprint.doi);
    if (work) {
      enrichment.concepts = work.concepts;
    } else if (eprint.title) {
      // fallback: classify by title and abstract text
      const classification = await oaPlugin.classifyText(eprint.title, eprint.abstract);
      enrichment.topics = classification.topics;
      enrichment.concepts = classification.concepts;
    }
  }

  return { ...eprint, enrichment };
}
```

## Citation graph

Citations come from two sources: automated GROBID extraction from eprint PDFs, and user-curated `pub.chive.eprint.citation` records indexed from the firehose.

The service provides citation graph traversal:

```typescript
// forward citations (papers citing this one)
const citing = await discovery.getCitingPapers(eprintUri, {
  limit: 50,
  sort: 'influence',
});

// backward citations (papers this one cites)
const references = await discovery.getReferences(eprintUri, {
  limit: 100,
});

// citation statistics
const stats = await discovery.getCitationCounts(eprintUri);
// { total: 42, influential: 8, recent: 15 }
```

## GROBID citation extraction

The citation extraction pipeline uses GROBID (GeneRation Of BIbliographic Data) to parse PDF documents and extract structured reference data. Extraction runs as a background job after eprint indexing.

### Pipeline flow

1. Eprint PDF is indexed from the firehose
2. A citation extraction job is queued
3. GROBID parses the PDF and returns TEI-XML with structured references
4. References are stored in PostgreSQL (`citations_index` table)
5. Citations matching existing Chive eprints create `CITES` edges in Neo4j

### Configuration

| Variable             | Default                 | Description                        |
| -------------------- | ----------------------- | ---------------------------------- |
| `GROBID_URL`         | `http://localhost:8070` | GROBID service URL                 |
| `GROBID_TIMEOUT`     | `120000`                | Request timeout (ms)               |
| `GROBID_CONSOLIDATE` | `1`                     | Citation consolidation level (0-2) |

### Resilience

The discovery service wraps citation graph queries in try-catch blocks. When Neo4j is unavailable or has no citation data, the service falls back to Elasticsearch More Like This (MLT) queries for related paper suggestions.

## Interaction tracking

User interactions feed back into recommendations:

```typescript
interface Interaction {
  eprintUri: AtUri;
  action: 'view' | 'download' | 'endorse' | 'tag' | 'share';
  duration?: number; // for views, time spent in seconds
  context?: string; // where the interaction occurred
}

await discovery.recordInteraction(userDid, {
  eprintUri: 'at://did:plc:abc.../pub.chive.eprint.submission/3k5...',
  action: 'view',
  duration: 120,
  context: 'for-you-feed',
});
```

## Graceful degradation

Each signal collector wraps external calls in try-catch blocks and logs failures at debug level. When an external API (Semantic Scholar, OpenAlex) or a storage backend (Neo4j) is unavailable, the remaining signals still contribute to the final score. Local signals (field match, ES MLT, author network) always work without external dependencies.

```typescript
// each collector degrades independently
if (signals.includes('citations')) {
  await this.collectCitationSignals(eprintUri, signalAccumulator);
  // catches Neo4j errors internally, continues with other signals
}

if (signals.includes('semantic')) {
  await this.collectSemanticSignals(eprintUri, eprint, minScore, signalAccumulator);
  // tries SPECTER2 first, falls back to ES MLT
}
```

## Dependencies

```typescript
interface DiscoveryDependencies {
  logger: ILogger;
  database: IDatabasePool;
  search: ISearchEngine;
  ranking: IRankingService;
  citationGraph: ICitationGraph;
  pluginManager?: IPluginManager;
  recommendationEngine?: RecommendationService; // Neo4j co-citation + bibliographic coupling
}
```

The `recommendationEngine` is optional. When provided, `collectCitationSignals` uses `RecommendationService.getSimilar()` for combined co-citation and bibliographic coupling. When absent, citation signals fall back to co-citation only via `ICitationGraph.findCoCitedPapers()`.

The `pluginManager` is optional and set via `setPluginManager()` after construction. It provides access to the Semantic Scholar and OpenAlex plugins for enrichment and SPECTER2-based recommendations.

## Configuration

```typescript
interface DiscoveryConfig {
  maxRecommendations: number; // max recommendations per request
  minScore: number; // minimum relevance score
  recencyWeight: number; // weight for recent papers
  diversityFactor: number; // reduce similar paper clustering
  cacheTimeout: number; // recommendation cache TTL
}
```

Environment variables:

| Variable              | Default | Description             |
| --------------------- | ------- | ----------------------- |
| `DISCOVERY_MAX_RECS`  | `100`   | Max recommendations     |
| `DISCOVERY_MIN_SCORE` | `0.1`   | Minimum relevance score |
| `DISCOVERY_CACHE_TTL` | `3600`  | Cache TTL in seconds    |
