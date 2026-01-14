# REST endpoints

The REST API provides a limited HTTP interface for web clients. Most functionality is available via [XRPC endpoints](./xrpc-endpoints.md).

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
| `limit`  | integer | Results per page (max 100)             |
| `cursor` | string  | Pagination cursor                      |

**Example**

```bash
curl "https://api.chive.pub/api/v1/eprints?q=quantum+computing&field=cs.QC&limit=10"
```

### Get eprint

```http
GET /api/v1/eprints/:uri
```

Retrieve an eprint by its AT URI.

**Path parameters**

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

**Path parameters**

| Name  | Type   | Description |
| ----- | ------ | ----------- |
| `did` | string | Author DID  |

---

## Integrations

### Get eprint integrations

```http
GET /api/v1/eprints/:uri/integrations
```

Get external integrations for an eprint (DOI, arXiv links, etc.).

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

For full API functionality including reviews, endorsements, governance, backlinks, and discovery, use the [XRPC endpoints](./xrpc-endpoints.md).

## OpenAPI specification

The complete OpenAPI 3.1 specification is available at:

```
https://api.chive.pub/openapi.json
```

## Next steps

- [XRPC endpoints](./xrpc-endpoints.md): Full AT Protocol native API
- [Authentication](./authentication.md): Auth flows and tokens
- [API overview](./overview.md): General API information
