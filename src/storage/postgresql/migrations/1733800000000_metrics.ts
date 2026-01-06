/**
 * Metrics table migration.
 *
 * @remarks
 * Creates table for persisting metrics from Redis to PostgreSQL.
 *
 * Tables created:
 * - `preprint_metrics` - Aggregated view/download metrics per preprint
 *
 * ATProto Compliance Notes:
 * - All data is AppView-specific (ephemeral, rebuildable)
 * - Metrics can be rebuilt from activity logs if needed
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create metrics table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =============================================================
  // PREPRINT METRICS TABLE
  // =============================================================
  // Stores aggregated view/download metrics flushed from Redis.
  // This provides durability and historical query support.
  // =============================================================

  pgm.createTable('preprint_metrics', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT URI of the preprint',
    },
    total_views: {
      type: 'bigint',
      notNull: true,
      default: 0,
      comment: 'Total view count (all-time)',
    },
    total_downloads: {
      type: 'bigint',
      notNull: true,
      default: 0,
      comment: 'Total download count (all-time)',
    },
    unique_views: {
      type: 'bigint',
      notNull: true,
      default: 0,
      comment: 'Approximate unique viewers (from HyperLogLog)',
    },
    unique_downloads: {
      type: 'bigint',
      notNull: true,
      default: 0,
      comment: 'Approximate unique downloaders',
    },
    last_flushed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When metrics were last flushed from Redis',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When record was created',
    },
  });

  // Indexes for common queries
  pgm.createIndex('preprint_metrics', 'total_views');
  pgm.createIndex('preprint_metrics', 'total_downloads');
  pgm.createIndex('preprint_metrics', 'last_flushed_at');

  // =============================================================
  // HELPER FUNCTION: Batch upsert metrics
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION upsert_preprint_metrics(
      p_uri text,
      p_views bigint,
      p_downloads bigint DEFAULT NULL,
      p_unique_views bigint DEFAULT NULL,
      p_unique_downloads bigint DEFAULT NULL
    )
    RETURNS void AS $$
    BEGIN
      INSERT INTO preprint_metrics (
        uri,
        total_views,
        total_downloads,
        unique_views,
        unique_downloads,
        last_flushed_at,
        created_at
      ) VALUES (
        p_uri,
        COALESCE(p_views, 0),
        COALESCE(p_downloads, 0),
        COALESCE(p_unique_views, 0),
        COALESCE(p_unique_downloads, 0),
        NOW(),
        NOW()
      )
      ON CONFLICT (uri) DO UPDATE SET
        total_views = GREATEST(preprint_metrics.total_views, EXCLUDED.total_views),
        total_downloads = GREATEST(preprint_metrics.total_downloads, EXCLUDED.total_downloads),
        unique_views = GREATEST(preprint_metrics.unique_views, EXCLUDED.unique_views),
        unique_downloads = GREATEST(preprint_metrics.unique_downloads, EXCLUDED.unique_downloads),
        last_flushed_at = NOW();
    END;
    $$ LANGUAGE plpgsql;
  `);
}

/**
 * Rollback migration: drop metrics table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.sql('DROP FUNCTION IF EXISTS upsert_preprint_metrics(text, bigint, bigint, bigint, bigint)');
  pgm.dropTable('preprint_metrics', { ifExists: true });
}
