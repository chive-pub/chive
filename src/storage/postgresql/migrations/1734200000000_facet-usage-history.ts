/**
 * Facet usage history migration.
 *
 * @remarks
 * Creates table for tracking daily facet/tag usage snapshots.
 * Enables time-windowed trending calculations (day, week, month).
 *
 * Tables created:
 * - `facet_usage_history` - Daily usage snapshots per facet/tag
 *
 * ATProto Compliance Notes:
 * - All data is AppView-specific (ephemeral, rebuildable)
 * - Historical data derived from indexed tag applications
 * - Can be rebuilt from user_tags_index if needed
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create facet usage history table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =============================================================
  // FACET USAGE HISTORY TABLE
  // =============================================================
  // Stores daily snapshots of facet/tag usage counts.
  // Used for calculating trending scores with time windows.
  // =============================================================

  pgm.createTable('facet_usage_history', {
    facet_uri: {
      type: 'text',
      notNull: true,
      comment: 'Facet or tag URI/identifier',
    },
    date: {
      type: 'date',
      notNull: true,
      comment: 'Date of the snapshot (UTC)',
    },
    usage_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Total usage count on this date',
    },
    unique_records: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Number of unique records using this facet',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this snapshot was recorded',
    },
  });

  // Composite primary key on facet_uri + date
  pgm.addConstraint('facet_usage_history', 'pk_facet_usage_history', {
    primaryKey: ['facet_uri', 'date'],
  });

  // Index for date-range queries (e.g., last 7 days)
  pgm.createIndex('facet_usage_history', 'date', {
    name: 'idx_facet_usage_history_date',
  });

  // Index for facet + date lookups
  pgm.createIndex('facet_usage_history', ['facet_uri', 'date'], {
    name: 'idx_facet_usage_history_facet_date',
  });

  // =============================================================
  // HELPER FUNCTION: Calculate trending score
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION calculate_facet_trending(
      p_facet_uri TEXT,
      p_window_days INTEGER DEFAULT 7
    )
    RETURNS TABLE(
      trending BOOLEAN,
      growth_rate NUMERIC,
      recent_avg NUMERIC,
      prior_avg NUMERIC
    ) AS $$
    DECLARE
      v_recent_avg NUMERIC;
      v_prior_avg NUMERIC;
      v_growth_rate NUMERIC;
    BEGIN
      -- Calculate average for recent window
      SELECT COALESCE(AVG(usage_count), 0)
      INTO v_recent_avg
      FROM facet_usage_history
      WHERE facet_uri = p_facet_uri
        AND date > CURRENT_DATE - p_window_days
        AND date <= CURRENT_DATE;

      -- Calculate average for prior window
      SELECT COALESCE(AVG(usage_count), 0)
      INTO v_prior_avg
      FROM facet_usage_history
      WHERE facet_uri = p_facet_uri
        AND date > CURRENT_DATE - (2 * p_window_days)
        AND date <= CURRENT_DATE - p_window_days;

      -- Calculate growth rate
      IF v_prior_avg > 0 THEN
        v_growth_rate := (v_recent_avg - v_prior_avg) / v_prior_avg;
      ELSE
        v_growth_rate := 0;
      END IF;

      -- Return results
      RETURN QUERY SELECT
        v_growth_rate > 0.2,  -- Trending if > 20% growth
        v_growth_rate,
        v_recent_avg,
        v_prior_avg;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // =============================================================
  // HELPER FUNCTION: Batch upsert snapshots
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION upsert_facet_usage_snapshot(
      p_facet_uri TEXT,
      p_date DATE,
      p_usage_count INTEGER,
      p_unique_records INTEGER
    )
    RETURNS VOID AS $$
    BEGIN
      INSERT INTO facet_usage_history (facet_uri, date, usage_count, unique_records)
      VALUES (p_facet_uri, p_date, p_usage_count, p_unique_records)
      ON CONFLICT (facet_uri, date) DO UPDATE SET
        usage_count = GREATEST(facet_usage_history.usage_count, EXCLUDED.usage_count),
        unique_records = GREATEST(facet_usage_history.unique_records, EXCLUDED.unique_records);
    END;
    $$ LANGUAGE plpgsql;
  `);
}

/**
 * Rollback migration: drop facet usage history table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Drop functions
  pgm.sql('DROP FUNCTION IF EXISTS upsert_facet_usage_snapshot(TEXT, DATE, INTEGER, INTEGER)');
  pgm.sql('DROP FUNCTION IF EXISTS calculate_facet_trending(TEXT, INTEGER)');

  // Drop table
  pgm.dropTable('facet_usage_history', { ifExists: true });
}
