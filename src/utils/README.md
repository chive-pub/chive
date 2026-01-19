# Utilities

Shared utility functions for Chive.

## Overview

This directory contains utility functions used across the codebase. Currently contains rich text processing utilities for handling annotation and abstract content.

## Directory Structure

```
utils/
├── README.md
└── rich-text.ts     # Rich text body processing utilities
```

## Files

### rich-text.ts

Utilities for processing rich text bodies in the GlossItem format used for abstracts and annotations.

**Key Functions:**

| Function                          | Description                                           |
| --------------------------------- | ----------------------------------------------------- |
| `extractPlainText(body)`          | Extract plain text from rich text body (for indexing) |
| `createRichTextFromPlain(text)`   | Wrap plain text in rich text format                   |
| `isRichTextEmpty(body)`           | Check if body has no content                          |
| `getRichTextLength(body)`         | Get character count                                   |
| `truncateRichText(body, maxLen)`  | Truncate to max length preserving items               |
| `extractNodeRefs(body)`           | Get all node reference URIs                           |
| `extractEprintRefs(body)`         | Get all eprint reference URIs                         |
| `isValidRichTextBody(body)`       | Validate rich text structure                          |
| `migrateAbstractToRichText(text)` | Convert plain text abstract to rich text              |

**Usage Example:**

```typescript
import { extractPlainText, createRichTextFromPlain } from './rich-text.js';

// Extract plain text for search indexing
const plainText = extractPlainText(eprint.abstract);
await searchIndex.index({ abstractPlainText: plainText });

// Create rich text from plain text
const richBody = createRichTextFromPlain('This is the abstract text.');
```

**Rich Text Format:**

Rich text bodies use the GlossItem format:

```typescript
interface RichTextBody {
  type: 'RichText';
  items: Array<
    | { type: 'text'; content: string }
    | { type: 'nodeRef'; uri: string; label?: string }
    | { type: 'eprintRef'; uri: string; title?: string }
  >;
  format: 'application/x-chive-gloss+json';
}
```
