# Chive Type System

This directory contains all TypeScript type definitions for Chive.

## Structure

```
types/
├── atproto.ts                    # AT Protocol primitives (AtUri, DID, CID, etc.)
├── atproto-validators.ts         # Type guards for AT Protocol types
├── errors.ts                     # Error hierarchy
├── result.ts                     # Result monad for error handling
├── validation.ts                 # Validation types
├── interfaces/                   # Service interfaces
│   ├── cache.interface.ts        # Cache provider (Redis)
│   ├── event-stream.interface.ts # Firehose consumer
│   ├── graph.interface.ts        # Knowledge graph (Neo4j)
│   ├── identity.interface.ts     # DID resolution
│   ├── logger.interface.ts       # Structured logging
│   ├── metrics.interface.ts      # Metrics (Prometheus)
│   ├── plugin.interface.ts       # Plugin system
│   ├── repository.interface.ts   # PDS access (read-only)
│   ├── search.interface.ts       # Search engine (Elasticsearch)
│   └── storage.interface.ts      # Index storage (PostgreSQL)
└── models/                       # Domain models
    ├── author.ts                 # Author profiles and metrics
    ├── preprint.ts               # Preprint, versions, tags
    └── review.ts                 # Reviews and endorsements
```

## AT Protocol Primitives

### Branded Types

All AT Protocol primitives use branded types for compile-time safety:

```typescript
import { toAtUri, toDID, toNSID, toCID } from './types';

// ✅ Correct: Use validators
const uri = toAtUri('at://did:plc:abc123/pub.chive.preprint.submission/xyz789');
const did = toDID('did:plc:abc123');
const nsid = toNSID('pub.chive.preprint.submission');
const cid = toCID('bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q');

// ❌ Wrong: Don't use type assertions
const uri = 'at://...' as AtUri; // Type-unsafe!
```

### BlobRef (CRITICAL)

BlobRefs are metadata pointers, **never blob data**:

```typescript
import type { BlobRef } from './types';

// ✅ Correct: Store BlobRef
const preprint = {
  documentBlobRef: {
    $type: 'blob',
    ref: toCID('bafyreib...')!,
    mimeType: 'application/pdf',
    size: 2048576,
  },
  documentFormat: 'pdf',
};

// ❌ Wrong: Don't store blob data
const preprint = {
  documentData: new Uint8Array([...]); // ATProto violation!
};
```

## Error Handling

### Result Monad

Use `Result<T, E>` for fallible operations:

```typescript
import { Ok, Err, unwrap, unwrapOr, isOk } from './types';

function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) {
    return Err(new Error('Division by zero'));
  }
  return Ok(a / b);
}

// Pattern matching
const result = divide(10, 2);
if (isOk(result)) {
  console.log('Result:', result.value); // 5
} else {
  console.error('Error:', result.error);
}

// Unwrap with default
const value = unwrapOr(divide(10, 0), 0); // 0
```

### Error Types

Use specific error types for better error handling:

```typescript
import { NotFoundError, ValidationError, ComplianceError } from './types';

// Not found
if (!preprint) {
  throw new NotFoundError('Preprint', uri);
}

// Validation
if (!preprint.title) {
  throw new ValidationError('Title is required', 'title', 'required');
}

// ATProto compliance
if (operation === 'WRITE_TO_PDS') {
  throw new ComplianceError('WRITE_TO_PDS', 'AppViews must never write to user PDSes');
}
```

## Service Interfaces

All services use dependency injection via interfaces:

```typescript
import type { IRepository, IStorageBackend, ISearchEngine } from './types';

class PreprintService {
  constructor(
    private readonly repository: IRepository,
    private readonly storage: IStorageBackend,
    private readonly search: ISearchEngine
  ) {}

  async indexPreprint(uri: AtUri): Promise<void> {
    // Fetch from user's PDS (read-only)
    const record = await this.repository.getRecord<PreprintRecord>(uri);
    if (!record) {
      throw new NotFoundError('Preprint', uri);
    }

    // Store index (metadata only)
    await this.storage.storePreprint({
      uri,
      cid: record.cid,
      author: record.author,
      title: record.value.title,
      abstract: record.value.abstract,
      documentBlobRef: record.value.document, // BlobRef, not blob data
      pdsUrl: await this.identity.getPDSEndpoint(record.author),
      indexedAt: new Date(),
      createdAt: new Date(record.value.createdAt),
    });

    // Index for search
    await this.search.indexPreprint({
      uri,
      author: record.author,
      authorName: 'Dr. Jane Smith', // Denormalized
      title: record.value.title,
      abstract: record.value.abstract,
      keywords: record.value.keywords,
      subjects: record.value.subjects,
      createdAt: new Date(record.value.createdAt),
      indexedAt: new Date(),
    });
  }
}
```

## Domain Models

All models are immutable:

```typescript
import type { Preprint, Review, Author } from './types';

// ✅ Correct: All properties readonly
const preprint: Preprint = {
  uri: toAtUri('at://...')!,
  cid: toCID('bafyreib...')!,
  author: toDID('did:plc:abc')!,
  title: 'Neural Networks in Biology',
  abstract: 'This paper explores...',
  documentBlobRef: {
    $type: 'blob',
    ref: toCID('bafyreib...')!,
    mimeType: 'application/pdf',
    size: 2048576,
  },
  documentFormat: 'pdf',
  keywords: ['neural networks', 'biology'],
  facets: [],
  version: 1,
  license: 'CC-BY-4.0',
  createdAt: Date.now() as Timestamp,
};

// ❌ Wrong: Can't mutate
preprint.title = 'New Title'; // Compile error!
```

## Plugin System

Create plugins by implementing `IChivePlugin`:

```typescript
import type { IChivePlugin, IPluginContext, PluginState } from './types';

export class GitHubPlugin implements IChivePlugin {
  readonly id = 'com.example.github-integration';
  readonly manifest = {
    id: 'com.example.github-integration',
    name: 'GitHub Integration',
    version: '0.1.0',
    description: 'Links preprints to GitHub repositories',
    author: 'Example Org',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.github.com'],
      },
    },
    entrypoint: 'dist/index.js',
  };

  private state = PluginState.UNINITIALIZED;
  private logger!: ILogger;

  async initialize(context: IPluginContext): Promise<void> {
    this.state = PluginState.INITIALIZING;
    this.logger = context.logger;

    context.eventBus.on('preprint.indexed', this.handleIndexed.bind(this));

    this.state = PluginState.READY;
    this.logger.info('GitHub plugin initialized');
  }

  async shutdown(): Promise<void> {
    this.state = PluginState.SHUTTING_DOWN;
    this.logger.info('GitHub plugin shutting down');
    this.state = PluginState.SHUTDOWN;
  }

  getState(): PluginState {
    return this.state;
  }

  private async handleIndexed(preprint: Preprint): Promise<void> {
    this.logger.info('Processing preprint', { uri: preprint.uri });
    // Plugin logic here
  }
}
```

## Type Safety Best Practices

1. **Never use `any`**: Use `unknown` with type guards instead
2. **Always use branded types**: Use validators (`toAtUri`, `toDID`, etc.)
3. **Prefer Result over exceptions**: For expected failures
4. **Make models immutable**: Use `readonly` on all properties
5. **Use strict TypeScript**: All types compile with strict mode
6. **Document with TSDoc**: 100% coverage on public APIs

## Testing

Test types with unit tests:

```typescript
import { describe, expect, it } from 'vitest';
import { toAtUri, toDID, Ok, Err, unwrap } from '@/types';

describe('AtUri validation', () => {
  it('validates correct AT URIs', () => {
    const uri = toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz');
    expect(uri).toBeTruthy();
  });

  it('rejects invalid AT URIs', () => {
    const uri = toAtUri('https://example.com');
    expect(uri).toBeNull();
  });
});

describe('Result monad', () => {
  it('unwraps Ok values', () => {
    const result = Ok(42);
    expect(unwrap(result)).toBe(42);
  });

  it('throws on Err unwrap', () => {
    const result = Err(new Error('Failed'));
    expect(() => unwrap(result)).toThrow('Failed');
  });
});
```
