/**
 * Rename semble_count to cosmik_count in backlink_counts table.
 *
 * @remarks
 * Renames the column and updates the refresh_backlink_counts function
 * to use the new column name and filter on 'cosmik.collection' instead
 * of 'semble.collection'.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: rename semble_count to cosmik_count.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Rename column
  pgm.renameColumn('backlink_counts', 'semble_count', 'cosmik_count');

  // Update source_type values in backlinks table
  pgm.sql(`
    UPDATE backlinks
    SET source_type = 'cosmik.collection'
    WHERE source_type = 'semble.collection'
  `);

  // Recreate the refresh function with the new column name and source type
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_backlink_counts(p_target_uri text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO backlink_counts (
        target_uri,
        cosmik_count,
        leaflet_count,
        whitewind_count,
        bluesky_post_count,
        bluesky_embed_count,
        comment_count,
        endorsement_count,
        other_count,
        total_count,
        last_updated_at
      )
      SELECT
        p_target_uri,
        COUNT(*) FILTER (WHERE source_type = 'cosmik.collection'),
        COUNT(*) FILTER (WHERE source_type = 'leaflet.list'),
        COUNT(*) FILTER (WHERE source_type = 'whitewind.blog'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.post'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.embed'),
        COUNT(*) FILTER (WHERE source_type = 'chive.comment'),
        COUNT(*) FILTER (WHERE source_type = 'chive.endorsement'),
        COUNT(*) FILTER (WHERE source_type = 'other'),
        COUNT(*),
        NOW()
      FROM backlinks
      WHERE target_uri = p_target_uri AND is_deleted = false
      ON CONFLICT (target_uri) DO UPDATE SET
        cosmik_count = EXCLUDED.cosmik_count,
        leaflet_count = EXCLUDED.leaflet_count,
        whitewind_count = EXCLUDED.whitewind_count,
        bluesky_post_count = EXCLUDED.bluesky_post_count,
        bluesky_embed_count = EXCLUDED.bluesky_embed_count,
        comment_count = EXCLUDED.comment_count,
        endorsement_count = EXCLUDED.endorsement_count,
        other_count = EXCLUDED.other_count,
        total_count = EXCLUDED.total_count,
        last_updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql
  `);
}

/**
 * Rollback migration: rename cosmik_count back to semble_count.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.renameColumn('backlink_counts', 'cosmik_count', 'semble_count');

  pgm.sql(`
    UPDATE backlinks
    SET source_type = 'semble.collection'
    WHERE source_type = 'cosmik.collection'
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_backlink_counts(p_target_uri text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO backlink_counts (
        target_uri,
        semble_count,
        leaflet_count,
        whitewind_count,
        bluesky_post_count,
        bluesky_embed_count,
        comment_count,
        endorsement_count,
        other_count,
        total_count,
        last_updated_at
      )
      SELECT
        p_target_uri,
        COUNT(*) FILTER (WHERE source_type = 'semble.collection'),
        COUNT(*) FILTER (WHERE source_type = 'leaflet.list'),
        COUNT(*) FILTER (WHERE source_type = 'whitewind.blog'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.post'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.embed'),
        COUNT(*) FILTER (WHERE source_type = 'chive.comment'),
        COUNT(*) FILTER (WHERE source_type = 'chive.endorsement'),
        COUNT(*) FILTER (WHERE source_type = 'other'),
        COUNT(*),
        NOW()
      FROM backlinks
      WHERE target_uri = p_target_uri AND is_deleted = false
      ON CONFLICT (target_uri) DO UPDATE SET
        semble_count = EXCLUDED.semble_count,
        leaflet_count = EXCLUDED.leaflet_count,
        whitewind_count = EXCLUDED.whitewind_count,
        bluesky_post_count = EXCLUDED.bluesky_post_count,
        bluesky_embed_count = EXCLUDED.bluesky_embed_count,
        comment_count = EXCLUDED.comment_count,
        endorsement_count = EXCLUDED.endorsement_count,
        other_count = EXCLUDED.other_count,
        total_count = EXCLUDED.total_count,
        last_updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql
  `);
}
