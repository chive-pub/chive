/**
 * Tests for annotation-serializer utility.
 *
 * @packageDocumentation
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  serializeToBody,
  renderBodyToHTML,
  extractPlainText,
  getTextLength,
  isWithinMaxLength,
  hasContent,
  escapeHTML,
} from './annotation-serializer';
import type { RichAnnotationBody } from '@/lib/api/schema';

// =============================================================================
// TEST DATA
// =============================================================================

const EMPTY_BODY: RichAnnotationBody = {
  type: 'RichText',
  items: [],
  format: 'application/x-chive-gloss+json',
};

const TEXT_ONLY_BODY: RichAnnotationBody = {
  type: 'RichText',
  items: [{ type: 'text', content: 'Hello, world!' }],
  format: 'application/x-chive-gloss+json',
};

const RICH_BODY: RichAnnotationBody = {
  type: 'RichText',
  items: [
    { type: 'text', content: 'This is about ' },
    {
      type: 'nodeRef',
      uri: 'at://did:plc:abc/pub.chive.graph.node/123',
      label: 'MIT',
      subkind: 'institution',
    },
    { type: 'text', content: ' and ' },
    {
      type: 'nodeRef',
      uri: 'at://did:plc:abc/pub.chive.graph.node/456',
      label: 'Machine Learning',
      subkind: 'field',
    },
    { type: 'text', content: '.' },
  ],
  format: 'application/x-chive-gloss+json',
};

// =============================================================================
// extractPlainText
// =============================================================================

describe('extractPlainText', () => {
  it('returns empty string for null body', () => {
    expect(extractPlainText(null)).toBe('');
  });

  it('returns empty string for body with empty items', () => {
    expect(extractPlainText(EMPTY_BODY)).toBe('');
  });

  it('extracts text from text-only body', () => {
    expect(extractPlainText(TEXT_ONLY_BODY)).toBe('Hello, world!');
  });

  it('extracts text and labels from rich body', () => {
    expect(extractPlainText(RICH_BODY)).toBe('This is about MIT and Machine Learning.');
  });

  it('handles wikidataRef items', () => {
    const body: RichAnnotationBody = {
      type: 'RichText',
      items: [
        { type: 'text', content: 'Founded by ' },
        { type: 'wikidataRef', qid: 'Q123', label: 'John Doe' },
      ],
      format: 'application/x-chive-gloss+json',
    };
    expect(extractPlainText(body)).toBe('Founded by John Doe');
  });

  it('handles fieldRef items', () => {
    const body: RichAnnotationBody = {
      type: 'RichText',
      items: [
        { type: 'text', content: 'In the field of ' },
        { type: 'fieldRef', uri: 'at://did:plc:abc/field/123', label: 'Physics' },
      ],
      format: 'application/x-chive-gloss+json',
    };
    expect(extractPlainText(body)).toBe('In the field of Physics');
  });
});

// =============================================================================
// getTextLength
// =============================================================================

describe('getTextLength', () => {
  it('returns 0 for null body', () => {
    expect(getTextLength(null)).toBe(0);
  });

  it('returns correct length for text-only body', () => {
    expect(getTextLength(TEXT_ONLY_BODY)).toBe(13); // "Hello, world!"
  });

  it('returns correct length for rich body', () => {
    expect(getTextLength(RICH_BODY)).toBe(39); // "This is about MIT and Machine Learning." = 39 chars
  });
});

// =============================================================================
// isWithinMaxLength
// =============================================================================

describe('isWithinMaxLength', () => {
  it('returns true for null body', () => {
    expect(isWithinMaxLength(null, 100)).toBe(true);
  });

  it('returns true when within limit', () => {
    expect(isWithinMaxLength(TEXT_ONLY_BODY, 100)).toBe(true);
  });

  it('returns true when exactly at limit', () => {
    expect(isWithinMaxLength(TEXT_ONLY_BODY, 13)).toBe(true);
  });

  it('returns false when over limit', () => {
    expect(isWithinMaxLength(TEXT_ONLY_BODY, 10)).toBe(false);
  });
});

// =============================================================================
// hasContent
// =============================================================================

describe('hasContent', () => {
  it('returns false for null body', () => {
    expect(hasContent(null)).toBe(false);
  });

  it('returns false for empty body', () => {
    expect(hasContent(EMPTY_BODY)).toBe(false);
  });

  it('returns false for whitespace-only text', () => {
    const body: RichAnnotationBody = {
      type: 'RichText',
      items: [{ type: 'text', content: '   \n\t  ' }],
      format: 'application/x-chive-gloss+json',
    };
    expect(hasContent(body)).toBe(false);
  });

  it('returns true for text content', () => {
    expect(hasContent(TEXT_ONLY_BODY)).toBe(true);
  });

  it('returns true for node reference content', () => {
    const body: RichAnnotationBody = {
      type: 'RichText',
      items: [
        {
          type: 'nodeRef',
          uri: 'at://did:plc:abc/pub.chive.graph.node/123',
          label: 'MIT',
          subkind: 'institution',
        },
      ],
      format: 'application/x-chive-gloss+json',
    };
    expect(hasContent(body)).toBe(true);
  });
});

// =============================================================================
// escapeHTML
// =============================================================================

describe('escapeHTML', () => {
  it('escapes ampersand', () => {
    expect(escapeHTML('A & B')).toBe('A &amp; B');
  });

  it('escapes less than', () => {
    expect(escapeHTML('a < b')).toBe('a &lt; b');
  });

  it('escapes greater than', () => {
    expect(escapeHTML('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHTML('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHTML("It's fine")).toBe('It&#39;s fine');
  });

  it('escapes multiple special characters', () => {
    expect(escapeHTML('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  it('returns empty string for empty input', () => {
    expect(escapeHTML('')).toBe('');
  });
});

// =============================================================================
// renderBodyToHTML
// =============================================================================

describe('renderBodyToHTML', () => {
  it('returns empty string for null body', () => {
    expect(renderBodyToHTML(null)).toBe('');
  });

  it('returns empty string for empty body', () => {
    expect(renderBodyToHTML(EMPTY_BODY)).toBe('');
  });

  it('renders text items', () => {
    const html = renderBodyToHTML(TEXT_ONLY_BODY);
    expect(html).toBe('Hello, world!');
  });

  it('escapes HTML in text items', () => {
    const body: RichAnnotationBody = {
      type: 'RichText',
      items: [{ type: 'text', content: '<script>alert("XSS")</script>' }],
      format: 'application/x-chive-gloss+json',
    };
    const html = renderBodyToHTML(body);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders nodeRef items as chips', () => {
    const body: RichAnnotationBody = {
      type: 'RichText',
      items: [
        { type: 'nodeRef', uri: 'at://did:plc:abc/node/123', label: 'MIT', subkind: 'institution' },
      ],
      format: 'application/x-chive-gloss+json',
    };
    const html = renderBodyToHTML(body);
    expect(html).toContain('mention-chip');
    expect(html).toContain('data-node-uri="at://did:plc:abc/node/123"');
    expect(html).toContain('data-node-label="MIT"');
    expect(html).toContain('data-subkind="institution"');
    expect(html).toContain('MIT');
  });

  it('converts newlines to br tags', () => {
    const body: RichAnnotationBody = {
      type: 'RichText',
      items: [{ type: 'text', content: 'Line 1\nLine 2' }],
      format: 'application/x-chive-gloss+json',
    };
    const html = renderBodyToHTML(body);
    expect(html).toContain('<br>');
  });
});

// =============================================================================
// serializeToBody
// =============================================================================

describe('serializeToBody', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('handles empty element', () => {
    const body = serializeToBody(container);
    expect(body.items).toHaveLength(0);
  });

  it('serializes plain text', () => {
    container.textContent = 'Hello, world!';
    const body = serializeToBody(container);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toEqual({ type: 'text', content: 'Hello, world!' });
  });

  it('serializes chip elements', () => {
    container.innerHTML = `
      <span class="mention-chip" data-node-uri="at://did:plc:abc/node/123" data-node-label="MIT" data-subkind="institution">
        <span>MIT</span>
      </span>
    `;
    const body = serializeToBody(container);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toEqual({
      type: 'nodeRef',
      uri: 'at://did:plc:abc/node/123',
      label: 'MIT',
      subkind: 'institution',
    });
  });

  it('serializes mixed text and chips', () => {
    container.innerHTML = `
      About <span class="mention-chip" data-node-uri="at://did:plc:abc/node/123" data-node-label="MIT" data-subkind="institution"><span>MIT</span></span> research
    `;
    const body = serializeToBody(container);
    expect(body.items.length).toBeGreaterThanOrEqual(2);

    // Should have text items and a nodeRef
    const textItems = body.items.filter((i) => i.type === 'text');
    const nodeRefs = body.items.filter((i) => i.type === 'nodeRef');
    expect(nodeRefs).toHaveLength(1);
    expect(nodeRefs[0]).toMatchObject({
      type: 'nodeRef',
      uri: 'at://did:plc:abc/node/123',
      label: 'MIT',
    });
  });

  it('sets correct format and type', () => {
    container.textContent = 'Test';
    const body = serializeToBody(container);
    expect(body.type).toBe('RichText');
    expect(body.format).toBe('application/x-chive-gloss+json');
  });

  it('normalizes non-breaking spaces', () => {
    container.innerHTML = 'Hello\u00A0world';
    const body = serializeToBody(container);
    expect(body.items[0]).toEqual({ type: 'text', content: 'Hello world' });
  });
});
