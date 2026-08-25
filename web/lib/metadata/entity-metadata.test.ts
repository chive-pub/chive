/**
 * Tests for JSON-LD serialization in entity head tags.
 *
 * @remarks
 * The JSON-LD payload is rendered through `dangerouslySetInnerHTML` into a
 * `<script type="application/ld+json">` element, and it carries eprint titles,
 * abstracts and author names that come from user-controlled PDS records.
 * `JSON.stringify` does not escape `<`, so a title containing `</script>` used
 * to close the element early and let everything after it parse as markup —
 * stored XSS on every page that rendered the record.
 */

import { describe, it, expect } from 'vitest';

import { buildEntityHeadTags } from './entity-metadata';

const jsonLdOf = (title: string, description?: string): string => {
  const tags = buildEntityHeadTags({
    atUri: 'at://did:plc:abc/pub.chive.eprint.submission/xyz',
    canonicalUrl: 'https://chive.pub/eprint/xyz',
    title,
    description,
    entityType: 'research',
  });
  const script = tags.find((tag) => tag.kind === 'script');
  expect(script).toBeDefined();
  return (script as { content: string }).content;
};

describe('JSON-LD serialization', () => {
  it('does not emit a literal closing script tag from a hostile title', () => {
    const payload = jsonLdOf('Innocent</script><script>alert(1)</script>');
    expect(payload).not.toContain('</script>');
    expect(payload).not.toContain('<script>');
  });

  it('escapes angle brackets and ampersands as unicode escapes', () => {
    const payload = jsonLdOf('a < b & c > d');
    expect(payload).toContain('\\u003c');
    expect(payload).toContain('\\u003e');
    expect(payload).toContain('\\u0026');
    expect(payload).not.toMatch(/[<>&]/);
  });

  it('escapes a hostile description too', () => {
    const payload = jsonLdOf('Fine title', 'abstract </script><img src=x onerror=alert(1)>');
    expect(payload).not.toContain('</script>');
    expect(payload).not.toContain('<img');
  });

  // The escaping must not change what the JSON means: a consumer parsing the
  // payload has to see the original characters back.
  it('round-trips to the original string', () => {
    const title = 'a < b & c > d </script>';
    const parsed = JSON.parse(jsonLdOf(title)) as { name?: string; headline?: string };
    expect(parsed.headline ?? parsed.name).toBe(title);
  });

  // U+2028/U+2029 are legal in JSON but terminate a line in JavaScript source.
  it('escapes JavaScript line terminators', () => {
    const payload = jsonLdOf('line break here');
    expect(payload).not.toContain(' ');
    expect(payload).not.toContain(' ');
    expect(payload).toContain('\\u2028');
  });
});
