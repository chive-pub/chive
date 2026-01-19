# Test Helpers

Utility functions and mock service factories for unit and integration testing.

## Overview

This directory provides testing infrastructure including authentication helpers and mock service implementations. These utilities allow testing API endpoints and services without requiring real database connections or ATProto service authentication.

## Files

| File               | Description                                       |
| ------------------ | ------------------------------------------------- |
| `auth.ts`          | Authentication middleware and test user utilities |
| `mock-services.ts` | Mock implementations of all core services         |

## Authentication Helpers

### Test Users

```typescript
import { TEST_USERS, createTestUser } from '@tests/helpers/auth';

// Pre-defined test users
TEST_USERS.regular; // Standard authenticated user
TEST_USERS.admin; // Admin user with elevated permissions
TEST_USERS.premium; // Premium tier user
```

### Authentication Middleware

```typescript
import { createTestAuthMiddleware, createHeaderBasedTestAuthMiddleware } from '@tests/helpers/auth';

// Fixed user authentication
app.use('*', createTestAuthMiddleware(TEST_USERS.regular));

// Per-request authentication via header
app.use('*', createHeaderBasedTestAuthMiddleware());
// Then use X-Test-User-DID header in requests
```

## Mock Services

All mock services are created with Vitest's `vi.fn()` and can be customized using `vi.mocked()`.

### Available Mock Factories

| Factory                           | Service                   |
| --------------------------------- | ------------------------- |
| `createMockAuthzService()`        | Authorization service     |
| `createMockAlphaService()`        | Alpha application service |
| `createMockLogger()`              | Logger                    |
| `createMockIdentity()`            | Identity resolver         |
| `createMockRepository()`          | ATProto repository        |
| `createMockSearchEngine()`        | Search engine             |
| `createMockSearchService()`       | Search service wrapper    |
| `createMockMetricsService()`      | Metrics service           |
| `createMockGraphService()`        | Knowledge graph service   |
| `createMockBlobProxyService()`    | Blob proxy service        |
| `createMockReviewService()`       | Review service            |
| `createMockTagManager()`          | Tag manager               |
| `createMockBacklinkService()`     | Backlink service          |
| `createMockClaimingService()`     | Claiming service          |
| `createMockImportService()`       | Import service            |
| `createMockPDSSyncService()`      | PDS sync service          |
| `createMockActivityService()`     | Activity service          |
| `createMockEprintService()`       | Eprint service            |
| `createMockFacetManager()`        | Facet manager             |
| `createMockNodeService()`         | Node service              |
| `createMockEdgeService()`         | Edge service              |
| `createMockStorageBackend()`      | Storage backend           |
| `createMockNodeRepository()`      | Node repository           |
| `createMockEdgeRepository()`      | Edge repository           |
| `createMockServiceAuthVerifier()` | Service auth verifier     |
| `createNoOpRelevanceLogger()`     | No-op relevance logger    |

## Usage Example

```typescript
import { createTestAuthMiddleware, TEST_USERS } from '@tests/helpers/auth';
import { createMockSearchService, createMockEprintService } from '@tests/helpers/mock-services';

describe('Search endpoint', () => {
  const searchService = createMockSearchService();
  const eprintService = createMockEprintService();

  beforeEach(() => {
    vi.mocked(searchService.search).mockResolvedValue({
      hits: [{ uri: 'at://...' }],
      total: 1,
      took: 5,
    });
  });

  it('returns search results', async () => {
    const app = createServer({ searchService, eprintService });
    app.use('*', createTestAuthMiddleware(TEST_USERS.regular));

    const res = await app.request('/xrpc/pub.chive.eprint.search?q=test');
    expect(res.status).toBe(200);
  });
});
```

## Related

- `tests/fixtures/` - Test data factories
- `tests/e2e/fixtures/` - E2E page objects and test data
