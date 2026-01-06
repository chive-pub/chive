# Searching for Preprints

Chive provides full-text search and faceted filtering to help you discover relevant preprints.

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

- `title:` - Preprint title
- `abstract:` - Preprint abstract
- `author:` - Author name
- `keyword:` - Author-provided keywords
- `field:` - Knowledge graph field

## Faceted Filtering

Click "Filters" to open the facet panel. Facets narrow results without changing the search query.

### Available Facets

**Field**: Select one or more fields from the knowledge graph hierarchy.

**Date Range**: Filter by submission date (e.g., last week, last month, custom range).

**Status**: Filter by preprint status (under review, endorsed, published).

**Author Affiliation**: Filter by institutional affiliation when available.

## Sorting Results

Results can be sorted by:

- **Relevance** (default): Text match score combined with citation signals
- **Date (newest)**: Most recent submissions first
- **Date (oldest)**: Earliest submissions first
- **Citations**: Most cited preprints first

## Saved Searches

Sign in to save frequently used searches. Saved searches appear in your dashboard and can trigger email notifications when new preprints match.

## Search Tips

1. Start broad, then narrow with facets
2. Use field prefixes for precise queries
3. Check spelling; the search suggests corrections
4. Browse related fields for serendipitous discovery

## API Access

Developers can access search via the REST API. See the [API Reference](../api-reference/rest-endpoints) for endpoint documentation.
