# Schema compatibility service

The SchemaCompatibilityService detects record format types and generates migration hints for ATProto records. It ensures Chive accepts both legacy and current formats while informing clients about available updates.

## Overview

ATProto records evolve over time. As Chive adds features like rich text formatting, older records may use outdated field formats. The schema compatibility service:

- Detects field formats in incoming records
- Identifies fields using legacy formats
- Generates migration hints for clients
- Maintains forward compatibility (accepts both old and new formats)

## Format types

### AbstractFormat

Detects the format of abstract fields in eprint records.

| Format            | Description                   | Current |
| ----------------- | ----------------------------- | ------- |
| `string`          | Plain text string (legacy)    | No      |
| `rich-text-array` | Array of RichTextItem objects | Yes     |
| `empty`           | Missing or null value         | Yes     |
| `invalid`         | Unexpected type               | No      |

### TitleFormat

Detects the format of title fields, including whether a `titleRich` array is needed.

| Format             | Description                                                | Current |
| ------------------ | ---------------------------------------------------------- | ------- |
| `plain`            | Plain string with no special formatting                    | Yes     |
| `plain-needs-rich` | Plain string containing LaTeX, subscripts, or superscripts | No      |
| `with-rich`        | Plain title with accompanying `titleRich` array            | Yes     |
| `empty`            | Missing or empty title                                     | No      |

### ReviewBodyFormat

Detects the format of review body fields.

| Format            | Description                   | Current |
| ----------------- | ----------------------------- | ------- |
| `string`          | Plain text string (legacy)    | No      |
| `rich-text-array` | Array of RichTextItem objects | Yes     |
| `empty`           | Missing or null value         | No      |
| `invalid`         | Unexpected type               | No      |

## Detecting formats

### Abstract format detection

```typescript
import { SchemaCompatibilityService } from '@/services/schema/schema-compatibility.js';

const service = new SchemaCompatibilityService();

// Legacy string format
const legacyResult = service.detectAbstractFormat('Plain text abstract');
// {
//   field: 'abstract',
//   format: 'string',
//   isCurrent: false,
//   metadata: { length: 20, detectedVersion: '0.0.0' }
// }

// Current rich text format
const currentResult = service.detectAbstractFormat([
  { type: 'text', content: 'Rich text abstract with ' },
  {
    type: 'nodeRef',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.node/8e31479f-01c0-5c1e-aae4-bd28b7cb0a7b',
  },
]);
// {
//   field: 'abstract',
//   format: 'rich-text-array',
//   isCurrent: true,
//   metadata: { itemCount: 2, isValid: true, detectedVersion: '0.1.0' }
// }
```

### Title format detection

The service detects whether titles contain special formatting that requires a `titleRich` array:

```typescript
// Plain title (no special formatting)
const plainResult = service.detectTitleFormat('Simple Title', undefined);
// { field: 'title', format: 'plain', isCurrent: true }

// Title with LaTeX but no titleRich (needs migration)
const latexResult = service.detectTitleFormat(
  'Study of $\\alpha$-decay in heavy nuclei',
  undefined
);
// {
//   field: 'title',
//   format: 'plain-needs-rich',
//   isCurrent: false,
//   metadata: {
//     titleLength: 39,
//     hasLatex: true,
//     hasLatexCommand: false,
//     hasSubscript: false,
//     hasSuperscript: false
//   }
// }

// Title with rich formatting (current format)
const richResult = service.detectTitleFormat('Study of alpha-decay in heavy nuclei', [
  { type: 'text', content: 'Study of ' },
  { type: 'latex', content: '\\alpha', displayMode: false },
  { type: 'text', content: '-decay in heavy nuclei' },
]);
// { field: 'title', format: 'with-rich', isCurrent: true }
```

### LaTeX pattern detection

The service detects several LaTeX patterns that indicate a title needs rich formatting:

- Inline math: `$...$`
- Display math: `$$...$$`
- LaTeX commands: `\alpha`, `\frac{a}{b}`, `\sqrt[3]{x}`
- Subscripts: `_{}` or `_x`
- Superscripts: `^{}` or `^2`

```typescript
// Examples of titles that trigger plain-needs-rich format
'Properties of $\\beta$-functions'; // inline math
'The formula $$E=mc^2$$ explained'; // display math
'Study of \\textit{Drosophila} genetics'; // LaTeX command
'Analysis of H_2O molecules'; // subscript
'The power x^2 in equations'; // superscript
```

### Review body format detection

```typescript
// Legacy string format
const legacyBody = service.detectReviewBodyFormat('Plain review text');
// { field: 'body', format: 'string', isCurrent: false }

// Current rich text format
const currentBody = service.detectReviewBodyFormat([
  { type: 'text', content: 'This paper presents...' },
]);
// { field: 'body', format: 'rich-text-array', isCurrent: true }
```

## Analyzing complete records

### Eprint records

Use `analyzeEprintRecord` to check all fields at once:

```typescript
const record = await fetchRecordFromPds(uri);
const result = service.analyzeEprintRecord(record);

if (!result.isCurrentSchema) {
  console.log('Legacy format detected');
  console.log('Schema version:', result.compatibility.schemaVersion);
  console.log('Deprecated fields:', result.compatibility.deprecatedFields);

  if (result.compatibility.migrationAvailable) {
    for (const hint of result.compatibility.migrationHints ?? []) {
      console.log(`Field: ${hint.field}`);
      console.log(`Action: ${hint.action}`);
      console.log(`Instructions: ${hint.instructions}`);
    }
  }
}
```

### Review records

Use `analyzeReviewRecord` for review comments:

```typescript
const reviewRecord = await fetchRecordFromPds(reviewUri);
const result = service.analyzeReviewRecord(reviewRecord);

if (!result.isCurrentSchema) {
  console.log('Legacy review detected');
}
```

## Migration workflow

### Step 1: Detect legacy formats

```typescript
const result = service.analyzeEprintRecord(record);

if (service.needsMigration(record)) {
  // record uses deprecated formats
}
```

### Step 2: Generate API hints

Include schema hints in API responses to inform clients:

```typescript
const result = service.analyzeEprintRecord(record);
const hints = service.generateApiHints(result);

const response = {
  uri: record.uri,
  value: record,
  ...(hints && { _schemaHints: hints }),
};

// Response includes hints for legacy records:
// {
//   "uri": "at://did:plc:.../pub.chive.eprint.submission/abc123",
//   "value": { ... },
//   "_schemaHints": {
//     "schemaVersion": "0.0.0",
//     "deprecatedFields": ["abstract"],
//     "migrationAvailable": true,
//     "migrationUrl": "https://docs.chive.pub/schema/migrations/abstract-richtext"
//   }
// }
```

### Step 3: Apply migrations

Migration hints provide instructions for each field:

```typescript
for (const hint of result.compatibility.migrationHints ?? []) {
  switch (hint.action) {
    case 'convert':
      // transform field format (e.g., string to array)
      console.log('Convert:', hint.instructions);
      break;

    case 'add':
      // add a new field (e.g., titleRich)
      console.log('Add field:', hint.instructions);
      break;

    case 'restructure':
      // fix invalid format
      console.log('Fix format:', hint.instructions);
      break;
  }

  if (hint.example) {
    console.log('Example:', JSON.stringify(hint.example, null, 2));
  }
}
```

### Example: Converting string abstract to rich text

Legacy format:

```json
{
  "title": "Example Paper",
  "abstract": "This paper studies the effects of..."
}
```

Current format:

```json
{
  "title": "Example Paper",
  "abstract": [{ "type": "text", "content": "This paper studies the effects of..." }]
}
```

### Example: Adding titleRich for LaTeX titles

Legacy format:

```json
{
  "title": "Study of $\\alpha$-decay",
  "abstract": [...]
}
```

Current format:

```json
{
  "title": "Study of alpha-decay",
  "titleRich": [
    { "type": "text", "content": "Study of " },
    { "type": "latex", "content": "\\alpha", "displayMode": false },
    { "type": "text", "content": "-decay" }
  ],
  "abstract": [...]
}
```

## Integration with API handlers

### XRPC endpoint example

```typescript
import { schemaCompatibilityService } from '@/services/schema/schema-compatibility.js';

export async function getSubmission(uri: string): Promise<GetSubmissionResponse> {
  const record = await repository.getRecord(uri);
  const result = schemaCompatibilityService.analyzeEprintRecord(record.value);
  const hints = schemaCompatibilityService.generateApiHints(result);

  return {
    uri: record.uri,
    cid: record.cid,
    value: record.value,
    ...(hints && { _schemaHints: hints }),
  };
}
```

### Conditional migration hints

Only include hints for records that need them:

```typescript
const result = service.analyzeEprintRecord(record);

// hints is undefined for current schema records
const hints = service.generateApiHints(result);

if (hints) {
  // record uses legacy formats
  response._schemaHints = hints;
}
```

## Types reference

### SchemaVersion

```typescript
interface SchemaVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}
```

### FieldFormatDetection

```typescript
interface FieldFormatDetection {
  readonly field: string;
  readonly format: string;
  readonly isCurrent: boolean;
  readonly metadata?: Record<string, unknown>;
}
```

### SchemaCompatibilityInfo

```typescript
interface SchemaCompatibilityInfo {
  readonly schemaVersion: SchemaVersion;
  readonly detectedFormat: 'current' | 'legacy' | 'unknown';
  readonly deprecatedFields: readonly DeprecatedFieldInfo[];
  readonly migrationAvailable: boolean;
  readonly migrationHints?: readonly SchemaMigrationHint[];
}
```

### SchemaMigrationHint

```typescript
interface SchemaMigrationHint {
  readonly field: string;
  readonly action: 'convert' | 'add' | 'restructure' | 'remove';
  readonly instructions: string;
  readonly documentationUrl?: string;
  readonly example?: unknown;
}
```

### ApiSchemaHints

```typescript
interface ApiSchemaHints {
  readonly schemaVersion?: string;
  readonly deprecatedFields?: readonly string[];
  readonly migrationAvailable?: boolean;
  readonly migrationUrl?: string;
}
```

## ATProto compliance

The schema compatibility service follows ATProto principles:

1. **Forward compatibility**: Accept both legacy and current formats without breaking
2. **Additive hints**: Schema hints are optional fields that existing clients ignore
3. **No breaking changes**: Legacy records continue to work; hints are informational only
4. **User data sovereignty**: Migration is performed by clients updating their PDS records; Chive never writes to user PDSes

## Numeric field serialization

ATProto requires floating-point numbers to be serialized as strings in certain contexts to preserve precision across different JSON parsers. The schema compatibility service handles this for:

### Bounding rectangle coordinates

PDF annotation bounding rectangles use string-serialized floats:

```typescript
interface BoundingRect {
  x: string; // "0.123456"
  y: string; // "0.234567"
  width: string; // "0.345678"
  height: string; // "0.456789"
  pageNumber: number;
}
```

When reading:

```typescript
const rect = {
  x: parseFloat(record.boundingRect.x),
  y: parseFloat(record.boundingRect.y),
  width: parseFloat(record.boundingRect.width),
  height: parseFloat(record.boundingRect.height),
  pageNumber: record.boundingRect.pageNumber,
};
```

When writing:

```typescript
const record = {
  boundingRect: {
    x: coords.x.toString(),
    y: coords.y.toString(),
    width: coords.width.toString(),
    height: coords.height.toString(),
    pageNumber: coords.pageNumber,
  },
};
```

This ensures consistent precision when coordinates are round-tripped through different ATProto implementations.

## Default instance

A singleton instance is exported for convenience:

```typescript
import { schemaCompatibilityService } from '@/services/schema/schema-compatibility.js';

// use directly
const result = schemaCompatibilityService.analyzeEprintRecord(record);
```

## Version information

Get the current schema version:

```typescript
const version = service.getCurrentVersionString();
// "0.1.0"

const versionObj = service.currentVersion;
// { major: 0, minor: 1, patch: 0 }
```
