/**
 * Unit tests for the profileConfig record lexicon.
 *
 * @remarks
 * `pub.chive.actor.profileConfig` was granted as an OAuth **write** scope in
 * every permission set and indexed in four places — the firehose event
 * processor, `sync.indexRecord`, the shared indexed-collection list and the PDS
 * scanner — while having no lexicon at all. Clients therefore held write access
 * to a collection with no schema, and whatever they wrote was indexed
 * unvalidated: the event processor read `profileType`, `sections`,
 * `featuredCollectionUri` and `createdAt` off records that nothing had ever
 * checked.
 *
 * The shape here is taken from what the code already reads and writes — the
 * `ProfileConfigRecord` interface and the `profile_config` columns — rather than
 * invented, so existing records remain valid.
 *
 * `knownValues` rather than `enum` on both `profileType` and section `kind`: a
 * new section type should not invalidate every stored record, which is what a
 * closed enumeration would do to profiles written before it existed.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

interface LexiconDoc {
  readonly id: string;
  readonly defs: Record<string, Record<string, unknown>>;
}

const lexicon = JSON.parse(
  readFileSync(join(process.cwd(), 'lexicons/pub/chive/actor/profileConfig.json'), 'utf8')
) as LexiconDoc;

const main = lexicon.defs.main as {
  type: string;
  key: string;
  record: { required: string[]; properties: Record<string, Record<string, unknown>> };
};

describe('profileConfig lexicon', () => {
  it('exists under the NSID the code indexes', () => {
    expect(lexicon.id).toBe('pub.chive.actor.profileConfig');
  });

  it('is a record type', () => {
    expect(main.type).toBe('record');
  });

  // One configuration per account, so the record key is fixed rather than
  // arbitrary — otherwise an account could hold several conflicting layouts.
  it('uses a literal self key', () => {
    expect(main.key).toBe('literal:self');
  });

  it.each([['profileType'], ['sections'], ['featuredCollectionUri'], ['createdAt'], ['updatedAt']])(
    'declares %s, which the event processor already reads',
    (field) => {
      expect(main.record.properties).toHaveProperty(field);
    }
  );

  it('requires only createdAt, so existing records stay valid', () => {
    expect(main.record.required).toEqual(['createdAt']);
  });

  it('validates AT-URIs as at-uri rather than free strings', () => {
    expect(main.record.properties.featuredCollectionUri?.format).toBe('at-uri');
  });

  // A closed enum would invalidate every stored profile the moment a new
  // section type shipped.
  it('leaves the section vocabulary open', () => {
    const section = lexicon.defs.section as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(section.properties.kind?.knownValues).toBeDefined();
    expect(section.properties.kind?.enum).toBeUndefined();
  });

  it('leaves the profile type vocabulary open', () => {
    expect(main.record.properties.profileType?.knownValues).toBeDefined();
    expect(main.record.properties.profileType?.enum).toBeUndefined();
  });

  it('bounds the arrays and strings it accepts', () => {
    expect(main.record.properties.sections?.maxLength).toBeDefined();
    const section = lexicon.defs.section as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(section.properties.label?.maxLength).toBeDefined();
    expect(section.properties.limit?.maximum).toBeDefined();
  });
});

describe('the write scope now names a schema', () => {
  it('the scope is still granted', () => {
    const scopes = readFileSync(join(process.cwd(), 'src/auth/scopes/chive-scopes.ts'), 'utf8');
    expect(scopes).toMatch(/repo:pub\.chive\.actor\.profileConfig/);
  });

  it('and the collection is still indexed', () => {
    const collections = readFileSync(
      join(process.cwd(), 'src/services/indexing/indexed-collections.ts'),
      'utf8'
    );
    expect(collections).toMatch(/pub\.chive\.actor\.profileConfig/);
  });
});
