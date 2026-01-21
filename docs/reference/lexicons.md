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
  "abstract": string,           // Required, max 5000 chars
  "document": BlobRef,          // Required, manuscript (PDF, DOCX, LaTeX, etc.)
  "documentFormat": string,     // Detected format (pdf, docx, latex, etc.)
  "authors": AuthorContribution[], // Required, 1-100 authors
  "submittedBy": string,        // Required, DID of submitter
  "license": string,            // Required, SPDX identifier
  "keywords": string[],         // Optional, max 20 keywords
  "facets": Facet[],            // Optional, faceted classification
  "supplementaryMaterials": SupplementaryItem[], // Optional, max 50
  "version": number,            // Version number
  "previousVersion": string,    // AT URI to previous version
  "createdAt": string           // Required, ISO 8601
}
```

See `lexicons/pub/chive/eprint/submission.json` for the complete schema.

### pub.chive.eprint.version

Version metadata for eprint revisions.

```typescript
{
  "$type": "pub.chive.eprint.version",
  "submission": StrongRef,      // Reference to submission
  "version": number,            // Version number (1, 2, 3...)
  "changelog": string,          // What changed
  "pdfBlob": BlobRef,           // Updated PDF
  "createdAt": string
}
```

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
