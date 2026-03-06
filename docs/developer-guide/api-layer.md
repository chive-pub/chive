# API layer

## Overview

Chive's API layer provides two primary interfaces for accessing eprint data:

1. **XRPC Endpoints** (`/xrpc/pub.chive.*`): ATProto-native procedure calls
2. **REST Endpoints** (`/api/v1/*`): Traditional REST API for broader compatibility

Both interfaces share the same middleware stack and return equivalent data with ATProto compliance guarantees.

---

## Architecture

### Technology stack

- **Framework**: [Hono](https://hono.dev/), a lightweight web framework
- **Validation**: ATProto Lexicon validation (`@atproto/lexicon`)
- **Type Generation**: Lexicon-to-TypeScript via `@atproto/lex-cli`
- **Documentation**: OpenAPI 3.1 generation for REST endpoints

### Directory structure

```text
src/api/
├── server.ts              # Application factory
├── routes.ts              # Route registration
├── config.ts              # API configuration
├── middleware/
│   ├── auth.ts            # DID-based authentication
│   ├── error-handler.ts   # ChiveError → HTTP mapping
│   ├── rate-limit.ts      # 4-tier Redis rate limiting
│   └── request-context.ts # Request ID, timing, logging
├── handlers/
│   └── xrpc/
│       ├── eprint/        # Eprint XRPC handlers
│       ├── graph/         # Knowledge graph handlers
│       ├── review/        # Review handlers
│       ├── endorsement/   # Endorsement handlers
│       ├── metrics/       # Metrics handlers
│       └── ...            # Other namespaces
├── xrpc/
│   ├── types.ts           # XRPCMethod interface definitions
│   ├── validation.ts      # Lexicon-based validation utilities
│   └── hono-adapter.ts    # Hono integration
└── types/
    └── context.ts         # Hono context extensions
```

---

## Quick start

### Creating the server

```typescript
import { createServer } from '@/api/server.js';

const app = createServer({
  eprintService,
  searchService,
  metricsService,
  graphService,
  blobProxyService,
  redis,
  logger,
});

// Node.js
import { serve } from '@hono/node-server';
serve({ fetch: app.fetch, port: 3000 });

// Bun
export default { port: 3000, fetch: app.fetch };
```

### Making requests

```bash
# XRPC: Get an eprint
curl "https://api.chive.pub/xrpc/pub.chive.eprint.getSubmission?uri=at://did:plc:abc/pub.chive.eprint.submission/xyz"

# REST: Get an eprint
curl "https://api.chive.pub/api/v1/eprints/at%3A%2F%2Fdid%3Aplc%3Aabc%2Fpub.chive.eprint.submission%2Fxyz"

# Search eprints
curl -X POST "https://api.chive.pub/xrpc/pub.chive.eprint.searchSubmissions" \
  -H "Content-Type: application/json" \
  -d '{"q": "quantum computing", "limit": 20}'
```

---

## XRPC endpoints

### Eprint endpoints

#### `pub.chive.eprint.getSubmission`

Retrieves a single eprint by AT URI.

**Request:**

```text
GET /xrpc/pub.chive.eprint.getSubmission?uri={atUri}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| uri | string | Yes | AT Protocol URI (at://did/collection/rkey) |

**Response:**

```json
{
  "uri": "at://did:plc:abc/pub.chive.eprint.submission/xyz",
  "cid": "bafyreiabc123",
  "title": "Quantum Computing Advances",
  "abstract": "This paper presents...",
  "author": "did:plc:abc",
  "license": "CC-BY-4.0",
  "document": {
    "$type": "blob",
    "ref": "bafkreipdf123",
    "mimeType": "application/pdf",
    "size": 1024000
  },
  "source": {
    "pdsEndpoint": "https://bsky.social",
    "recordUrl": "https://bsky.social/xrpc/com.atproto.repo.getRecord?...",
    "blobUrl": "https://bsky.social/xrpc/com.atproto.sync.getBlob?...",
    "lastVerifiedAt": "2024-01-15T10:05:00Z",
    "stale": false
  },
  "versions": [
    {
      "version": 1,
      "cid": "bafyreiabc123",
      "createdAt": "2024-01-15T10:00:00Z",
      "changelog": "Initial submission"
    }
  ],
  "metrics": {
    "views": 150,
    "downloads": 42,
    "endorsements": 5
  }
}
```

#### `pub.chive.eprint.listByAuthor`

Lists eprints by author DID.

**Request:**

```text
GET /xrpc/pub.chive.eprint.listByAuthor?did={did}&limit={n}&cursor={c}&sort={sort}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| did | string | Yes | Author's DID |
| limit | number | No | Max results (default: 20, max: 100) |
| cursor | string | No | Pagination cursor |
| sort | string | No | Sort order: "date" or "relevance" |

#### `pub.chive.eprint.searchSubmissions`

Full-text search across eprints.

**Request:**

```text
POST /xrpc/pub.chive.eprint.searchSubmissions
Content-Type: application/json

{
  "q": "quantum computing",
  "limit": 20,
  "cursor": "abc123",
  "facets": {
    "subject": "physics"
  }
}
```

### Graph endpoints

#### `pub.chive.graph.getField`

Retrieves a knowledge graph field by ID.

**Request:**

```text
GET /xrpc/pub.chive.graph.getField?id={fieldId}
```

#### `pub.chive.graph.searchAuthorities`

Searches authority records (controlled vocabulary).

**Request:**

```text
GET /xrpc/pub.chive.graph.searchAuthorities?query={q}&type={type}&status={status}
```

#### `pub.chive.graph.browseFaceted`

Browse eprints using PMEST faceted classification.

**Request:**

```text
GET /xrpc/pub.chive.graph.browseFaceted?facets.matter=physics&facets.time=2024
```

### Metrics endpoints

#### `pub.chive.metrics.getTrending`

Retrieves trending eprints.

**Request:**

```text
GET /xrpc/pub.chive.metrics.getTrending?window={24h|7d|30d}&limit={n}
```

---

## REST endpoints

### Eprints

| Method | Path                   | Description       |
| ------ | ---------------------- | ----------------- |
| GET    | `/api/v1/eprints`      | List eprints      |
| GET    | `/api/v1/eprints/:uri` | Get eprint by URI |

### Search

| Method | Path                       | Description    |
| ------ | -------------------------- | -------------- |
| GET    | `/api/v1/search?q={query}` | Search eprints |

### Health

| Method | Path      | Description     |
| ------ | --------- | --------------- |
| GET    | `/health` | Liveness probe  |
| GET    | `/ready`  | Readiness probe |

---

## ATProto compliance

### Critical requirements

Every API response MUST include:

1. **`source.pdsEndpoint`**: URL of the user's PDS
2. **`source.recordUrl`**: Direct URL to fetch record from PDS
3. **`source.lastVerifiedAt`**: When data was last synced from PDS
4. **`source.stale`**: Boolean indicating if data may be outdated (>7 days)

### BlobRef only

Documents are returned as BlobRefs, never inline data:

```json
{
  "document": {
    "$type": "blob",
    "ref": "bafkreipdf123",
    "mimeType": "application/pdf",
    "size": 1024000
  }
}
```

**Never:**

```json
{
  "document": {
    "data": "base64...", // FORBIDDEN
    "content": "..." // FORBIDDEN
  }
}
```

### No write operations

The API is read-only. These endpoints do NOT exist:

- `pub.chive.eprint.create`
- `pub.chive.eprint.update`
- `pub.chive.eprint.delete`
- `com.atproto.repo.uploadBlob`

Users create content in their PDSes directly. Chive indexes via firehose.

---

## Rate limiting

### Tiers

| Tier          | Limit        | Key        |
| ------------- | ------------ | ---------- |
| Anonymous     | 60 req/min   | IP address |
| Authenticated | 300 req/min  | User DID   |
| Admin         | 5000 req/min | User DID   |

### Response headers

```text
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1700000060
```

### Rate limited response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30

{
  "error": {
    "code": "RATE_LIMIT",
    "message": "Rate limit exceeded for anonymous tier",
    "requestId": "req_abc123",
    "retryAfter": 30
  }
}
```

### Bypassed endpoints

Health endpoints (`/health`, `/ready`) are not rate limited.

---

## Error handling

### Error response format

All errors follow Stripe/GitHub pattern:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "field": "email",
    "requestId": "req_abc123"
  }
}
```

### Error codes

| Code                   | HTTP Status | Description                  |
| ---------------------- | ----------- | ---------------------------- |
| `VALIDATION_ERROR`     | 400         | Invalid input                |
| `AUTHENTICATION_ERROR` | 401         | Invalid/missing token        |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions     |
| `NOT_FOUND`            | 404         | Resource not found           |
| `RATE_LIMIT`           | 429         | Rate limit exceeded          |
| `DATABASE_ERROR`       | 500         | Database operation failed    |
| `COMPLIANCE_ERROR`     | 500         | ATProto compliance violation |
| `INTERNAL_ERROR`       | 500         | Unexpected error             |

---

## Middleware stack

The middleware executes in order:

1. **Security Headers**: X-Content-Type-Options, X-Frame-Options, etc.
2. **CORS**: Cross-origin resource sharing
3. **Service Injection**: Injects services into context
4. **Request Context**: Generates request ID, timing, logging
5. **Authentication**: Optional DID-based auth
6. **Rate Limiting**: 4-tier Redis sliding window
7. **Error Handling**: ChiveError → HTTP response

---

## Adding new handlers

### 1. Define lexicon schema

Create the lexicon definition in `lexicons/pub/chive/{namespace}/{method}.json`:

```json
{
  "lexicon": 1,
  "id": "pub.chive.myFeature.getItem",
  "defs": {
    "main": {
      "type": "query",
      "parameters": {
        "type": "params",
        "required": ["id"],
        "properties": {
          "id": { "type": "string" },
          "limit": { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 }
        }
      },
      "output": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "required": ["id", "uri", "data"],
          "properties": {
            "id": { "type": "string" },
            "uri": { "type": "string", "format": "at-uri" },
            "data": { "type": "object" }
          }
        }
      }
    }
  }
}
```

### 2. Generate types

Run lexicon generation to create TypeScript types:

```bash
pnpm lexicon:generate
```

This generates types at `src/lexicons/generated/types/pub/chive/myFeature/getItem.ts`.

### 3. Create handler

```typescript
// src/api/handlers/xrpc/my-feature/getItem.ts
import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/myFeature/getItem.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const getItem: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const services = c.get('services');
    const logger = c.get('logger');

    logger.debug('Getting item', { id: params.id });

    const item = await services.myFeature.getItem(params.id);

    if (!item) {
      throw new NotFoundError('Item', params.id);
    }

    return {
      encoding: 'application/json',
      body: {
        id: item.id,
        uri: item.uri,
        data: item.data,
      },
    };
  },
};
```

### 4. Register handler

Export the handler from the namespace index:

```typescript
// src/api/handlers/xrpc/my-feature/index.ts
import { getItem } from './getItem.js';

export const myFeatureHandlers = {
  'pub.chive.myFeature.getItem': getItem,
};
```

Then register in the main handlers index:

```typescript
// src/api/handlers/xrpc/index.ts
import { myFeatureHandlers } from './my-feature/index.js';

export const allHandlers = {
  ...myFeatureHandlers,
  // ... other handlers
};
```

### XRPCMethod Interface

The `XRPCMethod` interface defines handler structure:

```typescript
interface XRPCMethod<TParams, TInput, TOutput> {
  type?: 'query' | 'procedure'; // Default: 'query'
  auth?: boolean | 'optional'; // Default: false
  handler: (ctx: XRPCContext<TParams, TInput>) => Promise<XRPCResponse<TOutput>>;
}

interface XRPCContext<TParams, TInput> {
  params: TParams; // Validated query parameters
  input: TInput | undefined; // Request body (procedures only)
  auth: AuthContext | null; // Authentication context
  c: Context<ChiveEnv>; // Hono context
}

interface XRPCResponse<T> {
  encoding: string; // 'application/json'
  body: T; // Response body
  headers?: Record<string, string>;
}
```

---

## Testing

### Unit tests

```bash
npm run test:unit -- tests/unit/api/
```

Test files:

- `tests/unit/api/middleware/*.test.ts`
- `tests/unit/api/handlers/**/*.test.ts`

### Integration tests

```bash
# Start test infrastructure
./scripts/start-test-stack.sh

# Run integration tests
npm run test:integration -- tests/integration/api/
```

Test files:

- `tests/integration/api/xrpc/*.test.ts`
- `tests/integration/api/rest/**/*.test.ts`
- `tests/integration/api/rate-limiting.test.ts`

### Compliance tests

```bash
npm run test:compliance
```

Test file: `tests/compliance/api-layer-compliance.test.ts`

**Compliance tests MUST pass at 100% for CI/CD.**

---

## Common issues

### 1. "source field missing in response"

Ensure handler returns source object:

```typescript
return {
  ...data,
  source: {
    pdsEndpoint: eprint.pdsUrl,
    recordUrl: buildRecordUrl(eprint),
    lastVerifiedAt: eprint.indexedAt.toISOString(),
    stale: isStale(eprint.indexedAt),
  },
};
```

### 2. "Rate limit headers not appearing"

Check middleware order in `server.ts`. Rate limiting must come after request context.

### 3. "Validation errors not formatted correctly"

Ensure `validateQuery`/`validateBody` middleware is applied to route.

### 4. "Context type errors"

Use proper ChiveEnv type:

```typescript
import type { Context } from 'hono';
import type { ChiveEnv } from '@/api/types/context.js';

export async function myHandler(c: Context<ChiveEnv>) {
  const services = c.get('services'); // Typed correctly
}
```

---

## Configuration

### Environment variables

| Variable                 | Description                                                   | Default                  |
| ------------------------ | ------------------------------------------------------------- | ------------------------ |
| `PORT`                   | Server port                                                   | 3000                     |
| `CORS_ORIGINS`           | Allowed CORS origins                                          | `http://localhost:*`     |
| `RATE_LIMIT_REDIS_URL`   | Redis URL for rate limiting                                   | `redis://localhost:6379` |
| `RATE_LIMIT_FAIL_MODE`   | Rate limiter behavior when Redis is down (`open` or `closed`) | `closed`                 |
| `STALENESS_THRESHOLD_MS` | Threshold for marking records as stale (milliseconds)         | `604800000` (7 days)     |
| `LOG_LEVEL`              | Logging level                                                 | `info`                   |

### Rate limit configuration

Edit `src/api/config.ts`:

```typescript
export const RATE_LIMITS = {
  anonymous: { maxRequests: 60, windowMs: 60_000 },
  authenticated: { maxRequests: 300, windowMs: 60_000 },
  admin: { maxRequests: 5000, windowMs: 60_000 },
} as const;
```

---

## OpenAPI documentation

Access interactive documentation at:

- `/docs` - Swagger UI
- `/openapi.json` - OpenAPI 3.1 spec

---

## Security notice

> **Placeholder implementations**
>
> The following security features are placeholder implementations pending full authentication integration:
>
> - **Token verification** (`src/api/middleware/auth.ts`): Currently only validates token structure and expiration, not cryptographic signatures. See `@todo` comments in code.
> - **Scope authorization** (`src/api/middleware/auth.ts`): Only admin scope is enforced; other scopes pass through.
> - **Rate limiter fail mode**: Configurable via `RATE_LIMIT_FAIL_MODE` env var. Default is `closed` (reject requests when Redis is down) for zero-trust compliance.
>
> For production deployments, ensure authentication and authorization features are completed.

---

## Next steps

- [Authentication and authorization](./authentication-authorization): auth flows and error handling
- [Core business services](./core-business-services): service layer that handlers delegate to
- [API reference](/api-reference/overview): full endpoint documentation
