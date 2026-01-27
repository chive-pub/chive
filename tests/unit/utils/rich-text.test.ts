/**
 * Unit tests for rich text utilities.
 *
 * @remarks
 * Tests extraction, manipulation, and validation of rich text bodies.
 */

import { describe, it, expect } from 'vitest';

import type { AtUri } from '@/types/atproto.js';
import type { AnnotationBody, AnnotationBodyItem } from '@/utils/rich-text.js';
import {
  extractPlainText,
  createRichTextFromPlain,
  isRichTextEmpty,
  getRichTextLength,
  truncateRichText,
  extractNodeRefs,
  extractEprintRefs,
  isValidRichTextBody,
  migrateAbstractToRichText,
} from '@/utils/rich-text.js';

// =============================================================================
// TEST DATA
// =============================================================================

const createTextItem = (content: string): AnnotationBodyItem => ({
  type: 'text' as const,
  content,
});
const createNodeRefItem = (uri: string, label: string): AnnotationBodyItem => ({
  type: 'nodeRef' as const,
  uri: uri as AtUri,
  label,
});
const createEprintRefItem = (uri: string, title: string): AnnotationBodyItem => ({
  type: 'eprintRef' as const,
  uri: uri as AtUri,
  title,
});

const createRichBody = (items: AnnotationBody['items']): AnnotationBody => ({
  type: 'RichText',
  items,
  format: 'application/x-chive-gloss+json',
});

// =============================================================================
// extractPlainText
// =============================================================================

describe('extractPlainText', () => {
  it('returns empty string for null input', () => {
    expect(extractPlainText(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(extractPlainText(undefined)).toBe('');
  });

  it('returns empty string for body with no items', () => {
    const body = createRichBody([]);
    expect(extractPlainText(body)).toBe('');
  });

  it('extracts text from text items', () => {
    const body = createRichBody([createTextItem('Hello'), createTextItem(' world')]);
    expect(extractPlainText(body)).toBe('Hello world');
  });

  it('extracts labels from nodeRef items', () => {
    const body = createRichBody([
      createTextItem('See '),
      createNodeRefItem('at://did/collection/rkey', 'Machine Learning'),
    ]);
    expect(extractPlainText(body)).toBe('See Machine Learning');
  });

  it('extracts titles from eprintRef items', () => {
    const body = createRichBody([
      createTextItem('As shown in '),
      createEprintRefItem('at://did/eprint/123', 'Related Paper'),
    ]);
    expect(extractPlainText(body)).toBe('As shown in Related Paper');
  });

  it('handles mixed item types', () => {
    const body = createRichBody([
      createTextItem('Introduction to '),
      createNodeRefItem('at://did/field/ml', 'ML'),
      createTextItem(' and '),
      createEprintRefItem('at://did/eprint/456', 'Deep Learning'),
    ]);
    expect(extractPlainText(body)).toBe('Introduction to ML and Deep Learning');
  });

  it('handles items with missing content', () => {
    const body = createRichBody([
      { type: 'text' as const, content: '' },
      { type: 'nodeRef' as const, uri: 'at://x' as AtUri, label: '' },
    ]);
    expect(extractPlainText(body)).toBe('');
  });

  it('handles unknown item types gracefully', () => {
    const body = createRichBody([
      createTextItem('Hello'),
      { type: 'unknown' as never } as never,
      createTextItem(' world'),
    ]);
    expect(extractPlainText(body)).toBe('Hello world');
  });
});

// =============================================================================
// createRichTextFromPlain
// =============================================================================

describe('createRichTextFromPlain', () => {
  it('creates rich text body from plain text', () => {
    const result = createRichTextFromPlain('Hello world');
    expect(result).toEqual({
      type: 'RichText',
      items: [{ type: 'text', content: 'Hello world' }],
      format: 'application/x-chive-gloss+json',
    });
  });

  it('handles empty string', () => {
    const result = createRichTextFromPlain('');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({ type: 'text', content: '' });
  });
});

// =============================================================================
// isRichTextEmpty
// =============================================================================

describe('isRichTextEmpty', () => {
  it('returns true for null input', () => {
    expect(isRichTextEmpty(null)).toBe(true);
  });

  it('returns true for undefined input', () => {
    expect(isRichTextEmpty(undefined)).toBe(true);
  });

  it('returns true for empty items array', () => {
    const body = createRichBody([]);
    expect(isRichTextEmpty(body)).toBe(true);
  });

  it('returns true when all text items are empty', () => {
    const body = createRichBody([createTextItem(''), createTextItem('   ')]);
    expect(isRichTextEmpty(body)).toBe(true);
  });

  it('returns false when there is non-empty text', () => {
    const body = createRichBody([createTextItem('Hello')]);
    expect(isRichTextEmpty(body)).toBe(false);
  });

  it('returns false when there are non-text items', () => {
    const body = createRichBody([
      createTextItem(''),
      createNodeRefItem('at://did/field/1', 'Field'),
    ]);
    expect(isRichTextEmpty(body)).toBe(false);
  });

  it('handles text item with undefined content', () => {
    const body = createRichBody([{ type: 'text' as const, content: undefined as never }]);
    expect(isRichTextEmpty(body)).toBe(true);
  });
});

// =============================================================================
// getRichTextLength
// =============================================================================

describe('getRichTextLength', () => {
  it('returns 0 for null input', () => {
    expect(getRichTextLength(null)).toBe(0);
  });

  it('returns correct length for text content', () => {
    const body = createRichBody([createTextItem('Hello world')]);
    expect(getRichTextLength(body)).toBe(11);
  });

  it('includes node ref labels in length', () => {
    const body = createRichBody([createTextItem('See '), createNodeRefItem('at://did/x', 'Topic')]);
    expect(getRichTextLength(body)).toBe(9); // "See " + "Topic"
  });
});

// =============================================================================
// truncateRichText
// =============================================================================

describe('truncateRichText', () => {
  it('returns empty body for null input', () => {
    const result = truncateRichText(null, 100);
    expect(result.items).toHaveLength(0);
  });

  it('returns original body if under max length', () => {
    const body = createRichBody([createTextItem('Short')]);
    const result = truncateRichText(body, 100);
    expect(result.items).toHaveLength(1);
  });

  it('truncates text items with ellipsis', () => {
    const body = createRichBody([createTextItem('This is a long text that needs truncation')]);
    const result = truncateRichText(body, 15);
    expect(extractPlainText(result)).toBe('This is a lo...');
  });

  it('uses custom ellipsis', () => {
    const body = createRichBody([createTextItem('Long text here')]);
    const result = truncateRichText(body, 10, '…');
    expect(extractPlainText(result)).toContain('…');
  });

  it('preserves complete items when possible', () => {
    const body = createRichBody([createTextItem('Hi '), createNodeRefItem('at://did/x', 'ML')]);
    const result = truncateRichText(body, 5);
    expect(result.items).toHaveLength(2);
  });

  it('stops before nodeRef if it would exceed limit', () => {
    const body = createRichBody([
      createTextItem('A'),
      createNodeRefItem('at://did/x', 'VeryLongLabel'),
    ]);
    const result = truncateRichText(body, 3);
    expect(result.items).toHaveLength(1);
  });

  it('stops before eprintRef if it would exceed limit', () => {
    const body = createRichBody([
      createTextItem('A'),
      createEprintRefItem('at://did/x', 'Very Long Title'),
    ]);
    const result = truncateRichText(body, 3);
    expect(result.items).toHaveLength(1);
  });

  it('includes nodeRef if within limit', () => {
    const body = createRichBody([createNodeRefItem('at://did/x', 'ML')]);
    const result = truncateRichText(body, 10);
    expect(result.items).toHaveLength(1);
  });

  it('includes eprintRef if within limit', () => {
    const body = createRichBody([createEprintRefItem('at://did/x', 'Paper')]);
    const result = truncateRichText(body, 10);
    expect(result.items).toHaveLength(1);
  });

  it('handles nodeRef with no label', () => {
    const body = createRichBody([
      { type: 'nodeRef' as const, uri: 'at://did/x' as AtUri } as AnnotationBodyItem,
    ]);
    const result = truncateRichText(body, 10);
    expect(result.items).toHaveLength(1);
  });

  it('handles eprintRef with no title', () => {
    const body = createRichBody([
      { type: 'eprintRef' as const, uri: 'at://did/x' as AtUri } as AnnotationBodyItem,
    ]);
    const result = truncateRichText(body, 10);
    expect(result.items).toHaveLength(1);
  });

  it('stops when max length reached', () => {
    const body = createRichBody([
      createTextItem('AAAA'),
      createTextItem('BBBB'),
      createTextItem('CCCC'),
    ]);
    const result = truncateRichText(body, 4);
    expect(result.items).toHaveLength(1);
    expect(extractPlainText(result)).toBe('AAAA');
  });
});

// =============================================================================
// extractNodeRefs
// =============================================================================

describe('extractNodeRefs', () => {
  it('returns empty array for null input', () => {
    expect(extractNodeRefs(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(extractNodeRefs(undefined)).toEqual([]);
  });

  it('extracts nodeRef URIs', () => {
    const body = createRichBody([
      createTextItem('See '),
      createNodeRefItem('at://did/field/ml', 'ML'),
      createTextItem(' and '),
      createNodeRefItem('at://did/field/nlp', 'NLP'),
    ]);
    expect(extractNodeRefs(body)).toEqual(['at://did/field/ml', 'at://did/field/nlp']);
  });

  it('ignores non-nodeRef items', () => {
    const body = createRichBody([
      createTextItem('Text'),
      createEprintRefItem('at://did/eprint/1', 'Paper'),
    ]);
    expect(extractNodeRefs(body)).toEqual([]);
  });
});

// =============================================================================
// extractEprintRefs
// =============================================================================

describe('extractEprintRefs', () => {
  it('returns empty array for null input', () => {
    expect(extractEprintRefs(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(extractEprintRefs(undefined)).toEqual([]);
  });

  it('extracts eprintRef URIs', () => {
    const body = createRichBody([
      createTextItem('See '),
      createEprintRefItem('at://did/eprint/1', 'Paper 1'),
      createTextItem(' and '),
      createEprintRefItem('at://did/eprint/2', 'Paper 2'),
    ]);
    expect(extractEprintRefs(body)).toEqual(['at://did/eprint/1', 'at://did/eprint/2']);
  });

  it('ignores non-eprintRef items', () => {
    const body = createRichBody([
      createTextItem('Text'),
      createNodeRefItem('at://did/field/1', 'Field'),
    ]);
    expect(extractEprintRefs(body)).toEqual([]);
  });
});

// =============================================================================
// isValidRichTextBody
// =============================================================================

describe('isValidRichTextBody', () => {
  it('returns false for null', () => {
    expect(isValidRichTextBody(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidRichTextBody(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isValidRichTextBody('string')).toBe(false);
    expect(isValidRichTextBody(123)).toBe(false);
  });

  it('returns false for object without items array', () => {
    expect(isValidRichTextBody({ type: 'RichText' })).toBe(false);
    expect(isValidRichTextBody({ items: 'not-array' })).toBe(false);
  });

  it('returns true for valid text items', () => {
    const body = { items: [{ type: 'text', content: 'Hello' }] };
    expect(isValidRichTextBody(body)).toBe(true);
  });

  it('returns true for valid nodeRef items', () => {
    const body = { items: [{ type: 'nodeRef', uri: 'at://did/x' }] };
    expect(isValidRichTextBody(body)).toBe(true);
  });

  it('returns true for valid eprintRef items', () => {
    const body = { items: [{ type: 'eprintRef', uri: 'at://did/x' }] };
    expect(isValidRichTextBody(body)).toBe(true);
  });

  it('returns false for text item without content string', () => {
    const body = { items: [{ type: 'text', content: 123 }] };
    expect(isValidRichTextBody(body)).toBe(false);
  });

  it('returns false for nodeRef without uri string', () => {
    const body = { items: [{ type: 'nodeRef', uri: 123 }] };
    expect(isValidRichTextBody(body)).toBe(false);
  });

  it('returns false for eprintRef without uri string', () => {
    const body = { items: [{ type: 'eprintRef', uri: null }] };
    expect(isValidRichTextBody(body)).toBe(false);
  });

  it('returns false for unknown item types', () => {
    const body = { items: [{ type: 'unknown' }] };
    expect(isValidRichTextBody(body)).toBe(false);
  });

  it('returns false for null items in array', () => {
    const body = { items: [null] };
    expect(isValidRichTextBody(body)).toBe(false);
  });

  it('returns false for non-object items in array', () => {
    const body = { items: ['string'] };
    expect(isValidRichTextBody(body)).toBe(false);
  });

  it('returns true for empty items array', () => {
    const body = { items: [] };
    expect(isValidRichTextBody(body)).toBe(true);
  });

  it('validates all items in array', () => {
    const body = {
      items: [
        { type: 'text', content: 'Hello' },
        { type: 'nodeRef', uri: 'at://did/x' },
        { type: 'eprintRef', uri: 'at://did/y' },
      ],
    };
    expect(isValidRichTextBody(body)).toBe(true);
  });
});

// =============================================================================
// migrateAbstractToRichText
// =============================================================================

describe('migrateAbstractToRichText', () => {
  it('returns empty body for null input', () => {
    const result = migrateAbstractToRichText(null);
    expect(result.items).toHaveLength(0);
  });

  it('returns empty body for undefined input', () => {
    const result = migrateAbstractToRichText(undefined);
    expect(result.items).toHaveLength(0);
  });

  it('returns empty body for empty string', () => {
    const result = migrateAbstractToRichText('');
    expect(result.items).toHaveLength(0);
  });

  it('wraps plain text in rich text structure', () => {
    const result = migrateAbstractToRichText('This is an abstract.');
    expect(result).toEqual({
      type: 'RichText',
      items: [{ type: 'text', content: 'This is an abstract.' }],
      format: 'application/x-chive-gloss+json',
    });
  });
});
