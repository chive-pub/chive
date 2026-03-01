/**
 * Migration to add label column to collection_edges_index.
 *
 * @remarks
 * Adds user-entered label storage to collection edges so items can be
 * displayed with custom names chosen by the collection curator.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE collection_edges_index
      ADD COLUMN IF NOT EXISTS label text;
    COMMENT ON COLUMN collection_edges_index.label IS
      'User-entered label for the item in this collection';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql('ALTER TABLE collection_edges_index DROP COLUMN IF EXISTS label');
}
