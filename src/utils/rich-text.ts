/**
 * Rich text utilities for processing annotation/abstract content.
 *
 * @remarks
 * Handles extraction and manipulation of rich text bodies in the GlossItem format.
 *
 * @packageDocumentation
 */

import type {
  TextItem as LexTextItem,
  NodeRefItem as LexNodeRefItem,
  WikidataRefItem as LexWikidataRefItem,
  FieldRefItem as LexFieldRefItem,
  FacetRefItem as LexFacetRefItem,
  EprintRefItem as LexEprintRefItem,
  AnnotationRefItem as LexAnnotationRefItem,
  AuthorRefItem as LexAuthorRefItem,
  MentionItem as LexMentionItem,
  LinkItem as LexLinkItem,
  TagItem as LexTagItem,
  LatexItem as LexLatexItem,
  CodeBlockItem as LexCodeBlockItem,
  HeadingItem as LexHeadingItem,
  ListItem as LexListItem,
  BlockquoteItem as LexBlockquoteItem,
} from '../lexicons/generated/types/pub/chive/richtext/defs.js';
import {
  validateTextItem,
  validateNodeRefItem,
  validateWikidataRefItem,
  validateFieldRefItem,
  validateFacetRefItem,
  validateEprintRefItem,
  validateAnnotationRefItem,
  validateAuthorRefItem,
  validateMentionItem,
  validateLinkItem,
  validateTagItem,
  validateLatexItem,
  validateCodeBlockItem,
  validateHeadingItem,
  validateListItem,
  validateBlockquoteItem,
} from '../lexicons/generated/types/pub/chive/richtext/defs.js';
import type {
  AnnotationBody,
  AnnotationBodyItem,
  TextBodyItem,
  NodeRefBodyItem,
  EprintRefBodyItem,
  WikidataRefBodyItem,
  AuthorityRefBodyItem,
  FieldRefBodyItem,
  FacetRefBodyItem,
  AnnotationRefBodyItem,
  AuthorRefBodyItem,
} from '../types/models/annotation.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Re-export canonical types from annotation model.
 */
export type {
  AnnotationBody,
  AnnotationBodyItem,
  TextBodyItem,
  NodeRefBodyItem,
  EprintRefBodyItem,
  WikidataRefBodyItem,
  AuthorityRefBodyItem,
  FieldRefBodyItem,
  FacetRefBodyItem,
  AnnotationRefBodyItem,
  AuthorRefBodyItem,
};

/**
 * Flexible input type for functions that accept rich text bodies.
 * Accepts both strict AnnotationBody and looser structures.
 */
export interface RichTextInput {
  type?: 'RichText';
  items?: readonly unknown[];
  format?: string;
}

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract plain text from a rich text body.
 *
 * @remarks
 * Used for:
 * - Full-text search indexing
 * - Character counting
 * - Display in plain text contexts
 *
 * @param richBody - The rich text body to extract from
 * @returns Plain text representation
 *
 * @example
 * ```typescript
 * const plainText = extractPlainText(eprint.abstract);
 * await searchIndex.index({ abstractPlainText: plainText });
 * ```
 */
export function extractPlainText(richBody: AnnotationBody | null | undefined): string {
  if (!richBody?.items) {
    return '';
  }

  return richBody.items
    .map((item: AnnotationBodyItem) => {
      switch (item.type) {
        case 'text':
          return item.content ?? '';
        case 'nodeRef':
          return item.label ?? '';
        case 'eprintRef':
          return item.title ?? '';
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Create a rich text body from plain text.
 *
 * @param plainText - The plain text to wrap
 * @returns Rich text body with a single text item
 */
export function createRichTextFromPlain(plainText: string): AnnotationBody {
  return {
    type: 'RichText',
    items: [{ type: 'text', content: plainText }],
    format: 'application/x-chive-gloss+json',
  };
}

/**
 * Check if a rich text body is empty (no content).
 *
 * @param richBody - The rich text body to check
 * @returns Whether the body is empty
 */
export function isRichTextEmpty(richBody: AnnotationBody | null | undefined): boolean {
  if (!richBody?.items || richBody.items.length === 0) {
    return true;
  }

  return richBody.items.every((item: AnnotationBodyItem) => {
    if (item.type === 'text') {
      const textItem = item;
      return !textItem.content || textItem.content.trim().length === 0;
    }
    return false;
  });
}

/**
 * Get the character count of a rich text body.
 *
 * @param richBody - The rich text body to measure
 * @returns Character count
 */
export function getRichTextLength(richBody: AnnotationBody | null | undefined): number {
  return extractPlainText(richBody).length;
}

/**
 * Truncate a rich text body to a maximum length.
 *
 * @remarks
 * Preserves complete items where possible, truncating text items as needed.
 *
 * @param richBody - The rich text body to truncate
 * @param maxLength - Maximum character length
 * @param ellipsis - Optional ellipsis string to append
 * @returns Truncated rich text body
 */
export function truncateRichText(
  richBody: AnnotationBody | null | undefined,
  maxLength: number,
  ellipsis = '...'
): AnnotationBody {
  if (!richBody?.items) {
    return { type: 'RichText', items: [], format: 'application/x-chive-gloss+json' };
  }

  const items: AnnotationBodyItem[] = [];
  let currentLength = 0;

  for (const item of richBody.items) {
    if (currentLength >= maxLength) {
      break;
    }

    if (item.type === 'text') {
      const textItem = item;
      const remaining = maxLength - currentLength;
      if (textItem.content.length <= remaining) {
        items.push(item);
        currentLength += textItem.content.length;
      } else {
        // Truncate text item
        const truncatedContent = textItem.content.slice(0, remaining - ellipsis.length) + ellipsis;
        items.push({ type: 'text', content: truncatedContent });
        break;
      }
    } else if (item.type === 'nodeRef') {
      const nodeItem = item;
      const itemLength = nodeItem.label?.length ?? 0;
      if (currentLength + itemLength <= maxLength) {
        items.push(item);
        currentLength += itemLength;
      } else {
        break;
      }
    } else if (item.type === 'eprintRef') {
      const eprintItem = item;
      const itemLength = eprintItem.title?.length ?? 0;
      if (currentLength + itemLength <= maxLength) {
        items.push(item);
        currentLength += itemLength;
      } else {
        break;
      }
    }
  }

  return {
    type: richBody.type,
    items,
    format: richBody.format,
  };
}

/**
 * Extract all node references from a rich text body.
 *
 * @param richBody - The rich text body to extract from
 * @returns Array of node reference URIs
 */
export function extractNodeRefs(richBody: AnnotationBody | null | undefined): string[] {
  if (!richBody?.items) {
    return [];
  }

  return richBody.items
    .filter((item: AnnotationBodyItem): item is NodeRefBodyItem => item.type === 'nodeRef')
    .map((item: NodeRefBodyItem) => item.uri);
}

/**
 * Extract all eprint references from a rich text body.
 *
 * @param richBody - The rich text body to extract from
 * @returns Array of eprint reference URIs
 */
export function extractEprintRefs(richBody: AnnotationBody | null | undefined): string[] {
  if (!richBody?.items) {
    return [];
  }

  return richBody.items
    .filter((item: AnnotationBodyItem): item is EprintRefBodyItem => item.type === 'eprintRef')
    .map((item: EprintRefBodyItem) => item.uri);
}

/**
 * Validate a rich text body structure.
 *
 * @param richBody - The value to validate
 * @returns Whether the value is a valid rich text body
 */
export function isValidRichTextBody(richBody: unknown): richBody is AnnotationBody {
  if (!richBody || typeof richBody !== 'object') {
    return false;
  }

  const body = richBody as Record<string, unknown>;

  if (!Array.isArray(body.items)) {
    return false;
  }

  return body.items.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const i = item as Record<string, unknown>;

    switch (i.type) {
      case 'text':
        return typeof i.content === 'string';
      case 'nodeRef':
        return typeof i.uri === 'string';
      case 'eprintRef':
        return typeof i.uri === 'string';
      default:
        return false;
    }
  });
}

/**
 * Wire-format rich text item: discriminated union of all lexicon item types.
 *
 * @remarks
 * Each variant requires its `$type` tag for XRPC wire format.
 * This is the canonical output type for all rich text serialization.
 */
export type WireRichTextItem =
  | (LexTextItem & { $type: 'pub.chive.richtext.defs#textItem' })
  | (LexNodeRefItem & { $type: 'pub.chive.richtext.defs#nodeRefItem' })
  | (LexWikidataRefItem & { $type: 'pub.chive.richtext.defs#wikidataRefItem' })
  | (LexFieldRefItem & { $type: 'pub.chive.richtext.defs#fieldRefItem' })
  | (LexFacetRefItem & { $type: 'pub.chive.richtext.defs#facetRefItem' })
  | (LexEprintRefItem & { $type: 'pub.chive.richtext.defs#eprintRefItem' })
  | (LexAnnotationRefItem & { $type: 'pub.chive.richtext.defs#annotationRefItem' })
  | (LexAuthorRefItem & { $type: 'pub.chive.richtext.defs#authorRefItem' })
  | (LexMentionItem & { $type: 'pub.chive.richtext.defs#mentionItem' })
  | (LexLinkItem & { $type: 'pub.chive.richtext.defs#linkItem' })
  | (LexTagItem & { $type: 'pub.chive.richtext.defs#tagItem' })
  | (LexLatexItem & { $type: 'pub.chive.richtext.defs#latexItem' })
  | (LexCodeBlockItem & { $type: 'pub.chive.richtext.defs#codeBlockItem' })
  | (LexHeadingItem & { $type: 'pub.chive.richtext.defs#headingItem' })
  | (LexListItem & { $type: 'pub.chive.richtext.defs#listItem' })
  | (LexBlockquoteItem & { $type: 'pub.chive.richtext.defs#blockquoteItem' });

// =============================================================================
// TYPED MAPPING: AnnotationBodyItem → WireRichTextItem
// =============================================================================

/**
 * Maps a typed AnnotationBodyItem to wire format with exhaustive checking.
 *
 * @remarks
 * This is the primary mapping path used when the input is a typed AnnotationBody
 * from the database. Every AnnotationBodyItem variant is handled explicitly with
 * property name normalization where the DB model diverges from the lexicon wire format.
 *
 * @internal
 */
function mapAnnotationBodyItemToWire(item: AnnotationBodyItem): WireRichTextItem {
  switch (item.type) {
    case 'text':
      return {
        $type: 'pub.chive.richtext.defs#textItem',
        type: 'text' as const,
        content: item.content,
      };
    case 'nodeRef':
      return {
        $type: 'pub.chive.richtext.defs#nodeRefItem',
        type: 'nodeRef' as const,
        uri: item.uri,
        label: item.label,
        subkind: item.subkind,
      };
    case 'wikidataRef':
      return {
        $type: 'pub.chive.richtext.defs#wikidataRefItem',
        type: 'wikidataRef' as const,
        qid: item.qid,
        label: item.label,
      };
    case 'fieldRef':
      return {
        $type: 'pub.chive.richtext.defs#fieldRefItem',
        type: 'fieldRef' as const,
        uri: item.uri,
        label: item.label,
      };
    case 'facetRef':
      return {
        $type: 'pub.chive.richtext.defs#facetRefItem',
        type: 'facetRef' as const,
        // FacetRefBodyItem stores dimension+value; wire format uses uri+label
        uri: item.dimension,
        label: item.value,
      };
    case 'eprintRef':
      return {
        $type: 'pub.chive.richtext.defs#eprintRefItem',
        type: 'eprintRef' as const,
        uri: item.uri,
        // EprintRefBodyItem stores 'title'; wire format uses 'label'
        label: item.title,
      };
    case 'annotationRef':
      return {
        $type: 'pub.chive.richtext.defs#annotationRefItem',
        type: 'annotationRef' as const,
        uri: item.uri,
        // AnnotationRefBodyItem stores 'excerpt'; wire format uses 'label'
        label: item.excerpt,
      };
    case 'authorRef':
      return {
        $type: 'pub.chive.richtext.defs#authorRefItem',
        type: 'authorRef' as const,
        did: item.did,
        // AuthorRefBodyItem stores 'displayName'; wire format uses 'label'
        label: item.displayName,
      };
    case 'authorityRef':
      // AuthorityRefBodyItem has no dedicated wire type; maps to nodeRefItem
      return {
        $type: 'pub.chive.richtext.defs#nodeRefItem',
        type: 'nodeRef' as const,
        uri: item.uri,
        label: item.label,
      };
    default: {
      // Exhaustive check: TypeScript will error if a variant is unhandled
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}

// =============================================================================
// RAW MAPPING: unknown JSONB → WireRichTextItem
// =============================================================================

/** Read a string property from an untyped JSONB object at the system boundary. */
function rawStr(item: Readonly<Record<string, unknown>>, key: string, fallback = ''): string {
  const v = item[key];
  return typeof v === 'string' ? v : fallback;
}

/** Read an optional string property from an untyped JSONB object. */
function rawOptStr(item: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const v = item[key];
  return typeof v === 'string' ? v : undefined;
}

/** Read an optional boolean property from an untyped JSONB object. */
function rawOptBool(item: Readonly<Record<string, unknown>>, key: string): boolean | undefined {
  const v = item[key];
  return typeof v === 'boolean' ? v : undefined;
}

/** Read an optional number property from an untyped JSONB object. */
function rawOptNum(item: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const v = item[key];
  return typeof v === 'number' ? v : undefined;
}

/**
 * Maps a single untyped JSONB item to wire format.
 *
 * @remarks
 * Used only at the system boundary where items arrive as unstructured JSONB
 * (e.g., raw arrays passed directly to toWireFormat). This path handles all
 * 16 wire item types plus legacy property name fallbacks.
 *
 * @internal
 */
function mapRawItemToWire(item: Readonly<Record<string, unknown>>): WireRichTextItem {
  const itemType = typeof item.type === 'string' ? item.type : '';

  switch (itemType) {
    case 'text':
      return {
        $type: 'pub.chive.richtext.defs#textItem',
        type: 'text' as const,
        content: rawStr(item, 'content'),
        ...(item.facets != null ? { facets: item.facets as LexTextItem['facets'] } : {}),
      };
    case 'nodeRef':
      return {
        $type: 'pub.chive.richtext.defs#nodeRefItem',
        type: 'nodeRef' as const,
        uri: rawStr(item, 'uri'),
        label: rawOptStr(item, 'label'),
        subkind: rawOptStr(item, 'subkind'),
      };
    case 'wikidataRef':
      return {
        $type: 'pub.chive.richtext.defs#wikidataRefItem',
        type: 'wikidataRef' as const,
        qid: rawStr(item, 'qid'),
        label: rawOptStr(item, 'label'),
      };
    case 'fieldRef':
      return {
        $type: 'pub.chive.richtext.defs#fieldRefItem',
        type: 'fieldRef' as const,
        uri: rawStr(item, 'uri'),
        label: rawOptStr(item, 'label'),
      };
    case 'facetRef':
      return {
        $type: 'pub.chive.richtext.defs#facetRefItem',
        type: 'facetRef' as const,
        uri: rawStr(item, 'uri') || rawStr(item, 'dimension'),
        label: rawOptStr(item, 'label') ?? rawOptStr(item, 'value'),
      };
    case 'eprintRef':
      return {
        $type: 'pub.chive.richtext.defs#eprintRefItem',
        type: 'eprintRef' as const,
        uri: rawStr(item, 'uri'),
        label: rawOptStr(item, 'label') ?? rawOptStr(item, 'title'),
      };
    case 'annotationRef':
      return {
        $type: 'pub.chive.richtext.defs#annotationRefItem',
        type: 'annotationRef' as const,
        uri: rawStr(item, 'uri'),
        label: rawOptStr(item, 'label') ?? rawOptStr(item, 'excerpt'),
      };
    case 'authorRef':
      return {
        $type: 'pub.chive.richtext.defs#authorRefItem',
        type: 'authorRef' as const,
        did: rawStr(item, 'did'),
        label: rawOptStr(item, 'label') ?? rawOptStr(item, 'displayName'),
      };
    case 'mention':
      return {
        $type: 'pub.chive.richtext.defs#mentionItem',
        type: 'mention' as const,
        did: rawStr(item, 'did'),
        handle: rawOptStr(item, 'handle'),
      };
    case 'link':
      return {
        $type: 'pub.chive.richtext.defs#linkItem',
        type: 'link' as const,
        url: rawStr(item, 'url'),
        label: rawOptStr(item, 'label'),
      };
    case 'tag':
      return {
        $type: 'pub.chive.richtext.defs#tagItem',
        type: 'tag' as const,
        tag: rawStr(item, 'tag'),
      };
    case 'latex':
      return {
        $type: 'pub.chive.richtext.defs#latexItem',
        type: 'latex' as const,
        content: rawStr(item, 'content'),
        displayMode: rawOptBool(item, 'displayMode'),
      };
    case 'codeBlock':
      return {
        $type: 'pub.chive.richtext.defs#codeBlockItem',
        type: 'codeBlock' as const,
        content: rawStr(item, 'content'),
        language: rawOptStr(item, 'language'),
      };
    case 'heading':
      return {
        $type: 'pub.chive.richtext.defs#headingItem',
        type: 'heading' as const,
        content: rawStr(item, 'content'),
        level: typeof item.level === 'number' ? item.level : 1,
      };
    case 'listItem':
      return {
        $type: 'pub.chive.richtext.defs#listItem',
        type: 'listItem' as const,
        content: rawStr(item, 'content'),
        listType: rawStr(item, 'listType', 'bullet') as 'bullet' | 'ordered',
        depth: rawOptNum(item, 'depth'),
        ordinal: rawOptNum(item, 'ordinal'),
      };
    case 'blockquote':
      return {
        $type: 'pub.chive.richtext.defs#blockquoteItem',
        type: 'blockquote' as const,
        content: rawStr(item, 'content'),
      };
    default:
      return {
        $type: 'pub.chive.richtext.defs#textItem',
        type: 'text' as const,
        content: rawStr(item, 'content') || rawStr(item, 'label') || '',
      };
  }
}

/**
 * Runtime validators keyed by item type discriminator.
 *
 * @internal
 */
type LexValidator = (v: unknown) => { success: boolean; error?: { message: string } };

const VALIDATORS: Record<string, LexValidator> = {
  text: validateTextItem as LexValidator,
  nodeRef: validateNodeRefItem as LexValidator,
  wikidataRef: validateWikidataRefItem as LexValidator,
  fieldRef: validateFieldRefItem as LexValidator,
  facetRef: validateFacetRefItem as LexValidator,
  eprintRef: validateEprintRefItem as LexValidator,
  annotationRef: validateAnnotationRefItem as LexValidator,
  authorRef: validateAuthorRefItem as LexValidator,
  mention: validateMentionItem as LexValidator,
  link: validateLinkItem as LexValidator,
  tag: validateTagItem as LexValidator,
  latex: validateLatexItem as LexValidator,
  codeBlock: validateCodeBlockItem as LexValidator,
  heading: validateHeadingItem as LexValidator,
  listItem: validateListItem as LexValidator,
  blockquote: validateBlockquoteItem as LexValidator,
};

/**
 * Validates a single wire-format item against its lexicon schema.
 *
 * @param item - The wire item to validate
 * @returns Validation result with success flag and optional error message
 */
export function validateWireItem(item: WireRichTextItem): { success: boolean; error?: string } {
  const validator = VALIDATORS[item.type];
  if (!validator) {
    return { success: false, error: `Unknown item type: ${item.type}` };
  }
  const result = validator(item);
  if (!result.success) {
    return { success: false, error: result.error?.message ?? 'validation failed' };
  }
  return { success: true };
}

/**
 * Validates an entire wire-format array against lexicon schemas.
 *
 * @param items - The wire items to validate
 * @returns Array of validation errors (empty if all valid)
 */
export function validateWireItems(items: WireRichTextItem[]): string[] {
  const errors: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const result = validateWireItem(item);
    if (!result.success) {
      errors.push(`Item[${i}] (${item.type}): ${result.error ?? 'validation failed'}`);
    }
  }
  return errors;
}

/**
 * Convert an AnnotationBody (or raw items array) to the wire-format array.
 *
 * @remarks
 * The wire format uses `$type` discriminators from the `pub.chive.richtext.defs`
 * namespace. This function accepts both wrapped AnnotationBody objects and raw
 * arrays of items, adds the required `$type` tags, and maps property names
 * where the wire format differs from the internal model.
 *
 * Items that already carry a `$type` starting with `pub.chive.richtext.defs#`
 * are passed through unchanged.
 *
 * @param body - The rich text body (wrapped or raw array)
 * @returns Array of wire-format items, or undefined if empty
 */
export function toWireFormat(
  body: AnnotationBody | readonly unknown[] | null | undefined
): WireRichTextItem[] | undefined {
  if (!body) {
    return undefined;
  }

  // Typed path: AnnotationBody from the database with typed AnnotationBodyItem[]
  if (
    !Array.isArray(body) &&
    typeof body === 'object' &&
    'items' in body &&
    Array.isArray(body.items)
  ) {
    const typedBody = body;
    if (typedBody.items.length === 0) {
      return undefined;
    }
    return typedBody.items.map(mapAnnotationBodyItemToWire);
  }

  // Raw path: untyped array from JSONB system boundary
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return undefined;
    }
    return body.map((raw: unknown): WireRichTextItem => {
      if (!raw || typeof raw !== 'object') {
        return { $type: 'pub.chive.richtext.defs#textItem', type: 'text' as const, content: '' };
      }
      return mapRawItemToWire(raw as Readonly<Record<string, unknown>>);
    });
  }

  return undefined;
}

/**
 * Migrate a plain text abstract to rich text format.
 *
 * @param plainText - The plain text abstract
 * @returns Rich text body
 */
export function migrateAbstractToRichText(plainText: string | null | undefined): AnnotationBody {
  if (!plainText) {
    return { type: 'RichText', items: [], format: 'application/x-chive-gloss+json' };
  }

  return createRichTextFromPlain(plainText);
}
