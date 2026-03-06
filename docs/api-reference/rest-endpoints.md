# REST endpoints

The REST API provides a limited HTTP interface for web clients. Most functionality is available via [XRPC endpoints](./xrpc-endpoints).

## Base URL

```text
https://api.chive.pub/api/v1
```

## Authentication

Include your access token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJFUzI1NiIs...
```

## Content types

| Request            | Response           |
| ------------------ | ------------------ |
| `application/json` | `application/json` |

## Eprints

### Search eprints

```http
GET /api/v1/eprints
```

Search and filter eprints.

#### Query parameters

| Name     | Type    | Description                            |
| -------- | ------- | -------------------------------------- |
| `q`      | string  | Search query                           |
| `field`  | string  | Filter by field                        |
| `author` | string  | Filter by author DID                   |
| `from`   | string  | Start date (ISO 8601)                  |
| `to`     | string  | End date (ISO 8601)                    |
| `sort`   | string  | Sort: `relevance`, `date`, `citations` |
| `limit`  | integer | Results per page (max 100)             |
| `cursor` | string  | Pagination cursor                      |

#### Example

```bash
curl "https://api.chive.pub/api/v1/eprints?q=quantum+computing&field=cs.QC&limit=10"
```

### Get eprint

```http
GET /api/v1/eprints/:uri
```

Retrieve an eprint by its AT URI.

#### Path parameters

| Name  | Type   | Description        |
| ----- | ------ | ------------------ |
| `uri` | string | URL-encoded AT URI |

### Search (alias)

```http
GET /api/v1/search
```

Alternative endpoint for searching eprints. Accepts the same parameters as `GET /api/v1/eprints`.

---

## Authors

### Get author eprints

```http
GET /api/v1/authors/:did/eprints
```

List eprints by an author.

#### Path parameters

| Name  | Type   | Description |
| ----- | ------ | ----------- |
| `did` | string | Author DID  |

---

## Integrations

### Get eprint integrations

```http
GET /api/v1/eprints/:uri/integrations
```

Returns cached integration data from external platforms for an eprint. When no cached data exists, the endpoint fetches live from external APIs (GitHub, GitLab, Zenodo, Software Heritage) and caches the result for one hour.

#### Path parameters

| Name  | Type   | Description                      |
| ----- | ------ | -------------------------------- |
| `uri` | string | URL-encoded AT URI of the eprint |

#### Response

```json
{
  "eprintUri": "at://did:plc:abc123.../pub.chive.eprint.submission/3k5...",
  "github": [
    {
      "type": "github",
      "owner": "user",
      "repo": "repo-name",
      "url": "https://github.com/user/repo-name",
      "stars": 42,
      "forks": 8,
      "language": "Python",
      "description": "Repository description",
      "license": "MIT",
      "lastUpdated": "2025-01-15T10:30:00Z",
      "topics": ["machine-learning", "nlp"]
    }
  ],
  "gitlab": [
    {
      "type": "gitlab",
      "pathWithNamespace": "group/project",
      "name": "project",
      "url": "https://gitlab.com/group/project",
      "stars": 5,
      "forks": 2,
      "description": "Project description",
      "visibility": "public",
      "topics": ["data-science"],
      "lastActivityAt": "2025-01-10T08:00:00Z"
    }
  ],
  "zenodo": [
    {
      "type": "zenodo",
      "doi": "10.5281/zenodo.12345",
      "conceptDoi": "10.5281/zenodo.12340",
      "title": "Dataset Title",
      "url": "https://zenodo.org/records/12345",
      "resourceType": "dataset",
      "accessRight": "open",
      "version": "1.0.0",
      "stats": { "downloads": 150, "views": 500 }
    }
  ],
  "softwareHeritage": [
    {
      "type": "software-heritage",
      "originUrl": "https://github.com/user/repo-name",
      "archived": true,
      "lastVisit": "2025-01-12T14:00:00Z",
      "lastSnapshotSwhid": "swh:1:snp:abc123...",
      "browseUrl": "https://archive.softwareheritage.org/browse/origin/..."
    }
  ],
  "datasets": [
    {
      "type": "figshare",
      "doi": "10.6084/m9.figshare.12345",
      "title": "Supplementary Dataset",
      "url": "https://figshare.com/articles/12345",
      "description": "Dataset description"
    }
  ],
  "lastUpdated": "2025-01-15T10:30:00Z"
}
```

All integration arrays are optional and only present when corresponding links exist in the eprint's supplementary materials. Each integration type returns data specific to its platform.

---

## Pagination

REST endpoints use cursor-based pagination:

```json
{
  "results": [...],
  "cursor": "abc123..."
}
```

Include the cursor in subsequent requests to fetch the next page.

## Error responses

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Eprint not found",
    "details": {
      "uri": "at://did:plc:abc123..."
    }
  }
}
```

### HTTP status codes

| Status | Meaning      |
| ------ | ------------ |
| 200    | Success      |
| 400    | Bad request  |
| 401    | Unauthorized |
| 403    | Forbidden    |
| 404    | Not found    |
| 429    | Rate limited |
| 500    | Server error |

## Rate limits

Rate limits apply per IP or per user:

| Tier          | Requests/minute |
| ------------- | --------------- |
| Anonymous     | 60              |
| Authenticated | 300             |

## Additional functionality

For full API functionality including reviews, endorsements, governance, backlinks, and discovery, use the [XRPC endpoints](./xrpc-endpoints).

## Health endpoints

Health check endpoints for monitoring and orchestration:

### Liveness probe

```http
GET /health/liveness
```

Returns 200 if the service is running.

### Readiness probe

```http
GET /health/readiness
```

Returns 200 if the service is ready to handle requests. Checks database connections and cache availability.

### Well-known endpoints

```http
GET /.well-known/did.json
```

Returns the service DID document for ATProto identity verification.

## OpenAPI specification

The complete OpenAPI 3.1 specification is available at:

```text
https://api.chive.pub/openapi.json
```

## Next steps

- [XRPC endpoints](./xrpc-endpoints): Full AT Protocol native API
- [Authentication](./authentication): Auth flows and tokens
- [API overview](./overview): General API information
