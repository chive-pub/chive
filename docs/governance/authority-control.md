# Authority control

Authority control ensures consistency in the knowledge graph by maintaining canonical records for concepts, people, and organizations. This document covers how authority records are managed and synchronized with external vocabularies.

## What is authority control?

Authority control links variant names and spellings to a single canonical concept:

```
User searches: "machine learning"
             → Matches authority record: "Machine Learning"
             → Includes aliases: "ML", "statistical learning"
             → Links to: Wikidata Q2539, LCSH sh85079324
```

This prevents fragmentation where "machine learning", "Machine Learning", and "ML" become separate concepts.

## Authority record structure

```typescript
interface AuthorityRecord {
  id: string; // Canonical identifier
  type: 'field' | 'person' | 'organization' | 'concept';
  name: string; // Preferred name
  aliases: string[]; // Alternative names
  description: string; // Scope note

  // Relationships
  broaderTerms: string[]; // Parent concepts
  narrowerTerms: string[]; // Child concepts
  relatedTerms: string[]; // Associated concepts

  // External links
  externalIds: {
    wikidata?: string; // Q-identifier
    lcsh?: string; // Library of Congress
    viaf?: string; // Virtual International Authority File
    fast?: string; // Faceted Application of Subject Terminology
    orcid?: string; // For person records
    ror?: string; // For organization records
  };

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string; // DID of creator
  source: 'manual' | 'reconciliation' | 'import';
}
```

## Authority editors

Authority editors are library science professionals responsible for maintaining authority records:

### Qualifications

| Requirement     | Description                           |
| --------------- | ------------------------------------- |
| **Education**   | MLIS, MLS, or equivalent degree       |
| **Experience**  | 2+ years cataloging or metadata work  |
| **Knowledge**   | Familiarity with LCSH, FAST, Wikidata |
| **Appointment** | Governance committee approval         |

### Responsibilities

- Create and maintain authority records
- Reconcile with external vocabularies
- Review authority-related proposals
- Train community on authority standards
- Vote on authority changes (4.5x weight)

### Current authority editors

Authority editors are listed publicly:

```http
GET /xrpc/pub.chive.governance.listAuthorityEditors
```

## External vocabulary integration

Chive synchronizes with external knowledge bases:

| Vocabulary   | Type                                       | Sync frequency |
| ------------ | ------------------------------------------ | -------------- |
| **Wikidata** | General knowledge graph                    | Daily          |
| **LCSH**     | Library of Congress Subject Headings       | Monthly        |
| **VIAF**     | Virtual International Authority File       | Monthly        |
| **FAST**     | Faceted Application of Subject Terminology | Monthly        |
| **ROR**      | Research Organization Registry             | Weekly         |
| **ORCID**    | Researcher identifiers                     | Real-time      |

### Reconciliation process

```
Local term → Wikidata API → Candidate matches
                                   │
                                   ▼
                           Confidence score
                           ├── High (>0.9): Auto-link
                           ├── Medium (0.7-0.9): Editor review
                           └── Low (<0.7): Manual reconciliation
```

### Evidence quality tiers

Reconciliations are scored by evidence quality:

| Tier           | Score | Evidence type                       |
| -------------- | ----- | ----------------------------------- |
| **Definitive** | 1.0   | Exact identifier match (DOI, ORCID) |
| **Strong**     | 0.9   | Multiple corroborating sources      |
| **Moderate**   | 0.7   | Single authoritative source         |
| **Weak**       | 0.5   | Name match only                     |
| **Tentative**  | 0.3   | Partial match, needs review         |

## Managing authority records

### Creating a record

Only authority editors can create records directly. Community members propose via the standard proposal process:

```json
{
  "type": "create_authority",
  "title": "Add authority record for MIT CSAIL",
  "changes": {
    "record": {
      "type": "organization",
      "name": "MIT Computer Science and Artificial Intelligence Laboratory",
      "aliases": ["MIT CSAIL", "CSAIL"],
      "externalIds": {
        "wikidata": "Q1500407",
        "ror": "03fmab257"
      }
    }
  }
}
```

### Updating a record

Changes to existing records follow the proposal process with a 60% threshold:

| Change type           | Threshold    | Approver                  |
| --------------------- | ------------ | ------------------------- |
| Add alias             | 60%, 3 votes | Community                 |
| Update description    | 60%, 3 votes | Community                 |
| Link external ID      | 60%, 3 votes | Authority editor review   |
| Change preferred name | 75%, 5 votes | Authority editor approval |
| Merge records         | 75%, 7 votes | Authority editor approval |

### Merging records

When duplicate records are discovered:

1. Authority editor identifies duplicates
2. Proposal created with merge rationale
3. Community votes (75% threshold)
4. If approved, records merged:
   - Keep record with more usage
   - Combine aliases
   - Preserve all external links
   - Redirect old ID to merged record

## Reconciliation workflow

### Monthly sync protocol

```
Day 1-3:   Fetch updates from external sources
Day 4-7:   Run automated reconciliation
Day 8-14:  Authority editors review flagged items
Day 15-20: Community proposal period for new links
Day 21-28: Voting on proposals
Day 28+:   Changes enacted
```

### Handling conflicts

When external sources disagree:

| Conflict type               | Resolution                                      |
| --------------------------- | ----------------------------------------------- |
| **Name variants**           | Use most authoritative source's preferred form  |
| **Scope differences**       | Document scope notes from each source           |
| **Hierarchy disagreements** | Follow LCSH for subjects, ROR for organizations |
| **Identifier conflicts**    | Flag for authority editor review                |

## Quality assurance

### Validation rules

Authority records must pass validation:

```typescript
function validateAuthority(record: AuthorityRecord): ValidationResult {
  const errors: string[] = [];

  if (!record.name || record.name.length < 2) {
    errors.push('Name required (min 2 characters)');
  }

  if (record.aliases.some((a) => a === record.name)) {
    errors.push('Alias cannot match preferred name');
  }

  if (record.type === 'person' && !record.externalIds.orcid) {
    errors.push('Person records should have ORCID when available');
  }

  // Check for circular relationships
  if (hasCircularRelationship(record)) {
    errors.push('Circular broader/narrower relationship detected');
  }

  return { valid: errors.length === 0, errors };
}
```

### Audit trail

All changes to authority records are logged:

```json
{
  "recordId": "authority-123",
  "action": "update",
  "changes": {
    "aliases": {
      "added": ["ML"],
      "removed": []
    }
  },
  "actor": "did:plc:editor...",
  "timestamp": "2025-01-15T10:30:00Z",
  "proposal": "proposal-456"
}
```

## API endpoints

### Search authorities

```http
GET /xrpc/pub.chive.graph.searchAuthorities?query=machine+learning&type=field
```

### Get authority

```http
GET /xrpc/pub.chive.graph.getAuthority?id=authority-123
```

### Get reconciliations

```http
GET /xrpc/pub.chive.graph.getAuthorityReconciliations?id=authority-123
```

## Next steps

- [Governance PDS](./governance-pds.md): Where authority records are stored
- [Proposals](./proposals.md): How to propose authority changes
- [Knowledge graph](/concepts/knowledge-graph): How authorities fit into the taxonomy
