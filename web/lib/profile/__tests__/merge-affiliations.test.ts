/**
 * Tests for merging Chive and sifa affiliations.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { mergeAffiliations, formatSpan } from '@/lib/profile/merge-affiliations';

const rochester = {
  name: 'University of Rochester',
  children: [{ name: 'Department of Linguistics' }],
};

describe('mergeAffiliations', () => {
  it('renders an institution once when both sources name it', () => {
    // This is the bug the merge exists for: the profile showed the same
    // university under "Affiliations" and again in a separate sifa card.
    const merged = mergeAffiliations(
      [rochester],
      [
        {
          institution: 'University of Rochester',
          title: 'Associate Professor',
          startedAt: '2021-07-01',
          source: 'position',
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      institution: 'University of Rochester',
      units: ['Department of Linguistics'],
      title: 'Associate Professor',
      span: '2021–present',
      sources: ['chive', 'sifa'],
    });
  });

  it('keeps each source alone when only one names the institution', () => {
    const merged = mergeAffiliations(
      [rochester],
      [{ institution: 'Santa Fe Institute', title: 'Fellow', source: 'position' }]
    );

    expect(merged.map((m) => m.institution)).toEqual([
      'University of Rochester',
      'Santa Fe Institute',
    ]);
    expect(merged[0]?.sources).toEqual(['chive']);
    expect(merged[1]?.sources).toEqual(['sifa']);
  });

  it('matches across case, punctuation and a leading "the"', () => {
    const merged = mergeAffiliations(
      [{ name: 'The Ohio State University' }],
      [{ institution: 'the ohio state university', title: 'Postdoc', source: 'position' }]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.institution).toBe('The Ohio State University');
    expect(merged[0]?.title).toBe('Postdoc');
  });

  it('does not guess at abbreviations', () => {
    // A wrong merge attributes a department to the wrong employer. One extra
    // row is the cheaper mistake.
    const merged = mergeAffiliations(
      [{ name: 'University of Rochester' }],
      [{ institution: 'Univ. of Rochester', source: 'position' }]
    );

    expect(merged).toHaveLength(2);
  });

  it('keeps the Chive name and sub-units, and takes the role from sifa', () => {
    const merged = mergeAffiliations(
      [rochester],
      [{ institution: 'University of Rochester', title: 'Associate Professor', source: 'position' }]
    );

    expect(merged[0]?.units).toEqual(['Department of Linguistics']);
    expect(merged[0]?.title).toBe('Associate Professor');
  });

  it('marks primary from either source', () => {
    const fromSifa = mergeAffiliations(
      [{ name: 'A' }, { name: 'B' }],
      [{ institution: 'B', isPrimary: true, source: 'position' }]
    );
    expect(fromSifa.find((m) => m.institution === 'B')?.isPrimary).toBe(true);

    const fromChive = mergeAffiliations([{ name: 'A' }, { name: 'B' }], [], true);
    expect(fromChive[0]?.isPrimary).toBe(true);
    expect(fromChive[1]?.isPrimary).toBe(false);
  });

  it('preserves the Chive ordering, appending sifa-only institutions', () => {
    const merged = mergeAffiliations(
      [{ name: 'First' }, { name: 'Second' }],
      [{ institution: 'Third', source: 'education' }]
    );

    expect(merged.map((m) => m.institution)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns nothing when neither source has anything', () => {
    expect(mergeAffiliations(undefined, undefined)).toEqual([]);
    expect(mergeAffiliations([], [])).toEqual([]);
  });

  it('does not duplicate a source when sifa lists two roles at one institution', () => {
    const merged = mergeAffiliations(
      [rochester],
      [
        {
          institution: 'University of Rochester',
          title: 'Associate Professor',
          source: 'position',
        },
        {
          institution: 'University of Rochester',
          title: 'Assistant Professor',
          source: 'position',
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.sources).toEqual(['chive', 'sifa']);
    // The first role wins rather than the two being concatenated.
    expect(merged[0]?.title).toBe('Associate Professor');
  });
});

describe('formatSpan', () => {
  it.each([
    [{ startedAt: '2021-07-01', endedAt: '2024-06-30' }, '2021–2024'],
    [{ startedAt: '2021-07-01' }, '2021–present'],
    [{ endedAt: '2016-05-01' }, 'until 2016'],
  ])('formats %o as %s', (role, expected) => {
    expect(formatSpan(role)).toBe(expected);
  });

  it('formats nothing when there are no dates, rather than a stray dash', () => {
    expect(formatSpan({})).toBeUndefined();
  });
});
