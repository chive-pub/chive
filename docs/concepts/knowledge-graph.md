# Knowledge graph

Chive uses a community-curated knowledge graph to classify and connect scholarly works. This Wikipedia-style approach allows the research community to build and maintain a structured taxonomy of academic fields.

## Overview

The knowledge graph serves three purposes:

1. **Discovery**: Find related eprints through field classifications
2. **Context**: Understand how a work fits into broader research areas
3. **Navigation**: Browse eprints by field, subfield, or topic

```
                    ┌──────────────────┐
                    │   Mathematics    │
                    └────────┬─────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Algebra    │  │   Analysis   │  │   Geometry   │
    └──────┬───────┘  └──────────────┘  └──────────────┘
           │
    ┌──────┴──────┬──────────────┐
    ▼             ▼              ▼
┌────────┐  ┌──────────┐  ┌───────────┐
│ Group  │  │  Ring    │  │  Linear   │
│ Theory │  │  Theory  │  │  Algebra  │
└────────┘  └──────────┘  └───────────┘
```

## Field nodes

A **field node** represents an academic discipline, subdiscipline, or topic. Each field has:

| Property          | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `label`           | Human-readable name (e.g., "Algebraic Geometry")      |
| `description`     | Brief explanation of the field's scope                |
| `alternateLabels` | Alternative names (e.g., "Algebraic Geometry" = "AG") |
| `externalIds`     | Links to Wikidata, Library of Congress, etc.          |

Hierarchical and associative relationships are represented as **edges** rather than embedded arrays:

| Edge Relation | Description                             |
| ------------- | --------------------------------------- |
| `broader`     | Parent categories this field belongs to |
| `narrower`    | Child specializations within this field |
| `related`     | Fields with conceptual overlap          |

### Field relationships

Fields connect through three relationship types:

```
Broader/Narrower (hierarchical)
    Mathematics
        └── Algebra
              └── Group Theory

Related (conceptual overlap)
    Algebraic Topology ──related──► Algebraic Geometry

Cross-disciplinary
    Computational Linguistics
        ├── parent: Linguistics
        └── parent: Computer Science
```

## PMEST classification

Beyond hierarchical fields, Chive uses PMEST (Personality, Matter, Energy, Space, Time) faceted classification. This system allows filtering across orthogonal dimensions:

| Facet           | Meaning               | Example             |
| --------------- | --------------------- | ------------------- |
| **Personality** | Core subject          | "Quantum mechanics" |
| **Matter**      | Material or substance | "Carbon nanotubes"  |
| **Energy**      | Process or action     | "Oxidation"         |
| **Space**       | Geographic scope      | "Arctic regions"    |
| **Time**        | Temporal scope        | "Holocene"          |

A single eprint can be classified across multiple facets:

```
Eprint: "Climate-Driven Carbon Nanotube Degradation in Arctic Soils"

Facets:
  Personality: Environmental Chemistry, Materials Science
  Matter: Carbon nanotubes, Soil
  Energy: Degradation, Climate change
  Space: Arctic
  Time: Contemporary (2020-present)
```

### Facet search

Users can combine facets to narrow searches:

```
GET /xrpc/pub.chive.graph.browseFaceted?
  personality=materials-science&
  matter=carbon-nanotubes&
  space=arctic
```

## Authority records

Authority records ensure consistency across the knowledge graph. They're like library catalog entries for concepts, represented as `pub.chive.graph.node`:

```typescript
// Example: "Quantum Computing" node
{
  "$type": "pub.chive.graph.node",
  "id": "quantum-computing",
  "kind": "object",
  "subkind": "field",
  "label": "Quantum Computing",
  "alternateLabels": [
    "Quantum Computation",
    "QC"
  ],
  "description": "Computational paradigm using quantum-mechanical phenomena",
  "externalIds": [
    { "source": "wikidata", "value": "Q339" },
    { "source": "lcsh", "value": "sh2008010405" },
    { "source": "viaf", "value": "168470861" }
  ],
  "status": "established",
  "createdAt": "2025-01-15T10:30:00Z"
}

// Relationships are stored as separate edge records
// pub.chive.graph.edge with relationSlug: "broader" → "Computer Science", "Quantum Mechanics"
// pub.chive.graph.edge with relationSlug: "narrower" → "Quantum Error Correction", "Quantum Algorithms"
// pub.chive.graph.edge with relationSlug: "related" → "Quantum Information Theory"
```

Authority records link to external controlled vocabularies:

| Vocabulary   | Purpose                                    |
| ------------ | ------------------------------------------ |
| **Wikidata** | Multilingual structured knowledge          |
| **LCSH**     | Library of Congress Subject Headings       |
| **VIAF**     | Virtual International Authority File       |
| **FAST**     | Faceted Application of Subject Terminology |

### Reconciliation

When users tag eprints, Chive reconciles tags against authority records:

```
User enters: "quantum computing"
         ↓
Chive matches: Authority record "Quantum Computing" (Q339)
         ↓
Eprint linked to canonical concept
```

This prevents fragmentation ("quantum computing" vs "Quantum Computation" vs "QC" all map to the same concept).

## Community governance

The knowledge graph uses Wikipedia-style moderation. Users can:

1. **Propose** new fields or changes
2. **Discuss** proposals in threaded comments
3. **Vote** on whether to accept proposals

### Proposal types

| Type                 | What it does                               | Approval threshold |
| -------------------- | ------------------------------------------ | ------------------ |
| **Create field**     | Add a new field to the taxonomy            | 67% with 5+ votes  |
| **Update field**     | Modify name, description, or relationships | 60% with 3+ votes  |
| **Merge fields**     | Combine redundant fields                   | 67% with 5+ votes  |
| **Deprecate field**  | Mark a field as obsolete                   | 75% with 7+ votes  |
| **Authority change** | Update authority records                   | 75% with 7+ votes  |

### Voter tiers

Not all votes carry equal weight. Expertise in the relevant field increases vote weight:

| Tier             | Vote weight | Criteria                             |
| ---------------- | ----------- | ------------------------------------ |
| Community member | 1.0x        | Any authenticated user               |
| Trusted editor   | 2.0x        | Consistent quality contributions     |
| Graph editor     | 2.0x        | Can modify knowledge graph nodes     |
| Domain expert    | 2.5x        | Publications in the field            |
| Administrator    | 5.0x        | Platform administrators (veto power) |

### Proposal workflow

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌───────────┐
│  Draft   │────►│  Discussion │────►│  Voting  │────►│  Outcome  │
│          │     │  (7 days)   │     │ (5 days) │     │           │
└──────────┘     └─────────────┘     └──────────┘     └───────────┘
                       │                   │
                       │                   │
                       ▼                   ▼
              Revisions allowed     Threshold met?
                                    ├── Yes → Approved
                                    └── No  → Rejected
```

## User tags vs. authority terms

Chive distinguishes between user-generated tags and authority-controlled terms:

| User tags             | Authority terms       |
| --------------------- | --------------------- |
| Free-form text        | Controlled vocabulary |
| Personal organization | Community consensus   |
| No voting required    | Proposal + voting     |
| May be reconciled     | Canonical concepts    |

Users can tag eprints freely. Popular tags may be promoted to authority terms through a two-stage process:

1. **Automatic nomination**: Tag used on 10+ eprints by 3+ users
2. **Community vote**: Standard proposal process

## Graph algorithms

The knowledge graph enables advanced discovery features:

### Citation analysis

```
Find papers that:
  - Cite foundational works in the field
  - Bridge multiple subfields
  - Introduce new connections
```

### Semantic similarity

```
Given an eprint about "quantum error correction":
  - Find semantically similar eprints
  - Suggest related fields to explore
  - Identify key authors in adjacent areas
```

### Field evolution

```
Track how fields change over time:
  - New subfields emerging
  - Fields merging or splitting
  - Terminology shifts
```

## Integration with search

The knowledge graph enhances search in several ways:

### Expansion

A search for "machine learning" automatically includes:

- Narrow terms: "deep learning", "neural networks"
- Related terms: "artificial intelligence", "statistical learning"

### Disambiguation

A search for "network" prompts:

- Computer networks?
- Neural networks?
- Social networks?
- Network science?

### Faceted browsing

Filter results by any PMEST dimension while staying within a field:

```
Field: Machine Learning
  Filter by Matter: Medical imaging
  Filter by Time: Last 5 years
  Filter by Space: [any]
```

## Wikidata integration

Chive synchronizes with Wikidata to:

1. **Import** established classifications
2. **Link** local concepts to global identifiers
3. **Contribute** new academic concepts back

```sparql
# Example SPARQL query to find related concepts
SELECT ?item ?itemLabel WHERE {
  wd:Q339 wdt:P279* ?item .  # Q339 = Quantum computing
  ?item wdt:P31 wd:Q11862829 .  # Instance of academic discipline
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
```

## API endpoints

| Endpoint                          | Purpose                          |
| --------------------------------- | -------------------------------- |
| `pub.chive.graph.getNode`         | Get node details by ID           |
| `pub.chive.graph.listNodes`       | List nodes (paginated, filtered) |
| `pub.chive.graph.searchNodes`     | Search nodes by label            |
| `pub.chive.graph.getField`        | Get field details (convenience)  |
| `pub.chive.graph.listFields`      | List fields (paginated)          |
| `pub.chive.graph.listEdges`       | List edges for a node            |
| `pub.chive.graph.browseFaceted`   | Faceted search                   |
| `pub.chive.graph.getFieldEprints` | Eprints in a field               |

## Next steps

- [Data sovereignty](./data-sovereignty.md): How your data stays yours
- [Peer review](/user-guide/peer-review): Review and endorse eprints
- [Governance](/governance/overview): How decisions are made
