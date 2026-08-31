/**
 * Replace the `leaflet.list` backlink source type with the two Leaflet
 * actually publishes.
 *
 * @remarks
 * `leaflet.list` corresponded to `xyz.leaflet.list`, an NSID that does not
 * exist. Leaflet publishes `pub.leaflet.document` and `pub.leaflet.comment`,
 * and the plugin now reads both.
 *
 * Production rows are unlikely to carry the old value, since the plugin that
 * would have written it was never loaded and matched no record even when it
 * was. Seeded test data does carry it, though, so the rewrite below is not
 * hypothetical.
 *
 * Order matters: the constraint is dropped *before* the rows are rewritten.
 * Updating first fails, because the old constraint still forbids the value
 * being written.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

const SOURCE_TYPES = [
  'cosmik.collection',
  'cosmik.connection',
  'cosmik.follow',
  'leaflet.document',
  'leaflet.comment',
  'whitewind.blog',
  'bluesky.post',
  'bluesky.embed',
  'chive.comment',
  'chive.endorsement',
  'margin.annotation',
  'margin.highlight',
  'margin.bookmark',
  'other',
];

const PREVIOUS_SOURCE_TYPES = [
  'cosmik.collection',
  'cosmik.connection',
  'cosmik.follow',
  'leaflet.list',
  'whitewind.blog',
  'bluesky.post',
  'bluesky.embed',
  'chive.comment',
  'chive.endorsement',
  'margin.annotation',
  'margin.highlight',
  'margin.bookmark',
  'other',
];

function quoted(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(', ');
}

export function up(pgm: MigrationBuilder): void {
  // Drop first: the old constraint rejects the value the update writes.
  pgm.sql(`ALTER TABLE backlinks DROP CONSTRAINT IF EXISTS backlinks_source_type_check`);

  pgm.sql(
    `UPDATE backlinks SET source_type = 'leaflet.document' WHERE source_type = 'leaflet.list'`
  );
  pgm.sql(`
    ALTER TABLE backlinks
    ADD CONSTRAINT backlinks_source_type_check
    CHECK (source_type IN (${quoted(SOURCE_TYPES)}))
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE backlinks DROP CONSTRAINT IF EXISTS backlinks_source_type_check`);

  pgm.sql(`UPDATE backlinks SET source_type = 'leaflet.list' WHERE source_type LIKE 'leaflet.%'`);

  pgm.sql(`
    ALTER TABLE backlinks
    ADD CONSTRAINT backlinks_source_type_check
    CHECK (source_type IN (${quoted(PREVIOUS_SOURCE_TYPES)}))
  `);
}
