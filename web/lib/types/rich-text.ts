/**
 * Rich text types re-exported from generated lexicon types.
 *
 * @remarks
 * All item types come directly from the generated `pub.chive.richtext.defs`
 * lexicon types. This module creates a discriminated union (`RichTextItem`)
 * and provides utility functions for working with rich text.
 *
 * @packageDocumentation
 */

// =============================================================================
// RE-EXPORTED GENERATED TYPES (single source of truth)
// =============================================================================

export type {
  TextItem,
  NodeRefItem,
  WikidataRefItem,
  FieldRefItem,
  FacetRefItem,
  EprintRefItem,
  AnnotationRefItem,
  AuthorRefItem,
  MentionItem,
  LinkItem,
  TagItem,
  LatexItem,
  CodeBlockItem,
  HeadingItem,
  ListItem,
  BlockquoteItem,
  Facet,
  ByteSlice,
  LinkFacet,
} from '@/lib/api/generated/types/pub/chive/richtext/defs';

import type {
  TextItem,
  NodeRefItem,
  WikidataRefItem,
  FieldRefItem,
  FacetRefItem,
  EprintRefItem,
  AnnotationRefItem,
  AuthorRefItem,
  MentionItem,
  LinkItem,
  TagItem,
  LatexItem,
  CodeBlockItem,
  HeadingItem,
  ListItem,
  BlockquoteItem,
} from '@/lib/api/generated/types/pub/chive/richtext/defs';

import type { RichTextFacet } from '@/lib/api/schema';

// Re-export for convenience
export type { RichTextFacet };

// =============================================================================
// DISCRIMINATED UNION
// =============================================================================

/**
 * Discriminated union of all rich text item types.
 *
 * @remarks
 * Discriminates on the `type` field. Each variant corresponds to a generated
 * lexicon type from `pub.chive.richtext.defs`.
 */
export type RichTextItem =
  | TextItem
  | NodeRefItem
  | WikidataRefItem
  | FieldRefItem
  | FacetRefItem
  | EprintRefItem
  | AnnotationRefItem
  | AuthorRefItem
  | MentionItem
  | LinkItem
  | TagItem
  | LatexItem
  | CodeBlockItem
  | HeadingItem
  | ListItem
  | BlockquoteItem;

/**
 * The set of known `type` discriminator values.
 */
const KNOWN_ITEM_TYPES = new Set([
  'text',
  'nodeRef',
  'wikidataRef',
  'fieldRef',
  'facetRef',
  'eprintRef',
  'annotationRef',
  'authorRef',
  'mention',
  'link',
  'tag',
  'latex',
  'codeBlock',
  'heading',
  'listItem',
  'blockquote',
]);

/**
 * Type guard that narrows an API response body item to a known RichTextItem.
 *
 * @remarks
 * API response body unions include a `{ $type: string }` catch-all for forward
 * compatibility. This guard filters to items with a known `type` discriminator,
 * enabling safe narrowing from wire format to `RichTextItem`.
 *
 * Uses `Extract<T, RichTextItem>` so that `.filter(isRichTextItem)` on a
 * generated body array properly narrows the element type and produces
 * `RichTextItem[]`.
 */
export function isRichTextItem<T>(item: T): item is Extract<T, RichTextItem> {
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    KNOWN_ITEM_TYPES.has((item as { type: string }).type)
  );
}

// =============================================================================
// RICH TEXT CONTENT
// =============================================================================

/**
 * Unified rich text content structure.
 *
 * @remarks
 * Contains both a plain text representation (for search/accessibility)
 * and an array of rich text items for rendering.
 */
export interface RichText {
  text: string;
  items: RichTextItem[];
  html?: string;
}

// =============================================================================
// CONVERSION UTILITIES
// =============================================================================

/**
 * Creates a unified rich text from plain text.
 */
export function createFromPlainText(text: string): RichText {
  return {
    text,
    items: [{ type: 'text', content: text }],
  };
}

/**
 * Creates empty unified rich text.
 */
export function createEmptyRichText(): RichText {
  return {
    text: '',
    items: [],
  };
}

/**
 * Extracts plain text from rich text items.
 */
export function extractPlainText(items: RichTextItem[]): string {
  return items
    .map((item) => {
      switch (item.type) {
        case 'text':
        case 'latex':
        case 'codeBlock':
        case 'heading':
        case 'blockquote':
          return item.content;
        case 'listItem':
          return item.content;
        case 'mention':
          return `@${item.handle ?? item.did}`;
        case 'link':
          return item.label ?? item.url;
        case 'tag':
          return `#${item.tag}`;
        case 'nodeRef':
        case 'fieldRef':
        case 'wikidataRef':
          return item.label ?? '';
        case 'facetRef':
        case 'eprintRef':
        case 'annotationRef':
          return item.label ?? '';
        case 'authorRef':
          return item.label ?? item.did;
        default:
          return '';
      }
    })
    .join('');
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isTextItem(item: RichTextItem): item is TextItem {
  return item.type === 'text';
}

export function isMentionItem(item: RichTextItem): item is MentionItem {
  return item.type === 'mention';
}

export function isLinkItem(item: RichTextItem): item is LinkItem {
  return item.type === 'link';
}

export function isEntityRefItem(
  item: RichTextItem
): item is
  | NodeRefItem
  | WikidataRefItem
  | FieldRefItem
  | EprintRefItem
  | AnnotationRefItem
  | AuthorRefItem {
  return ['nodeRef', 'wikidataRef', 'fieldRef', 'eprintRef', 'annotationRef', 'authorRef'].includes(
    item.type
  );
}

export function isLatexItem(item: RichTextItem): item is LatexItem {
  return item.type === 'latex';
}

export function isCodeBlockItem(item: RichTextItem): item is CodeBlockItem {
  return item.type === 'codeBlock';
}

// =============================================================================
// ATPROTO FACET CONVERSION
// =============================================================================

/**
 * Converts byte index to string index.
 *
 * @remarks
 * ATProto facets use byte indices (UTF-8), but JavaScript strings use
 * UTF-16 code units. This function converts byte indices to string indices.
 */
function byteToStringIndex(text: string, byteIndex: number): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  if (byteIndex >= bytes.length) {
    return text.length;
  }

  let currentBytePos = 0;
  let charIndex = 0;

  for (const char of text) {
    if (currentBytePos >= byteIndex) {
      return charIndex;
    }
    const charBytes = encoder.encode(char).length;
    currentBytePos += charBytes;
    charIndex++;
  }

  return charIndex;
}

/**
 * Converts ATProto rich text (text + facets) to unified rich text items.
 */
export function fromAtprotoRichText(text: string, facets?: RichTextFacet[] | null): RichTextItem[] {
  if (!facets || facets.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

  const items: RichTextItem[] = [];
  let currentByteIndex = 0;

  for (const facet of sortedFacets) {
    const startStringIndex = byteToStringIndex(text, currentByteIndex);
    const facetStartStringIndex = byteToStringIndex(text, facet.index.byteStart);
    const facetEndStringIndex = byteToStringIndex(text, facet.index.byteEnd);

    if (facetStartStringIndex > startStringIndex) {
      const plainText = text.slice(startStringIndex, facetStartStringIndex);
      if (plainText) {
        items.push({ type: 'text', content: plainText });
      }
    }

    const facetText = text.slice(facetStartStringIndex, facetEndStringIndex);
    const feature = facet.features[0];

    if (feature) {
      switch (feature.$type) {
        case 'app.bsky.richtext.facet#mention':
          if (feature.did) {
            items.push({
              type: 'mention',
              did: feature.did,
              handle: facetText.startsWith('@') ? facetText.slice(1) : facetText,
            });
          } else {
            items.push({ type: 'text', content: facetText });
          }
          break;
        case 'app.bsky.richtext.facet#link':
          if (feature.uri) {
            items.push({
              type: 'link',
              url: feature.uri,
              label: facetText,
            });
          } else {
            items.push({ type: 'text', content: facetText });
          }
          break;
        case 'app.bsky.richtext.facet#tag':
          if (feature.tag) {
            items.push({
              type: 'tag',
              tag: feature.tag,
            });
          } else {
            items.push({ type: 'text', content: facetText });
          }
          break;
        default:
          items.push({ type: 'text', content: facetText });
      }
    } else {
      items.push({ type: 'text', content: facetText });
    }

    currentByteIndex = facet.index.byteEnd;
  }

  const finalStartIndex = byteToStringIndex(text, currentByteIndex);
  if (finalStartIndex < text.length) {
    items.push({ type: 'text', content: text.slice(finalStartIndex) });
  }

  return items;
}
