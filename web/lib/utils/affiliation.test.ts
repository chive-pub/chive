/**
 * Tests for affiliation tree formatting.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { getAffiliationDisplay, getAffiliationPaths } from '@/lib/utils/affiliation';

const rochester = {
  name: 'University of Rochester',
  children: [
    {
      name: 'School of Arts and Sciences',
      children: [{ name: 'Department of Linguistics' }, { name: 'Department of Computer Science' }],
    },
    { name: 'School of Medicine' },
  ],
};

describe('getAffiliationDisplay', () => {
  it('names the institution once and lists what sits under it', () => {
    // The header used to render one fully-qualified path per leaf, so this
    // affiliation alone produced three lines each beginning "University of
    // Rochester".
    const { institution, units } = getAffiliationDisplay(rochester);

    expect(institution).toBe('University of Rochester');
    expect(units).toEqual([
      'School of Arts and Sciences > Department of Linguistics',
      'School of Arts and Sciences > Department of Computer Science',
      'School of Medicine',
    ]);
    expect(units.every((unit) => !unit.includes('University of Rochester'))).toBe(true);
  });

  it('returns no units for an institution with no sub-units', () => {
    expect(getAffiliationDisplay({ name: 'Santa Fe Institute' })).toEqual({
      institution: 'Santa Fe Institute',
      units: [],
    });
  });

  it('treats an empty children array as no sub-units', () => {
    expect(getAffiliationDisplay({ name: 'Santa Fe Institute', children: [] }).units).toEqual([]);
  });

  it('covers every leaf that getAffiliationPaths does', () => {
    // The grouped form must not silently drop a department.
    const { units } = getAffiliationDisplay(rochester);
    expect(units).toHaveLength(getAffiliationPaths(rochester).length);
  });
});
