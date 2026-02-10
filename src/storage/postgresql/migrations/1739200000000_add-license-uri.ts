/**
 * Migration to add license_uri column to eprints_index.
 *
 * @remarks
 * Stores the AT-URI reference to the license node in the knowledge graph.
 * Required for the schema migration detection to persist after re-indexing.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'eprints_index' AND column_name = 'license_uri'
      ) THEN
        ALTER TABLE eprints_index ADD COLUMN license_uri text;
        COMMENT ON COLUMN eprints_index.license_uri IS 'AT-URI reference to license node in knowledge graph';
      END IF;
    END
    $$;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE eprints_index DROP COLUMN IF EXISTS license_uri`);
}
