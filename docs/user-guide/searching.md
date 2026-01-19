# Searching for Eprints

Chive provides full-text search and faceted filtering to help you discover relevant eprints.

## Basic Search

Enter keywords in the search box on any page. Results are ranked by relevance using text matching, citation count, and recency.

### Search Syntax

| Operator     | Example                | Description           |
| ------------ | ---------------------- | --------------------- |
| Quotes       | `"machine learning"`   | Exact phrase match    |
| OR           | `quantum OR classical` | Match either term     |
| Minus        | `neural -network`      | Exclude term          |
| Field prefix | `author:Smith`         | Search specific field |

### Searchable Fields

- `title:` - Eprint title
- `abstract:` - Eprint abstract
- `author:` - Author name
- `keyword:` - Author-provided keywords
- `field:` - Knowledge graph field

## Faceted Filtering

Click "Filters" to open the facet panel. Facets narrow results without changing the search query.

### Available Facets

**Field**: Select one or more fields from the knowledge graph hierarchy.

**Date Range**: Filter by submission date (e.g., last week, last month, custom range).

**Publication Status**: Filter by lifecycle stage (eprint, under review, accepted, in press, published).

**Author Affiliation**: Filter by institutional affiliation when available.

## Sorting Results

Results can be sorted by:

- **Relevance** (default): Text match score combined with citation signals
- **Date (newest)**: Most recent submissions first
- **Date (oldest)**: Earliest submissions first
- **Citations**: Most cited eprints first

## Search Tips

1. Start broad, then narrow with facets
2. Use field prefixes for precise queries
3. Check spelling; the search suggests corrections
4. Browse related fields for serendipitous discovery

## Author Search

Find researchers who have eprints on Chive:

1. Go to **Authors** in the navigation
2. Enter a researcher's name or DID
3. Results show authors with Chive presence

### Author Results Include

- Display name and handle
- Avatar (from Bluesky profile)
- Number of eprints on Chive
- Links to their author profile page

### Search by DID

You can search directly by AT Protocol DID:

```
did:plc:abc123xyz
```

This is useful when you know someone's identifier but not their handle.

## API Access

Developers can access search via the REST API. See the [API Reference](../api-reference/rest-endpoints) for endpoint documentation.

### Author Search API

```http
GET /xrpc/pub.chive.author.searchAuthors?query=Smith&limit=10
```

Returns matching authors with handles, avatars, and Chive presence indicators.
