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

describe('ordering', () => {
  it('puts previous affiliations most recently ended first', () => {
    // The merge walks Chive first and appends sifa-only entries, which is an
    // order nobody chose — a list showing years read as though unsorted.
    const merged = mergeAffiliations(
      [{ name: 'Listed first in the profile' }],
      [
        { institution: 'Ended 2018', endedAt: '2018-01-01', source: 'position' },
        { institution: 'Ended 2024', endedAt: '2024-01-01', source: 'position' },
        { institution: 'Ended 2021', endedAt: '2021-01-01', source: 'education' },
      ]
    );

    expect(merged.map((m) => m.institution)).toEqual([
      'Ended 2024',
      'Ended 2021',
      'Ended 2018',
      // Undated, so last.
      'Listed first in the profile',
    ]);
  });

  it('orders current affiliations by when the role began', () => {
    const merged = mergeAffiliations(undefined, [
      { institution: 'Started 2016', startedAt: '2016-01-01', source: 'position' },
      { institution: 'Started 2024', startedAt: '2024-01-01', source: 'position' },
    ]);

    expect(merged.map((m) => m.institution)).toEqual(['Started 2024', 'Started 2016']);
  });

  it('leads with the primary affiliation whatever its date', () => {
    const merged = mergeAffiliations(undefined, [
      { institution: 'Recent', startedAt: '2024-01-01', source: 'position' },
      {
        institution: 'Older but primary',
        startedAt: '2016-01-01',
        isPrimary: true,
        source: 'position',
      },
    ]);

    expect(merged[0]?.institution).toBe('Older but primary');
  });

  it('leaves a profile with no dates exactly as its owner arranged it', () => {
    // A Chive affiliation carries no dates, so sorting must not reshuffle one.
    const merged = mergeAffiliations(
      [{ name: 'First' }, { name: 'Second' }, { name: 'Third' }],
      undefined
    );

    expect(merged.map((m) => m.institution)).toEqual(['First', 'Second', 'Third']);
  });

  it('dates an institution the sources both mention by the sifa role', () => {
    const merged = mergeAffiliations(
      [{ name: 'Undated in Chive' }, { name: 'Rochester' }],
      [{ institution: 'Rochester', endedAt: '2024-01-01', source: 'position' }]
    );

    // Rochester has a date now, so it leads the undated one.
    expect(merged.map((m) => m.institution)).toEqual(['Rochester', 'Undated in Chive']);
  });
});
