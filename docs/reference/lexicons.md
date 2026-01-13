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

User-contributed tag on a eprint.

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

Formal endorsement of a eprint.

```typescript
{
  "$type": "pub.chive.review.endorsement",
  "subject": StrongRef,         // Reference to eprint
  "endorsementType": EndorsementType,
  "statement": string,          // Optional, max 500 chars
  "createdAt": string
}

type EndorsementType =
  | "overall"                   // General endorsement
  | "methodology"               // Sound methodology
  | "results"                   // Verified results
  | "reproducibility"           // Reproducible
  | "writing"                   // Well-written
  | "novelty"                   // Novel contribution
  | "significance";             // Significant impact
```

## Graph lexicons

### pub.chive.graph.fieldProposal

Proposal to add or modify a field.

```typescript
{
  "$type": "pub.chive.graph.fieldProposal",
  "type": ProposalType,
  "title": string,              // Max 200 chars
  "description": string,        // Max 2000 chars
  "changes": FieldChanges,
  "createdAt": string
}

type ProposalType = "create" | "update" | "merge" | "deprecate";

interface FieldChanges {
  fieldId?: string;             // For create/update
  name?: string;
  parent?: string;
  description?: string;
  mergeInto?: string;           // For merge
  deprecationReason?: string;   // For deprecate
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

### pub.chive.graph.authorityRecord

Authority record for controlled vocabulary (stored in Governance PDS).

```typescript
{
  "$type": "pub.chive.graph.authorityRecord",
  "id": string,
  "type": "field" | "person" | "organization" | "concept",
  "name": string,
  "aliases": string[],
  "description": string,
  "broaderTerms": string[],
  "narrowerTerms": string[],
  "relatedTerms": string[],
  "externalIds": {
    "wikidata": string,
    "lcsh": string,
    "viaf": string,
    "fast": string,
    "orcid": string,
    "ror": string
  },
  "createdAt": string,
  "updatedAt": string
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

### pub.chive.actor.discoverySettings

Discovery preferences.

```typescript
{
  "$type": "pub.chive.actor.discoverySettings",
  "recommendationDiversity": "low" | "medium" | "high",
  "excludeSources": string[],
  "languages": string[],
  "emailDigestFrequency": "never" | "daily" | "weekly"
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
| Aliases             | 20        |

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
