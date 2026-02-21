import { describe, it, expect } from 'vitest';

import { mergeFieldsIntoFacets } from './submission-wizard';

describe('mergeFieldsIntoFacets', () => {
  const field1 = { uri: 'at://did:plc:gov/pub.chive.graph.node/cs', label: 'Computer Science' };
  const field2 = { uri: 'at://did:plc:gov/pub.chive.graph.node/phys', label: 'Physics' };

  it('adds fields as discipline facets when no facets exist', () => {
    const result = mergeFieldsIntoFacets([], [field1, field2]);

    expect(result).toEqual([
      { slug: 'discipline', value: field1.uri, label: field1.label },
      { slug: 'discipline', value: field2.uri, label: field2.label },
    ]);
  });

  it('preserves existing non-discipline facets', () => {
    const existing = [{ slug: 'space', value: 'europe', label: 'Europe' }];

    const result = mergeFieldsIntoFacets(existing, [field1]);

    expect(result).toEqual([
      { slug: 'space', value: 'europe', label: 'Europe' },
      { slug: 'discipline', value: field1.uri, label: field1.label },
    ]);
  });

  it('deduplicates fields already present as discipline facets', () => {
    const existing = [{ slug: 'discipline', value: field1.uri, label: field1.label }];

    const result = mergeFieldsIntoFacets(existing, [field1, field2]);

    expect(result).toEqual([
      { slug: 'discipline', value: field1.uri, label: field1.label },
      { slug: 'discipline', value: field2.uri, label: field2.label },
    ]);
  });

  it('returns existing facets unchanged when no fields are provided', () => {
    const existing = [
      { slug: 'space', value: 'asia', label: 'Asia' },
      { slug: 'energy', value: 'meta-analysis', label: 'Meta-analysis' },
    ];

    const result = mergeFieldsIntoFacets(existing, []);

    expect(result).toEqual(existing);
  });

  it('does not mutate the input array', () => {
    const existing = [{ slug: 'space', value: 'europe', label: 'Europe' }];
    const copy = [...existing];

    mergeFieldsIntoFacets(existing, [field1]);

    expect(existing).toEqual(copy);
  });
});
