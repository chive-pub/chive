/**
 * Tests for how a citation names its paper.
 *
 * @remarks
 * The citation graph stores only URIs on its nodes. Two surfaces draw
 * citations — the network graph and the summary list — and each needs the same
 * answer; a copy in each is how one came to render a bare AT-URI while the
 * other read correctly.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { paperLabel, papersByUri } from '@/lib/citations/paper-label';

describe('paperLabel', () => {
  it('names a paper the way it would be cited', () => {
    const label = paperLabel(
      {
        uri: 'at://did:plc:a/pub.chive.eprint.submission/1',
        title: 'Neural Models of Factuality',
        authors: ['Aaron Steven White', 'Rachel Rudinger'],
        year: 2018,
      },
      'Citing paper 1'
    );

    // Surname and year, as a citation is spoken; the full name crowds the node.
    expect(label).toBe('White 2018 — Neural Models of Factuality');
  });

  it('falls back when the API did not name the paper', () => {
    expect(paperLabel(undefined, 'Citing paper 3')).toBe('Citing paper 3');
  });

  it('uses the title alone when there is no author or year', () => {
    expect(
      paperLabel(
        { uri: 'at://did:plc:a/pub.chive.eprint.submission/2', title: 'An Untitled Sort of Paper' },
        'Reference 2'
      )
    ).toBe('An Untitled Sort of Paper');
  });

  it('truncates a long title rather than letting it overrun the node', () => {
    const long = 'A'.repeat(80);
    const label = paperLabel(
      {
        uri: 'at://did:plc:a/pub.chive.eprint.submission/3',
        title: long,
        authors: ['Ada Lovelace'],
        year: 1843,
      },
      'x'
    );

    expect(label.startsWith('Lovelace 1843 — ')).toBe(true);
    expect(label.endsWith('...')).toBe(true);
    expect(label.length).toBeLessThan(70);
  });

  it('indexes papers by uri for edges to resolve against', () => {
    const papers = [
      { uri: 'at://a/c/1', title: 'One' },
      { uri: 'at://a/c/2', title: 'Two' },
    ];

    const byUri = papersByUri(papers);

    expect(byUri.get('at://a/c/1')?.title).toBe('One');
    expect(byUri.size).toBe(2);
  });

  it('produces an empty index when the response named nothing', () => {
    expect(papersByUri(undefined).size).toBe(0);
  });
});
