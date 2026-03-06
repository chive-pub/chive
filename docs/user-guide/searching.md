# Searching for eprints

Chive provides full-text search and faceted filtering to help you discover relevant eprints.

## Basic search

Enter keywords in the search box on any page. Results are ranked by relevance using text matching, citation count, and recency.

### Search syntax

| Operator     | Example                | Description           |
| ------------ | ---------------------- | --------------------- |
| Quotes       | `"machine learning"`   | Exact phrase match    |
| OR           | `quantum OR classical` | Match either term     |
| Minus        | `neural -network`      | Exclude term          |
| Field prefix | `author:Smith`         | Search specific field |

### Searchable fields

- `title:` - Eprint title
- `abstract:` - Eprint abstract
- `author:` - Author name
- `keyword:` - Author-provided keywords
- `field:` - Knowledge graph field

## Faceted filtering

Click "Filters" to open the facet panel. Facets narrow results without changing the search query.

### Available facets

**Field**: Select one or more fields from the knowledge graph hierarchy.

**Date range**: Filter by submission date (e.g., last week, last month, custom range).

**Publication status**: Filter by lifecycle stage (eprint, under review, accepted, in press, published).

**Author affiliation**: Filter by institutional affiliation when available.

## Sorting results

Results can be sorted by:

- **Relevance** (default): Text match score combined with citation signals
- **Recent**: Most recent submissions first
- **Citations**: Most cited eprints first

The API accepts a `sort` parameter with values `relevance` (default) or `recent`.

## Search tips

1. Start broad, then narrow with facets
2. Use field prefixes for precise queries
3. Check spelling; the search suggests corrections
4. Browse related fields for serendipitous discovery

## Author search

Find researchers who have eprints on Chive:

1. Go to **Authors** in the navigation
2. Enter a researcher's name or DID
3. Results show authors with Chive presence

### Author results include

- Display name and handle
- Avatar (from Bluesky profile)
- Number of eprints on Chive
- Links to their author profile page

### Search by DID

You can search directly by AT Protocol DID:

```text
did:plc:abc123xyz
```

This is useful when you know someone's identifier but not their handle.

## API access

Developers can access search via the REST API. See the [API reference](../api-reference/rest-endpoints) for endpoint documentation.

### Author search API

```http
GET /xrpc/pub.chive.author.searchAuthors?query=Smith&limit=10
```

Returns matching authors with handles, avatars, and Chive presence indicators.
