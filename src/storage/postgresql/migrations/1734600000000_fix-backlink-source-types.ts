/**
 * Fix backlink source types migration.
 *
 * @remarks
 * Corrects the backlink source type values to match the API schema:
 * - Changes 'whitewind.post' to 'whitewind.blog'
 * - Changes 'external' to 'other'
 *
 * This ensures consistency between the database constraint and the
 * API schema defined in src/api/schemas/backlink.ts.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: fix backlink source types.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // First, update any existing data that uses the old values
  pgm.sql(`
    UPDATE backlinks
    SET source_type = 'whitewind.blog'
    WHERE source_type = 'whitewind.post'
  `);

  pgm.sql(`
    UPDATE backlinks
    SET source_type = 'other'
    WHERE source_type = 'external'
  `);

  // Drop the old constraint
  pgm.sql(`
    ALTER TABLE backlinks
    DROP CONSTRAINT IF EXISTS backlinks_source_type_check
  `);

  // Add the new constraint with corrected values
  pgm.sql(`
    ALTER TABLE backlinks
    ADD CONSTRAINT backlinks_source_type_check
    CHECK (source_type IN (
      'semble.collection',
      'leaflet.list',
      'whitewind.blog',
      'bluesky.post',
      'bluesky.embed',
      'chive.comment',
      'chive.endorsement',
      'other'
    ))
  `);

  // Update the refresh_backlink_counts function to use correct source type
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_backlink_counts(p_target_uri text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO backlink_counts (
        target_uri,
        semble_count,
        leaflet_count,
        whitewind_count,
        bluesky_count,
        comment_count,
        endorsement_count,
        total_count,
        last_updated_at
      )
      SELECT
        p_target_uri,
        COUNT(*) FILTER (WHERE source_type = 'semble.collection'),
        COUNT(*) FILTER (WHERE source_type = 'leaflet.list'),
        COUNT(*) FILTER (WHERE source_type = 'whitewind.blog'),
        COUNT(*) FILTER (WHERE source_type IN ('bluesky.post', 'bluesky.embed')),
        COUNT(*) FILTER (WHERE source_type = 'chive.comment'),
        COUNT(*) FILTER (WHERE source_type = 'chive.endorsement'),
        COUNT(*),
        NOW()
      FROM backlinks
      WHERE target_uri = p_target_uri AND is_deleted = false
      ON CONFLICT (target_uri) DO UPDATE SET
        semble_count = EXCLUDED.semble_count,
        leaflet_count = EXCLUDED.leaflet_count,
        whitewind_count = EXCLUDED.whitewind_count,
        bluesky_count = EXCLUDED.bluesky_count,
        comment_count = EXCLUDED.comment_count,
        endorsement_count = EXCLUDED.endorsement_count,
        total_count = EXCLUDED.total_count,
        last_updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql
  `);
}

/**
 * Rollback migration: revert to old source types.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Revert data
  pgm.sql(`
    UPDATE backlinks
    SET source_type = 'whitewind.post'
    WHERE source_type = 'whitewind.blog'
  `);

  pgm.sql(`
    UPDATE backlinks
    SET source_type = 'external'
    WHERE source_type = 'other'
  `);

  // Drop the new constraint
  pgm.sql(`
    ALTER TABLE backlinks
    DROP CONSTRAINT IF EXISTS backlinks_source_type_check
  `);

  // Restore old constraint
  pgm.sql(`
    ALTER TABLE backlinks
    ADD CONSTRAINT backlinks_source_type_check
    CHECK (source_type IN (
      'semble.collection',
      'leaflet.list',
      'whitewind.post',
      'bluesky.post',
      'bluesky.embed',
      'chive.comment',
      'chive.endorsement',
      'external'
    ))
  `);

  // Restore old function
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_backlink_counts(p_target_uri text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO backlink_counts (
        target_uri,
        semble_count,
        leaflet_count,
        whitewind_count,
        bluesky_count,
        comment_count,
        endorsement_count,
        total_count,
        last_updated_at
      )
      SELECT
        p_target_uri,
        COUNT(*) FILTER (WHERE source_type = 'semble.collection'),
        COUNT(*) FILTER (WHERE source_type = 'leaflet.list'),
        COUNT(*) FILTER (WHERE source_type = 'whitewind.post'),
        COUNT(*) FILTER (WHERE source_type IN ('bluesky.post', 'bluesky.embed')),
        COUNT(*) FILTER (WHERE source_type = 'chive.comment'),
        COUNT(*) FILTER (WHERE source_type = 'chive.endorsement'),
        COUNT(*),
        NOW()
      FROM backlinks
      WHERE target_uri = p_target_uri AND is_deleted = false
      ON CONFLICT (target_uri) DO UPDATE SET
        semble_count = EXCLUDED.semble_count,
        leaflet_count = EXCLUDED.leaflet_count,
        whitewind_count = EXCLUDED.whitewind_count,
        bluesky_count = EXCLUDED.bluesky_count,
        comment_count = EXCLUDED.comment_count,
        endorsement_count = EXCLUDED.endorsement_count,
        total_count = EXCLUDED.total_count,
        last_updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql
  `);
}
