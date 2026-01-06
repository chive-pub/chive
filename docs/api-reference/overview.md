# API overview

Chive exposes two API styles: XRPC (AT Protocol native) and REST (traditional HTTP). Both provide access to the same underlying functionality.

## API styles

### XRPC

XRPC (Cross-Server Remote Procedure Call) is the AT Protocol's native API style. Endpoints follow a namespaced pattern:

```
/xrpc/pub.chive.preprint.getSubmission?uri=at://did:plc:abc123.../pub.chive.preprint.submission/3k5...
```

XRPC characteristics:

| Aspect        | Description                               |
| ------------- | ----------------------------------------- |
| **Namespace** | `pub.chive.*` for all Chive endpoints     |
| **Schema**    | Defined by Lexicons (AT Protocol schemas) |
| **Methods**   | Query (GET) or Procedure (POST)           |
| **Encoding**  | JSON for data, CBOR for binary            |

### REST

REST endpoints provide a familiar HTTP API for web clients:

```
GET /api/v1/preprints/at:did:plc:abc123.../pub.chive.preprint.submission/3k5...
```

REST characteristics:

| Aspect         | Description                                  |
| -------------- | -------------------------------------------- |
| **Versioning** | `/api/v1/` prefix                            |
| **Methods**    | Standard HTTP verbs (GET, POST, PUT, DELETE) |
| **Encoding**   | JSON                                         |
| **OpenAPI**    | Full specification at `/openapi.json`        |

## Base URLs

| Environment | Base URL                        |
| ----------- | ------------------------------- |
| Production  | `https://api.chive.pub`         |
| Staging     | `https://api.staging.chive.pub` |
| Local dev   | `http://localhost:3000`         |

## Authentication

Chive supports three authentication methods:

| Method              | Use case               | Header                          |
| ------------------- | ---------------------- | ------------------------------- |
| **Bearer token**    | User sessions          | `Authorization: Bearer <token>` |
| **Service auth**    | Server-to-server       | `Authorization: Bearer <jwt>`   |
| **Unauthenticated** | Public read operations | (none)                          |

Most read operations work without authentication. Write operations and user-specific data require a valid session.

See [Authentication](./authentication.md) for details.

## Rate limiting

Rate limits protect the service and ensure fair usage:

| Tier          | Requests/minute | Applies to                         |
| ------------- | --------------- | ---------------------------------- |
| Anonymous     | 60              | Unauthenticated requests           |
| Authenticated | 300             | Normal users                       |
| Elevated      | 1000            | Verified researchers, institutions |
| Service       | 5000            | Server-to-server (approved apps)   |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1704412800
```

## Error handling

### Error response format

```json
{
  "error": "InvalidRequest",
  "message": "The 'uri' parameter is required",
  "details": {
    "field": "uri",
    "reason": "missing"
  }
}
```

### Common error codes

| HTTP Status | Error code          | Meaning                                 |
| ----------- | ------------------- | --------------------------------------- |
| 400         | `InvalidRequest`    | Malformed request or missing parameters |
| 401         | `AuthRequired`      | Authentication needed                   |
| 403         | `Forbidden`         | Authenticated but not authorized        |
| 404         | `NotFound`          | Resource doesn't exist                  |
| 429         | `RateLimitExceeded` | Too many requests                       |
| 500         | `InternalError`     | Server error                            |

### XRPC-specific errors

XRPC endpoints may return AT Protocol error codes:

| Error            | Meaning                             |
| ---------------- | ----------------------------------- |
| `InvalidToken`   | Session token is invalid or expired |
| `ExpiredToken`   | Token has expired; refresh required |
| `RecordNotFound` | The requested record doesn't exist  |
| `RepoNotFound`   | The DID's repository wasn't found   |

## Pagination

List endpoints use cursor-based pagination:

```http
GET /xrpc/pub.chive.preprint.searchSubmissions?query=quantum&limit=25

Response:
{
  "submissions": [...],
  "cursor": "eyJvZmZzZXQiOjI1fQ=="
}
```

To fetch the next page:

```http
GET /xrpc/pub.chive.preprint.searchSubmissions?query=quantum&limit=25&cursor=eyJvZmZzZXQiOjI1fQ==
```

Pagination parameters:

| Parameter | Type    | Default | Max      |
| --------- | ------- | ------- | -------- |
| `limit`   | integer | 25      | 100      |
| `cursor`  | string  | (none)  | (opaque) |

## AT URIs

Many endpoints accept or return AT URIs, which identify records in the AT Protocol:

```
at://did:plc:abc123.../pub.chive.preprint.submission/3k5xyzabc
     └──────┬───────┘  └───────────┬─────────────┘   └───┬────┘
          DID               Collection             Record Key
```

When passing AT URIs as URL parameters, encode them:

```
/xrpc/pub.chive.preprint.getSubmission?uri=at%3A%2F%2Fdid%3Aplc%3Aabc123...
```

## CORS

The API supports CORS for browser-based applications:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

## Content types

| Content-Type          | Usage                              |
| --------------------- | ---------------------------------- |
| `application/json`    | Default for all requests/responses |
| `application/cbor`    | Binary data (blobs)                |
| `multipart/form-data` | File uploads                       |

## Endpoint namespaces

XRPC endpoints are organized by namespace:

| Namespace                 | Purpose               | Endpoints |
| ------------------------- | --------------------- | --------- |
| `pub.chive.preprint.*`    | Preprint operations   | 4         |
| `pub.chive.review.*`      | Reviews and comments  | 2         |
| `pub.chive.endorsement.*` | Endorsements          | 3         |
| `pub.chive.graph.*`       | Knowledge graph       | 8         |
| `pub.chive.tag.*`         | User tags             | 5         |
| `pub.chive.governance.*`  | Proposals and voting  | 5         |
| `pub.chive.metrics.*`     | Analytics             | 7         |
| `pub.chive.discovery.*`   | Recommendations       | 5         |
| `pub.chive.claiming.*`    | Authorship claims     | 12        |
| `pub.chive.backlink.*`    | AT Protocol app links | 4         |
| `pub.chive.activity.*`    | User activity         | 4         |
| `pub.chive.import.*`      | External imports      | 3         |
| `pub.chive.actor.*`       | User profiles         | 5         |
| `pub.chive.author.*`      | Author profiles       | 1         |
| `pub.chive.sync.*`        | Data synchronization  | 3         |

See [XRPC endpoints](./xrpc-endpoints.md) for the complete reference.

## OpenAPI specification

The full OpenAPI 3.1 specification is available at:

```
https://api.chive.pub/openapi.json
```

Use this for:

- Generating client libraries
- API exploration tools (Swagger UI, Postman)
- Type generation (openapi-typescript)

## SDKs and clients

### TypeScript/JavaScript

```typescript
import { ChiveClient } from '@chive/api-client';

const client = new ChiveClient({
  baseUrl: 'https://api.chive.pub',
  token: 'your-session-token',
});

const preprint = await client.preprint.getSubmission({
  uri: 'at://did:plc:abc123.../pub.chive.preprint.submission/3k5...',
});
```

### Generated types

Frontend types are auto-generated from the OpenAPI spec:

```bash
# Regenerate types after API changes
pnpm openapi:generate
```

Generated files:

- `web/lib/api/schema.generated.ts`: Path types (auto-generated)
- `web/lib/api/schema.d.ts`: Domain types (manually maintained)
- `web/lib/api/client.ts`: Typed API client

## Quick examples

### Fetch a preprint

```bash
curl "https://api.chive.pub/xrpc/pub.chive.preprint.getSubmission?uri=at://did:plc:abc123.../pub.chive.preprint.submission/3k5..."
```

### Search preprints

```bash
curl "https://api.chive.pub/xrpc/pub.chive.preprint.searchSubmissions?query=quantum+computing&limit=10"
```

### Get recommendations (authenticated)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.chive.pub/xrpc/pub.chive.discovery.getRecommendations?limit=20"
```

## Interactive API documentation

For detailed endpoint documentation with request/response examples and schemas, see the [Interactive API Reference](/api-docs/chive-api). This documentation is auto-generated from the OpenAPI specification and includes:

- Request parameters and body schemas
- Response schemas with examples
- Try-it-out functionality
- All 69 XRPC and REST endpoints

## Next steps

- [Authentication](./authentication.md): Session management and tokens
- [XRPC endpoints](./xrpc-endpoints.md): Endpoint overview by namespace
- [REST endpoints](./rest-endpoints.md): HTTP API patterns
- [Interactive API Reference](/api-docs/chive-api): Full endpoint details
