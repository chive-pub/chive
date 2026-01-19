# Chive Lexicon Schemas

This directory contains all Lexicon schema definitions for the `pub.chive.*` namespace. Lexicons define the structure, validation rules, and documentation for AT Protocol records and XRPC procedures in Chive.

## Schema Index

### Eprint Records

**`pub.chive.eprint.submission`**
Main eprint record containing title, abstract, PDF blob reference, keywords, and faceted classification.

**`pub.chive.eprint.version`**
Version metadata tracking eprint revisions and changelogs.

**`pub.chive.eprint.userTag`**
User-generated tags for folksonomy-style classification (TaxoFolk system).

**`pub.chive.eprint.authorContribution`**
Author contribution records tracking individual author contributions to eprints.

### Review Records

**`pub.chive.review.comment`**
Review comments on eprints, supporting inline comments and threaded discussions.

**`pub.chive.review.endorsement`**
Formal endorsements of eprints (methods, results, or overall).

**`pub.chive.review.entityLink`**
Links between review entities and external resources.

### Knowledge Graph Records

**`pub.chive.graph.node`**
Knowledge graph nodes representing fields, concepts, and entities.

**`pub.chive.graph.nodeProposal`**
Community proposals for creating or updating knowledge graph nodes.

**`pub.chive.graph.edge`**
Knowledge graph edges representing relationships between nodes.

**`pub.chive.graph.edgeProposal`**
Community proposals for creating or updating knowledge graph edges.

**`pub.chive.graph.vote`**
Votes on node or edge proposals (approve/reject with optional comment).

**`pub.chive.graph.reconciliation`**
Reconciliation records for merging or splitting graph entities.

### Actor Records

**`pub.chive.actor.profile`**
Chive-specific author profile with ORCID, affiliations, and research fields.

**`pub.chive.actor.discoverySettings`**
User preferences for discovery and notification settings.

### XRPC Queries

**`pub.chive.eprint.getSubmission`**
Retrieve a single eprint by AT URI with PDS source tracking.

**`pub.chive.eprint.searchSubmissions`**
Search eprints with full-text queries and faceted filters.

## NSID Naming Conventions

Lexicon NSIDs follow reverse domain notation:

```
pub.chive.{category}.{type}
```

- `pub.chive` - Authority (Chive namespace)
- `{category}` - Record category (eprint, review, graph, actor)
- `{type}` - Specific record type

## Blob Size Limits

| Blob Type     | Max Size | Rationale               |
| ------------- | -------- | ----------------------- |
| PDF           | 50 MB    | Eprint submissions      |
| Supplementary | 100 MB   | Datasets, code archives |
| Avatar        | 1 MB     | Author profile images   |

**CRITICAL**: All blob fields use `type: "blob"` (BlobRef), never `type: "string"` with base64 encoding. Chive stores blob references, not blob data. Actual files remain in user PDSes.

## Schema Validation

Validate all schemas:

```bash
pnpm lexicons:validate
```

This runs `@atproto/lexicon validate` on all JSON files in `lexicons/`.

## Code Generation

Generate TypeScript types and Zod validators from schemas:

```bash
pnpm lexicons:generate
```

Generated files:

- `src/lexicons/types/` - TypeScript interfaces
- `src/lexicons/validators/` - Zod runtime validators

## Versioning Strategy

See [VERSIONING.md](./VERSIONING.md) for schema evolution and deprecation procedures.

## ATProto Compliance

All Chive lexicons comply with AT Protocol specifications:

1. **Client-Generated Keys**: Records use `key: "tid"` or `key: "self"`, never server-generated keys
2. **Blob References**: All file fields use `type: "blob"`, not base64 strings
3. **AT URI References**: Cross-references use `format: "at-uri"`
4. **DID Format**: Identity fields use `format: "did"`

## Validation Examples

### Validating Records with LexiconValidator

```typescript
import { LexiconValidator } from './src/lexicons/validator.js';

const validator = new LexiconValidator();
await validator.loadSchemas();

const eprintData = {
  title: 'Quantum Entanglement in Photonic Systems',
  abstract: 'We demonstrate quantum entanglement...',
  pdf: {
    $type: 'blob',
    ref: 'bafyreibwkjvc2wlkqn3v6jxlp2w3z4',
    mimeType: 'application/pdf',
    size: 1024000,
  },
  license: 'CC-BY-4.0',
  createdAt: new Date().toISOString(),
};

const result = validator.validateRecord('pub.chive.eprint.submission', eprintData);

if (result.valid) {
  console.log('Eprint is valid');
} else {
  console.error('Validation errors:', result.errors);
}
```

### Using Generated Zod Validators

```typescript
import { eprintSubmissionSchema } from './src/lexicons/validators/pub/chive/eprint/submission.js';

try {
  const validEprint = eprintSubmissionSchema.parse(eprintData);
  console.log('Valid eprint:', validEprint);
} catch (error) {
  console.error('Zod validation failed:', error.errors);
}
```

### Handling Validation Errors

```typescript
import { LexiconValidator } from './src/lexicons/validator.js';

const validator = new LexiconValidator();
await validator.loadSchemas();

const invalidData = {
  title: 'My Paper',
  // Missing required fields: abstract, pdf, license, createdAt
};

const result = validator.validateRecord('pub.chive.eprint.submission', invalidData);

if (!result.valid) {
  result.errors.forEach((error) => {
    console.log(`Field: ${error.field}`);
    console.log(`Errors: ${error.errors?.join(', ')}`);
  });
}
```

### Validating XRPC Parameters

```typescript
const searchParams = {
  q: 'machine learning',
  author: 'did:plc:abc123',
  limit: 25,
};

const paramResult = validator.validateParams('pub.chive.eprint.searchSubmissions', searchParams);

if (paramResult.valid) {
  // Execute search
} else {
  // Return 400 Bad Request with error details
}
```

## Related Documentation

- [ATProto Lexicon Specification](https://atproto.com/guides/lexicon)
