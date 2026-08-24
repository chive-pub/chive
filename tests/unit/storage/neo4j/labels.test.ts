/**
 * Unit tests for Neo4j label construction.
 *
 * @remarks
 * Neo4j cannot bind a label as a query parameter, so labels are interpolated
 * into Cypher. Node subkinds reach that interpolation from unauthenticated
 * callers via `pub.chive.graph.listNodes` and `pub.chive.graph.getHierarchy`,
 * which made this the injection point these tests close.
 */

import { describe, expect, it } from 'vitest';

import { kindToLabel, subkindToLabel } from '@/storage/neo4j/labels.js';
import { ValidationError } from '@/types/errors.js';

describe('subkindToLabel', () => {
  it('should convert a slug to a PascalCase label', () => {
    expect(subkindToLabel('field')).toBe('Field');
    expect(subkindToLabel('research-method')).toBe('ResearchMethod');
    expect(subkindToLabel('institution')).toBe('Institution');
  });

  it('should preserve digits and underscores', () => {
    expect(subkindToLabel('facet2')).toBe('Facet2');
    expect(subkindToLabel('legacy_field')).toBe('Legacy_field');
  });

  // Each of these previously passed straight through into the query string,
  // letting a caller close the MATCH pattern and append their own Cypher.
  it.each([
    ['pattern break + delete', 'a) DETACH DELETE n //'],
    ['clause injection', 'Field) RETURN n UNION MATCH (m) RETURN m //'],
    ['whitespace', 'Field OR true'],
    ['backtick escape', 'Field`) MATCH (x) DETACH DELETE x //'],
    ['comment marker', 'Field//'],
    ['braces', 'Field {uri: 1}'],
    ['empty', ''],
    ['leading digit', '1field'],
  ])('should reject %s', (_name, malicious) => {
    expect(() => subkindToLabel(malicious)).toThrow(ValidationError);
  });

  it('should not leak the rejected value into a usable label', () => {
    // A thrown error is the only acceptable outcome; returning a sanitised
    // fragment would still interpolate attacker-influenced text.
    let label: string | undefined;
    try {
      label = subkindToLabel('a) DETACH DELETE n //');
    } catch {
      label = undefined;
    }
    expect(label).toBeUndefined();
  });
});

describe('kindToLabel', () => {
  it('should map kinds to their labels', () => {
    expect(kindToLabel('type')).toBe('Type');
    expect(kindToLabel('object')).toBe('Object');
  });
});
