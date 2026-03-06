# Remaining stub implementations requiring completion

This document catalogs all placeholder and stub implementations in the Chive codebase that still require full implementation. See the "Completed items" section at the end for reference.

## Priority levels

- **P0 (Critical)**: Blocks core functionality; must be implemented before any production use
- **P1 (High)**: Required for full feature set; can demo without but not ship
- **P2 (Medium)**: Enhances functionality; can ship initial version without
- **P3 (Low)**: Nice-to-have improvements; can defer indefinitely

## P0: Blob proxy CDN configuration

### 1. Blob proxy CDN URL placeholder

**Location**: `src/index.ts:389`

**Current state**: Hardcoded placeholder URL that will fail in production.

```typescript
getPublicURL: (cid: string) => `https://placeholder.invalid/blobs/${cid}`,
```

**Required implementation**:

1. Add environment variable for CDN base URL
2. Configure R2/CDN integration with proper credentials
3. Replace placeholder with actual CDN URL construction

**Environment variables required**:

```bash
CDN_BASE_URL=https://cdn.chive.pub
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=chive-blobs
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
```

**Implementation**:

```typescript
getPublicURL: (cid: string) => `${config.cdnBaseUrl}/blobs/${cid}`,
```

**Tests required**:

- Unit test: URL construction with various CID formats
- Integration test: Verify CDN URL returns valid content

## P1: XRPC query handlers

These handlers currently return empty results or 404s. They need to be connected to their backing services.

### 2. Tag query handlers

#### 2.1 getSuggestions

**Location**: `src/api/handlers/xrpc/tag/getSuggestions.ts:42-52`

**Current state**: Returns empty suggestions array.

```typescript
// Return empty results for now - service implementation pending
const response: TagSuggestionsResponse = {
  suggestions: [],
};
```

**Required implementation**:

1. Inject `TagManager` from Neo4j storage layer
2. Query Neo4j for tags matching the input query prefix
3. Apply TaxoFolk ranking algorithm for suggestions
4. Return ranked suggestions with usage statistics

```typescript
export async function getSuggestionsHandler(
  c: Context<ChiveEnv>,
  params: GetTagSuggestionsParams
): Promise<TagSuggestionsResponse> {
  const tagManager = c.get('services').tagManager;
  const suggestions = await tagManager.getSuggestions(params.q, {
    limit: params.limit ?? 10,
    minQualityScore: 0.3,
  });

  return {
    suggestions: suggestions.map((tag) => ({
      normalizedForm: tag.normalizedForm,
      displayForm: tag.displayForm,
      usageCount: tag.usageCount,
      qualityScore: tag.qualityScore,
    })),
  };
}
```

**Tests required**:

- Unit test: Mock TagManager, verify correct parameters passed
- Unit test: Empty query returns popular tags
- Unit test: Limit parameter respected
- Integration test: Query Neo4j with real tag data

#### 2.2 getTrending

**Location**: `src/api/handlers/xrpc/tag/getTrending.ts:42`

**Current state**: Returns empty trending array.

**Required implementation**:

1. Inject `TagManager` from Neo4j storage
2. Query for tags with highest recent growth rate
3. Calculate trending score based on velocity and recency
4. Support time window parameter (24h, 7d, 30d)

```typescript
export async function getTrendingHandler(
  c: Context<ChiveEnv>,
  params: GetTrendingTagsParams
): Promise<TrendingTagsResponse> {
  const tagManager = c.get('services').tagManager;
  const trending = await tagManager.getTrendingTags({
    timeWindow: params.timeWindow ?? '7d',
    limit: params.limit ?? 20,
  });

  return {
    tags: trending.map((tag) => ({
      normalizedForm: tag.normalizedForm,
      displayForm: tag.displayForm,
      usageCount: tag.usageCount,
      trendScore: tag.trendScore,
      growthRate: tag.growthRate,
    })),
    timeWindow: params.timeWindow ?? '7d',
  };
}
```

**Tests required**:

- Unit test: Different time windows return different results
- Unit test: Growth rate calculation correctness
- Integration test: Trending detection with time-series data

#### 2.3 search

**Location**: `src/api/handlers/xrpc/tag/search.ts:43`

**Current state**: Returns empty search results.

**Required implementation**:

1. Inject `TagManager` from Neo4j storage
2. Perform full-text search on tag display forms
3. Apply quality score filtering
4. Support pagination with cursor

```typescript
export async function searchHandler(
  c: Context<ChiveEnv>,
  params: SearchTagsParams
): Promise<TagSearchResponse> {
  const tagManager = c.get('services').tagManager;
  const results = await tagManager.searchTags(params.q, {
    limit: params.limit ?? 25,
    cursor: params.cursor,
    minQualityScore: params.minQuality ?? 0,
  });

  return {
    tags: results.tags.map((tag) => ({
      normalizedForm: tag.normalizedForm,
      displayForm: tag.displayForm,
      usageCount: tag.usageCount,
      qualityScore: tag.qualityScore,
    })),
    cursor: results.nextCursor,
    hasMore: results.hasMore,
  };
}
```

**Tests required**:

- Unit test: Search query tokenization
- Unit test: Pagination cursor handling
- Unit test: Quality score filtering
- Integration test: Full-text search against Neo4j

#### 2.4 listForEprint

**Location**: `src/api/handlers/xrpc/tag/listForEprint.ts:41`

**Current state**: Returns empty tags array.

**Required implementation**:

1. Inject `TagManager` from Neo4j storage
2. Query tags linked to specific eprint URI
3. Include tagger information
4. Sort by usage count or recency

```typescript
export async function listForEprintHandler(
  c: Context<ChiveEnv>,
  params: ListTagsForEprintParams
): Promise<EprintTagsResponse> {
  const tagManager = c.get('services').tagManager;
  const tags = await tagManager.getTagsForEprint(params.eprintUri, {
    limit: params.limit ?? 50,
    cursor: params.cursor,
    includeTaggers: true,
  });

  return {
    tags: tags.items.map((tag) => ({
      normalizedForm: tag.normalizedForm,
      displayForm: tag.displayForm,
      usageCount: tag.usageCount,
      taggers: tag.taggers.map((t) => ({ did: t.did, taggedAt: t.taggedAt.toISOString() })),
    })),
    cursor: tags.nextCursor,
    hasMore: tags.hasMore,
    total: tags.total,
  };
}
```

**Tests required**:

- Unit test: Eprint URI validation
- Unit test: Tagger list aggregation
- Integration test: Tag-eprint relationships in Neo4j

#### 2.5 getDetail

**Location**: `src/api/handlers/xrpc/tag/getDetail.ts:42`

**Current state**: Returns 404 for all requests.

**Required implementation**:

1. Inject `TagManager` from Neo4j storage
2. Fetch tag by normalized form
3. Include usage statistics, quality score, spam score
4. Return 404 only if tag doesn't exist

```typescript
export async function getDetailHandler(
  c: Context<ChiveEnv>,
  params: GetTagDetailParams
): Promise<TagDetailResponse> {
  const tagManager = c.get('services').tagManager;
  const tag = await tagManager.getTagDetail(params.tag);

  if (!tag) {
    throw new NotFoundError('Tag', params.tag);
  }

  return {
    normalizedForm: tag.normalizedForm,
    displayForm: tag.displayForm,
    usageCount: tag.usageCount,
    uniqueUsers: tag.uniqueUsers,
    uniqueEprints: tag.uniqueEprints,
    qualityScore: tag.qualityScore,
    spamScore: tag.spamScore,
    createdAt: tag.createdAt.toISOString(),
    lastUsedAt: tag.lastUsedAt.toISOString(),
  };
}
```

**Tests required**:

- Unit test: Existing tag returns full detail
- Unit test: Non-existent tag returns 404
- Unit test: All statistics fields populated
- Integration test: Tag detail from Neo4j

### 3. Endorsement query handlers

#### 3.1 listForEprint

**Location**: `src/api/handlers/xrpc/endorsement/listForEprint.ts:44-54`

**Current state**: Returns empty endorsements array with zero counts.

**Required implementation**:

1. Inject `EndorsementRepository` from PostgreSQL storage
2. Query endorsements for eprint URI
3. Aggregate by contribution type
4. Support pagination

```typescript
export async function listForEprintHandler(
  c: Context<ChiveEnv>,
  params: ListEndorsementsForEprintParams
): Promise<EndorsementsResponse> {
  const endorsementRepo = c.get('services').endorsementRepository;
  const result = await endorsementRepo.listForEprint(params.eprintUri, {
    contributionType: params.contributionType,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

  const summary = await endorsementRepo.getSummaryForEprint(params.eprintUri);

  return {
    endorsements: result.items.map(mapEndorsementToResponse),
    summary: {
      total: summary.total,
      endorserCount: summary.uniqueEndorsers,
      byType: summary.byContributionType,
    },
    cursor: result.nextCursor,
    hasMore: result.hasMore,
    total: result.total,
  };
}
```

**Tests required**:

- Unit test: Filter by contribution type
- Unit test: Summary aggregation correctness
- Unit test: Pagination handling
- Integration test: PostgreSQL query with endorsement data

#### 3.2 getSummary

**Location**: `src/api/handlers/xrpc/endorsement/getSummary.ts:41`

**Current state**: Returns empty summary with zero counts.

**Required implementation**:

1. Inject `EndorsementRepository`
2. Aggregate endorsement counts by contribution type
3. Count unique endorsers
4. Calculate endorsement velocity (endorsements per time period)

```typescript
export async function getSummaryHandler(
  c: Context<ChiveEnv>,
  params: GetEndorsementSummaryParams
): Promise<EndorsementSummaryResponse> {
  const endorsementRepo = c.get('services').endorsementRepository;
  const summary = await endorsementRepo.getSummaryForEprint(params.eprintUri);

  return {
    eprintUri: params.eprintUri,
    total: summary.total,
    endorserCount: summary.uniqueEndorsers,
    byType: summary.byContributionType,
    recentEndorsers: summary.recentEndorsers.map((e) => ({
      did: e.did,
      endorsedAt: e.endorsedAt.toISOString(),
      contributionTypes: e.contributionTypes,
    })),
  };
}
```

**Tests required**:

- Unit test: Aggregation by contribution type
- Unit test: Unique endorser counting
- Integration test: Summary calculation with PostgreSQL

#### 3.3 getUserEndorsement

**Location**: `src/api/handlers/xrpc/endorsement/getUserEndorsement.ts:43`

**Current state**: Returns 404 for all requests.

**Required implementation**:

1. Inject `EndorsementRepository`
2. Query for specific user's endorsement of an eprint
3. Return full endorsement details if exists
4. Return 404 only if user hasn't endorsed

```typescript
export async function getUserEndorsementHandler(
  c: Context<ChiveEnv>,
  params: GetUserEndorsementParams
): Promise<UserEndorsementResponse> {
  const endorsementRepo = c.get('services').endorsementRepository;
  const endorsement = await endorsementRepo.getUserEndorsement(params.eprintUri, params.userDid);

  if (!endorsement) {
    throw new NotFoundError('Endorsement', `${params.userDid}:${params.eprintUri}`);
  }

  return {
    uri: endorsement.uri,
    cid: endorsement.cid,
    eprintUri: endorsement.eprintUri,
    endorserDid: endorsement.endorserDid,
    contributions: endorsement.contributions,
    comment: endorsement.comment,
    createdAt: endorsement.createdAt.toISOString(),
  };
}
```

**Tests required**:

- Unit test: Existing endorsement returned
- Unit test: Non-existent endorsement returns 404
- Integration test: User endorsement lookup in PostgreSQL

### 4. Review query handlers

#### 4.1 listForEprint

**Location**: `src/api/handlers/xrpc/review/listForEprint.ts:45-51`

**Current state**: Returns empty reviews array.

**Required implementation**:

1. Inject `ReviewsRepository` from PostgreSQL storage
2. Query reviews for eprint URI
3. Support filtering by motivation type
4. Support inline-only filter for annotations
5. Handle pagination

```typescript
export async function listForEprintHandler(
  c: Context<ChiveEnv>,
  params: ListReviewsForEprintParams
): Promise<ReviewsResponse> {
  const reviewsRepo = c.get('services').reviewsRepository;
  const result = await reviewsRepo.listForEprint(params.eprintUri, {
    motivation: params.motivation,
    inlineOnly: params.inlineOnly ?? false,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

  return {
    reviews: result.items.map(mapReviewToResponse),
    cursor: result.nextCursor,
    hasMore: result.hasMore,
    total: result.total,
  };
}
```

**Tests required**:

- Unit test: Filter by motivation type
- Unit test: Inline-only filter (reviews with anchors)
- Unit test: Pagination cursor handling
- Integration test: Review queries in PostgreSQL

#### 4.2 getThread

**Location**: `src/api/handlers/xrpc/review/getThread.ts:42`

**Current state**: Returns 404 for all requests.

**Required implementation**:

1. Inject `ReviewsRepository`
2. Fetch root review by URI
3. Recursively fetch all replies up to max depth
4. Build threaded response structure

```typescript
export async function getThreadHandler(
  c: Context<ChiveEnv>,
  params: GetReviewThreadParams
): Promise<ReviewThreadResponse> {
  const reviewsRepo = c.get('services').reviewsRepository;

  // Fetch root review
  const root = await reviewsRepo.getByUri(params.reviewUri);
  if (!root) {
    throw new NotFoundError('Review', params.reviewUri);
  }

  // Fetch replies using PostgreSQL function
  const replies = await reviewsRepo.getThread(params.reviewUri, {
    maxDepth: params.depth ?? 10,
  });

  return {
    root: mapReviewToResponse(root),
    replies: replies.map((r) => ({
      ...mapReviewToResponse(r),
      replyDepth: r.replyDepth,
    })),
    totalReplies: replies.length,
  };
}
```

**Tests required**:

- Unit test: Root review not found returns 404
- Unit test: Thread depth limiting
- Unit test: Reply ordering (chronological)
- Integration test: Thread retrieval with PostgreSQL function

### 5. Governance query handlers

#### 5.1 listProposals

**Location**: `src/api/handlers/xrpc/governance/listProposals.ts:43`

**Current state**: Returns empty proposals array.

**Required implementation**:

1. Inject `KnowledgeGraphAdapter` from Neo4j storage
2. Query field proposals with optional status filter
3. Include vote counts
4. Support pagination

```typescript
export async function listProposalsHandler(
  c: Context<ChiveEnv>,
  params: ListProposalsParams
): Promise<ProposalsResponse> {
  const graphAdapter = c.get('services').knowledgeGraphAdapter;
  const result = await graphAdapter.listProposals({
    status: params.status,
    fieldId: params.fieldId,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

  return {
    proposals: result.items.map(mapProposalToResponse),
    cursor: result.nextCursor,
    hasMore: result.hasMore,
    total: result.total,
  };
}
```

**Tests required**:

- Unit test: Filter by status (pending, approved, rejected)
- Unit test: Filter by field ID
- Unit test: Pagination handling
- Integration test: Proposal listing from Neo4j

#### 5.2 getProposal

**Location**: `src/api/handlers/xrpc/governance/getProposal.ts:42`

**Current state**: Returns 404 for all requests.

**Required implementation**:

1. Inject `KnowledgeGraphAdapter`
2. Fetch proposal by ID
3. Include full change details
4. Include vote breakdown

```typescript
export async function getProposalHandler(
  c: Context<ChiveEnv>,
  params: GetProposalParams
): Promise<ProposalDetailResponse> {
  const graphAdapter = c.get('services').knowledgeGraphAdapter;
  const proposal = await graphAdapter.getProposal(params.proposalId);

  if (!proposal) {
    throw new NotFoundError('Proposal', params.proposalId);
  }

  return {
    id: proposal.id,
    fieldId: proposal.fieldId,
    proposedBy: proposal.proposedBy,
    proposalType: proposal.proposalType,
    changes: proposal.changes,
    rationale: proposal.rationale,
    status: proposal.status,
    votes: proposal.votes,
    createdAt: proposal.createdAt.toISOString(),
    resolvedAt: proposal.resolvedAt?.toISOString(),
  };
}
```

**Tests required**:

- Unit test: Existing proposal returned with full details
- Unit test: Non-existent proposal returns 404
- Unit test: Vote counts accurate
- Integration test: Proposal detail from Neo4j

#### 5.3 listVotes

**Location**: `src/api/handlers/xrpc/governance/listVotes.ts:42`

**Current state**: Returns empty votes array.

**Required implementation**:

1. Inject `KnowledgeGraphAdapter`
2. Query votes for a specific proposal
3. Include voter DIDs and vote timestamps
4. Support pagination

```typescript
export async function listVotesHandler(
  c: Context<ChiveEnv>,
  params: ListVotesParams
): Promise<VotesResponse> {
  const graphAdapter = c.get('services').knowledgeGraphAdapter;
  const result = await graphAdapter.listVotes(params.proposalId, {
    voteType: params.voteType,
    limit: params.limit ?? 100,
    cursor: params.cursor,
  });

  return {
    votes: result.items.map((vote) => ({
      voterDid: vote.voterDid,
      voteType: vote.voteType,
      votedAt: vote.votedAt.toISOString(),
      comment: vote.comment,
    })),
    cursor: result.nextCursor,
    hasMore: result.hasMore,
    total: result.total,
  };
}
```

**Tests required**:

- Unit test: Filter by vote type (approve/reject)
- Unit test: Pagination handling
- Integration test: Vote listing from Neo4j

## P2: Facet analytics placeholders

### 6. Facet trending and growth rate

**Location**: `src/storage/neo4j/facet-manager.ts:897-898`

**Current state**: Hardcoded placeholder values.

```typescript
trending: false, // Placeholder - would need time-series data
growthRate: 0, // Placeholder - would need historical data
```

**Required implementation**:

1. **Time-series storage**:
   - Create daily facet usage snapshots table in PostgreSQL
   - Store (facet_uri, date, usage_count) tuples
   - Run nightly aggregation job

2. **Trending calculation**:
   - Compare current usage to 7-day moving average
   - Tag as "trending" if growth > 20% above average
   - Use exponential smoothing for stability

3. **Growth rate calculation**:
   - Calculate week-over-week growth percentage
   - Handle new facets (no historical data) gracefully

```typescript
private async calculateFacetTrending(facetUri: string): Promise<{ trending: boolean; growthRate: number }> {
  const history = await this.getFacetUsageHistory(facetUri, 14); // 14 days

  if (history.length < 7) {
    return { trending: false, growthRate: 0 };
  }

  const recentAvg = average(history.slice(0, 7).map(h => h.count));
  const priorAvg = average(history.slice(7).map(h => h.count));

  const growthRate = priorAvg > 0 ? (recentAvg - priorAvg) / priorAvg : 0;
  const trending = growthRate > 0.2;

  return { trending, growthRate };
}
```

**Database migration required**:

```sql
CREATE TABLE facet_usage_history (
  facet_uri TEXT NOT NULL,
  date DATE NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (facet_uri, date)
);

CREATE INDEX idx_facet_usage_history_date ON facet_usage_history(date);
```

**Tests required**:

- Unit test: Trending detection algorithm
- Unit test: Growth rate calculation with various scenarios
- Unit test: Handling of new facets with no history
- Integration test: Time-series data aggregation

## P2: Knowledge graph proposal changes

### 7. Proposal changes field

**Location**: `src/storage/neo4j/adapter.ts:1167`

**Current state**: Returns empty object for changes field.

```typescript
changes: {}, // Simplified for interface
```

**Required implementation**:

1. Store proposal changes as JSON in Neo4j node property
2. Parse and return structured changes object
3. Support different change types (add field, rename, merge, delete)

```typescript
private mapProposalFromNode(node: Record<string, unknown>, proposedBy: DID): IFieldProposal {
  // Parse changes from stored JSON
  const changesJson = node.changes as string | undefined;
  const changes: ProposalChanges = changesJson
    ? JSON.parse(changesJson)
    : {};

  return {
    id: node.id as string,
    fieldId: node.fieldId as string,
    proposedBy,
    proposalType: node.proposalType as IFieldProposal['proposalType'],
    changes,
    rationale: node.rationale as string,
    status: node.status as IFieldProposal['status'],
    votes: {
      approve: Number(node.approveVotes) || 0,
      reject: Number(node.rejectVotes) || 0,
    },
    createdAt: new Date(String(node.createdAt)),
  };
}
```

**Tests required**:

- Unit test: Parse various change types
- Unit test: Handle missing/null changes gracefully
- Integration test: Round-trip changes through Neo4j

## Service integration requirements

### Required service injections

The following services must be available in the Hono context for handlers to work:

```typescript
// src/api/types/context.ts - extend ChiveEnv
interface ChiveServices {
  // Existing
  logger: ILogger;

  // Required for query handlers
  tagManager: TagManager;
  endorsementRepository: EndorsementRepository;
  reviewsRepository: ReviewsRepository;
  knowledgeGraphAdapter: KnowledgeGraphAdapter;
}
```

### Wiring in entry point

```typescript
// src/index.ts - add to service container
const services: ChiveServices = {
  logger,
  tagManager: new TagManager({ connection: neo4jConnection, logger }),
  endorsementRepository: new EndorsementRepository({ pool: pgPool, logger }),
  reviewsRepository: new ReviewsRepository({ pool: pgPool, logger }),
  knowledgeGraphAdapter: new KnowledgeGraphAdapter({ connection: neo4jConnection, logger }),
};

// Pass to Hono context
app.use('*', async (c, next) => {
  c.set('services', services);
  await next();
});
```

## Testing strategy

### Unit tests

Each handler requires:

1. **Happy path**: service returns data, handler formats correctly
2. **Empty result**: service returns empty, handler returns empty response
3. **Not found**: service returns null, handler throws 404
4. **Pagination**: cursor handling works correctly
5. **Filtering**: filter parameters passed to service correctly

### Integration tests

Each handler requires:

1. **Database integration**: query against seeded test data
2. **Full request cycle**: HTTP request through handler to database
3. **Error propagation**: database errors become appropriate HTTP errors

### Test file locations

```text
tests/unit/api/handlers/xrpc/tag/
  getSuggestions.test.ts
  getTrending.test.ts
  search.test.ts
  listForEprint.test.ts
  getDetail.test.ts

tests/unit/api/handlers/xrpc/endorsement/
  listForEprint.test.ts
  getSummary.test.ts
  getUserEndorsement.test.ts

tests/unit/api/handlers/xrpc/review/
  listForEprint.test.ts
  getThread.test.ts

tests/unit/api/handlers/xrpc/governance/
  listProposals.test.ts
  getProposal.test.ts
  listVotes.test.ts

tests/integration/api/xrpc/
  tag-queries.test.ts
  endorsement-queries.test.ts
  review-queries.test.ts
  governance-queries.test.ts
```

## Implementation order

### Phase 1: Service layer verification

1. Verify TagManager has required methods
2. Verify EndorsementRepository has required methods
3. Verify ReviewsRepository has required methods
4. Verify KnowledgeGraphAdapter has required methods
5. Add any missing methods to services

### Phase 2: Context wiring

1. Update ChiveEnv with service types
2. Wire services in entry point
3. Verify services available in handlers

### Phase 3: Handler implementation (by domain)

1. Tag handlers (5 handlers)
2. Endorsement handlers (3 handlers)
3. Review handlers (2 handlers)
4. Governance handlers (3 handlers)

### Phase 4: Testing

1. Unit tests for all handlers
2. Integration tests for all handlers
3. Update compliance tests if needed

## Completed items (reference)

The following items from the original `STUB_IMPLEMENTATIONS.md` have been completed:

| Item                             | Status             | Completed In                                   |
| -------------------------------- | ------------------ | ---------------------------------------------- |
| IRepository Implementation       | Completed          | `src/atproto/repository/at-repository.ts`      |
| IIdentityResolver Implementation | Completed          | Wired existing `DIDResolver`                   |
| Blob Proxy Service Wiring        | Partially Complete | Need CDN URL config                            |
| Endorsement Write Handlers       | Completed          | `src/api/handlers/xrpc/endorsement/*.ts`       |
| Review Write Handlers            | Completed          | `src/api/handlers/xrpc/review/*.ts`            |
| Tag Write Handlers               | Completed          | `src/api/handlers/xrpc/tag/*.ts`               |
| LingBuzz Paper Search            | Completed          | `src/plugins/builtin/lingbuzz.ts`              |
| Semantics Archive Search         | Completed          | `src/plugins/builtin/semantics-archive.ts`     |
| StoredReview Interface           | Completed          | `src/storage/postgresql/reviews-repository.ts` |
| Tag Spam Detection               | Completed          | `src/storage/neo4j/tag-spam-detector.ts`       |

## Next steps

- [Stub implementations](./STUB_IMPLEMENTATIONS): original stub documentation
- [Lexicons reference](../reference/lexicons): lexicon schemas
- [XRPC endpoints](../api-reference/xrpc-endpoints): API endpoint details
