/**
 * Rename collection visibility values from public/private to listed/unlisted.
 *
 * @remarks
 * Since collections are AT Protocol records in user PDSes, they are always
 * technically accessible. The visibility setting controls what the AppView
 * surfaces in listings and search, not access control. This migration
 * collapses the three-value system (public, unlisted, private) into two
 * values (listed, unlisted):
 *
 * - 'public' -> 'listed'
 * - 'private' -> 'unlisted'
 * - 'unlisted' -> 'unlisted' (unchanged)
 *
 * Also updates the column default from 'public' to 'listed'.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: rename visibility values to listed/unlisted.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Rename 'public' to 'listed'
  pgm.sql(`
    UPDATE collections_index
    SET visibility = 'listed'
    WHERE visibility = 'public'
  `);

  // Rename 'private' to 'unlisted'
  pgm.sql(`
    UPDATE collections_index
    SET visibility = 'unlisted'
    WHERE visibility = 'private'
  `);

  // Update the column default
  pgm.alterColumn('collections_index', 'visibility', {
    default: "'listed'",
    comment: 'Visibility setting (listed, unlisted)',
  });
}

/**
 * Rollback migration: restore visibility values to public/unlisted/private.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Rename 'listed' back to 'public'
  pgm.sql(`
    UPDATE collections_index
    SET visibility = 'public'
    WHERE visibility = 'listed'
  `);

  // Note: 'unlisted' stays as 'unlisted'; we cannot distinguish
  // which rows were formerly 'private' vs. 'unlisted', so this
  // rollback is lossy for those rows.

  // Restore the column default
  pgm.alterColumn('collections_index', 'visibility', {
    default: "'public'",
    comment: 'Visibility setting (public, unlisted, private)',
  });
}
