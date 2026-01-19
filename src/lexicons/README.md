# Lexicons

AT Protocol lexicon validators and type definitions for Chive records.

## Overview

This directory contains generated validators for Chive's lexicon schemas. Lexicons define the record types stored in user PDSes and indexed by Chive's AppView.

## Directory Structure

```
lexicons/
├── validator.ts                 # Main validation entry point
└── validators/
    └── pub/
        └── chive/
            ├── actor/           # User profile records
            │   ├── discoverySettings.ts
            │   └── profile.ts
            ├── eprint/          # Eprint records
            │   ├── authorContribution.ts
            │   ├── getSubmission.ts
            │   ├── searchSubmissions.ts
            │   ├── submission.ts
            │   ├── userTag.ts
            │   └── version.ts
            ├── graph/           # Knowledge graph records
            │   ├── edge.ts
            │   ├── edgeProposal.ts
            │   ├── node.ts
            │   ├── nodeProposal.ts
            │   ├── reconciliation.ts
            │   └── vote.ts
            └── review/          # Review records
                ├── comment.ts
                ├── endorsement.ts
                └── entityLink.ts
```

## Namespace

All Chive lexicons use the `pub.chive.*` namespace:

| NSID                                  | Description                      |
| ------------------------------------- | -------------------------------- |
| `pub.chive.actor.profile`             | User profile metadata            |
| `pub.chive.actor.discoverySettings`   | Content discovery preferences    |
| `pub.chive.eprint.submission`         | Core eprint record               |
| `pub.chive.eprint.version`            | Version metadata                 |
| `pub.chive.eprint.userTag`            | User-contributed tags            |
| `pub.chive.eprint.authorContribution` | Author contribution declarations |
| `pub.chive.review.comment`            | Review comments                  |
| `pub.chive.review.endorsement`        | Formal endorsements              |
| `pub.chive.review.entityLink`         | Entity linking annotations       |
| `pub.chive.graph.node`                | Knowledge graph nodes            |
| `pub.chive.graph.edge`                | Knowledge graph edges            |
| `pub.chive.graph.nodeProposal`        | Node proposals for governance    |
| `pub.chive.graph.edgeProposal`        | Edge proposals for governance    |
| `pub.chive.graph.vote`                | Community votes on proposals     |
| `pub.chive.graph.reconciliation`      | Authority reconciliation records |

## Usage

```typescript
import { validate } from './validator.js';

// Validate an eprint submission record
const result = validate('pub.chive.eprint.submission', record);
if (!result.success) {
  console.error('Validation errors:', result.errors);
}
```

## Code Generation

Validators are generated from lexicon JSON schemas using the ATProto lexicon codegen pipeline:

```bash
# Regenerate validators from lexicon definitions
pnpm lexicon:codegen
```

Source lexicon schemas are in `.claude/design/01-lexicons/`.

## ATProto Compliance

These validators ensure records conform to lexicon schemas before being:

- Indexed from the firehose
- Returned in API responses
- Validated during development

All records live in user PDSes; Chive only indexes them.
