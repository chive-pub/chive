/**
 * Tests for how a citation names its paper.
 *
 * @remarks
 * The citation graph stores only URIs on its nodes. Two surfaces draw
 * citations (the network graph and the summary list), and each needs the same
 * answer; a copy in each is how one came to render a bare AT-URI while the
 * other read correctly.
 *
 * The faults these cover: only the first author was ever named, so a
 * two-author paper was attributed to one of them; the surname was taken as the
 * last whitespace-separated token, which turns "Julian" into a surname and
 * "van de Schoot" into "Schoot"; and an em-dash sat between the byline and the
 * title, which no citation style uses.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import {
  formatAuthors,
  formatSurname,
  paperLabel,
  paperLabelParts,
  papersByUri,
} from '@/lib/citations/paper-label';

const uri = 'at://did:plc:a/pub.chive.eprint.submission/1';

describe('formatSurname', () => {
  it('takes the last name of a written-out name', () => {
    expect(formatSurname('Aaron Steven White')).toBe('White');
  });

  it('returns a single-token name whole', () => {
    // Taking the last token of "Julian" presents a given name as a surname
    // with nothing to mark it as one.
    expect(formatSurname('Julian')).toBe('Julian');
  });

  it('takes the surname as given when the name is inverted', () => {
    expect(formatSurname('Grove, Julian')).toBe('Grove');
  });

  it('keeps the particles that belong to the surname', () => {
    expect(formatSurname('Rens van de Schoot')).toBe('van de Schoot');
    expect(formatSurname('Ludwig van Beethoven')).toBe('van Beethoven');
  });

  it('drops a generational suffix, which is not a name', () => {
    expect(formatSurname('Martin Luther King Jr.')).toBe('King');
  });

  it('has nothing to say about an empty name', () => {
    expect(formatSurname('   ')).toBe('');
  });
});

describe('formatAuthors', () => {
  it('names the sole author', () => {
    expect(formatAuthors(['Julian Grove'])).toBe('Grove');
  });

  it('names both authors of a two-author paper', () => {
    // Naming only the first misattributes the paper to one of them.
    expect(formatAuthors(['Aaron Steven White', 'Rachel Rudinger'])).toBe('White and Rudinger');
  });

  it('names the first of three or more and stops', () => {
    expect(formatAuthors(['Aaron Steven White', 'Rachel Rudinger', 'Drew Reisinger'])).toBe(
      'White et al.'
    );
    expect(formatAuthors(['A One', 'B Two', 'C Three', 'D Four'])).toBe('One et al.');
  });

  it('gives nothing when the API named no authors', () => {
    expect(formatAuthors(undefined)).toBeUndefined();
    expect(formatAuthors([])).toBeUndefined();
    expect(formatAuthors(['  '])).toBeUndefined();
  });
});

describe('paperLabelParts', () => {
  it('separates the byline from the title', () => {
    expect(
      paperLabelParts({
        uri,
        title: 'Neural Models of Factuality',
        authors: ['Aaron Steven White', 'Rachel Rudinger'],
        year: 2018,
      })
    ).toEqual({ byline: 'White and Rudinger 2018', title: 'Neural Models of Factuality' });
  });

  it('bylines the year alone when no author was named', () => {
    expect(paperLabelParts({ uri, title: 'A Paper', year: 2015 })).toEqual({
      byline: '2015',
      title: 'A Paper',
    });
  });

  it('bylines the authors alone when no year was given', () => {
    expect(paperLabelParts({ uri, title: 'A Paper', authors: ['Julian Grove'] })).toEqual({
      byline: 'Grove',
      title: 'A Paper',
    });
  });

  it('gives no byline when there is neither author nor year', () => {
    expect(paperLabelParts({ uri, title: 'A Paper' })).toEqual({ title: 'A Paper' });
  });

  it('leaves the title uncut, since the list truncates in layout', () => {
    const long = 'A'.repeat(80);
    expect(paperLabelParts({ uri, title: long }).title).toBe(long);
  });
});

describe('paperLabel', () => {
  it('names a paper the way it would be cited', () => {
    const label = paperLabel(
      {
        uri,
        title: 'Neural Models of Factuality',
        authors: ['Aaron Steven White', 'Rachel Rudinger'],
        year: 2018,
      },
      'Citing paper 1'
    );

    expect(label).toBe('White and Rudinger 2018. Neural Models of Factuality');
  });

  it('puts nothing between the year and the title but a stop', () => {
    // The em-dash that used to sit here belongs to no citation style.
    expect(
      paperLabel({ uri, title: 'A Paper', authors: ['Julian Grove'], year: 2025 }, 'x')
    ).not.toContain('—');
  });

  it('falls back when the API did not name the paper', () => {
    expect(paperLabel(undefined, 'Citing paper 3')).toBe('Citing paper 3');
  });

  it('uses the title alone when there is no author or year', () => {
    expect(paperLabel({ uri, title: 'An Untitled Sort of Paper' }, 'Reference 2')).toBe(
      'An Untitled Sort of Paper'
    );
  });

  it('truncates a long title rather than letting it overrun the node', () => {
    const long = 'A'.repeat(80);
    const label = paperLabel({ uri, title: long, authors: ['Ada Lovelace'], year: 1843 }, 'x');

    expect(label.startsWith('Lovelace 1843. ')).toBe(true);
    expect(label.endsWith('...')).toBe(true);
    expect(label.length).toBeLessThan(70);
  });
});

describe('papersByUri', () => {
  it('indexes papers by uri for edges to resolve against', () => {
    const byUri = papersByUri([
      { uri: 'at://a/c/1', title: 'One' },
      { uri: 'at://a/c/2', title: 'Two' },
    ]);

    expect(byUri.get('at://a/c/1')?.title).toBe('One');
    expect(byUri.size).toBe(2);
  });

  it('produces an empty index when the response named nothing', () => {
    expect(papersByUri(undefined).size).toBe(0);
  });
});
