/**
 * PDS Registry migration.
 *
 * @remarks
 * Creates table for tracking Personal Data Servers (PDSes) that may contain
 * Chive records. Enables proactive PDS scanning to catch records that don't
 * appear in the relay firehose.
 *
 * Tables created:
 * - `pds_registry` - Registry of known PDSes with scan status
 *
 * ATProto Compliance Notes:
 * - This is AppView infrastructure (read-only from PDSes)
 * - Used for discovery, not data storage
 * - Can be rebuilt from PLC directory enumeration
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create PDS registry table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =============================================================
  // PDS REGISTRY TABLE
  // =============================================================
  // Stores known PDSes and their scan status.
  // Used for proactive scanning to find Chive records that don't
  // appear in the relay firehose.
  // =============================================================

  pgm.createTable('pds_registry', {
    pds_url: {
      type: 'text',
      primaryKey: true,
      comment: 'PDS endpoint URL (e.g., https://bsky.social)',
    },
    discovered_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this PDS was first discovered',
    },
    discovery_source: {
      type: 'text',
      notNull: true,
      comment:
        'How the PDS was discovered (plc_enumeration, relay_listhosts, user_registration, did_mention)',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      comment: 'Current status (pending, active, scanning, unreachable, no_chive_records)',
    },
    last_scan_at: {
      type: 'timestamptz',
      comment: 'When the PDS was last scanned',
    },
    next_scan_at: {
      type: 'timestamptz',
      comment: 'When the PDS should next be scanned',
    },
    has_chive_records: {
      type: 'boolean',
      comment: 'Whether this PDS has any Chive records',
    },
    chive_record_count: {
      type: 'integer',
      default: 0,
      comment: 'Number of Chive records found on this PDS',
    },
    consecutive_failures: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Number of consecutive scan failures',
    },
    scan_priority: {
      type: 'integer',
      notNull: true,
      default: 100,
      comment: 'Scan priority (lower = higher priority)',
    },
    last_error: {
      type: 'text',
      comment: 'Last error message if scan failed',
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'Last update timestamp',
    },
  });

  // Index for finding PDSes ready to scan
  pgm.createIndex('pds_registry', 'next_scan_at', {
    name: 'idx_pds_registry_next_scan',
    where: "status = 'active'",
  });

  // Index for finding PDSes with Chive records
  pgm.createIndex('pds_registry', 'has_chive_records', {
    name: 'idx_pds_registry_has_chive',
    where: 'has_chive_records = TRUE',
  });

  // Index for status filtering
  pgm.createIndex('pds_registry', 'status', {
    name: 'idx_pds_registry_status',
  });

  // Index for priority ordering
  pgm.createIndex('pds_registry', ['scan_priority', 'next_scan_at'], {
    name: 'idx_pds_registry_priority',
    where: "status = 'active'",
  });

  // =============================================================
  // AUTO-UPDATE TRIGGER FOR updated_at
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_pds_registry_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER pds_registry_updated_at
      BEFORE UPDATE ON pds_registry
      FOR EACH ROW
      EXECUTE FUNCTION update_pds_registry_updated_at();
  `);

  // =============================================================
  // HELPER FUNCTION: Get PDSes ready for scanning
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION get_pds_for_scan(p_limit INTEGER DEFAULT 10)
    RETURNS TABLE(
      pds_url TEXT,
      scan_priority INTEGER,
      has_chive_records BOOLEAN,
      last_scan_at TIMESTAMPTZ
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        r.pds_url,
        r.scan_priority,
        r.has_chive_records,
        r.last_scan_at
      FROM pds_registry r
      WHERE r.status = 'active'
        AND (r.next_scan_at IS NULL OR r.next_scan_at <= NOW())
        AND r.consecutive_failures < 5
      ORDER BY r.scan_priority ASC, r.next_scan_at ASC NULLS FIRST
      LIMIT p_limit;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // =============================================================
  // HELPER FUNCTION: Mark scan started
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION pds_scan_started(p_pds_url TEXT)
    RETURNS VOID AS $$
    BEGIN
      UPDATE pds_registry
      SET status = 'scanning'
      WHERE pds_url = p_pds_url;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // =============================================================
  // HELPER FUNCTION: Mark scan completed
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION pds_scan_completed(
      p_pds_url TEXT,
      p_has_chive_records BOOLEAN,
      p_chive_record_count INTEGER,
      p_next_scan_hours INTEGER DEFAULT 168  -- 7 days default
    )
    RETURNS VOID AS $$
    BEGIN
      UPDATE pds_registry
      SET
        status = CASE
          WHEN p_has_chive_records THEN 'active'
          ELSE 'no_chive_records'
        END,
        last_scan_at = NOW(),
        next_scan_at = NOW() + (p_next_scan_hours || ' hours')::INTERVAL,
        has_chive_records = p_has_chive_records,
        chive_record_count = p_chive_record_count,
        consecutive_failures = 0,
        last_error = NULL
      WHERE pds_url = p_pds_url;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // =============================================================
  // HELPER FUNCTION: Mark scan failed
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION pds_scan_failed(p_pds_url TEXT, p_error TEXT)
    RETURNS VOID AS $$
    DECLARE
      v_failures INTEGER;
    BEGIN
      UPDATE pds_registry
      SET
        consecutive_failures = consecutive_failures + 1,
        last_error = p_error,
        status = CASE
          WHEN consecutive_failures >= 4 THEN 'unreachable'
          ELSE 'active'
        END,
        -- Exponential backoff: 1h, 2h, 4h, 8h, then give up
        next_scan_at = NOW() + (POWER(2, LEAST(consecutive_failures, 4)) || ' hours')::INTERVAL
      WHERE pds_url = p_pds_url
      RETURNING consecutive_failures INTO v_failures;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

/**
 * Rollback migration: drop PDS registry table and functions.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Drop functions
  pgm.sql('DROP FUNCTION IF EXISTS pds_scan_failed(TEXT, TEXT)');
  pgm.sql('DROP FUNCTION IF EXISTS pds_scan_completed(TEXT, BOOLEAN, INTEGER, INTEGER)');
  pgm.sql('DROP FUNCTION IF EXISTS pds_scan_started(TEXT)');
  pgm.sql('DROP FUNCTION IF EXISTS get_pds_for_scan(INTEGER)');

  // Drop trigger and function
  pgm.sql('DROP TRIGGER IF EXISTS pds_registry_updated_at ON pds_registry');
  pgm.sql('DROP FUNCTION IF EXISTS update_pds_registry_updated_at()');

  // Drop table
  pgm.dropTable('pds_registry', { ifExists: true });
}
