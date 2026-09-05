/**
 * Migration to key a backlink on its source *and* its target.
 *
 * @remarks
 * `uq_backlinks_source_uri` made one source record able to record exactly one
 * backlink. But a source can legitimately reference several eprints — a Cosmik
 * connection names two by definition, and a Leaflet essay may cite a handful —
 * and `BacklinkTrackingPlugin` writes one row per reference. Each write hit the
 * same conflict target and overwrote the previous one, so only the last
 * reference survived and every earlier paper silently lost its backlink.
 *
 * The identity of a backlink is the pair. Keying on it lets one record point at
 * as many papers as it names, and keeps the upsert idempotent per pair.
 *
 * Existing rows are unaffected: they are already unique on `source_uri`, which
 * makes them unique on the pair.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: re-key the backlink uniqueness on (source_uri, target_uri).
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.dropConstraint('backlinks', 'uq_backlinks_source_uri', { ifExists: true });
  pgm.addConstraint('backlinks', 'uq_backlinks_source_target', {
    unique: ['source_uri', 'target_uri'],
  });
}

/**
 * Rollback migration.
 *
 * @param pgm - PostgreSQL migration builder
 *
 * @remarks
 * Going back requires the table to hold one row per source again, so any
 * additional targets a source gained are dropped, keeping the earliest.
 */
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DELETE FROM backlinks a
    USING backlinks b
    WHERE a.source_uri = b.source_uri AND a.id > b.id
  `);
  pgm.dropConstraint('backlinks', 'uq_backlinks_source_target', { ifExists: true });
  pgm.addConstraint('backlinks', 'uq_backlinks_source_uri', {
    unique: ['source_uri'],
  });
}
