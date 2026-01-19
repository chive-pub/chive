# DiscoveryService

The DiscoveryService provides personalized eprint recommendations using Semantic Scholar and OpenAlex enrichment with graceful degradation when external APIs are unavailable.

## Features

- Eprint enrichment with citation data, concepts, and topics
- Personalized recommendations based on user reading history
- Similar paper discovery using SPECTER2 embeddings
- Citation graph traversal (forward and backward citations)
- Graceful degradation when external services are unavailable

## Usage

```typescript
import { DiscoveryService } from '@/services/discovery';

const discovery = container.resolve(DiscoveryService);

// Get personalized recommendations
const recommendations = await discovery.getRecommendationsForUser(userDid, {
  limit: 20,
  sources: ['semantic-scholar', 'openalex', 'local'],
});

// Find similar eprints
const similar = await discovery.findRelatedEprints(eprintUri, {
  method: 'specter2',
  limit: 10,
});

// Enrich eprint with external metadata
const enriched = await discovery.enrichEprint(eprint);
```

## Recommendation algorithm

The service combines multiple signals for recommendations:

### Signal sources

| Signal              | Source                    |
| ------------------- | ------------------------- |
| SPECTER2 similarity | Semantic Scholar          |
| Citation overlap    | OpenAlex/Semantic Scholar |
| Field match         | Local knowledge graph     |
| Author co-citation  | Citation analysis         |
| Recency             | Publication date          |

Signals are combined dynamically based on availability and user context.

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

### Scoring

The ranking service combines available signals into a final score. When external APIs are unavailable, local signals (field match, recency) receive higher weight.

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
async enrichEprint(eprint: Eprint): Promise<EnrichedEprint> {
  const enrichment: Enrichment = {};

  // Try Semantic Scholar first
  if (this.pluginManager?.hasPlugin('semantic-scholar')) {
    const s2Plugin = this.pluginManager.getPlugin('semantic-scholar');
    const paper = await s2Plugin.getPaperByDoi(eprint.doi);
    if (paper) {
      enrichment.citationCount = paper.citationCount;
      enrichment.influentialCitationCount = paper.influentialCitationCount;
    }
  }

  // Fallback to OpenAlex
  if (!enrichment.citationCount && this.pluginManager?.hasPlugin('openalex')) {
    const oaPlugin = this.pluginManager.getPlugin('openalex');
    const work = await oaPlugin.getWorkByDoi(eprint.doi);
    if (work) {
      enrichment.citationCount = work.citedByCount;
      enrichment.concepts = work.concepts;
    }
  }

  // Always available: local data
  enrichment.localMetrics = await this.metricsService.getMetrics(eprint.uri);

  return { ...eprint, enrichment };
}
```

## Citation graph

The service provides citation graph traversal:

```typescript
// Forward citations (papers citing this one)
const citing = await discovery.getCitingPapers(eprintUri, {
  limit: 50,
  sort: 'influence',
});

// Backward citations (papers this one cites)
const references = await discovery.getReferences(eprintUri, {
  limit: 100,
});

// Citation statistics
const stats = await discovery.getCitationCounts(eprintUri);
// { total: 42, influential: 8, recent: 15 }
```

## Interaction tracking

User interactions feed back into recommendations:

```typescript
interface Interaction {
  eprintUri: AtUri;
  action: 'view' | 'download' | 'endorse' | 'tag' | 'share';
  duration?: number; // For views, time spent in seconds
  context?: string; // Where the interaction occurred
}

await discovery.recordInteraction(userDid, {
  eprintUri: 'at://did:plc:abc.../pub.chive.eprint.submission/3k5...',
  action: 'view',
  duration: 120,
  context: 'for-you-feed',
});
```

## Graceful degradation

The service works without external APIs:

```typescript
async getRecommendationsForUser(
  userDid: string,
  options: RecommendationOptions
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Try external APIs (optional)
  if (this.pluginManager?.hasPlugin('semantic-scholar')) {
    try {
      const s2Recs = await this.getSemanticScholarRecs(userDid);
      recommendations.push(...s2Recs);
    } catch (error) {
      this.logger.warn('Semantic Scholar unavailable, using local only');
    }
  }

  // Always available: local recommendations
  const localRecs = await this.getLocalRecommendations(userDid);
  recommendations.push(...localRecs);

  // Merge, dedupe, and rank
  return this.rankRecommendations(recommendations, options.limit);
}
```

## Local recommendations

When external APIs are unavailable, local signals are used:

- Field-based: Eprints in fields the user follows
- Co-author network: Eprints by authors of papers the user has read
- Tag similarity: Eprints with similar tags to user's tagged papers
- Trending: Popular eprints in user's fields

## Dependencies

```typescript
interface DiscoveryDependencies {
  logger: ILogger;
  database: IDatabasePool;
  search: ISearchEngine;
  ranking: IRankingService;
  citationGraph: ICitationGraph;
  pluginManager?: IPluginManager; // Optional for external APIs
}
```

## Configuration

```typescript
interface DiscoveryConfig {
  maxRecommendations: number; // Max recommendations per request
  minScore: number; // Minimum relevance score
  recencyWeight: number; // Weight for recent papers
  diversityFactor: number; // Reduce similar paper clustering
  cacheTimeout: number; // Recommendation cache TTL
}
```

Environment variables:

| Variable              | Default | Description             |
| --------------------- | ------- | ----------------------- |
| `DISCOVERY_MAX_RECS`  | `100`   | Max recommendations     |
| `DISCOVERY_MIN_SCORE` | `0.1`   | Minimum relevance score |
| `DISCOVERY_CACHE_TTL` | `3600`  | Cache TTL in seconds    |
