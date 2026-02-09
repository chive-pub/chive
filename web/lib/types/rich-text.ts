/**
 * Rich text types for Chive.
 *
 * @remarks
 * This module defines a rich text format that combines:
 * - FOVEA-style entity references (nodeRef, wikidataRef, fieldRef, etc.)
 * - ATProto-style facets (mentions, links, hashtags)
 * - Markdown formatting (bold, italic, code, headings, lists)
 * - LaTeX math expressions (inline and display)
 *
 * This format enables consistent rendering across titles, abstracts,
 * and reviews while maintaining ATProto compatibility.
 *
 * @example
 * ```typescript
 * const content: RichText = {
 *   text: 'Check out this paper by @alice.bsky.social about machine learning!',
 *   items: [
 *     { type: 'text', content: 'Check out this paper by ' },
 *     { type: 'mention', handle: 'alice.bsky.social', did: 'did:plc:abc123' },
 *     { type: 'text', content: ' about ' },
 *     { type: 'nodeRef', uri: 'at://...', label: 'machine learning', subkind: 'field' },
 *     { type: 'text', content: '!' },
 *   ],
 * };
 * ```
 *
 * @packageDocumentation
 */

import type { RichTextFacet } from '@/lib/api/schema';

// Re-export for convenience
export type { RichTextFacet };

// =============================================================================
// ITEM TYPES
// =============================================================================

/**
 * All possible rich text item types.
 *
 * @remarks
 * Types are grouped by category:
 * - Basic: text (with optional formatting)
 * - ATProto facets: mention, link, tag
 * - Entity references: nodeRef, wikidataRef, fieldRef, facetRef, eprintRef, annotationRef, authorRef
 * - Cross-references: crossReference (review/annotation within an eprint)
 * - Special content: latex, code
 */
export type RichTextItemType =
  | 'text' // Plain text with optional formatting
  | 'mention' // @handle reference (ATProto)
  | 'link' // URL link (ATProto)
  | 'tag' // #hashtag (ATProto)
  | 'nodeRef' // Knowledge graph node reference
  | 'wikidataRef' // Wikidata entity reference (QID)
  | 'fieldRef' // Academic field reference
  | 'facetRef' // Facet classification reference
  | 'eprintRef' // Eprint reference
  | 'annotationRef' // Annotation reference
  | 'authorRef' // Author reference (DID)
  | 'crossReference' // Cross-reference to review or annotation
  | 'latex' // LaTeX math expression
  | 'code'; // Code block

// =============================================================================
// TEXT FORMATTING
// =============================================================================

/**
 * Text formatting options.
 *
 * @remarks
 * These can be combined (e.g., bold AND italic).
 * Applied only to items of type 'text'.
 */
export interface TextFormat {
  /** Bold text */
  bold?: boolean;
  /** Italic text */
  italic?: boolean;
  /** Strikethrough text */
  strikethrough?: boolean;
  /** Inline code formatting */
  code?: boolean;
}

// =============================================================================
// RICH TEXT ITEMS
// =============================================================================

/**
 * Base properties shared by all rich text items.
 */
interface BaseRichTextItem {
  /** Item type discriminator */
  type: RichTextItemType;
}

/**
 * Plain text item with optional formatting.
 */
export interface TextItem extends BaseRichTextItem {
  type: 'text';
  /** Text content */
  content: string;
  /** Optional formatting */
  format?: TextFormat;
}

/**
 * ATProto mention item (@handle).
 */
export interface MentionItem extends BaseRichTextItem {
  type: 'mention';
  /** User DID */
  did: string;
  /** User handle (for display) */
  handle?: string;
  /** Display name */
  displayName?: string;
}

/**
 * ATProto link item (URL).
 */
export interface LinkItem extends BaseRichTextItem {
  type: 'link';
  /** URL */
  url: string;
  /** Display text (defaults to URL if not provided) */
  label?: string;
}

/**
 * ATProto tag item (#hashtag).
 */
export interface TagItem extends BaseRichTextItem {
  type: 'tag';
  /** Tag value (without #) */
  tag: string;
}

/**
 * Knowledge graph node reference.
 */
export interface NodeRefItem extends BaseRichTextItem {
  type: 'nodeRef';
  /** AT-URI of the node */
  uri: string;
  /** Display label */
  label: string;
  /** Node subkind (field, institution, person, etc.) */
  subkind?: string;
}

/**
 * Wikidata entity reference.
 */
export interface WikidataRefItem extends BaseRichTextItem {
  type: 'wikidataRef';
  /** Wikidata QID (e.g., Q123456) */
  qid: string;
  /** Display label */
  label: string;
  /** Optional direct URL override */
  url?: string;
}

/**
 * Academic field reference.
 */
export interface FieldRefItem extends BaseRichTextItem {
  type: 'fieldRef';
  /** AT-URI of the field node */
  uri: string;
  /** Display label */
  label: string;
}

/**
 * Facet classification reference.
 */
export interface FacetRefItem extends BaseRichTextItem {
  type: 'facetRef';
  /** Facet dimension (e.g., 'time', 'space') */
  dimension: string;
  /** Facet value */
  value: string;
}

/**
 * Eprint reference.
 */
export interface EprintRefItem extends BaseRichTextItem {
  type: 'eprintRef';
  /** AT-URI of the eprint */
  uri: string;
  /** Eprint title */
  title: string;
}

/**
 * Annotation reference.
 */
export interface AnnotationRefItem extends BaseRichTextItem {
  type: 'annotationRef';
  /** AT-URI of the annotation */
  uri: string;
  /** Text excerpt for preview */
  excerpt: string;
}

/**
 * Author reference.
 */
export interface AuthorRefItem extends BaseRichTextItem {
  type: 'authorRef';
  /** Author DID */
  did: string;
  /** Display name */
  displayName?: string;
  /** Handle */
  handle?: string;
}

/**
 * Cross-reference to a review or annotation within an eprint.
 */
export interface CrossReferenceItem extends BaseRichTextItem {
  type: 'crossReference';
  /** AT-URI of the referenced review or annotation */
  uri: string;
  /** Display label (author name or excerpt) */
  label: string;
  /** Whether this references a review or annotation */
  refType: 'review' | 'annotation';
}

/**
 * LaTeX math expression.
 */
export interface LatexItem extends BaseRichTextItem {
  type: 'latex';
  /** LaTeX source */
  content: string;
  /** True for display mode (block), false for inline */
  displayMode: boolean;
}

/**
 * Code block.
 */
export interface CodeItem extends BaseRichTextItem {
  type: 'code';
  /** Code content */
  content: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** True for code block, false for inline code */
  block?: boolean;
}

/**
 * Union of all rich text item types.
 */
export type RichTextItem =
  | TextItem
  | MentionItem
  | LinkItem
  | TagItem
  | NodeRefItem
  | WikidataRefItem
  | FieldRefItem
  | FacetRefItem
  | EprintRefItem
  | AnnotationRefItem
  | AuthorRefItem
  | CrossReferenceItem
  | LatexItem
  | CodeItem;

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
  /** Plain text representation (for search, accessibility, fallback) */
  text: string;
  /** Rich text items for rendering */
  items: RichTextItem[];
  /** Optional HTML representation (for fast preview rendering) */
  html?: string;
}

// =============================================================================
// CONVERSION UTILITIES
// =============================================================================

/**
 * Creates a unified rich text from plain text.
 *
 * @param text - Plain text content
 * @returns Unified rich text with a single text item
 */
export function createFromPlainText(text: string): RichText {
  return {
    text,
    items: [{ type: 'text', content: text }],
  };
}

/**
 * Creates empty unified rich text.
 *
 * @returns Empty unified rich text
 */
export function createEmptyRichText(): RichText {
  return {
    text: '',
    items: [],
  };
}

/**
 * Extracts plain text from unified rich text items.
 *
 * @param items - Rich text items
 * @returns Plain text representation
 */
export function extractPlainText(items: RichTextItem[]): string {
  return items
    .map((item) => {
      switch (item.type) {
        case 'text':
        case 'latex':
        case 'code':
          return item.content;
        case 'mention':
          return `@${item.handle ?? item.displayName ?? item.did}`;
        case 'link':
          return item.label ?? item.url;
        case 'tag':
          return `#${item.tag}`;
        case 'nodeRef':
        case 'fieldRef':
        case 'wikidataRef':
          return item.label;
        case 'facetRef':
          return `${item.dimension}: ${item.value}`;
        case 'eprintRef':
          return item.title;
        case 'annotationRef':
          return item.excerpt;
        case 'authorRef':
          return item.displayName ?? item.handle ?? `@${item.did}`;
        case 'crossReference':
          return item.label;
        default:
          return '';
      }
    })
    .join('');
}

// =============================================================================
// LEGACY CONVERSION
// =============================================================================

/**
 * Annotation body item from legacy FOVEA format.
 *
 * @remarks
 * This type matches the existing RichAnnotationItem in schema.ts.
 */
export interface LegacyAnnotationItem {
  type?:
    | 'text'
    | 'nodeRef'
    | 'eprintRef'
    | 'wikidataRef'
    | 'fieldRef'
    | 'facetRef'
    | 'annotationRef'
    | 'authorRef';
  content?: string;
  uri?: string;
  label?: string;
  kind?: 'type' | 'object';
  subkind?: string;
  title?: string;
  qid?: string;
  url?: string;
  dimension?: string;
  value?: string;
  excerpt?: string;
  did?: string;
  displayName?: string;
}

/**
 * Converts legacy annotation body items to unified rich text items.
 *
 * @param items - Legacy annotation items
 * @returns Unified rich text items
 */
export function fromLegacyAnnotationItems(items: LegacyAnnotationItem[]): RichTextItem[] {
  return items
    .map((item): RichTextItem | null => {
      switch (item.type) {
        case 'text':
          return { type: 'text', content: item.content ?? '' };
        case 'nodeRef':
          return {
            type: 'nodeRef',
            uri: item.uri ?? '',
            label: item.label ?? 'Unknown',
            subkind: item.subkind,
          };
        case 'wikidataRef':
          return {
            type: 'wikidataRef',
            qid: item.qid ?? '',
            label: item.label ?? 'Unknown',
            url: item.url,
          };
        case 'fieldRef':
          return {
            type: 'fieldRef',
            uri: item.uri ?? '',
            label: item.label ?? 'Unknown',
          };
        case 'facetRef':
          return {
            type: 'facetRef',
            dimension: item.dimension ?? 'unknown',
            value: item.value ?? '',
          };
        case 'eprintRef':
          return {
            type: 'eprintRef',
            uri: item.uri ?? '',
            title: item.title ?? 'Untitled',
          };
        case 'annotationRef':
          return {
            type: 'annotationRef',
            uri: item.uri ?? '',
            excerpt: item.excerpt ?? '...',
          };
        case 'authorRef':
          return {
            type: 'authorRef',
            did: item.did ?? '',
            displayName: item.displayName,
          };
        default:
          // Handle unknown types as plain text
          if (item.content) {
            return { type: 'text', content: item.content };
          }
          return null;
      }
    })
    .filter((item): item is RichTextItem => item !== null);
}

/**
 * Converts unified rich text items to legacy annotation body format.
 *
 * @param items - Unified rich text items
 * @returns Legacy annotation items
 */
export function toLegacyAnnotationItems(items: RichTextItem[]): LegacyAnnotationItem[] {
  return items.map((item): LegacyAnnotationItem => {
    switch (item.type) {
      case 'text':
        return { type: 'text', content: item.content };
      case 'nodeRef':
        return { type: 'nodeRef', uri: item.uri, label: item.label, subkind: item.subkind };
      case 'wikidataRef':
        return { type: 'wikidataRef', qid: item.qid, label: item.label, url: item.url };
      case 'fieldRef':
        return { type: 'fieldRef', uri: item.uri, label: item.label };
      case 'facetRef':
        return { type: 'facetRef', dimension: item.dimension, value: item.value };
      case 'eprintRef':
        return { type: 'eprintRef', uri: item.uri, title: item.title };
      case 'annotationRef':
        return { type: 'annotationRef', uri: item.uri, excerpt: item.excerpt };
      case 'authorRef':
        return { type: 'authorRef', did: item.did, displayName: item.displayName };
      case 'mention':
        // Convert mentions to author refs
        return { type: 'authorRef', did: item.did, displayName: item.displayName };
      case 'link':
        // Links become text with the URL or label
        return { type: 'text', content: item.label ?? item.url };
      case 'tag':
        return { type: 'text', content: `#${item.tag}` };
      case 'latex':
        // LaTeX becomes text content
        return {
          type: 'text',
          content: item.displayMode ? `$$${item.content}$$` : `$${item.content}$`,
        };
      case 'crossReference':
        // Cross-references become annotation refs in legacy format
        return { type: 'annotationRef', uri: item.uri, excerpt: item.label };
      case 'code':
        return {
          type: 'text',
          content: item.block
            ? `\`\`\`${item.language ?? ''}\n${item.content}\n\`\`\``
            : `\`${item.content}\``,
        };
      default:
        return { type: 'text', content: '' };
    }
  });
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for text items.
 */
export function isTextItem(item: RichTextItem): item is TextItem {
  return item.type === 'text';
}

/**
 * Type guard for mention items.
 */
export function isMentionItem(item: RichTextItem): item is MentionItem {
  return item.type === 'mention';
}

/**
 * Type guard for link items.
 */
export function isLinkItem(item: RichTextItem): item is LinkItem {
  return item.type === 'link';
}

/**
 * Type guard for entity reference items.
 */
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

/**
 * Type guard for LaTeX items.
 */
export function isLatexItem(item: RichTextItem): item is LatexItem {
  return item.type === 'latex';
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
 *
 * @param text - The text string
 * @param byteIndex - The byte index to convert
 * @returns The string index
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
 *
 * @param text - Plain text content
 * @param facets - ATProto facets array
 * @returns Unified rich text items
 */
export function fromAtprotoRichText(text: string, facets?: RichTextFacet[] | null): RichTextItem[] {
  if (!facets || facets.length === 0) {
    return [{ type: 'text', content: text }];
  }

  // Sort facets by start position
  const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

  const items: RichTextItem[] = [];
  let currentByteIndex = 0;

  for (const facet of sortedFacets) {
    const startStringIndex = byteToStringIndex(text, currentByteIndex);
    const facetStartStringIndex = byteToStringIndex(text, facet.index.byteStart);
    const facetEndStringIndex = byteToStringIndex(text, facet.index.byteEnd);

    // Add plain text before this facet
    if (facetStartStringIndex > startStringIndex) {
      const plainText = text.slice(startStringIndex, facetStartStringIndex);
      if (plainText) {
        items.push({ type: 'text', content: plainText });
      }
    }

    // Add the faceted segment
    const facetText = text.slice(facetStartStringIndex, facetEndStringIndex);
    const feature = facet.features[0]; // Use first feature

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
          // Unknown facet type, just add as text
          items.push({ type: 'text', content: facetText });
      }
    } else {
      items.push({ type: 'text', content: facetText });
    }

    currentByteIndex = facet.index.byteEnd;
  }

  // Add remaining text after last facet
  const finalStartIndex = byteToStringIndex(text, currentByteIndex);
  if (finalStartIndex < text.length) {
    items.push({ type: 'text', content: text.slice(finalStartIndex) });
  }

  return items;
}
