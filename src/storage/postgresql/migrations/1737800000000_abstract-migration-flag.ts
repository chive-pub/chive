/**
 * Migration to add needs_abstract_migration flag to eprints_index.
 *
 * @remarks
 * This migration adds a boolean flag that indicates whether the source PDS
 * record uses a legacy plain string abstract instead of the current rich
 * text array format. This enables accurate schema migration hints without
 * relying on heuristic detection.
 *
 * The flag is set during indexing based on the source record format detected
 * by the PDS record transformer. This is indexing metadata, not a domain
 * concept; the knowledge of legacy formats lives only in the normalization code.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add needs_abstract_migration column.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('eprints_index', {
    needs_abstract_migration: {
      type: 'boolean',
      comment:
        'Indicates the source PDS record uses legacy plain string abstract format. ' +
        'Set during indexing for accurate schema migration hints.',
    },
  });

  // Add column comment via SQL for clarity
  pgm.sql(`
    COMMENT ON COLUMN eprints_index.needs_abstract_migration IS
      'True if source PDS record uses legacy string abstract format, false or null if using current array format. Set during indexing.';
  `);
}

/**
 * Rollback migration: remove needs_abstract_migration column.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn('eprints_index', 'needs_abstract_migration');
}
