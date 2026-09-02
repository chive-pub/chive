/**
 * The backlink source-type constraint must match what plugins write.
 *
 * @remarks
 * `backlinks.source_type` carries a CHECK constraint, and a plugin writing a
 * value it does not list has its row rejected by PostgreSQL — a backlink that
 * cannot be stored looks exactly like one that was never found.
 *
 * The constraint lives in SQL and the permitted set in TypeScript, so the two
 * can drift silently. These assertions tie them together.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATION =
  'src/storage/postgresql/migrations/1742400000000_backlink-source-types-match-plugins.ts';

/**
 * Every value the `BacklinkSourceType` union permits.
 */
function unionValues(): string[] {
  const source = readFileSync(
    join(process.cwd(), 'src/types/interfaces/plugin.interface.ts'),
    'utf8'
  );
  const start = source.indexOf('export type BacklinkSourceType =');
  expect(start).toBeGreaterThan(-1);
  const block = source.slice(start, source.indexOf(';', source.indexOf("'other'", start)));
  return [...new Set([...block.matchAll(/'([a-z][a-z.]*)'/g)].flatMap((m) => m[1] ?? []))];
}

/**
 * Every value the migration's constraint allows.
 */
function constraintValues(): string[] {
  const migration = readFileSync(join(process.cwd(), MIGRATION), 'utf8');
  const start = migration.indexOf('const SOURCE_TYPES = [');
  expect(start).toBeGreaterThan(-1);
  const block = migration.slice(start, migration.indexOf('] as const', start));
  return [...block.matchAll(/'([a-z][a-z.]*)'/g)].flatMap((m) => m[1] ?? []);
}

describe('backlink source types', () => {
  it('the constraint allows exactly what the union permits', () => {
    expect([...constraintValues()].sort()).toEqual([...unionValues()].sort());
  });

  it.each([
    'cosmik.collection',
    'leaflet.document',
    'leaflet.comment',
    'standard.document',
    'calendar.event',
    'margin.annotation',
  ])('%s, which a plugin writes, is allowed', (type) => {
    expect(constraintValues()).toContain(type);
  });

  it('does not allow names with no corresponding record type', () => {
    // `leaflet.list` names an NSID Leaflet does not publish, `semble.collection`
    // predates the rename to Cosmik, and WhiteWind is no longer read.
    expect(constraintValues()).not.toContain('leaflet.list');
    expect(constraintValues()).not.toContain('semble.collection');
    expect(constraintValues()).not.toContain('whitewind.blog');
  });

  it('rewrites rows carrying the old names rather than dropping them', () => {
    const migration = readFileSync(join(process.cwd(), MIGRATION), 'utf8');
    expect(migration).toContain("['semble.collection', 'cosmik.collection']");
    expect(migration).toContain("['leaflet.list', 'leaflet.document']");
    // And rewrites before tightening, or the new constraint rejects stored rows.
    expect(migration.indexOf('UPDATE backlinks SET source_type')).toBeLessThan(
      migration.indexOf('ADD CONSTRAINT backlinks_source_type_check')
    );
  });

  it('counts Leaflet and Cosmik by prefix, so a new subtype still counts', () => {
    const migration = readFileSync(join(process.cwd(), MIGRATION), 'utf8');
    expect(migration).toContain("source_type LIKE 'cosmik.%'");
    expect(migration).toContain("source_type LIKE 'leaflet.%'");
  });
});
