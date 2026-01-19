/**
 * PDS Registry relay-connected field migration.
 *
 * @remarks
 * Adds `is_relay_connected` column to track whether a PDS is connected to
 * a relay (firehose). Relay-connected PDSes don't need proactive scanning
 * because their records appear in the firehose.
 *
 * Known relay-connected PDS patterns:
 * - `*.host.bsky.network` - Bluesky-hosted PDSes
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add is_relay_connected column.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Add is_relay_connected column
  pgm.addColumn('pds_registry', {
    is_relay_connected: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment:
        'Whether this PDS is connected to a relay (firehose). Relay-connected PDSes do not need proactive scanning.',
    },
  });

  // Set is_relay_connected = true for known Bluesky-hosted PDSes
  pgm.sql(`
    UPDATE pds_registry
    SET is_relay_connected = TRUE
    WHERE pds_url LIKE '%.host.bsky.network%'
       OR pds_url LIKE '%bsky.social%'
       OR pds_url LIKE '%bsky.network%';
  `);

  // Create index for filtering non-relay PDSes for scanning
  pgm.createIndex('pds_registry', 'is_relay_connected', {
    name: 'idx_pds_registry_relay_connected',
    where: 'is_relay_connected = FALSE',
  });

  // Update the get_pds_for_scan function to exclude relay-connected PDSes
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
        AND r.is_relay_connected = FALSE
      ORDER BY r.scan_priority ASC, r.next_scan_at ASC NULLS FIRST
      LIMIT p_limit;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

/**
 * Rollback migration: remove is_relay_connected column.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Restore original function
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

  // Drop index
  pgm.dropIndex('pds_registry', 'is_relay_connected', {
    name: 'idx_pds_registry_relay_connected',
    ifExists: true,
  });

  // Drop column
  pgm.dropColumn('pds_registry', 'is_relay_connected');
}
