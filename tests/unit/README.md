# Unit Tests

Unit tests for Chive backend services using Vitest.

## Overview

Isolated tests for individual functions, classes, and modules without external dependencies. All external services are mocked.

## Directory Structure

```
unit/
├── api/
│   ├── handlers/
│   │   ├── claiming/
│   │   │   └── fetchExternalPdf.test.ts
│   │   └── xrpc/
│   │       ├── actor/
│   │       │   └── autocomplete.test.ts
│   │       ├── claiming/
│   │       │   └── startClaimFromExternal.test.ts
│   │       ├── endorsement.test.ts
│   │       ├── eprint.test.ts
│   │       ├── governance.test.ts
│   │       ├── governance-admin.test.ts
│   │       ├── governance-consensus.test.ts
│   │       ├── review.test.ts
│   │       ├── tag.test.ts
│   │       └── trusted-editor.test.ts
│   └── middleware/
│       ├── auth.test.ts
│       ├── error-handler.test.ts
│       ├── rate-limit.test.ts
│       └── validation.test.ts
├── atproto/
│   └── repository/
│       └── at-repository.test.ts
├── auth/
│   ├── authentication-service.test.ts
│   ├── authorization-service.test.ts
│   ├── did-resolver.test.ts
│   ├── jwt-service.test.ts
│   ├── mfa-service.test.ts
│   ├── session-manager.test.ts
│   ├── webauthn-service.test.ts
│   └── zero-trust-service.test.ts
├── lexicons/
│   └── validator.test.ts
├── observability/
│   ├── logger.test.ts
│   ├── metrics.test.ts
│   └── telemetry.test.ts
├── plugins/
│   ├── builtin/
│   │   ├── arxiv.test.ts
│   │   ├── base-plugin.test.ts
│   │   ├── bluesky-backlinks.test.ts
│   │   ├── crossref.test.ts
│   │   ├── dryad.test.ts
│   │   ├── figshare.test.ts
│   │   ├── github-integration.test.ts
│   │   ├── gitlab-integration.test.ts
│   │   ├── leaflet-backlinks.test.ts
│   │   ├── lingbuzz.test.ts
│   │   ├── openalex.test.ts
│   │   ├── openreview.test.ts
│   │   ├── osf.test.ts
│   │   ├── psyarxiv.test.ts
│   │   ├── ror.test.ts
│   │   ├── semantic-scholar.test.ts
│   │   ├── semantics-archive.test.ts
│   │   ├── semble-backlinks.test.ts
│   │   ├── software-heritage.test.ts
│   │   ├── whitewind-backlinks.test.ts
│   │   ├── wikidata.test.ts
│   │   └── zenodo-integration.test.ts
│   ├── core/
│   │   ├── backlink-plugin.test.ts
│   │   ├── event-bus.test.ts
│   │   ├── importing-plugin.test.ts
│   │   ├── manifest-schema.test.ts
│   │   ├── plugin-context.test.ts
│   │   ├── plugin-loader.test.ts
│   │   ├── plugin-manager.test.ts
│   │   └── scoped-event-bus.test.ts
│   ├── sandbox/
│   │   ├── isolated-vm-sandbox.test.ts
│   │   ├── permission-enforcer.test.ts
│   │   └── resource-governor.test.ts
│   └── plugin-permission-validation.test.ts
├── scripts/
│   └── db/
│       ├── deterministic-uuid.test.ts
│       └── seed-scripts.test.ts
├── services/
│   ├── activity/
│   │   └── activity-service.test.ts
│   ├── alpha/
│   │   └── alpha-application-service.test.ts
│   ├── backlink/
│   │   └── backlink-service.test.ts
│   ├── blob-proxy/
│   │   └── pds-resolution.test.ts
│   ├── claiming/
│   │   └── claiming-service.test.ts
│   ├── discovery/
│   │   └── discovery-service.test.ts
│   ├── eprint/
│   │   ├── pds-record-transformer.test.ts
│   │   └── version-manager.test.ts
│   ├── governance/
│   │   └── trusted-editor-service.test.ts
│   ├── import/
│   │   └── import-service.test.ts
│   ├── indexing/
│   │   ├── commit-handler.test.ts
│   │   ├── error-classifier.test.ts
│   │   ├── event-filter.test.ts
│   │   └── reconnection-manager.test.ts
│   ├── notification/
│   │   └── notification-service.test.ts
│   ├── pds-discovery/
│   │   └── pds-scanner.test.ts
│   ├── reconciliation/
│   │   └── reconciliation-service.test.ts
│   ├── review/
│   │   ├── review-service.test.ts
│   │   └── threading-handler.test.ts
│   ├── search/
│   │   ├── category-matcher.test.ts
│   │   ├── search-service.test.ts
│   │   └── text-scorer.test.ts
│   └── pds-rate-limiter.test.ts
├── storage/
│   ├── neo4j/
│   │   ├── citation-graph.test.ts
│   │   └── tag-spam-detector.test.ts
│   └── postgresql/
│       ├── adapter.test.ts
│       ├── batch-operations.test.ts
│       ├── connection.test.ts
│       ├── facet-usage-history-repository.test.ts
│       ├── query-builder.test.ts
│       └── transaction.test.ts
├── types/
│   ├── atproto-validators.test.ts
│   └── result.test.ts
└── workers/
    ├── enrichment-worker.test.ts
    └── freshness-worker.test.ts
```

## Running Tests

```bash
# Run all unit tests
pnpm test:unit

# Run with watch mode (TDD)
pnpm test:watch

# Run specific test file
pnpm test -- tests/unit/services/search/search-service.test.ts

# Run tests matching pattern
pnpm test -- --grep "search"

# Run with coverage
pnpm test:coverage

# Run with UI
pnpm test:ui
```

## Test Categories

### API Tests

Tests for XRPC handlers, REST endpoints, and middleware.

### Auth Tests

Tests for authentication, authorization, JWT handling, MFA, and WebAuthn.

### Plugin Tests

Tests for plugin system core, builtin plugins, and sandbox security.

### Service Tests

Tests for business logic in service layer.

### Storage Tests

Tests for database adapters, query builders, and repositories.

### Worker Tests

Tests for background job workers.

## Writing Tests

### Use Mock Services

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createMockSearchEngine } from '@tests/helpers/mock-services';

describe('SearchService', () => {
  const mockEngine = createMockSearchEngine();

  it('returns search results', async () => {
    vi.mocked(mockEngine.search).mockResolvedValue({
      hits: [{ uri: 'at://...' }],
      total: 1,
      took: 5,
    });

    const service = new SearchService(mockEngine);
    const results = await service.search({ query: 'test' });

    expect(results.total).toBe(1);
  });
});
```

### Use Test Fixtures

```typescript
import { createMockEprintData, createMockAuthor } from '@tests/fixtures/mock-authors';

describe('EprintIndexer', () => {
  it('indexes eprint with authors', async () => {
    const eprint = createMockEprintData({
      authors: [createMockAuthor({ name: 'Alice' })],
    });

    await indexer.index(eprint);
  });
});
```

## Coverage Requirements

- **Backend**: 80% line coverage minimum
- **Critical paths**: 100% coverage required
  - Indexing pipeline
  - Authentication
  - Sync operations
  - Validation
  - Compliance checks

## Related

- `tests/helpers/` - Mock services and auth helpers
- `tests/fixtures/` - Test data factories
- `tests/integration/` - Integration tests
- `vitest.config.ts` - Vitest configuration
