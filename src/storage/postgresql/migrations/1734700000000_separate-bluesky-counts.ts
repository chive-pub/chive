/**
 * Separate Bluesky post and embed counts migration.
 *
 * @remarks
 * Splits the combined `bluesky_count` column into separate `bluesky_post_count`
 * and `bluesky_embed_count` columns. Also adds `other_count` for the 'other'
 * source type.
 *
 * This matches the API schema in src/api/schemas/backlink.ts which returns
 * separate counts for frontend display flexibility.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: separate bluesky counts.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Add new columns for separate Bluesky counts
  pgm.addColumn('backlink_counts', {
    bluesky_post_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of Bluesky post references',
    },
  });

  pgm.addColumn('backlink_counts', {
    bluesky_embed_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of Bluesky embed references',
    },
  });

  pgm.addColumn('backlink_counts', {
    other_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of other/external references',
    },
  });

  // Migrate existing data: split bluesky_count based on actual backlinks
  pgm.sql(`
    UPDATE backlink_counts bc
    SET
      bluesky_post_count = COALESCE((
        SELECT COUNT(*)
        FROM backlinks b
        WHERE b.target_uri = bc.target_uri
          AND b.source_type = 'bluesky.post'
          AND b.is_deleted = false
      ), 0),
      bluesky_embed_count = COALESCE((
        SELECT COUNT(*)
        FROM backlinks b
        WHERE b.target_uri = bc.target_uri
          AND b.source_type = 'bluesky.embed'
          AND b.is_deleted = false
      ), 0),
      other_count = COALESCE((
        SELECT COUNT(*)
        FROM backlinks b
        WHERE b.target_uri = bc.target_uri
          AND b.source_type = 'other'
          AND b.is_deleted = false
      ), 0)
  `);

  // Drop the old combined bluesky_count column
  pgm.dropColumn('backlink_counts', 'bluesky_count');

  // Update the refresh_backlink_counts function with separate counts
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

/**
 * Rollback migration: restore combined bluesky_count.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Add back the combined bluesky_count column
  pgm.addColumn('backlink_counts', {
    bluesky_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of Bluesky shares/embeds',
    },
  });

  // Migrate data back: combine post and embed counts
  pgm.sql(`
    UPDATE backlink_counts
    SET bluesky_count = bluesky_post_count + bluesky_embed_count
  `);

  // Drop the separate columns
  pgm.dropColumn('backlink_counts', 'bluesky_post_count');
  pgm.dropColumn('backlink_counts', 'bluesky_embed_count');
  pgm.dropColumn('backlink_counts', 'other_count');

  // Restore original refresh function
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
