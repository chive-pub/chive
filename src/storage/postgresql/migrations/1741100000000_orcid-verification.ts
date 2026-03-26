/**
 * ORCID verification migration.
 *
 * @remarks
 * Adds a timestamp column to track when an author's ORCID was verified
 * via the ORCID OAuth flow. A null value indicates the ORCID was either
 * manually entered or not present.
 *
 * ATProto Compliance Notes:
 * - This column is AppView-specific (ephemeral, rebuildable)
 * - Verification status is derived from Chive's own OAuth flow,
 *   not from user PDS records
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add ORCID verification timestamp.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('authors_index', {
    orcid_verified_at: {
      type: 'timestamptz',
      comment:
        'Timestamp when ORCID was verified via OAuth. Null means manually entered or not present.',
    },
  });
}

/**
 * Rollback migration: remove ORCID verification timestamp.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn('authors_index', 'orcid_verified_at');
}
