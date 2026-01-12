# API reference

The Chive API provides programmatic access to eprints, reviews, endorsements, and the knowledge graph. This section documents both the XRPC (AT Protocol native) and REST interfaces.

## API styles

Chive exposes two API styles:

| Style    | Base path           | Use case                             |
| -------- | ------------------- | ------------------------------------ |
| **XRPC** | `/xrpc/pub.chive.*` | AT Protocol native, lexicon-defined  |
| **REST** | `/api/v1/*`         | Traditional HTTP, OpenAPI-documented |

Both provide access to the same functionality. Choose based on your client requirements.

## Quick start

### Fetch a eprint (XRPC)

```bash
curl "https://api.chive.pub/xrpc/pub.chive.eprint.getSubmission?uri=at://did:plc:abc123.../pub.chive.eprint.submission/3k5..."
```

### Search eprints (REST)

```bash
curl "https://api.chive.pub/api/v1/eprints?q=quantum+computing&limit=10"
```

### Authenticated request

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.chive.pub/xrpc/pub.chive.discovery.getRecommendations"
```

## Documentation sections

| Section                               | Description                             |
| ------------------------------------- | --------------------------------------- |
| [Overview](./overview.md)             | Base URLs, rate limits, error handling  |
| [Authentication](./authentication.md) | OAuth flows, tokens, and authorization  |
| [XRPC endpoints](./xrpc-endpoints.md) | Complete XRPC reference (80+ endpoints) |
| [REST endpoints](./rest-endpoints.md) | HTTP API reference                      |

## OpenAPI specification

The full OpenAPI 3.1 specification is available at:

```
https://api.chive.pub/openapi.json
```

Use this for:

- Generating client libraries
- API exploration (Swagger UI, Postman)
- Type generation (`openapi-typescript`)

## SDKs

### TypeScript

```typescript
import { ChiveClient } from '@chive/api-client';

const client = new ChiveClient({
  baseUrl: 'https://api.chive.pub',
});

const eprint = await client.eprint.getSubmission({
  uri: 'at://did:plc:abc123.../pub.chive.eprint.submission/3k5...',
});
```

## Rate limits

| Tier          | Requests/minute |
| ------------- | --------------- |
| Anonymous     | 60              |
| Authenticated | 300             |
| Elevated      | 1000            |

## Next steps

Start with the [Overview](./overview.md) to understand the API structure, then explore specific endpoints in [XRPC endpoints](./xrpc-endpoints.md) or [REST endpoints](./rest-endpoints.md).
