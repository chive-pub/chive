# Lexicons reference

Chive uses the `pub.chive.*` namespace for all AT Protocol lexicons. This reference documents all record types and their schemas.

## Namespace overview

| Namespace                | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `pub.chive.eprint.*`     | Eprint submissions and versions            |
| `pub.chive.review.*`     | Reviews and endorsements                   |
| `pub.chive.graph.*`      | Knowledge graph (fields, proposals, votes) |
| `pub.chive.actor.*`      | User profiles and settings                 |
| `pub.chive.tag.*`        | User-generated tags                        |
| `pub.chive.governance.*` | Governance records (in Governance PDS)     |

## Eprint lexicons

### pub.chive.eprint.submission

Core eprint record.

```typescript
{
  "$type": "pub.chive.eprint.submission",
  "title": string,              // Required, max 500 chars
  "abstract": RichAbstract[],   // Required, rich text with node refs
  "abstractPlainText": string,  // Auto-generated for search indexing
  "document": BlobRef,          // Required, manuscript (PDF, DOCX, LaTeX, etc.)
  "documentFormatSlug": string, // Detected format (pdf, docx, latex, etc.)
  "authors": AuthorContribution[], // Required, 1-100 authors
  "submittedBy": string,        // Required, DID of submitter
  "paperDid": string,           // Optional, DID of paper account (paper-centric model)
  "licenseSlug": string,        // Required, SPDX identifier
  "keywords": string[],         // Optional, max 20 keywords
  "fieldUris": string[],        // Optional, AT-URIs to field nodes
  "topicUris": string[],        // Optional, AT-URIs to topic nodes
  "facetUris": string[],        // Optional, AT-URIs to facet nodes
  "supplementaryMaterials": SupplementaryItem[], // Optional, max 50
  "version": SemanticVersion,   // Semantic version object
  "previousVersion": string,    // AT-URI to previous version
  "createdAt": string           // Required, ISO 8601
}
```

**SemanticVersion type:**

```typescript
interface SemanticVersion {
  major: number; // Major version (1+), fundamental revisions
  minor: number; // Minor version (0+), new content/additions
  patch: number; // Patch version (0+), corrections/fixes
  prerelease?: string; // Optional prerelease tag (e.g., "draft", "rc1")
}
```

See `lexicons/pub/chive/eprint/submission.json` for the complete schema.

### pub.chive.eprint.changelog

Structured changelog entry for eprint version updates.

```typescript
{
  "$type": "pub.chive.eprint.changelog",
  "eprintUri": string,          // Required, AT-URI of the eprint
  "version": SemanticVersion,   // Required, version this changelog describes
  "previousVersion": SemanticVersion, // Optional, previous version
  "summary": string,            // Optional, one-line summary, max 500 chars
  "sections": ChangelogSection[], // Required, structured changes, max 20
  "reviewerResponse": string,   // Optional, response to peer review, max 10000 chars
  "createdAt": string           // Required, ISO 8601
}
```

**ChangelogSection type:**

```typescript
interface ChangelogSection {
  category: string; // Category (kebab-case)
  items: ChangeItem[]; // Change items, max 50
}

interface ChangeItem {
  description: string; // Required, max 2000 chars
  changeType?: string; // "added" | "changed" | "removed" | "fixed" | "deprecated"
  location?: string; // Document location, max 100 chars
  reviewReference?: string; // Reviewer comment reference, max 200 chars
}
```

**Changelog categories:**

| Category                  | Description                 |
| ------------------------- | --------------------------- |
| `methodology`             | Changes to research methods |
| `results`                 | New or updated results      |
| `analysis`                | Data analysis changes       |
| `discussion`              | Discussion section updates  |
| `conclusions`             | Conclusion changes          |
| `data`                    | Data updates or corrections |
| `figures`                 | Figure changes              |
| `tables`                  | Table changes               |
| `references`              | Bibliography updates        |
| `supplementary-materials` | Supplementary file updates  |
| `corrections`             | Error corrections           |
| `formatting`              | Layout/formatting changes   |
| `language-editing`        | Grammar/style improvements  |
| `acknowledgments`         | Acknowledgment updates      |
| `authorship`              | Author list changes         |
| `other`                   | Other changes               |

### pub.chive.eprint.userTag

User-contributed tag on an eprint.

```typescript
{
  "$type": "pub.chive.eprint.userTag",
  "subject": StrongRef,         // Reference to eprint
  "tag": string,                // Tag text, max 50 chars
  "createdAt": string
}
```

## Eprint procedures

### pub.chive.eprint.updateSubmission

Authorize and prepare an eprint update.

```typescript
// Input
{
  "uri": string,                // Required, AT-URI of eprint
  "versionBump": string,        // Required, "major" | "minor" | "patch"
  "title": string,              // Optional, updated title
  "abstract": RichAbstract[],   // Optional, updated abstract
  "document": BlobRef,          // Optional, replacement document
  "keywords": string[],         // Optional, updated keywords
  "fieldUris": string[],        // Optional, updated field references
  "changelog": ChangelogInput   // Optional, structured changelog
}

// Output
{
  "uri": string,                // AT-URI of the eprint
  "version": SemanticVersion,   // New semantic version
  "expectedCid": string,        // CID for optimistic concurrency control
  "changelogUri": string        // Optional, AT-URI of created changelog record
}
```

The frontend uses `expectedCid` as the `swapRecord` parameter when calling `putRecord` to prevent race conditions.

### pub.chive.eprint.deleteSubmission

Authorize an eprint deletion.

```typescript
// Input
{
  "uri": string                 // Required, AT-URI of eprint to delete
}

// Output
{
  "success": boolean            // Whether deletion is authorized
}
```

## Review lexicons

### pub.chive.review.comment

Review comment or reply.

```typescript
{
  "$type": "pub.chive.review.comment",
  "eprintUri": string,          // Required, AT URI of reviewed eprint
  "content": string,            // Required, comment text, max 10000 chars
  "lineNumber": number,         // Optional, for inline comments
  "parentComment": string,      // Optional, AT URI of parent comment
  "createdAt": string           // Required, ISO 8601
}
```

### pub.chive.review.endorsement

Endorsement of contribution types in an eprint.

```typescript
{
  "$type": "pub.chive.review.endorsement",
  "eprintUri": string,            // Required, AT-URI of eprint being endorsed
  "contributions": string[],      // Required, 1-15 contribution types (no duplicates)
  "comment": string,              // Optional, max 5000 chars
  "createdAt": string             // Required, ISO 8601
}
```

**Contribution types** (based on CRediT taxonomy):

| Value               | Description              |
| ------------------- | ------------------------ |
| `methodological`    | Sound methodology        |
| `analytical`        | Analytical rigor         |
| `theoretical`       | Theoretical framework    |
| `empirical`         | Empirical approach       |
| `conceptual`        | Conceptualization        |
| `technical`         | Technical implementation |
| `data`              | Data quality/curation    |
| `replication`       | Replication study        |
| `reproducibility`   | Reproducible results     |
| `synthesis`         | Literature synthesis     |
| `interdisciplinary` | Cross-disciplinary work  |
| `pedagogical`       | Educational value        |
| `visualization`     | Data visualization       |
| `societal-impact`   | Societal relevance       |
| `clinical`          | Clinical applicability   |

## Graph lexicons

### pub.chive.graph.node

Node record for the knowledge graph.

```typescript
{
  "$type": "pub.chive.graph.node",
  "id": string,                 // Unique identifier
  "kind": "type" | "object",    // Node classification
  "subkind": string,            // "field", "facet", "institution", "person", "concept"
  "label": string,              // Display name
  "alternateLabels": string[],  // Synonyms (max 20)
  "description": string,        // Scope note (max 2000 chars)
  "externalIds": ExternalId[],  // Links to Wikidata, LCSH, etc.
  "status": NodeStatus,
  "createdAt": string,
  "updatedAt": string
}

type NodeStatus = "proposed" | "provisional" | "established" | "deprecated";

interface ExternalId {
  source: string;               // "wikidata", "lcsh", "viaf", "fast", "orcid", "ror"
  value: string;                // The external identifier
}
```

### pub.chive.graph.edge

Relationship between two nodes in the knowledge graph.

```typescript
{
  "$type": "pub.chive.graph.edge",
  "sourceUri": string,          // AT URI of source node
  "targetUri": string,          // AT URI of target node
  "relationSlug": EdgeRelation, // Relationship type
  "weight": number,             // Relationship strength (0.0-1.0)
  "status": EdgeStatus,
  "createdAt": string
}

type EdgeRelation = "broader" | "narrower" | "related" | "sameAs" | "partOf" | "hasPart";
type EdgeStatus = "proposed" | "established" | "deprecated";
```

### pub.chive.graph.nodeProposal

Proposal to create, update, merge, or deprecate a node.

```typescript
{
  "$type": "pub.chive.graph.nodeProposal",
  "proposalType": ProposalType,
  "kind": "type" | "object",
  "subkind": string,
  "proposedNode": ProposedNodeData,
  "rationale": string,          // Max 2000 chars
  "evidence": Evidence[],       // Supporting materials
  "createdAt": string
}

type ProposalType = "create" | "update" | "merge" | "deprecate";

interface ProposedNodeData {
  id?: string;                  // Required for update/merge/deprecate
  label?: string;
  alternateLabels?: string[];
  description?: string;
  externalIds?: ExternalId[];
  mergeIntoUri?: string;        // For merge proposals
  deprecationReason?: string;   // For deprecate proposals
}

interface Evidence {
  type: string;                 // "publication_count", "conference", "expert_endorsement"
  source?: string;
  value?: string | number;
  url?: string;
}
```

### pub.chive.graph.edgeProposal

Proposal to create, update, or deprecate an edge between nodes.

```typescript
{
  "$type": "pub.chive.graph.edgeProposal",
  "proposalType": "create" | "update" | "deprecate",
  "proposedEdge": ProposedEdgeData,
  "rationale": string,          // Max 2000 chars
  "createdAt": string
}

interface ProposedEdgeData {
  sourceUri: string;
  targetUri: string;
  relationSlug: EdgeRelation;
  weight?: number;
}
```

### pub.chive.graph.vote

Vote on a proposal.

```typescript
{
  "$type": "pub.chive.graph.vote",
  "proposal": StrongRef,        // Reference to proposal
  "vote": "approve" | "reject" | "abstain",
  "comment": string,            // Optional, max 500 chars
  "createdAt": string
}
```

## Actor lexicons

### pub.chive.actor.profile

Extended user profile.

```typescript
{
  "$type": "pub.chive.actor.profile",
  "bio": string,                // Max 1000 chars
  "orcid": string,              // ORCID iD
  "affiliation": string,
  "website": string,
  "researchInterests": string[],
  "fields": string[],           // Followed fields
  "publicEmail": string
}
```

### pub.chive.discovery.settings

Discovery preferences for personalized recommendations.

```typescript
{
  "$type": "pub.chive.discovery.settings",
  "enablePersonalization": boolean,
  "enableForYouFeed": boolean,
  "forYouSignals": {
    "fields": boolean,
    "citations": boolean,
    "collaborators": boolean,
    "trending": boolean
  },
  "relatedPapersSignals": {
    "citations": boolean,
    "topics": boolean
  },
  "citationNetworkDisplay": "hidden" | "preview" | "expanded",
  "showRecommendationReasons": boolean
}
```

## Common types

### StrongRef

Reference to another record.

```typescript
interface StrongRef {
  uri: string; // AT URI
  cid: string; // Content ID
}
```

### BlobRef

Reference to a blob.

```typescript
interface BlobRef {
  $type: 'blob';
  ref: {
    $link: string; // CID
  };
  mimeType: string;
  size: number;
}
```

## Validation rules

### String limits

| Field        | Max length |
| ------------ | ---------- |
| Title        | 500        |
| Abstract     | 5000       |
| Comment text | 10000      |
| Tag          | 50         |
| Bio          | 1000       |

### Array limits

| Field               | Max items |
| ------------------- | --------- |
| Authors             | 50        |
| Keywords            | 20        |
| Fields              | 5         |
| Supplementary blobs | 10        |
| Alternate labels    | 20        |

### Blob limits

| Type             | Max size   |
| ---------------- | ---------- |
| PDF              | 100 MB     |
| Supplementary    | 50 MB each |
| Total per record | 200 MB     |

## Versioning

Lexicons follow semantic versioning:

- **Major**: Breaking changes (new required fields, removed fields)
- **Minor**: Backwards-compatible additions (new optional fields)
- **Patch**: Bug fixes, documentation updates

Current versions:

| Lexicon              | Version |
| -------------------- | ------- |
| `pub.chive.eprint.*` | 1.0.0   |
| `pub.chive.review.*` | 1.0.0   |
| `pub.chive.graph.*`  | 1.0.0   |
| `pub.chive.actor.*`  | 1.0.0   |

## Related documentation

- [AT Protocol Concepts](../concepts/at-protocol.md): Protocol fundamentals
- [API Reference](../api-reference/xrpc-endpoints.md): XRPC endpoints
- [Data Sovereignty](../concepts/data-sovereignty.md): Where data lives
