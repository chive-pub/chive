# Stub implementations requiring completion

This document catalogs all placeholder and stub implementations in the Chive codebase that require full implementation for production readiness.

## Priority levels

- **P0 (Critical)**: Blocks core functionality; must be implemented before any production use
- **P1 (High)**: Required for full feature set; can demo without but not ship
- **P2 (Medium)**: Enhances functionality; can ship initial version without
- **P3 (Low)**: Nice-to-have improvements; can defer indefinitely

## P0: ATProto infrastructure

### 1. IRepository implementation

**Location**: `src/index.ts:237-245`

**Current state**: Placeholder that returns `null` for all operations.

```typescript
function createPlaceholderRepository(): IRepository {
  return {
    getRecord: () => Promise.resolve(null),
    listRecords: async function* () {
      /* empty */
    },
    getBlob: () => Promise.reject(new APIError('Blob fetching not implemented', 501, 'getBlob')),
  };
}
```

**Required implementation**:

1. **Record fetching** (`getRecord`)
   - Resolve author DID to PDS URL via identity resolver
   - Call `com.atproto.repo.getRecord` XRPC method on user's PDS
   - Parse response and return typed `RepositoryRecord<T>`
   - Handle 404 (record not found) gracefully
   - Implement retry logic with exponential backoff
   - Cache successful responses with configurable TTL

2. **Record listing** (`listRecords`)
   - Resolve author DID to PDS URL
   - Call `com.atproto.repo.listRecords` with pagination
   - Return async generator for memory-efficient streaming
   - Handle cursor-based pagination
   - Support filtering by collection NSID

3. **Blob fetching** (`getBlob`)
   - Resolve author DID to PDS URL
   - Construct blob URL: `{pdsUrl}/xrpc/com.atproto.sync.getBlob?did={did}&cid={cid}`
   - Stream response as `ReadableStream<Uint8Array>`
   - Verify CID matches content hash
   - Never store blob data locally (proxy only)

**Dependencies**:

- `IIdentityResolver` must be implemented first
- HTTP client with retry support (e.g., `ky`, `got`)
- CID verification library (`@ipld/dag-cbor`, `multiformats`)

**Reference**: See `src/types/interfaces/repository.interface.ts` for full interface specification.

### 2. IIdentityResolver implementation

**Location**: `src/index.ts:259-264`

**Current state**: Placeholder that returns `null` for all operations.

```typescript
function createPlaceholderIdentityResolver(): IIdentityResolver {
  return {
    resolveHandle: () => Promise.resolve(null),
    resolveDID: () => Promise.resolve(null),
    getPDSEndpoint: () => Promise.resolve(null),
  };
}
```

**Required implementation**:

1. **Handle resolution** (`resolveHandle`)
   - DNS TXT record lookup for `_atproto.{handle}`
   - HTTP well-known lookup at `https://{handle}/.well-known/atproto-did`
   - Validate returned DID format
   - Cache results with 5-minute TTL (handles can change)

2. **DID resolution** (`resolveDID`)
   - For `did:plc:*`: Query PLC directory at `https://plc.directory/{did}`
   - For `did:web:*`: Fetch `https://{domain}/.well-known/did.json`
   - Parse and validate DID document structure
   - Cache with 1-hour TTL (DID documents change infrequently)

3. **PDS endpoint extraction** (`getPDSEndpoint`)
   - Resolve DID to DID document
   - Find service entry with `type: "AtprotoPersonalDataServer"`
   - Extract `serviceEndpoint` URL
   - Validate URL format

**Dependencies**:

- DNS resolver for TXT lookups
- HTTP client for well-known and PLC queries
- DID document parser/validator

**Reference**:

- ATProto Identity spec: https://atproto.com/specs/did
- PLC directory: https://web.plc.directory/

## P0: Blob proxy service wiring

### 3. Service instantiation in entry point

**Location**: `src/index.ts:204-213`

**Current state**: All blob proxy dependencies passed as `null as never`.

```typescript
const blobProxyService = new BlobProxyService({
  repository: createPlaceholderRepository(),
  identity: createPlaceholderIdentityResolver(),
  redisCache: null as never, // TODO: Implement RedisCache
  cdnAdapter: null as never, // TODO: Implement CDNAdapter
  cidVerifier: null as never, // TODO: Implement CIDVerifier
  coalescer: null as never, // TODO: Implement RequestCoalescer
  resiliencePolicy: null as never, // TODO: Implement resilience policy
  logger,
});
```

**Required implementation**:

The component implementations exist but need instantiation:

1. **RedisCache** (`src/services/blob-proxy/redis-cache.ts`)

   ```typescript
   const redisCache = new RedisCache({
     redis,
     defaultTTL: 3600, // 1 hour
     beta: 1.0, // Probabilistic early expiration
     maxBlobSize: 10485760, // 10MB
     keyPrefix: 'chive:blob:',
     logger,
   });
   ```

2. **CDNAdapter** (`src/services/blob-proxy/cdn-adapter.ts`)

   ```typescript
   const cdnAdapter = new CDNAdapter({
     endpoint: config.r2Endpoint,
     bucket: config.r2Bucket,
     accessKeyId: config.r2AccessKeyId,
     secretAccessKey: config.r2SecretAccessKey,
     cdnBaseURL: config.cdnBaseURL,
     defaultTTL: 86400, // 24 hours
     logger,
   });
   ```

3. **CIDVerifier** (`src/services/blob-proxy/cid-verifier.ts`)

   ```typescript
   const cidVerifier = new CIDVerifier({ logger });
   ```

4. **RequestCoalescer** (`src/services/blob-proxy/request-coalescer.ts`)

   ```typescript
   const coalescer = new RequestCoalescer({
     maxWaitTime: 100, // ms
     maxBatchSize: 50,
     logger,
   });
   ```

5. **Resilience policy** (using `cockatiel` library)

   ```typescript
   import { Policy, ConsecutiveBreaker } from 'cockatiel';

   const resiliencePolicy = Policy.wrap(
     Policy.handleAll().retry().attempts(3).exponential(),
     Policy.handleAll().circuitBreaker(10_000, new ConsecutiveBreaker(5))
   );
   ```

**Environment variables required**:

```bash
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=chive-blobs
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
CDN_BASE_URL=https://cdn.chive.pub
```

## P1: XRPC write handlers (PDS integration)

These handlers return HTTP 501 because write operations require user authentication and PDS integration.

### 4. Endorsement handlers

**Locations**:

- `src/api/handlers/xrpc/endorsement/create.ts:43-46`
- `src/api/handlers/xrpc/endorsement/update.ts:43-46`
- `src/api/handlers/xrpc/endorsement/delete.ts:47-50`

**Current state**: Return 501 with message explaining endorsements are created in user PDSes.

**Required implementation**:

1. **Authentication flow**
   - Implement ATProto OAuth (DPoP-bound tokens)
   - Verify user session via `com.atproto.server.getSession`
   - Extract user DID from verified session

2. **PDS write operations**
   - Resolve user DID to their PDS endpoint
   - Create record via `com.atproto.repo.createRecord`
   - Update via `com.atproto.repo.putRecord`
   - Delete via `com.atproto.repo.deleteRecord`
   - Use lexicon: `pub.chive.review.endorsement`

3. **Index synchronization**
   - After successful PDS write, trigger local index update
   - Or rely on firehose to pick up changes (preferred for consistency)

**Reference**: See `design/01-lexicons/endorsement.md` for schema.

### 5. Review handlers

**Locations**:

- `src/api/handlers/xrpc/review/create.ts:42-45`
- `src/api/handlers/xrpc/review/delete.ts:47-50`

**Current state**: Return 501 with message explaining reviews are created in user PDSes.

**Required implementation**: Same pattern as endorsement handlers.

**Lexicon**: `pub.chive.review.comment`

### 6. Tag handlers

**Locations**:

- `src/api/handlers/xrpc/tag/create.ts:40-43`
- `src/api/handlers/xrpc/tag/delete.ts:47-50`

**Current state**: Return 501 with message explaining tags are created in user PDSes.

**Required implementation**: Same pattern as endorsement handlers.

**Lexicon**: `pub.chive.eprint.userTag`

## P2: Plugin paper search

### 7. LingBuzz paper search

**Location**: `src/plugins/builtin/lingbuzz.ts:557-562`

**Current state**: Returns empty array with debug log.

```typescript
searchPapers(query: string): Promise<readonly LingBuzzPaper[]> {
  this.logger.debug('Paper search not fully implemented', { query });
  return Promise.resolve([]);
}
```

**Required implementation**:

1. **Index building**
   - Crawl LingBuzz paper listings
   - Extract metadata (title, authors, abstract, URL)
   - Store in Elasticsearch index

2. **Search implementation**
   - Query Elasticsearch with user's search terms
   - Return ranked results with relevance scores
   - Support filtering by year, author, topic

3. **Sync strategy**
   - Incremental updates via RSS/Atom feed
   - Full re-index monthly

### 8. Semantics Archive paper search

**Location**: `src/plugins/builtin/semantics-archive.ts:341`

**Current state**: Same as LingBuzz (returns empty array).

**Required implementation**: Same pattern as LingBuzz with Semantics Archive-specific parsing.

## P2: Review storage types

### 9. StoredReview interface

**Location**: `src/storage/postgresql/reviews-repository.ts:44-52`

**Current state**: Placeholder interface with basic fields.

```typescript
/**
 * Stored review metadata (placeholder).
 *
 * This is a placeholder interface. Full review storage types will be
 * defined when the review lexicons are implemented.
 */
export interface StoredReview {
  uri: AtUri;
  eprintUri: AtUri;
  reviewerDid: DID;
  content: string;
  pdsUrl: string;
  createdAt: Date;
  indexedAt: Date;
}
```

**Required implementation**:

Expand to match `pub.chive.review.comment` lexicon:

```typescript
export interface StoredReview {
  // Identity
  readonly uri: AtUri;
  readonly cid: CID;

  // References
  readonly eprintUri: AtUri;
  readonly parentUri?: AtUri; // For threaded replies
  readonly rootUri?: AtUri; // Thread root

  // Author
  readonly reviewerDid: DID;
  readonly reviewerHandle?: string; // Denormalized for display

  // Content
  readonly content: string;
  readonly contentFormat: 'markdown' | 'plain';

  // Anchoring (for inline comments)
  readonly anchor?: {
    readonly type: 'text' | 'page' | 'figure';
    readonly pageNumber?: number;
    readonly textRange?: { start: number; end: number };
    readonly quote?: string;
  };

  // Metadata
  readonly pdsUrl: string;
  readonly createdAt: Date;
  readonly indexedAt: Date;
  readonly updatedAt?: Date;

  // Aggregates (denormalized)
  readonly replyCount: number;
  readonly endorsementCount: number;
}
```

## P3: ML-based quality detection

### 10. Tag spam detection

**Location**: `src/storage/neo4j/tag-manager.ts:448`

**Current state**: Comment noting ML model placeholder.

```typescript
/**
 * Quality score is based on:
 * - Usage diversity (unique users / total usage)
 * - Growth sustainability (not just spam bursts)
 * - Spam detection (placeholder - would use ML model)
 */
```

**Required implementation**:

1. **Feature engineering**
   - Tag creation velocity (tags/hour by user)
   - User reputation score
   - Tag content analysis (gibberish detection)
   - Network analysis (coordinated behavior)

2. **Model training**
   - Collect labeled spam/not-spam examples
   - Train classifier (XGBoost or similar)
   - Deploy as microservice or embedded model

3. **Integration**
   - Call spam classifier in `updateQualityScore`
   - Factor spam probability into quality score
   - Auto-flag high-probability spam for review

**Alternative**: Start with rule-based heuristics before investing in ML.

## Implementation order recommendation

1. **Phase 1: Core ATProto** (P0)
   - IIdentityResolver
   - IRepository
   - Blob proxy service wiring

2. **Phase 2: Authentication** (P1)
   - ATProto OAuth implementation
   - Session management
   - Write handler enablement

3. **Phase 3: Enhanced features** (P2)
   - Plugin paper search
   - Full review storage types

4. **Phase 4: Quality** (P3)
   - Spam detection ML model

## Testing requirements

Each stub implementation must include:

1. **Unit tests**
   - Mock external dependencies (PDS, PLC directory)
   - Test error handling paths
   - Test retry/circuit breaker behavior

2. **Integration tests**
   - Test against local PDS (via test stack)
   - Test real DID resolution (against plc.directory staging)

3. **Compliance tests**
   - Verify ATProto protocol adherence
   - Ensure no data sovereignty violations

## Next steps

- [Remaining stub implementations](./REMAINING_STUB_IMPLEMENTATIONS): updated stub catalog
- [Lexicons reference](../reference/lexicons): lexicon schemas
- [XRPC endpoints](../api-reference/xrpc-endpoints): API endpoint details
