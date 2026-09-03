/**
 * Tests for how a citation node names its paper.
 *
 * @remarks
 * The citation graph stores only URIs on its nodes, so before the API returned
 * anything to label them with, every node read "Citing paper 1", "Citing paper
 * 2" — a network that is technically correct and tells a reader nothing.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { paperLabel } from '@/components/eprints/citation-visualization';

describe('paperLabel', () => {
  it('names a paper the way it would be cited', () => {
    const label = paperLabel(
      {
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
    expect(paperLabel({ title: 'An Untitled Sort of Paper' }, 'Reference 2')).toBe(
      'An Untitled Sort of Paper'
    );
  });

  it('truncates a long title rather than letting it overrun the node', () => {
    const long = 'A'.repeat(80);
    const label = paperLabel({ title: long, authors: ['Ada Lovelace'], year: 1843 }, 'x');

    expect(label.startsWith('Lovelace 1843 — ')).toBe(true);
    expect(label.endsWith('...')).toBe(true);
    expect(label.length).toBeLessThan(70);
  });
});
