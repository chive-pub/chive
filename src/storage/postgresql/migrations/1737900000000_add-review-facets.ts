/**
 * Migration to add facets column to reviews_index.
 *
 * @remarks
 * Adds JSONB column for storing ATProto-style rich text facets
 * (bold, italic, mentions, links, etc.) extracted from review body.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Use raw SQL with IF NOT EXISTS for idempotent migration
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reviews_index' AND column_name = 'facets'
      ) THEN
        ALTER TABLE reviews_index ADD COLUMN facets jsonb;
        COMMENT ON COLUMN reviews_index.facets IS 'ATProto-style rich text facets (bold, italic, mentions, links)';
      END IF;
    END $$;
  `);

  // GIN index for facet queries (IF NOT EXISTS is supported)
  pgm.createIndex('reviews_index', 'facets', {
    method: 'gin',
    name: 'idx_reviews_facets',
    where: 'facets IS NOT NULL',
    ifNotExists: true,
  });
}

/**
 * Rollback migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('reviews_index', 'facets', {
    name: 'idx_reviews_facets',
    ifExists: true,
  });
  pgm.dropColumn('reviews_index', 'facets', { ifExists: true });
}
