# DiscoveryService

The DiscoveryService provides personalized preprint recommendations using Semantic Scholar and OpenAlex enrichment with graceful degradation when external APIs are unavailable.

## Features

- Preprint enrichment with citation data, concepts, and topics
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

// Find similar preprints
const similar = await discovery.findRelatedPreprints(preprintUri, {
  method: 'specter2',
  limit: 10,
});

// Enrich preprint with external metadata
const enriched = await discovery.enrichPreprint(preprint);
```

## Recommendation algorithm

The service combines multiple signals for recommendations:

### Signal sources

| Signal              | Weight | Source                    |
| ------------------- | ------ | ------------------------- |
| SPECTER2 similarity | 0.35   | Semantic Scholar          |
| Citation overlap    | 0.25   | OpenAlex/Semantic Scholar |
| Field match         | 0.20   | Local knowledge graph     |
| Author co-citation  | 0.10   | Citation analysis         |
| Recency             | 0.10   | Publication date          |

### Personalization

User preferences are built from:

```typescript
interface UserProfile {
  readHistory: AtUri[]; // Preprints viewed > 30 seconds
  endorsedPreprints: AtUri[]; // Preprints user endorsed
  taggedPreprints: AtUri[]; // Preprints user tagged
  followedFields: string[]; // Subscribed fields
  researchInterests: string[]; // Profile keywords
}
```

### Scoring

```typescript
function scoreRecommendation(
  preprint: Preprint,
  userProfile: UserProfile,
  signals: SignalScores
): number {
  return (
    signals.specter2Similarity * 0.35 +
    signals.citationOverlap * 0.25 +
    signals.fieldMatch * 0.2 +
    signals.authorCoCitation * 0.1 +
    signals.recencyScore * 0.1
  );
}
```

## Enrichment

The service enriches preprints with external metadata:

```typescript
interface EnrichedPreprint extends Preprint {
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
async enrichPreprint(preprint: Preprint): Promise<EnrichedPreprint> {
  const enrichment: Enrichment = {};

  // Try Semantic Scholar first
  if (this.pluginManager?.hasPlugin('semantic-scholar')) {
    const s2Plugin = this.pluginManager.getPlugin('semantic-scholar');
    const paper = await s2Plugin.getPaperByDoi(preprint.doi);
    if (paper) {
      enrichment.citationCount = paper.citationCount;
      enrichment.influentialCitationCount = paper.influentialCitationCount;
    }
  }

  // Fallback to OpenAlex
  if (!enrichment.citationCount && this.pluginManager?.hasPlugin('openalex')) {
    const oaPlugin = this.pluginManager.getPlugin('openalex');
    const work = await oaPlugin.getWorkByDoi(preprint.doi);
    if (work) {
      enrichment.citationCount = work.citedByCount;
      enrichment.concepts = work.concepts;
    }
  }

  // Always available: local data
  enrichment.localMetrics = await this.metricsService.getMetrics(preprint.uri);

  return { ...preprint, enrichment };
}
```

## Citation graph

The service provides citation graph traversal:

```typescript
// Forward citations (papers citing this one)
const citing = await discovery.getCitingPapers(preprintUri, {
  limit: 50,
  sort: 'influence',
});

// Backward citations (papers this one cites)
const references = await discovery.getReferences(preprintUri, {
  limit: 100,
});

// Citation statistics
const stats = await discovery.getCitationCounts(preprintUri);
// { total: 42, influential: 8, recent: 15 }
```

## Interaction tracking

User interactions feed back into recommendations:

```typescript
interface Interaction {
  preprintUri: AtUri;
  action: 'view' | 'download' | 'endorse' | 'tag' | 'share';
  duration?: number; // For views, time spent in seconds
  context?: string; // Where the interaction occurred
}

await discovery.recordInteraction(userDid, {
  preprintUri: 'at://did:plc:abc.../pub.chive.preprint.submission/3k5...',
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

- Field-based: Preprints in fields the user follows
- Co-author network: Preprints by authors of papers the user has read
- Tag similarity: Preprints with similar tags to user's tagged papers
- Trending: Popular preprints in user's fields

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
