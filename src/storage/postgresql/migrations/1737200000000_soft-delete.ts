/**
 * Soft-delete support for eprints.
 *
 * @remarks
 * Adds soft-delete columns to enable tracking of deleted records without
 * immediate removal from the index. This allows:
 *
 * - Detecting when records are deleted from source PDSes
 * - Grace period before permanent removal
 * - Audit trail of deletions
 *
 * Records are marked as deleted when:
 * - PDS returns 404 during freshness check
 * - Record is explicitly tombstoned via firehose
 *
 * **Columns Added:**
 * - `deleted_at` - When deletion was detected
 * - `deletion_source` - How deletion was detected ('pds_404', 'firehose_tombstone', 'admin')
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add soft-delete columns.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Add soft-delete columns to eprints_index
  pgm.addColumns('eprints_index', {
    deleted_at: {
      type: 'timestamptz',
      comment: 'When deletion was detected (null = not deleted)',
    },
    deletion_source: {
      type: 'text',
      check: "deletion_source IN ('pds_404', 'firehose_tombstone', 'admin')",
      comment: 'How deletion was detected',
    },
  });

  // Create partial index for active (non-deleted) records
  // This optimizes queries that filter out deleted records
  pgm.createIndex('eprints_index', 'deleted_at', {
    name: 'idx_eprints_active',
    where: 'deleted_at IS NULL',
  });

  // Create index for deleted records (for cleanup jobs)
  pgm.createIndex('eprints_index', 'deleted_at', {
    name: 'idx_eprints_deleted',
    where: 'deleted_at IS NOT NULL',
  });

  // Add freshness check tracking columns to pds_sync_status
  pgm.addColumns('pds_sync_status', {
    freshness_check_count: {
      type: 'integer',
      default: 0,
      notNull: true,
      comment: 'Number of freshness checks performed',
    },
    last_freshness_check: {
      type: 'timestamptz',
      comment: 'When last freshness check was performed',
    },
    records_refreshed: {
      type: 'integer',
      default: 0,
      notNull: true,
      comment: 'Total records refreshed from this PDS',
    },
    records_deleted: {
      type: 'integer',
      default: 0,
      notNull: true,
      comment: 'Total records deleted from this PDS',
    },
  });

  // Add soft-delete to reviews_index
  pgm.addColumns('reviews_index', {
    deleted_at: {
      type: 'timestamptz',
      comment: 'When deletion was detected',
    },
    deletion_source: {
      type: 'text',
      check: "deletion_source IN ('pds_404', 'firehose_tombstone', 'admin')",
      comment: 'How deletion was detected',
    },
  });

  // Add soft-delete to endorsements_index
  pgm.addColumns('endorsements_index', {
    deleted_at: {
      type: 'timestamptz',
      comment: 'When deletion was detected',
    },
    deletion_source: {
      type: 'text',
      check: "deletion_source IN ('pds_404', 'firehose_tombstone', 'admin')",
      comment: 'How deletion was detected',
    },
  });

  // Add soft-delete to user_tags_index
  pgm.addColumns('user_tags_index', {
    deleted_at: {
      type: 'timestamptz',
      comment: 'When deletion was detected',
    },
    deletion_source: {
      type: 'text',
      check: "deletion_source IN ('pds_404', 'firehose_tombstone', 'admin')",
      comment: 'How deletion was detected',
    },
  });
}

/**
 * Rollback migration: remove soft-delete columns.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Remove indexes
  pgm.dropIndex('eprints_index', 'deleted_at', { name: 'idx_eprints_active', ifExists: true });
  pgm.dropIndex('eprints_index', 'deleted_at', { name: 'idx_eprints_deleted', ifExists: true });

  // Remove columns from user_tags_index
  pgm.dropColumns('user_tags_index', ['deleted_at', 'deletion_source']);

  // Remove columns from endorsements_index
  pgm.dropColumns('endorsements_index', ['deleted_at', 'deletion_source']);

  // Remove columns from reviews_index
  pgm.dropColumns('reviews_index', ['deleted_at', 'deletion_source']);

  // Remove freshness columns from pds_sync_status
  pgm.dropColumns('pds_sync_status', [
    'freshness_check_count',
    'last_freshness_check',
    'records_refreshed',
    'records_deleted',
  ]);

  // Remove columns from eprints_index
  pgm.dropColumns('eprints_index', ['deleted_at', 'deletion_source']);
}
