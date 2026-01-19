/**
 * Migration: Fix trending calculation for new tags.
 *
 * @remarks
 * The original function returned `trending = false` for new tags with no prior
 * history because growth_rate was set to 0. This caused new systems to show
 * "No tags yet" even when tags existed.
 *
 * This migration updates the function to consider tags with recent activity
 * but no prior history as "trending" with their recent_avg as the growth rate.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
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
      v_is_trending BOOLEAN;
    BEGIN
      -- Calculate average for recent window
      SELECT COALESCE(AVG(usage_count), 0)
      INTO v_recent_avg
      FROM facet_usage_history
      WHERE facet_uri = p_facet_uri
        AND date > CURRENT_DATE - (p_window_days * INTERVAL '1 day')
        AND date <= CURRENT_DATE;

      -- Calculate average for prior window
      SELECT COALESCE(AVG(usage_count), 0)
      INTO v_prior_avg
      FROM facet_usage_history
      WHERE facet_uri = p_facet_uri
        AND date > CURRENT_DATE - (2 * p_window_days * INTERVAL '1 day')
        AND date <= CURRENT_DATE - (p_window_days * INTERVAL '1 day');

      -- Calculate growth rate and trending status
      IF v_prior_avg > 0 THEN
        -- Normal case: compare to prior window
        v_growth_rate := (v_recent_avg - v_prior_avg) / v_prior_avg;
        v_is_trending := v_growth_rate > 0.2;  -- Trending if > 20% growth
      ELSIF v_recent_avg > 0 THEN
        -- New tag: has recent activity but no prior history
        -- Consider it trending with recent_avg as pseudo growth rate
        v_growth_rate := v_recent_avg;
        v_is_trending := TRUE;
      ELSE
        -- No activity at all
        v_growth_rate := 0;
        v_is_trending := FALSE;
      END IF;

      RETURN QUERY SELECT
        v_is_trending,
        v_growth_rate,
        v_recent_avg,
        v_prior_avg;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Revert to the previous version (from fix-facet-trending-function migration)
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
        AND date > CURRENT_DATE - (p_window_days * INTERVAL '1 day')
        AND date <= CURRENT_DATE;

      SELECT COALESCE(AVG(usage_count), 0)
      INTO v_prior_avg
      FROM facet_usage_history
      WHERE facet_uri = p_facet_uri
        AND date > CURRENT_DATE - (2 * p_window_days * INTERVAL '1 day')
        AND date <= CURRENT_DATE - (p_window_days * INTERVAL '1 day');

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
