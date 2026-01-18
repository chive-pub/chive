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

Authority records use `pub.chive.graph.node` with an appropriate `subkind`. Relationships are stored as separate edge records.

```typescript
interface GraphNode {
  id: string; // Canonical identifier
  kind: 'type' | 'object'; // Node classification
  subkind: string; // 'field', 'person', 'institution', 'concept'
  label: string; // Preferred name
  alternateLabels: string[]; // Alternative names (synonyms)
  description: string; // Scope note
  externalIds: ExternalId[]; // Links to external vocabularies
  status: NodeStatus;
  createdAt: string;
  updatedAt: string;
}

interface ExternalId {
  source: string; // 'wikidata', 'lcsh', 'viaf', 'fast', 'orcid', 'ror'
  value: string;
}

type NodeStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

// Relationships are stored as separate edge records
interface GraphEdge {
  sourceUri: string; // AT URI of source node
  targetUri: string; // AT URI of target node
  relationSlug: string; // 'broader', 'narrower', 'related', 'sameAs'
  weight: number;
  status: string;
}
```

## Graph editors

Graph editors are responsible for maintaining knowledge graph nodes (including authority records):

### Qualifications

| Requirement     | Description                           |
| --------------- | ------------------------------------- |
| **Knowledge**   | Familiarity with LCSH, FAST, Wikidata |
| **Appointment** | Administrator approval                |

### Responsibilities

- Create and maintain knowledge graph nodes
- Reconcile with external vocabularies
- Review node and edge proposals
- Train community on authority standards
- Vote on graph changes (2.0x weight)

### Current graph editors

Graph editors are listed publicly:

```http
GET /xrpc/pub.chive.governance.listGraphEditors
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

Only graph editors can create records directly. Community members propose via the standard proposal process:

```json
{
  "$type": "pub.chive.graph.nodeProposal",
  "proposalType": "create",
  "kind": "object",
  "subkind": "institution",
  "proposedNode": {
    "id": "mit-csail",
    "label": "MIT Computer Science and Artificial Intelligence Laboratory",
    "alternateLabels": ["MIT CSAIL", "CSAIL"],
    "description": "Research laboratory at MIT focused on CS and AI",
    "externalIds": [
      { "source": "wikidata", "value": "Q1500407" },
      { "source": "ror", "value": "03fmab257" }
    ]
  },
  "rationale": "Major research institution frequently affiliated with Chive authors",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### Updating a record

Changes to existing records follow the proposal process with a 60% threshold:

| Change type         | Threshold    | Approver              |
| ------------------- | ------------ | --------------------- |
| Add alternate label | 60%, 3 votes | Community             |
| Update description  | 60%, 3 votes | Community             |
| Link external ID    | 60%, 3 votes | Graph editor review   |
| Change label        | 75%, 5 votes | Graph editor approval |
| Merge nodes         | 75%, 7 votes | Graph editor approval |

### Merging records

When duplicate records are discovered:

1. Graph editor identifies duplicates
2. Proposal created with merge rationale
3. Community votes (75% threshold)
4. If approved, nodes merged:
   - Keep node with more usage
   - Combine alternate labels
   - Preserve all external IDs
   - Redirect old ID to merged node

## Reconciliation workflow

### Monthly sync protocol

```
Day 1-3:   Fetch updates from external sources
Day 4-7:   Run automated reconciliation
Day 8-14:  Graph editors review flagged items
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
| **Identifier conflicts**    | Flag for graph editor review                    |

## Quality assurance

### Validation rules

Nodes must pass validation:

```typescript
function validateNode(node: GraphNode): ValidationResult {
  const errors: string[] = [];

  if (!node.label || node.label.length < 2) {
    errors.push('Label required (min 2 characters)');
  }

  if (node.alternateLabels?.some((a) => a === node.label)) {
    errors.push('Alternate label cannot match primary label');
  }

  if (node.subkind === 'person') {
    const hasOrcid = node.externalIds?.some((e) => e.source === 'orcid');
    if (!hasOrcid) {
      errors.push('Person nodes should have ORCID when available');
    }
  }

  return { valid: errors.length === 0, errors };
}
```

Edge validation checks for circular relationships separately via graph traversal.

### Audit trail

All changes to nodes are logged:

```json
{
  "nodeId": "quantum-computing",
  "action": "update",
  "changes": {
    "alternateLabels": {
      "added": ["QC"],
      "removed": []
    }
  },
  "actor": "did:plc:editor...",
  "timestamp": "2025-01-15T10:30:00Z",
  "proposal": "proposal-456"
}
```

## API endpoints

### Search nodes

```http
GET /xrpc/pub.chive.graph.searchNodes?query=machine+learning&subkind=field
```

### Get node

```http
GET /xrpc/pub.chive.graph.getNode?id=quantum-computing
```

### Get reconciliations

```http
GET /xrpc/pub.chive.graph.getNodeReconciliations?id=quantum-computing
```

## Next steps

- [Governance PDS](./governance-pds.md): Where authority records are stored
- [Proposals](./proposals.md): How to propose authority changes
- [Knowledge graph](/concepts/knowledge-graph): How authorities fit into the taxonomy
