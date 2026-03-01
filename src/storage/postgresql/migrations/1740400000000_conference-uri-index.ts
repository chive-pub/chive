/**
 * Add partial index on conference_presentation->>'conferenceUri' for
 * efficient collection feed queries matching eprints to tracked events.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add conference URI index.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE INDEX idx_eprints_conference_uri
      ON eprints_index ((conference_presentation->>'conferenceUri'))
      WHERE conference_presentation->>'conferenceUri' IS NOT NULL
  `);
}

/**
 * Revert migration: drop conference URI index.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP INDEX IF EXISTS idx_eprints_conference_uri`);
}
