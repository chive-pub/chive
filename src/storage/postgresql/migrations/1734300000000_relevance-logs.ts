/**
 * Relevance logging tables migration.
 *
 * @remarks
 * Creates tables for logging search impressions, clicks, and dwell time
 * to build LTR (Learning to Rank) training data.
 *
 * Tables created:
 * - `search_impressions` - Search queries and their contexts
 * - `impression_results` - Results shown for each impression with features
 * - `result_clicks` - Click events on search results
 *
 * Data Format:
 * - Features stored as JSONB for flexibility during model iteration
 * - Judgment lists exportable in SVM Rank format for XGBoost/RankLib
 *
 * ATProto Compliance Notes:
 * - All data is AppView-specific (ephemeral, rebuildable)
 * - User DIDs optional - anonymous searches logged with session correlation
 * - GDPR: user deletion cascades to relevance logs
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create relevance logging tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =============================================================
  // SEARCH IMPRESSIONS TABLE
  // =============================================================
  // Records each search query execution for training data.
  // Partitioned by month for efficient retention management.
  // =============================================================

  pgm.createTable('search_impressions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
      comment: 'Unique impression identifier for click correlation',
    },
    query_id: {
      type: 'varchar(64)',
      notNull: true,
      comment: 'Hash of normalized query for grouping similar queries',
    },
    query: {
      type: 'text',
      notNull: true,
      comment: 'Original query string',
    },
    user_did: {
      type: 'varchar(255)',
      comment: 'User DID if authenticated (optional for privacy)',
    },
    session_id: {
      type: 'varchar(64)',
      comment: 'Session identifier for anonymous user grouping',
    },
    result_count: {
      type: 'smallint',
      notNull: true,
      default: 0,
      comment: 'Number of results returned',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When impression occurred',
    },
  });

  // Indexes for training data export and analytics
  pgm.createIndex('search_impressions', 'query_id', {
    name: 'idx_impressions_query_id',
  });
  pgm.createIndex('search_impressions', 'user_did', {
    name: 'idx_impressions_user_did',
    where: 'user_did IS NOT NULL',
  });
  pgm.createIndex('search_impressions', 'created_at', {
    name: 'idx_impressions_created_at',
  });
  pgm.createIndex('search_impressions', 'session_id', {
    name: 'idx_impressions_session_id',
    where: 'session_id IS NOT NULL',
  });

  // =============================================================
  // IMPRESSION RESULTS TABLE
  // =============================================================
  // Stores each result shown in an impression with position and
  // feature values at the time of display. Features in JSONB for
  // flexibility during model development.
  // =============================================================

  pgm.createTable('impression_results', {
    impression_id: {
      type: 'uuid',
      notNull: true,
      references: 'search_impressions(id)',
      onDelete: 'CASCADE',
      comment: 'Parent impression',
    },
    uri: {
      type: 'varchar(512)',
      notNull: true,
      comment: 'AT URI of the result',
    },
    position: {
      type: 'smallint',
      notNull: true,
      comment: 'Display position (0-indexed)',
    },
    features: {
      type: 'jsonb',
      notNull: true,
      default: '{}',
      comment: 'Feature values at impression time (LTRFeatureVector)',
    },
  });

  // Composite primary key
  pgm.addConstraint('impression_results', 'pk_impression_results', {
    primaryKey: ['impression_id', 'uri'],
  });

  // Index for looking up all results for an impression
  pgm.createIndex('impression_results', 'impression_id', {
    name: 'idx_impression_results_impression',
  });

  // Index for looking up impressions by result URI
  pgm.createIndex('impression_results', 'uri', {
    name: 'idx_impression_results_uri',
  });

  // =============================================================
  // RESULT CLICKS TABLE
  // =============================================================
  // Records click events on search results. Dwell time filled
  // asynchronously when user navigates away.
  // =============================================================

  pgm.createTable('result_clicks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
      comment: 'Unique click identifier',
    },
    impression_id: {
      type: 'uuid',
      notNull: true,
      comment: 'Parent impression (for FK composite key)',
    },
    uri: {
      type: 'varchar(512)',
      notNull: true,
      comment: 'AT URI of clicked result',
    },
    position: {
      type: 'smallint',
      notNull: true,
      comment: 'Position when clicked (for position bias analysis)',
    },
    clicked_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When click occurred',
    },
    dwell_time_ms: {
      type: 'integer',
      comment: 'Time spent on page in milliseconds (filled on return)',
    },
    downloaded: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether user downloaded PDF (strong relevance signal)',
    },
  });

  // Foreign key to impression_results composite key
  pgm.addConstraint('result_clicks', 'fk_result_clicks_impression_result', {
    foreignKeys: {
      columns: ['impression_id', 'uri'],
      references: 'impression_results(impression_id, uri)',
      onDelete: 'CASCADE',
    },
  });

  // Index for finding clicks by impression
  pgm.createIndex('result_clicks', 'impression_id', {
    name: 'idx_result_clicks_impression',
  });

  // Index for analytics on click timing
  pgm.createIndex('result_clicks', 'clicked_at', {
    name: 'idx_result_clicks_clicked_at',
  });

  // =============================================================
  // HELPER FUNCTION: Compute relevance grade from click data
  // =============================================================
  // Grades for SVM Rank format:
  // 4 = clicked + downloaded
  // 3 = clicked + dwell > 30s
  // 2 = clicked + dwell 10-30s
  // 1 = clicked + dwell < 10s
  // 0 = shown but not clicked
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION compute_relevance_grade(
      p_clicked boolean,
      p_dwell_time_ms integer,
      p_downloaded boolean
    )
    RETURNS smallint AS $$
    BEGIN
      IF NOT p_clicked THEN
        RETURN 0;
      END IF;

      IF p_downloaded THEN
        RETURN 4;
      END IF;

      IF p_dwell_time_ms IS NULL THEN
        RETURN 1; -- Clicked but no dwell data yet
      ELSIF p_dwell_time_ms >= 30000 THEN
        RETURN 3;
      ELSIF p_dwell_time_ms >= 10000 THEN
        RETURN 2;
      ELSE
        RETURN 1;
      END IF;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
  `);

  // =============================================================
  // HELPER FUNCTION: Normalize query to stable ID
  // =============================================================
  // Creates a stable hash for grouping similar queries.
  // Lowercases, removes punctuation, sorts words.
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION normalize_query_id(p_query text)
    RETURNS varchar(64) AS $$
    DECLARE
      normalized text;
      words text[];
    BEGIN
      -- Lowercase and remove punctuation
      normalized := regexp_replace(lower(p_query), '[^a-z0-9\\s]', '', 'g');
      -- Trim and collapse whitespace
      normalized := regexp_replace(trim(normalized), '\\s+', ' ', 'g');
      -- Sort words for stability
      SELECT array_agg(word ORDER BY word) INTO words
      FROM unnest(string_to_array(normalized, ' ')) AS word
      WHERE length(word) > 0;
      -- Return SHA256 hash (first 64 chars)
      RETURN encode(sha256(array_to_string(words, ' ')::bytea), 'hex');
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
  `);

  // =============================================================
  // VIEW: Judgment list export
  // =============================================================
  // Provides data in format ready for SVM Rank export.
  // Joins impressions, results, and clicks.
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE VIEW v_judgment_list AS
    SELECT
      si.query_id,
      si.query,
      ir.uri,
      ir.position,
      ir.features,
      si.created_at AS impression_at,
      rc.clicked_at,
      rc.dwell_time_ms,
      COALESCE(rc.downloaded, false) AS downloaded,
      compute_relevance_grade(
        rc.id IS NOT NULL,
        rc.dwell_time_ms,
        COALESCE(rc.downloaded, false)
      ) AS relevance_grade
    FROM search_impressions si
    JOIN impression_results ir ON ir.impression_id = si.id
    LEFT JOIN result_clicks rc ON rc.impression_id = si.id AND rc.uri = ir.uri
    ORDER BY si.query_id, si.created_at, ir.position;
  `);

  // =============================================================
  // COMMENT ON TABLES
  // =============================================================

  pgm.sql(`COMMENT ON TABLE search_impressions IS 'Search queries logged for LTR training data'`);
  pgm.sql(
    `COMMENT ON TABLE impression_results IS 'Results shown for each search impression with features'`
  );
  pgm.sql(`COMMENT ON TABLE result_clicks IS 'Click events on search results'`);
}

/**
 * Rollback migration: drop relevance logging tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.sql('DROP VIEW IF EXISTS v_judgment_list');
  pgm.sql('DROP FUNCTION IF EXISTS normalize_query_id(text)');
  pgm.sql('DROP FUNCTION IF EXISTS compute_relevance_grade(boolean, integer, boolean)');
  pgm.dropTable('result_clicks', { ifExists: true, cascade: true });
  pgm.dropTable('impression_results', { ifExists: true, cascade: true });
  pgm.dropTable('search_impressions', { ifExists: true, cascade: true });
}
