/**
 * Unit tests keeping the search mapping in step with the document mapper.
 *
 * @remarks
 * Seven fields the mapper emits had no mapping in the index template:
 * `submitted_by`, `paper_did`, `supplementary_materials`, `related_works`,
 * `repositories`, `funding` and `conference_presentation`. Elasticsearch does
 * not complain about that — it infers a mapping, and for arrays of objects the
 * inferred `object` type flattens them. Flattened, a query cannot ask about one
 * element: `funding.funder_ror` and `related_works.relation_type` matched
 * across the whole array rather than within a single entry, which is worse than
 * not being searchable, because the wrong answers look right.
 *
 * Those fields are now mapped explicitly, arrays of objects as `nested`.
 *
 * The template is set to `dynamic: false` rather than the `strict` the backlog
 * suggested. Strict makes Elasticsearch reject any document containing an
 * unmapped field, so a newly emitted field would stop all indexing — including
 * a rebuild from the firehose, which is the recovery path. `false` leaves the
 * value in `_source` but unindexed: a field goes missing from search, which is
 * a visible and recoverable failure. This test supplies what strict would have
 * caught, at CI time instead of at write time.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

interface IndexTemplate {
  readonly template: {
    readonly mappings: {
      readonly dynamic?: string;
      readonly properties: Record<string, { type?: string; properties?: unknown }>;
    };
  };
}

const template = JSON.parse(
  readFileSync(join(process.cwd(), 'src/storage/elasticsearch/templates/eprints.json'), 'utf8')
) as IndexTemplate;

const mapperSource = readFileSync(
  join(process.cwd(), 'src/storage/elasticsearch/document-mapper.ts'),
  'utf8'
);

/** Top-level keys of the object `mapEprintToDocument` returns. */
const emittedFields = (): string[] => {
  const returned = /return \{([\s\S]*?)\n {2}\};/.exec(mapperSource);
  expect(returned).not.toBeNull();
  const keys = [...(returned?.[1] ?? '').matchAll(/^ {4}([a-z_][a-z0-9_]*):/gm)];
  return [...new Set(keys.map((match) => match[1]!))];
};

const properties = template.template.mappings.properties;

describe('search mapping covers what the mapper emits', () => {
  it('finds the emitted field list', () => {
    expect(emittedFields().length).toBeGreaterThan(30);
  });

  it('maps every emitted top-level field', () => {
    const unmapped = emittedFields().filter((field) => !(field in properties));
    expect(unmapped).toEqual([]);
  });

  // Arrays of objects must be `nested`, or a query matches across elements
  // instead of within one.
  it.each([['related_works'], ['funding'], ['supplementary_materials']])(
    '%s is nested so per-element queries are possible',
    (field) => {
      expect(properties[field]?.type).toBe('nested');
    }
  );

  it('maps the sub-fields the backlog named as unfilterable', () => {
    const funding = properties.funding as { properties?: Record<string, unknown> };
    const related = properties.related_works as { properties?: Record<string, unknown> };
    expect(funding.properties).toHaveProperty('funder_ror');
    expect(related.properties).toHaveProperty('relation_type');
  });

  it('does not reject documents carrying an unmapped field', () => {
    expect(template.template.mappings.dynamic).toBe('false');
  });
});

describe('the search document carries no blob content', () => {
  // Chive stores BlobRefs and never blob data. `document_base64` was a
  // supported, tested path for putting a base64 document body into
  // Elasticsearch; nothing populated it, but its existence contradicted the
  // rule outright.
  it('has no base64 document field in the mapping', () => {
    expect(properties).not.toHaveProperty('document_base64');
  });

  it('has no base64 document field in the mapper', () => {
    expect(mapperSource).not.toMatch(/document_base64|documentBase64/);
  });

  it('still carries the blob reference', () => {
    expect(properties).toHaveProperty('document_blob_ref');
  });
});
