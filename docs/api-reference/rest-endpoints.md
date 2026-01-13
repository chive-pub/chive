# REST endpoints

The REST API provides a traditional HTTP interface for web clients. All endpoints are available under `/api/v1/`.

## Base URL

```
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

### Get eprint

```http
GET /api/v1/eprints/:encodedUri
```

Retrieve a eprint by its encoded AT URI.

**Path parameters**

| Name         | Type   | Description        |
| ------------ | ------ | ------------------ |
| `encodedUri` | string | URL-encoded AT URI |

**Example**

```bash
curl "https://api.chive.pub/api/v1/eprints/at%3A%2F%2Fdid%3Aplc%3Aabc123...%2Fpub.chive.eprint.submission%2F3k5..."
```

**Response**

```json
{
  "uri": "at://did:plc:abc123.../pub.chive.eprint.submission/3k5...",
  "title": "Novel Approach to Quantum Computing",
  "authors": [
    {
      "did": "did:plc:abc123...",
      "name": "Alice Smith",
      "orcid": "0000-0002-1825-0097"
    }
  ],
  "abstract": "We present a new method...",
  "fields": ["cs.QC", "quant-ph"],
  "pdf": {
    "url": "https://cdn.chive.pub/blobs/bafyreib...",
    "size": 1234567
  },
  "createdAt": "2025-01-15T10:30:00Z",
  "metrics": {
    "views": 1234,
    "downloads": 456,
    "citations": 12
  }
}
```

### Search eprints

```http
GET /api/v1/eprints
```

Search and filter eprints.

**Query parameters**

| Name     | Type    | Description                            |
| -------- | ------- | -------------------------------------- |
| `q`      | string  | Search query                           |
| `field`  | string  | Filter by field                        |
| `author` | string  | Filter by author DID                   |
| `from`   | string  | Start date (ISO 8601)                  |
| `to`     | string  | End date (ISO 8601)                    |
| `sort`   | string  | Sort: `relevance`, `date`, `citations` |
| `page`   | integer | Page number (1-indexed)                |
| `limit`  | integer | Results per page (max 100)             |

**Example**

```bash
curl "https://api.chive.pub/api/v1/eprints?q=quantum+computing&field=cs.QC&limit=10"
```

**Response**

```json
{
  "results": [...],
  "total": 1234,
  "page": 1,
  "pages": 124,
  "limit": 10
}
```

### Get eprint PDF

```http
GET /api/v1/eprints/:encodedUri/pdf
```

Redirect to the eprint PDF blob.

**Response**

302 redirect to blob URL.

### Get eprint metrics

```http
GET /api/v1/eprints/:encodedUri/metrics
```

Get engagement metrics for a eprint.

---

## Reviews

### Get reviews for eprint

```http
GET /api/v1/eprints/:encodedUri/reviews
```

List reviews for a eprint.

**Query parameters**

| Name    | Type    | Description               |
| ------- | ------- | ------------------------- |
| `sort`  | string  | Sort: `recent`, `helpful` |
| `page`  | integer | Page number               |
| `limit` | integer | Results per page          |

### Get review thread

```http
GET /api/v1/reviews/:encodedUri
```

Get a review and its replies.

---

## Endorsements

### Get endorsements for eprint

```http
GET /api/v1/eprints/:encodedUri/endorsements
```

List endorsements for a eprint.

### Get endorsement summary

```http
GET /api/v1/eprints/:encodedUri/endorsements/summary
```

Get aggregated endorsement data.

**Response**

```json
{
  "total": 15,
  "byContribution": {
    "methodology": 8,
    "writing": 5,
    "conceptualization": 12
  }
}
```

---

## Fields

### List fields

```http
GET /api/v1/fields
```

List all fields in the knowledge graph.

**Query parameters**

| Name     | Type   | Description            |
| -------- | ------ | ---------------------- |
| `parent` | string | Filter by parent field |
| `q`      | string | Search field names     |

### Get field

```http
GET /api/v1/fields/:id
```

Get details for a specific field.

**Response**

```json
{
  "id": "cs.QC",
  "name": "Quantum Computing",
  "description": "Research on quantum computation",
  "parentFields": ["cs"],
  "childFields": ["cs.QC.algorithms"],
  "eprintCount": 4523
}
```

### Get field eprints

```http
GET /api/v1/fields/:id/eprints
```

Get eprints in a field.

---

## Authors

### Get author profile

```http
GET /api/v1/authors/:did
```

Get a public author profile.

**Response**

```json
{
  "did": "did:plc:abc123...",
  "handle": "alice.bsky.social",
  "displayName": "Alice Smith",
  "affiliation": "MIT",
  "orcid": "0000-0002-1825-0097",
  "eprintCount": 12,
  "citationCount": 456
}
```

### Get author eprints

```http
GET /api/v1/authors/:did/eprints
```

List eprints by an author.

---

## Tags

### Search tags

```http
GET /api/v1/tags
```

Search and list tags.

**Query parameters**

| Name       | Type    | Description        |
| ---------- | ------- | ------------------ |
| `q`        | string  | Search query       |
| `trending` | boolean | Show trending tags |

### Get tag details

```http
GET /api/v1/tags/:tag
```

Get details for a specific tag.

---

## Discovery

### Get recommendations

```http
GET /api/v1/recommendations
```

Get personalized recommendations (requires auth).

**Query parameters**

| Name    | Type    | Description               |
| ------- | ------- | ------------------------- |
| `limit` | integer | Number of recommendations |

### Get similar eprints

```http
GET /api/v1/eprints/:encodedUri/similar
```

Get eprints similar to a given one.

### Get trending

```http
GET /api/v1/trending
```

Get trending eprints.

**Query parameters**

| Name     | Type   | Description                         |
| -------- | ------ | ----------------------------------- |
| `period` | string | Time period: `day`, `week`, `month` |
| `field`  | string | Filter by field                     |

---

## Governance

### List proposals

```http
GET /api/v1/governance/proposals
```

List governance proposals.

**Query parameters**

| Name     | Type   | Description             |
| -------- | ------ | ----------------------- |
| `status` | string | Filter by status        |
| `type`   | string | Filter by proposal type |

### Get proposal

```http
GET /api/v1/governance/proposals/:id
```

Get details for a proposal.

---

## User

### Get current user

```http
GET /api/v1/me
```

Get the authenticated user's profile.

### Get user activity

```http
GET /api/v1/me/activity
```

Get the user's activity feed.

### Get user claims

```http
GET /api/v1/me/claims
```

Get the user's authorship claims.

---

## Backlinks

### Get backlinks

```http
GET /api/v1/eprints/:encodedUri/backlinks
```

Get backlinks (AT Protocol app references) for a eprint.

**Response**

```json
{
  "backlinks": [
    {
      "source": "bsky.app",
      "uri": "at://did:plc:user.../app.bsky.feed.post/xyz...",
      "createdAt": "2025-01-16T12:00:00Z"
    }
  ],
  "counts": {
    "bsky.app": 23,
    "other": 5
  }
}
```

---

## Import

### Search external sources

```http
GET /api/v1/import/search
```

Search external sources (arXiv, Semantic Scholar).

**Query parameters**

| Name     | Type   | Description                        |
| -------- | ------ | ---------------------------------- |
| `q`      | string | Search query                       |
| `source` | string | Source: `arxiv`, `semanticscholar` |

### Check if exists

```http
GET /api/v1/import/exists
```

Check if an external eprint exists in Chive.

**Query parameters**

| Name    | Type   | Description |
| ------- | ------ | ----------- |
| `doi`   | string | DOI         |
| `arxiv` | string | arXiv ID    |

---

## Pagination

REST endpoints use page-based pagination:

```json
{
  "results": [...],
  "total": 1234,
  "page": 1,
  "pages": 124,
  "limit": 10
}
```

| Field   | Description              |
| ------- | ------------------------ |
| `total` | Total number of results  |
| `page`  | Current page (1-indexed) |
| `pages` | Total number of pages    |
| `limit` | Results per page         |

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
| 201    | Created      |
| 204    | No content   |
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

Headers included in responses:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1704412800
```

## OpenAPI specification

The complete OpenAPI 3.1 specification is available at:

```
https://api.chive.pub/openapi.json
```

Use this for code generation and API exploration.

## Next steps

- [XRPC endpoints](./xrpc-endpoints.md): AT Protocol native API
- [Authentication](./authentication.md): Auth flows and tokens
- [API overview](./overview.md): General API information
