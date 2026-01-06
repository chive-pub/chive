# XRPC endpoints

This page documents all XRPC endpoints available in the Chive API. Endpoints are organized by namespace.

## Preprint namespace

Endpoints for querying preprint submissions.

### pub.chive.preprint.getSubmission

Retrieve a single preprint by its AT URI.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description            |
| ----- | ------ | -------- | ---------------------- |
| `uri` | string | Yes      | AT URI of the preprint |

**Response**

```json
{
  "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
  "cid": "bafyreib...",
  "author": {
    "did": "did:plc:abc123...",
    "handle": "alice.bsky.social",
    "displayName": "Alice Smith"
  },
  "record": {
    "title": "Novel Approach to Quantum Computing",
    "abstract": "We present a new method...",
    "authors": [...],
    "fields": ["cs.QC", "quant-ph"],
    "pdfBlob": {
      "$type": "blob",
      "ref": { "$link": "bafyreib..." },
      "mimeType": "application/pdf",
      "size": 1234567
    },
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "indexedAt": "2025-01-15T10:31:00Z",
  "metrics": {
    "views": 1234,
    "downloads": 456,
    "citations": 12
  }
}
```

### pub.chive.preprint.searchSubmissions

Search for preprints by query string.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name       | Type     | Required | Description                                  |
| ---------- | -------- | -------- | -------------------------------------------- |
| `query`    | string   | Yes      | Search query                                 |
| `fields`   | string[] | No       | Filter by field codes                        |
| `authors`  | string[] | No       | Filter by author DIDs                        |
| `dateFrom` | string   | No       | Start date (ISO 8601)                        |
| `dateTo`   | string   | No       | End date (ISO 8601)                          |
| `sortBy`   | string   | No       | Sort order: `relevance`, `date`, `citations` |
| `limit`    | integer  | No       | Results per page (default: 25, max: 100)     |
| `cursor`   | string   | No       | Pagination cursor                            |

**Response**

```json
{
  "submissions": [
    {
      "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
      "title": "Novel Approach to Quantum Computing",
      "authors": [...],
      "abstract": "We present...",
      "fields": ["cs.QC"],
      "indexedAt": "2025-01-15T10:31:00Z"
    }
  ],
  "cursor": "eyJvZmZzZXQiOjI1fQ=="
}
```

### pub.chive.preprint.listByAuthor

List preprints by a specific author.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name     | Type    | Required | Description                    |
| -------- | ------- | -------- | ------------------------------ |
| `author` | string  | Yes      | Author DID                     |
| `limit`  | integer | No       | Results per page (default: 25) |
| `cursor` | string  | No       | Pagination cursor              |

---

## Review namespace

Endpoints for peer reviews and comments.

### pub.chive.review.getThread

Get a review thread for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name    | Type    | Required | Description                        |
| ------- | ------- | -------- | ---------------------------------- |
| `uri`   | string  | Yes      | URI of the preprint or root review |
| `depth` | integer | No       | Thread depth (default: 6)          |

**Response**

```json
{
  "thread": {
    "uri": "at://did:plc:reviewer.../pub.chive.review.comment/abc...",
    "author": {
      "did": "did:plc:reviewer...",
      "handle": "bob.bsky.social"
    },
    "record": {
      "text": "This is an excellent contribution...",
      "subject": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
      "createdAt": "2025-01-16T14:00:00Z"
    },
    "replies": [...]
  }
}
```

### pub.chive.review.listForPreprint

List all reviews for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name     | Type    | Required | Description               |
| -------- | ------- | -------- | ------------------------- |
| `uri`    | string  | Yes      | Preprint URI              |
| `sortBy` | string  | No       | Sort: `recent`, `helpful` |
| `limit`  | integer | No       | Results per page          |
| `cursor` | string  | No       | Pagination cursor         |

---

## Endorsement namespace

Endpoints for formal endorsements.

### pub.chive.endorsement.getSummary

Get endorsement summary for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description  |
| ----- | ------ | -------- | ------------ |
| `uri` | string | Yes      | Preprint URI |

**Response**

```json
{
  "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
  "totalEndorsements": 15,
  "byContribution": {
    "methodology": 8,
    "writing": 5,
    "conceptualization": 12,
    "data_curation": 3
  },
  "endorsers": [
    {
      "did": "did:plc:endorser...",
      "handle": "expert.bsky.social",
      "contributions": ["methodology", "conceptualization"]
    }
  ]
}
```

### pub.chive.endorsement.listForPreprint

List all endorsements for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name     | Type    | Required | Description       |
| -------- | ------- | -------- | ----------------- |
| `uri`    | string  | Yes      | Preprint URI      |
| `limit`  | integer | No       | Results per page  |
| `cursor` | string  | No       | Pagination cursor |

### pub.chive.endorsement.getUserEndorsement

Get a specific user's endorsement for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

**Parameters**

| Name  | Type   | Required | Description                               |
| ----- | ------ | -------- | ----------------------------------------- |
| `uri` | string | Yes      | Preprint URI                              |
| `did` | string | No       | User DID (defaults to authenticated user) |

---

## Graph namespace

Endpoints for the knowledge graph.

### pub.chive.graph.getField

Get details for a specific field.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name | Type   | Required | Description      |
| ---- | ------ | -------- | ---------------- |
| `id` | string | Yes      | Field identifier |

**Response**

```json
{
  "id": "cs.QC",
  "name": "Quantum Computing",
  "description": "Research on quantum computation and information",
  "aliases": ["Quantum Computation", "QC"],
  "parentFields": ["cs", "quant-ph"],
  "childFields": ["cs.QC.error-correction", "cs.QC.algorithms"],
  "relatedFields": ["cs.CC", "quant-ph.theory"],
  "externalIds": {
    "wikidata": "Q339",
    "lcsh": "sh2008010405"
  },
  "preprintCount": 4523
}
```

### pub.chive.graph.listFields

List all fields with optional filtering.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name     | Type    | Required | Description            |
| -------- | ------- | -------- | ---------------------- |
| `parent` | string  | No       | Filter by parent field |
| `query`  | string  | No       | Search field names     |
| `limit`  | integer | No       | Results per page       |
| `cursor` | string  | No       | Pagination cursor      |

### pub.chive.graph.searchAuthorities

Search authority records.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name    | Type    | Required | Description                                       |
| ------- | ------- | -------- | ------------------------------------------------- |
| `query` | string  | Yes      | Search query                                      |
| `type`  | string  | No       | Authority type: `field`, `person`, `organization` |
| `limit` | integer | No       | Results per page                                  |

### pub.chive.graph.getAuthority

Get a specific authority record.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name | Type   | Required | Description         |
| ---- | ------ | -------- | ------------------- |
| `id` | string | Yes      | Authority record ID |

### pub.chive.graph.browseFaceted

Browse preprints using PMEST facets.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name          | Type     | Required | Description       |
| ------------- | -------- | -------- | ----------------- |
| `personality` | string[] | No       | Subject facets    |
| `matter`      | string[] | No       | Material facets   |
| `energy`      | string[] | No       | Process facets    |
| `space`       | string[] | No       | Geographic facets |
| `time`        | string[] | No       | Temporal facets   |
| `limit`       | integer  | No       | Results per page  |
| `cursor`      | string   | No       | Pagination cursor |

### pub.chive.graph.getFieldPreprints

Get preprints in a specific field.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name              | Type    | Required | Description          |
| ----------------- | ------- | -------- | -------------------- |
| `field`           | string  | Yes      | Field identifier     |
| `includeChildren` | boolean | No       | Include child fields |
| `sortBy`          | string  | No       | Sort order           |
| `limit`           | integer | No       | Results per page     |
| `cursor`          | string  | No       | Pagination cursor    |

### pub.chive.graph.getAuthorityReconciliations

Get reconciliation history for an authority record.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name | Type   | Required | Description         |
| ---- | ------ | -------- | ------------------- |
| `id` | string | Yes      | Authority record ID |

---

## Tag namespace

Endpoints for user-generated tags.

### pub.chive.tag.search

Search tags.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name    | Type    | Required | Description      |
| ------- | ------- | -------- | ---------------- |
| `query` | string  | Yes      | Search query     |
| `limit` | integer | No       | Results per page |

### pub.chive.tag.listForPreprint

List tags on a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description  |
| ----- | ------ | -------- | ------------ |
| `uri` | string | Yes      | Preprint URI |

### pub.chive.tag.getTrending

Get trending tags.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name     | Type    | Required | Description                         |
| -------- | ------- | -------- | ----------------------------------- |
| `period` | string  | No       | Time period: `day`, `week`, `month` |
| `limit`  | integer | No       | Number of tags                      |

### pub.chive.tag.getSuggestions

Get tag suggestions based on content.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name   | Type   | Required | Description     |
| ------ | ------ | -------- | --------------- |
| `uri`  | string | No       | Preprint URI    |
| `text` | string | No       | Text to analyze |

### pub.chive.tag.getDetail

Get details for a specific tag.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description |
| ----- | ------ | -------- | ----------- |
| `tag` | string | Yes      | Tag name    |

---

## Governance namespace

Endpoints for community governance.

### pub.chive.governance.listProposals

List governance proposals.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name     | Type    | Required | Description                                         |
| -------- | ------- | -------- | --------------------------------------------------- |
| `status` | string  | No       | Filter: `pending`, `voting`, `approved`, `rejected` |
| `type`   | string  | No       | Proposal type                                       |
| `limit`  | integer | No       | Results per page                                    |
| `cursor` | string  | No       | Pagination cursor                                   |

### pub.chive.governance.getProposal

Get details for a specific proposal.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name | Type   | Required | Description |
| ---- | ------ | -------- | ----------- |
| `id` | string | Yes      | Proposal ID |

**Response**

```json
{
  "id": "proposal-123",
  "type": "create_field",
  "status": "voting",
  "proposer": {
    "did": "did:plc:proposer...",
    "handle": "researcher.bsky.social"
  },
  "title": "Add Quantum Machine Learning field",
  "description": "Propose adding QML as a subfield of both...",
  "changes": {
    "fieldName": "Quantum Machine Learning",
    "parentFields": ["cs.QC", "cs.LG"]
  },
  "votes": {
    "approve": 12,
    "reject": 3,
    "weightedApprove": 28.5,
    "weightedReject": 4.5
  },
  "threshold": 0.67,
  "createdAt": "2025-01-10T09:00:00Z",
  "votingEndsAt": "2025-01-17T09:00:00Z"
}
```

### pub.chive.governance.listVotes

List votes on a proposal.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name         | Type    | Required | Description       |
| ------------ | ------- | -------- | ----------------- |
| `proposalId` | string  | Yes      | Proposal ID       |
| `limit`      | integer | No       | Results per page  |
| `cursor`     | string  | No       | Pagination cursor |

### pub.chive.governance.getUserVote

Get the authenticated user's vote on a proposal.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

**Parameters**

| Name         | Type   | Required | Description |
| ------------ | ------ | -------- | ----------- |
| `proposalId` | string | Yes      | Proposal ID |

### pub.chive.governance.getPendingCount

Get count of pending proposals.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

---

## Metrics namespace

Endpoints for analytics and engagement metrics.

### pub.chive.metrics.getMetrics

Get metrics for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description  |
| ----- | ------ | -------- | ------------ |
| `uri` | string | Yes      | Preprint URI |

**Response**

```json
{
  "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
  "views": 12453,
  "downloads": 3421,
  "citations": 45,
  "endorsements": 23,
  "reviews": 8,
  "shares": 156,
  "history": {
    "views": [
      { "date": "2025-01-14", "count": 234 },
      { "date": "2025-01-15", "count": 456 }
    ]
  }
}
```

### pub.chive.metrics.getViewCount

Get view count for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description  |
| ----- | ------ | -------- | ------------ |
| `uri` | string | Yes      | Preprint URI |

### pub.chive.metrics.getTrending

Get trending preprints.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name     | Type    | Required | Description                         |
| -------- | ------- | -------- | ----------------------------------- |
| `period` | string  | No       | Time period: `day`, `week`, `month` |
| `field`  | string  | No       | Filter by field                     |
| `limit`  | integer | No       | Number of results                   |

### pub.chive.metrics.recordView

Record a view event.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Optional         |

**Input**

```json
{
  "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
  "source": "search"
}
```

### pub.chive.metrics.recordDownload

Record a download event.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Optional         |

**Input**

```json
{
  "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
  "format": "pdf"
}
```

### pub.chive.metrics.recordSearchClick

Record a search result click.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Optional         |

**Input**

```json
{
  "query": "quantum computing",
  "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
  "position": 3
}
```

### pub.chive.metrics.recordDwellTime

Record time spent on a preprint.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Optional         |

**Input**

```json
{
  "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
  "durationMs": 45000
}
```

---

## Discovery namespace

Endpoints for personalized recommendations.

### pub.chive.discovery.getRecommendations

Get personalized recommendations for the authenticated user.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

**Parameters**

| Name     | Type    | Required | Description               |
| -------- | ------- | -------- | ------------------------- |
| `limit`  | integer | No       | Number of recommendations |
| `cursor` | string  | No       | Pagination cursor         |

**Response**

```json
{
  "recommendations": [
    {
      "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
      "title": "Advances in Quantum Error Correction",
      "reason": "Based on your reading history in quantum computing",
      "score": 0.92
    }
  ],
  "cursor": "eyJvZmZzZXQiOjIwfQ=="
}
```

### pub.chive.discovery.getSimilar

Get preprints similar to a given preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name    | Type    | Required | Description       |
| ------- | ------- | -------- | ----------------- |
| `uri`   | string  | Yes      | Preprint URI      |
| `limit` | integer | No       | Number of results |

### pub.chive.discovery.getCitations

Get citation graph for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name        | Type    | Required | Description               |
| ----------- | ------- | -------- | ------------------------- |
| `uri`       | string  | Yes      | Preprint URI              |
| `direction` | string  | No       | `citing`, `cited`, `both` |
| `limit`     | integer | No       | Number of results         |

### pub.chive.discovery.getEnrichment

Get enriched metadata for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description  |
| ----- | ------ | -------- | ------------ |
| `uri` | string | Yes      | Preprint URI |

### pub.chive.discovery.recordInteraction

Record a user interaction for recommendation training.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Required         |

**Input**

```json
{
  "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
  "type": "click",
  "context": "recommendations"
}
```

---

## Claiming namespace

Endpoints for authorship claims.

### pub.chive.claiming.startClaim

Start a new authorship claim.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Required         |

**Input**

```json
{
  "preprintUri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5...",
  "authorPosition": 1,
  "orcid": "0000-0002-1825-0097"
}
```

### pub.chive.claiming.getClaim

Get details of a claim.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

**Parameters**

| Name | Type   | Required | Description |
| ---- | ------ | -------- | ----------- |
| `id` | string | Yes      | Claim ID    |

### pub.chive.claiming.completeClaim

Complete a pending claim with verification.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Required         |

### pub.chive.claiming.collectEvidence

Collect evidence for a claim.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Required         |

### pub.chive.claiming.approveClaim

Approve a claim (moderator only).

| Property | Value                |
| -------- | -------------------- |
| Method   | Procedure (POST)     |
| Auth     | Required (moderator) |

### pub.chive.claiming.rejectClaim

Reject a claim (moderator only).

| Property | Value                |
| -------- | -------------------- |
| Method   | Procedure (POST)     |
| Auth     | Required (moderator) |

### pub.chive.claiming.getUserClaims

Get claims for the authenticated user.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

### pub.chive.claiming.findClaimable

Find preprints claimable by the user.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

### pub.chive.claiming.autocomplete

Autocomplete for claim search.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

### pub.chive.claiming.searchPreprints

Search preprints for claiming.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

### pub.chive.claiming.getSuggestions

Get claim suggestions for the user.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

### pub.chive.claiming.startClaimFromExternal

Start a claim from an external identifier.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Required         |

### pub.chive.claiming.getPendingClaims

Get pending claims (moderator only).

| Property | Value                |
| -------- | -------------------- |
| Method   | Query (GET)          |
| Auth     | Required (moderator) |

---

## Backlink namespace

Endpoints for AT Protocol app references.

### pub.chive.backlink.list

List backlinks for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name     | Type   | Required | Description          |
| -------- | ------ | -------- | -------------------- |
| `uri`    | string | Yes      | Preprint URI         |
| `source` | string | No       | Filter by source app |

### pub.chive.backlink.create

Create a backlink.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Required         |

### pub.chive.backlink.delete

Delete a backlink.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Required         |

### pub.chive.backlink.getCounts

Get backlink counts for a preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description  |
| ----- | ------ | -------- | ------------ |
| `uri` | string | Yes      | Preprint URI |

---

## Activity namespace

Endpoints for user activity.

### pub.chive.activity.getActivityFeed

Get the user's activity feed.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

### pub.chive.activity.logActivity

Log an activity event.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Required         |

### pub.chive.activity.getCorrelationMetrics

Get activity correlation metrics.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

### pub.chive.activity.markFailed

Mark an activity as failed.

| Property | Value            |
| -------- | ---------------- |
| Method   | Procedure (POST) |
| Auth     | Required         |

---

## Import namespace

Endpoints for importing from external sources.

### pub.chive.import.search

Search external sources for preprints.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

**Parameters**

| Name     | Type   | Required | Description                                    |
| -------- | ------ | -------- | ---------------------------------------------- |
| `query`  | string | Yes      | Search query                                   |
| `source` | string | No       | Source: `arxiv`, `semanticscholar`, `openalex` |

### pub.chive.import.exists

Check if an external preprint already exists.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name         | Type   | Required | Description                         |
| ------------ | ------ | -------- | ----------------------------------- |
| `externalId` | string | Yes      | External identifier (DOI, arXiv ID) |

### pub.chive.import.get

Get details for an external preprint.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name         | Type   | Required | Description         |
| ------------ | ------ | -------- | ------------------- |
| `externalId` | string | Yes      | External identifier |

---

## Actor namespace

Endpoints for user profiles and autocomplete.

### pub.chive.actor.getMyProfile

Get the authenticated user's profile.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

**Response**

```json
{
  "did": "did:plc:abc123...",
  "handle": "alice.bsky.social",
  "displayName": "Alice Smith",
  "orcid": "0000-0002-1825-0097",
  "affiliation": "MIT",
  "bio": "Quantum computing researcher",
  "preprintCount": 12,
  "endorsementCount": 45
}
```

### pub.chive.actor.autocompleteOrcid

Autocomplete ORCID lookup.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name    | Type   | Required | Description           |
| ------- | ------ | -------- | --------------------- |
| `query` | string | Yes      | Partial name or ORCID |

### pub.chive.actor.discoverAuthorIds

Discover external author identifiers.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Required    |

### pub.chive.actor.autocompleteAffiliation

Autocomplete institution names.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name    | Type   | Required | Description              |
| ------- | ------ | -------- | ------------------------ |
| `query` | string | Yes      | Partial institution name |

### pub.chive.actor.autocompleteKeyword

Autocomplete research keywords.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name    | Type   | Required | Description     |
| ------- | ------ | -------- | --------------- |
| `query` | string | Yes      | Partial keyword |

---

## Author namespace

Endpoints for public author profiles.

### pub.chive.author.getProfile

Get a public author profile.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description |
| ----- | ------ | -------- | ----------- |
| `did` | string | Yes      | Author DID  |

---

## Sync namespace

Endpoints for data synchronization.

### pub.chive.sync.checkStaleness

Check if indexed data is stale.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description |
| ----- | ------ | -------- | ----------- |
| `uri` | string | Yes      | Record URI  |

### pub.chive.sync.verify

Verify a record against PDS.

| Property | Value       |
| -------- | ----------- |
| Method   | Query (GET) |
| Auth     | Optional    |

**Parameters**

| Name  | Type   | Required | Description |
| ----- | ------ | -------- | ----------- |
| `uri` | string | Yes      | Record URI  |

### pub.chive.sync.refreshRecord

Force refresh a record from PDS.

| Property | Value              |
| -------- | ------------------ |
| Method   | Procedure (POST)   |
| Auth     | Required (service) |

**Input**

```json
{
  "uri": "at://did:plc:abc123.../pub.chive.preprint.submission/3k5..."
}
```

---

## Error codes

All endpoints may return these error codes:

| Code                | HTTP Status | Description              |
| ------------------- | ----------- | ------------------------ |
| `InvalidRequest`    | 400         | Malformed request        |
| `AuthRequired`      | 401         | Authentication needed    |
| `InvalidToken`      | 401         | Token invalid or expired |
| `Forbidden`         | 403         | Not authorized           |
| `RecordNotFound`    | 404         | Record doesn't exist     |
| `RateLimitExceeded` | 429         | Too many requests        |
| `InternalError`     | 500         | Server error             |

## Next steps

- [REST endpoints](./rest-endpoints.md): HTTP API reference
- [Authentication](./authentication.md): Auth flows and tokens
- [API overview](./overview.md): General API information
