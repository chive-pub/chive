/**
 * Rich text utilities for processing annotation/abstract content.
 *
 * @remarks
 * Handles extraction and manipulation of rich text bodies in the GlossItem format.
 *
 * @packageDocumentation
 */

import type {
  AnnotationBody,
  AnnotationBodyItem,
  TextBodyItem,
  NodeRefBodyItem,
  EprintRefBodyItem,
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
};

/**
 * Alias for backwards compatibility.
 */
export type RichTextBody = AnnotationBody;

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
export function extractPlainText(richBody: RichTextBody | null | undefined): string {
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
export function createRichTextFromPlain(plainText: string): RichTextBody {
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
export function isRichTextEmpty(richBody: RichTextBody | null | undefined): boolean {
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
export function getRichTextLength(richBody: RichTextBody | null | undefined): number {
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
  richBody: RichTextBody | null | undefined,
  maxLength: number,
  ellipsis = '...'
): RichTextBody {
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
export function extractNodeRefs(richBody: RichTextBody | null | undefined): string[] {
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
export function extractEprintRefs(richBody: RichTextBody | null | undefined): string[] {
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
export function isValidRichTextBody(richBody: unknown): richBody is RichTextBody {
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
 * Migrate a plain text abstract to rich text format.
 *
 * @param plainText - The plain text abstract
 * @returns Rich text body
 */
export function migrateAbstractToRichText(plainText: string | null | undefined): RichTextBody {
  if (!plainText) {
    return { type: 'RichText', items: [], format: 'application/x-chive-gloss+json' };
  }

  return createRichTextFromPlain(plainText);
}
