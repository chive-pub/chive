/**
 * Migration: Fix date arithmetic in calculate_facet_trending function.
 *
 * @remarks
 * The original function used `CURRENT_DATE - p_window_days` which causes
 * PostgreSQL error "operator does not exist: date > integer".
 *
 * This migration replaces the function with correct interval arithmetic:
 * `CURRENT_DATE - (p_window_days * INTERVAL '1 day')`
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // Replace the calculate_facet_trending function with fixed date arithmetic
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
      -- Fixed: Use INTERVAL arithmetic instead of integer subtraction
      SELECT COALESCE(AVG(usage_count), 0)
      INTO v_recent_avg
      FROM facet_usage_history
      WHERE facet_uri = p_facet_uri
        AND date > CURRENT_DATE - (p_window_days * INTERVAL '1 day')
        AND date <= CURRENT_DATE;

      -- Calculate average for prior window
      -- Fixed: Use INTERVAL arithmetic instead of integer subtraction
      SELECT COALESCE(AVG(usage_count), 0)
      INTO v_prior_avg
      FROM facet_usage_history
      WHERE facet_uri = p_facet_uri
        AND date > CURRENT_DATE - (2 * p_window_days * INTERVAL '1 day')
        AND date <= CURRENT_DATE - (p_window_days * INTERVAL '1 day');

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
}

export function down(pgm: MigrationBuilder): void {
  // Revert to original (buggy) version for rollback
  // Note: This will restore the bug, but maintains migration reversibility
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
      SELECT COALESCE(AVG(usage_count), 0)
      INTO v_recent_avg
      FROM facet_usage_history
      WHERE facet_uri = p_facet_uri
        AND date > CURRENT_DATE - p_window_days
        AND date <= CURRENT_DATE;

      SELECT COALESCE(AVG(usage_count), 0)
      INTO v_prior_avg
      FROM facet_usage_history
      WHERE facet_uri = p_facet_uri
        AND date > CURRENT_DATE - (2 * p_window_days)
        AND date <= CURRENT_DATE - p_window_days;

      IF v_prior_avg > 0 THEN
        v_growth_rate := (v_recent_avg - v_prior_avg) / v_prior_avg;
      ELSE
        v_growth_rate := 0;
      END IF;

      RETURN QUERY SELECT
        v_growth_rate > 0.2,
        v_growth_rate,
        v_recent_avg,
        v_prior_avg;
    END;
    $$ LANGUAGE plpgsql;
  `);
}
