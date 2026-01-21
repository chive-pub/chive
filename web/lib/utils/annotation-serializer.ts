/**
 * Serialization utilities for rich annotation content.
 *
 * @remarks
 * Handles conversion between contenteditable DOM and RichAnnotationBody:
 * - DOM → RichAnnotationBody for form submission
 * - RichAnnotationBody → HTML for rendering in contenteditable
 *
 * @packageDocumentation
 */

import type {
  RichAnnotationBody,
  RichAnnotationBodyObject,
  RichAnnotationItem,
} from '@/lib/api/schema';
import { getSubkindChipClasses } from '@/lib/constants/subkind-colors';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get items array from RichAnnotationBody, handling both object and array forms.
 *
 * @param body - The annotation body (object with items or array directly)
 * @returns The items array, or empty array if null/undefined
 */
function getBodyItems(body: RichAnnotationBody | null): RichAnnotationItem[] {
  if (!body) return [];
  // If it's an array, return it directly; otherwise get .items from the object
  return Array.isArray(body) ? body : (body.items ?? []);
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Node reference data from a chip element.
 */
export interface ChipData {
  uri: string;
  label: string;
  kind?: 'type' | 'object';
  subkind?: string;
  trigger: '@' | '#';
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** CSS class marker for chip elements */
const CHIP_CLASS = 'mention-chip';

// =============================================================================
// SERIALIZATION (DOM → Body)
// =============================================================================

/**
 * Serialize contenteditable DOM to RichAnnotationBody.
 *
 * @remarks
 * Walks the DOM tree, extracting text nodes and chip elements.
 * Text nodes become textItem, chip elements become nodeRefItem.
 *
 * @param element - The contenteditable element to serialize
 * @returns RichAnnotationBody with items
 *
 * @example
 * ```typescript
 * const body = serializeToBody(editableDiv);
 * // { type: 'RichText', items: [...], format: '...' }
 * ```
 */
export function serializeToBody(element: HTMLElement): RichAnnotationBodyObject {
  const items: RichAnnotationItem[] = [];
  let currentText = '';

  /**
   * Flush accumulated text to items array.
   */
  const flushText = () => {
    if (currentText) {
      // Normalize whitespace but preserve meaningful spaces
      const normalizedText = currentText.replace(/\u00A0/g, ' ');
      if (normalizedText.trim() || normalizedText === ' ') {
        items.push({ type: 'text', content: normalizedText });
      }
      currentText = '';
    }
  };

  /**
   * Recursively walk DOM nodes.
   */
  const walkNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      currentText += node.textContent ?? '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // Check if this is a chip element
      if (el.classList.contains(CHIP_CLASS) && el.dataset.nodeUri) {
        flushText();

        items.push({
          type: 'nodeRef',
          uri: el.dataset.nodeUri,
          label: el.dataset.nodeLabel ?? '',
          kind: el.dataset.kind as 'type' | 'object' | undefined,
          subkind: el.dataset.subkind,
        });
      } else if (el.tagName === 'BR') {
        // Handle line breaks
        currentText += '\n';
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        // Block elements typically add newlines
        if (currentText && !currentText.endsWith('\n')) {
          currentText += '\n';
        }
        // Walk children
        for (const child of el.childNodes) {
          walkNode(child);
        }
        if (currentText && !currentText.endsWith('\n')) {
          currentText += '\n';
        }
      } else {
        // Walk children of inline elements
        for (const child of el.childNodes) {
          walkNode(child);
        }
      }
    }
  };

  // Walk all top-level children
  for (const child of element.childNodes) {
    walkNode(child);
  }

  // Flush any remaining text
  flushText();

  // Clean up: merge adjacent text items and trim
  const mergedItems: RichAnnotationItem[] = [];
  for (const item of items) {
    if (item.type === 'text' && mergedItems.length > 0) {
      const last = mergedItems[mergedItems.length - 1];
      if (last.type === 'text' && last.content !== undefined && item.content !== undefined) {
        last.content += item.content;
        continue;
      }
    }
    mergedItems.push(item);
  }

  // Trim leading/trailing whitespace from first/last text items
  if (mergedItems.length > 0) {
    const first = mergedItems[0];
    if (first.type === 'text' && first.content !== undefined) {
      first.content = first.content.replace(/^[\s\n]+/, '');
      if (!first.content) {
        mergedItems.shift();
      }
    }
  }
  if (mergedItems.length > 0) {
    const last = mergedItems[mergedItems.length - 1];
    if (last.type === 'text' && last.content !== undefined) {
      last.content = last.content.replace(/[\s\n]+$/, '');
      if (!last.content) {
        mergedItems.pop();
      }
    }
  }

  return {
    type: 'RichText',
    items: mergedItems,
    format: 'application/x-chive-gloss+json',
  };
}

// =============================================================================
// DESERIALIZATION (Body → HTML)
// =============================================================================

/**
 * Escape HTML special characters.
 */
export function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert newlines to <br> tags.
 */
function textToHTML(text: string): string {
  return escapeHTML(text).replace(/\n/g, '<br>');
}

/**
 * Render RichAnnotationBody as HTML for contenteditable.
 *
 * @param body - The annotation body to render
 * @returns HTML string for contenteditable
 *
 * @example
 * ```typescript
 * const html = renderBodyToHTML(body);
 * editableDiv.innerHTML = html;
 * ```
 */
export function renderBodyToHTML(body: RichAnnotationBody | null): string {
  const items = getBodyItems(body);
  if (items.length === 0) {
    return '';
  }

  return items
    .map((item: RichAnnotationItem) => {
      switch (item.type) {
        case 'text':
          return textToHTML(item.content ?? '');

        case 'nodeRef': {
          const colorClasses = getSubkindChipClasses(item.subkind ?? 'default');
          const trigger = item.kind === 'object' ? '@' : '#';
          return `<span contenteditable="false" class="${CHIP_CLASS}" data-node-uri="${escapeHTML(item.uri ?? '')}" data-node-label="${escapeHTML(item.label ?? '')}" data-kind="${escapeHTML(item.kind ?? '')}" data-subkind="${escapeHTML(item.subkind ?? '')}" data-trigger="${trigger}"><span class="inline-flex items-center rounded px-1.5 py-0.5 text-sm font-medium mx-0.5 ${colorClasses}">${escapeHTML(item.label ?? '')}</span></span>`;
        }

        default:
          return '';
      }
    })
    .join('');
}

// =============================================================================
// CHIP CREATION
// =============================================================================

/**
 * Create chip HTML for insertion at cursor.
 *
 * @param uri - AT-URI of the node
 * @param label - Display label
 * @param kind - Node kind (type or object)
 * @param subkind - Subkind for styling
 * @param trigger - Trigger character (@ or #)
 * @returns HTML string for the chip
 */
export function createChipHTML(
  uri: string,
  label: string,
  kind: 'type' | 'object',
  subkind: string,
  trigger: '@' | '#'
): string {
  const colorClasses = getSubkindChipClasses(subkind);
  return `<span contenteditable="false" class="${CHIP_CLASS}" data-node-uri="${escapeHTML(uri)}" data-node-label="${escapeHTML(label)}" data-kind="${escapeHTML(kind)}" data-subkind="${escapeHTML(subkind)}" data-trigger="${trigger}"><span class="inline-flex items-center rounded px-1.5 py-0.5 text-sm font-medium mx-0.5 ${colorClasses}">${escapeHTML(label)}</span></span>`;
}

/**
 * Create a chip DOM element.
 *
 * @param uri - AT-URI of the node
 * @param label - Display label
 * @param kind - Node kind (type or object)
 * @param subkind - Subkind for styling
 * @param trigger - Trigger character (@ or #)
 * @returns HTMLSpanElement for the chip
 */
export function createChipElement(
  uri: string,
  label: string,
  kind: 'type' | 'object',
  subkind: string,
  trigger: '@' | '#'
): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.className = CHIP_CLASS;
  chip.dataset.nodeUri = uri;
  chip.dataset.nodeLabel = label;
  chip.dataset.kind = kind;
  chip.dataset.subkind = subkind;
  chip.dataset.trigger = trigger;

  const colorClasses = getSubkindChipClasses(subkind);
  const badge = document.createElement('span');
  badge.className = `inline-flex items-center rounded px-1.5 py-0.5 text-sm font-medium mx-0.5 ${colorClasses}`;
  badge.textContent = label;

  chip.appendChild(badge);
  return chip;
}

// =============================================================================
// PLAIN TEXT EXTRACTION
// =============================================================================

/**
 * Extract plain text from RichAnnotationBody.
 *
 * @remarks
 * Useful for:
 * - Character counting
 * - Search indexing
 * - Display in contexts that don't support rich text
 *
 * @param body - The annotation body
 * @returns Plain text representation
 */
export function extractPlainText(body: RichAnnotationBody | null): string {
  const items = getBodyItems(body);
  if (items.length === 0) {
    return '';
  }

  return items
    .map((item: RichAnnotationItem) => {
      switch (item.type) {
        case 'text':
          return item.content ?? '';
        case 'nodeRef':
          return item.label ?? '';
        case 'wikidataRef':
          return item.label ?? '';
        case 'fieldRef':
          return item.label ?? '';
        case 'eprintRef':
          return item.title ?? '';
        case 'facetRef':
          return `${item.dimension ?? ''}: ${item.value ?? ''}`;
        case 'annotationRef':
          return item.excerpt ?? '';
        case 'authorRef':
          return item.displayName ?? '';
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Get text content length from body.
 *
 * @param body - The annotation body
 * @returns Total character count
 */
export function getTextLength(body: RichAnnotationBody | null): number {
  return extractPlainText(body).length;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that a body doesn't exceed max length.
 *
 * @param body - The annotation body
 * @param maxLength - Maximum allowed length
 * @returns Whether the body is within limits
 */
export function isWithinMaxLength(body: RichAnnotationBody | null, maxLength: number): boolean {
  return getTextLength(body) <= maxLength;
}

/**
 * Check if the body contains content.
 *
 * @param body - The annotation body
 * @returns Whether the body has content
 */
export function hasContent(body: RichAnnotationBody | null): boolean {
  const items = getBodyItems(body);
  if (items.length === 0) {
    return false;
  }

  return items.some((item: RichAnnotationItem) => {
    if (item.type === 'text') {
      return (item.content ?? '').trim().length > 0;
    }
    return true; // Non-text items count as content
  });
}
