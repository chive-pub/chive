/**
 * Migration to add a GIN index on the tags JSONB column of collections_index.
 *
 * @remarks
 * Enables efficient filtering of collections by tag using the JSONB containment
 * operator (@>). The jsonb_path_ops operator class is used for compact storage
 * and fast containment queries.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_collections_tags_gin
      ON collections_index
      USING GIN (tags jsonb_path_ops)
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql('DROP INDEX IF EXISTS idx_collections_tags_gin');
}
