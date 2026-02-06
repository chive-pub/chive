# Frontend Rich Text System

This guide covers the unified rich text rendering system for Chive's frontend.

## Lexicon Schemas

The rich text system implements three lexicon schemas:

| Lexicon                       | Field       | Description                               |
| ----------------------------- | ----------- | ----------------------------------------- |
| `pub.chive.richtext.defs`     | (shared)    | Shared type definitions for all rich text |
| `pub.chive.eprint.submission` | `titleRich` | Rich title with LaTeX and entity refs     |
| `pub.chive.eprint.submission` | `abstract`  | Rich abstract with full formatting        |
| `pub.chive.review.comment`    | `body`      | Rich comment body                         |

See [Lexicons Reference](/reference/lexicons#rich-text-system) for complete schema documentation.

## Overview

The rich text system provides consistent rendering of formatted content across titles, abstracts, reviews, and annotations. It combines:

- ATProto-style facets (mentions, links, hashtags)
- Entity references (knowledge graph nodes, Wikidata, fields, eprints)
- Markdown formatting (bold, italic, strikethrough, code)
- LaTeX math expressions (inline and display mode)

## Architecture

### Type Hierarchy

All rich text types are defined in `web/lib/types/rich-text.ts`:

```
RichTextItem (union type)
├── TextItem           # Plain text with optional formatting
├── MentionItem        # @handle ATProto mentions
├── LinkItem           # URLs (internal and external)
├── TagItem            # #hashtags
├── NodeRefItem        # Knowledge graph node references
├── WikidataRefItem    # Wikidata entity references (QID)
├── FieldRefItem       # Academic field references
├── FacetRefItem       # Facet classification references
├── EprintRefItem      # Eprint references
├── AnnotationRefItem  # Annotation references
├── AuthorRefItem      # Author references (DID)
├── LatexItem          # LaTeX math expressions
└── CodeItem           # Code blocks and inline code
```

### Data Flow

```
Record from PDS              RichTextRenderer
      │                            │
      ▼                            ▼
Legacy format? ──yes──► fromLegacyAnnotationItems()
      │                            │
      no                           │
      │                            ▼
      ▼                     RichTextItem[]
ATProto facets? ─yes──► fromAtprotoRichText()
      │                            │
      no                           │
      │                            ▼
      ▼                    ItemRenderer loop
RichTextItem[] ────────────────►   │
                                   ▼
                           Rendered output
```

## RichTextRenderer Component

The main rendering component is located at `web/components/editor/rich-text-renderer.tsx`.

### Basic Usage

```tsx
import { RichTextRenderer } from '@/components/editor/rich-text-renderer';
import type { RichTextItem } from '@/lib/types/rich-text';

const items: RichTextItem[] = [
  { type: 'text', content: 'Research on ' },
  { type: 'nodeRef', uri: 'at://...', label: 'machine learning', subkind: 'field' },
  { type: 'text', content: ' by ' },
  { type: 'mention', did: 'did:plc:abc123', handle: 'alice.bsky.social' },
];

<RichTextRenderer items={items} mode="inline" />;
```

### Props

| Prop      | Type                                     | Default     | Description                         |
| --------- | ---------------------------------------- | ----------- | ----------------------------------- |
| items     | RichTextItem[] \| LegacyAnnotationItem[] | undefined   | Rich text items to render           |
| text      | string                                   | undefined   | Plain text (for ATProto facet mode) |
| facets    | AtprotoFacet[] \| null                   | undefined   | ATProto facets (used with text)     |
| mode      | 'inline' \| 'block'                      | 'inline'    | Rendering mode                      |
| className | string                                   | undefined   | Additional CSS classes              |
| testId    | string                                   | 'rich-text' | data-testid attribute               |

### Input Formats

The component accepts three input formats:

**1. Item-based format (recommended):**

```tsx
<RichTextRenderer
  items={[
    { type: 'text', content: 'Hello ' },
    { type: 'mention', did: 'did:plc:abc', handle: 'alice' },
  ]}
/>
```

**2. ATProto text+facets format:**

```tsx
<RichTextRenderer
  text="Hello @alice.bsky.social!"
  facets={[
    {
      index: { byteStart: 6, byteEnd: 25 },
      features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:abc' }],
    },
  ]}
/>
```

**3. Legacy annotation format (auto-converted):**

```tsx
<RichTextRenderer
  items={[
    { type: 'text', content: 'See ' },
    { type: 'wikidataRef', qid: 'Q123', label: 'example' },
  ]}
/>
```

### Render Modes

**Inline mode (default):** Items flow inline. Use for titles and short text.

```tsx
<RichTextRenderer items={items} mode="inline" />
```

**Block mode:** Preserves whitespace and line breaks. Use for abstracts and long content.

```tsx
<RichTextRenderer items={items} mode="block" />
```

## Supported Item Types

### TextItem

Plain text with optional formatting.

```typescript
interface TextItem {
  type: 'text';
  content: string;
  format?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
}
```

Formats can be combined:

```tsx
{
  type: 'text',
  content: 'important',
  format: { bold: true, italic: true }
}
// Renders: <strong><em>important</em></strong>
```

### MentionItem

ATProto @handle references. Links to author profile page.

```typescript
interface MentionItem {
  type: 'mention';
  did: string;
  handle?: string;
  displayName?: string;
}
```

Renders as a blue link: `@alice.bsky.social`

### LinkItem

URLs with automatic handling for internal and external links.

```typescript
interface LinkItem {
  type: 'link';
  url: string;
  label?: string;
}
```

Behavior by URL type:

- **Internal links** (`chive.pub` or `/path`): Renders as Next.js `Link`
- **Wikidata links**: Renders as a badge with external icon
- **Other external links**: Opens in new tab with external icon

### TagItem

Hashtag references. Links to search results.

```typescript
interface TagItem {
  type: 'tag';
  tag: string; // without the # prefix
}
```

Renders as: `#machine-learning`

### NodeRefItem

Knowledge graph node references. Displayed as colored badges based on subkind.

```typescript
interface NodeRefItem {
  type: 'nodeRef';
  uri: string;
  label: string;
  subkind?: string; // 'field', 'institution', 'person', 'method', etc.
}
```

Badge colors are determined by `getSubkindColorClasses()` from `@/lib/constants/subkind-colors`.

### WikidataRefItem

Wikidata entity references. Displayed as blue badges with external link icon.

```typescript
interface WikidataRefItem {
  type: 'wikidataRef';
  qid: string; // e.g., 'Q123456'
  label: string;
  url?: string; // optional URL override
}
```

### FieldRefItem

Academic field references. Uses field-specific styling.

```typescript
interface FieldRefItem {
  type: 'fieldRef';
  uri: string;
  label: string;
}
```

### FacetRefItem

PMEST facet classification references. Links to browse page with filter.

```typescript
interface FacetRefItem {
  type: 'facetRef';
  dimension: string; // 'time', 'space', 'energy', 'matter', 'personality'
  value: string;
}
```

### EprintRefItem

Eprint references. Links to eprint detail page.

```typescript
interface EprintRefItem {
  type: 'eprintRef';
  uri: string;
  title: string;
}
```

### AnnotationRefItem

Annotation excerpt references.

```typescript
interface AnnotationRefItem {
  type: 'annotationRef';
  uri: string;
  excerpt: string;
}
```

### AuthorRefItem

Author references by DID.

```typescript
interface AuthorRefItem {
  type: 'authorRef';
  did: string;
  displayName?: string;
  handle?: string;
}
```

### LatexItem

LaTeX math expressions rendered via KaTeX.

```typescript
interface LatexItem {
  type: 'latex';
  content: string; // LaTeX source (without delimiters)
  displayMode: boolean; // true for block, false for inline
}
```

Examples:

```tsx
// Inline: renders as part of text flow
{ type: 'latex', content: '\\alpha + \\beta', displayMode: false }

// Display: renders as centered block
{ type: 'latex', content: '\\int_0^\\infty e^{-x} dx = 1', displayMode: true }
```

### CodeItem

Code blocks and inline code.

```typescript
interface CodeItem {
  type: 'code';
  content: string;
  language?: string; // for syntax highlighting
  block?: boolean; // true for code block, false for inline
}
```

## Integration with Eprint Components

### EprintAbstract

The `EprintAbstract` component in `web/components/eprints/eprint-abstract.tsx` uses `RichTextRenderer` for abstract display with expand/collapse functionality.

```tsx
import { EprintAbstract } from '@/components/eprints/eprint-abstract';

<EprintAbstract abstractItems={eprint.abstractItems} maxLength={300} defaultExpanded={false} />;
```

**Props:**

| Prop            | Type           | Default    | Description                    |
| --------------- | -------------- | ---------- | ------------------------------ |
| abstractItems   | RichTextItem[] | (required) | Rich text content              |
| maxLength       | number         | 300        | Character limit when collapsed |
| defaultExpanded | boolean        | false      | Initial expansion state        |
| className       | string         | undefined  | Additional CSS classes         |

### StaticAbstract

For list views where expansion is not needed:

```tsx
import { StaticAbstract } from '@/components/eprints/eprint-abstract';

<StaticAbstract abstractItems={eprint.abstractItems} maxLines={3} />;
```

## Schema Migration Utilities

When working with records that may use older field formats, use the migration utilities.

### Detecting Migration Needs

Located in `web/lib/api/schema-migration.ts`:

```typescript
import { needsSchemaMigration, detectFieldsNeedingMigration } from '@/lib/api/schema-migration';

if (needsSchemaMigration(record)) {
  const fields = detectFieldsNeedingMigration(record);
  console.log('Fields to migrate:', fields); // ['title', 'abstract', 'license']
}
```

### Migrating Records

```typescript
import { transformToCurrentSchema } from '@/lib/api/schema-migration';

const result = transformToCurrentSchema(record);

if (result.success && result.record) {
  // result.record contains the migrated record
  console.log('Migrated fields:', result.fields);
}
```

### Field-Specific Migrations

**Abstract migration:** Converts plain string to RichTextBodyItem array.

```typescript
import { migrateAbstractToRichText } from '@/lib/api/schema-migration';

const richAbstract = migrateAbstractToRichText('Plain text abstract');
// Returns: [{ type: 'text', content: 'Plain text abstract' }]
```

**Title migration:** Parses LaTeX from plain title into rich text items.

```typescript
import { migrateTitleToRichText, isLegacyTitleFormat } from '@/lib/api/schema-migration';

if (isLegacyTitleFormat(record.title, record.titleRich)) {
  const richTitle = migrateTitleToRichText(record.title);
  // Separates LaTeX into dedicated items
}
```

**License migration:** Adds knowledge graph URI to license slug.

```typescript
import { migrateLicenseToNode } from '@/lib/api/schema-migration';

const license = migrateLicenseToNode('CC-BY-4.0');
// Returns: {
//   licenseSlug: 'CC-BY-4.0',
//   licenseUri: 'at://did:plc:chive-governance/pub.chive.graph.node/fc58b045-e186-5081-b7eb-abc5c47ea8a3'
// }
```

## useSchemaMigration Hook

Located in `web/lib/hooks/use-schema-migration.ts`.

Handles the complete migration flow: fetch, transform, and update.

```tsx
import { useSchemaMigration, canUserMigrateRecord } from '@/lib/hooks/use-schema-migration';

function MigrationButton({ eprint, currentUserDid }) {
  const { mutateAsync: migrateRecord, isPending, error } = useSchemaMigration();

  const canMigrate = canUserMigrateRecord(eprint.uri, eprint.submittedBy, currentUserDid);

  const handleMigrate = async () => {
    try {
      const result = await migrateRecord({ uri: eprint.uri });
      toast.success(`Migrated ${result.fields.length} fields`);
    } catch (err) {
      if (err instanceof SchemaMigrationError) {
        toast.error(`Migration failed in ${err.phase} phase: ${err.message}`);
      }
    }
  };

  if (!canMigrate) return null;

  return (
    <Button onClick={handleMigrate} disabled={isPending}>
      {isPending ? 'Updating...' : 'Update to Latest Format'}
    </Button>
  );
}
```

### SchemaMigrationError

Error class with phase information:

```typescript
class SchemaMigrationError extends Error {
  readonly code = 'SCHEMA_MIGRATION_ERROR';
  readonly uri: string;
  readonly phase: 'fetch' | 'transform' | 'update';
}
```

## Utility Functions

### Plain Text Extraction

Extract plain text from rich text items (for search, truncation):

```typescript
import { extractPlainText } from '@/lib/types/rich-text';

const plainText = extractPlainText(items);
```

### Creating Rich Text

```typescript
import { createFromPlainText, createEmptyRichText } from '@/lib/types/rich-text';

// From plain string
const richText = createFromPlainText('Hello world');

// Empty structure
const empty = createEmptyRichText();
```

### Type Guards

```typescript
import {
  isTextItem,
  isMentionItem,
  isLinkItem,
  isEntityRefItem,
  isLatexItem,
} from '@/lib/types/rich-text';

if (isLatexItem(item)) {
  console.log('LaTeX:', item.content);
}

if (isEntityRefItem(item)) {
  // item is NodeRefItem | WikidataRefItem | FieldRefItem | ...
}
```

### Legacy Format Conversion

```typescript
import { fromLegacyAnnotationItems, toLegacyAnnotationItems } from '@/lib/types/rich-text';

// Convert legacy to unified format
const unified = fromLegacyAnnotationItems(legacyItems);

// Convert back (for backward compatibility)
const legacy = toLegacyAnnotationItems(unifiedItems);
```

### ATProto Facet Conversion

```typescript
import { fromAtprotoRichText } from '@/lib/types/rich-text';

const items = fromAtprotoRichText(text, facets);
```

Note: ATProto facets use byte indices (UTF-8), which the function automatically converts to JavaScript string indices (UTF-16).

## Styling

### Badge Colors

Node reference badges use subkind-specific colors defined in `@/lib/constants/subkind-colors`:

| Subkind     | Background  | Text        |
| ----------- | ----------- | ----------- |
| field       | purple-100  | purple-800  |
| institution | emerald-100 | emerald-800 |
| person      | amber-100   | amber-800   |
| method      | cyan-100    | cyan-800    |
| dataset     | orange-100  | orange-800  |
| default     | slate-100   | slate-800   |

### CSS Classes

The renderer applies these base classes:

```css
/* Container */
.leading-relaxed [&>*]:inline [&_.badge]:mx-0.5 [&_.badge]:align-baseline

/* Block mode adds */
.whitespace-pre-wrap

/* Links */
.text-blue-600 hover:underline dark:text-blue-400

/* Inline code */
.rounded bg-muted px-1 py-0.5 font-mono text-sm

/* Code blocks */
.rounded bg-muted p-3 overflow-x-auto my-2
```

## Testing

Test files:

- `web/components/editor/rich-text-renderer.test.tsx`
- `web/components/eprints/eprint-abstract.test.tsx`
- `web/lib/types/rich-text.test.ts`

Run with:

```bash
pnpm test:unit web/components/editor
pnpm test:unit web/components/eprints/eprint-abstract
pnpm test:unit web/lib/types/rich-text
```

## Related Documentation

- [Lexicons Reference](/reference/lexicons): Complete schema documentation for rich text types
- [Frontend Development](./frontend.md): General frontend architecture
- [Eprint Lifecycle Components](./frontend-eprint-lifecycle.md): Edit, version, delete components
- [ATProto Facets](https://atproto.com/specs/richtext): ATProto rich text specification
