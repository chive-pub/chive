/**
 * Migration to create the content_reports table.
 *
 * @remarks
 * Stores user-submitted content reports for moderation. Users can flag
 * eprints, reviews, and other content as spam, inappropriate, copyright
 * violations, misinformation, or other issues.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create content_reports table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.createTable('content_reports', {
    id: {
      type: 'serial',
      primaryKey: true,
      comment: 'Auto-incrementing primary key',
    },
    reporter_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of the user who submitted the report',
    },
    target_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the reported content',
    },
    target_collection: {
      type: 'text',
      notNull: true,
      comment: 'Collection NSID of the reported content (e.g., pub.chive.eprint.submission)',
    },
    reason: {
      type: 'text',
      notNull: true,
      comment: 'Report reason: spam, inappropriate, copyright, misinformation, or other',
    },
    description: {
      type: 'text',
      comment: 'Free-text details provided by the reporter',
    },
    status: {
      type: 'text',
      notNull: true,
      default: "'pending'",
      comment: 'Report status: pending, reviewed, actioned, or dismissed',
    },
    reviewed_by: {
      type: 'text',
      comment: 'DID of the admin who reviewed the report',
    },
    reviewed_at: {
      type: 'timestamp with time zone',
      comment: 'When the report was reviewed',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When the report was submitted',
    },
  });

  // Unique constraint: one report per user per target
  pgm.addConstraint('content_reports', 'uq_content_reports_reporter_target', {
    unique: ['reporter_did', 'target_uri'],
  });

  // Index on target_uri for listing reports by content
  pgm.createIndex('content_reports', 'target_uri', {
    name: 'idx_content_reports_target_uri',
  });

  // Index on reporter_did for listing reports by user
  pgm.createIndex('content_reports', 'reporter_did', {
    name: 'idx_content_reports_reporter_did',
  });

  // Index on status for filtering by moderation status
  pgm.createIndex('content_reports', 'status', {
    name: 'idx_content_reports_status',
  });

  // Index on created_at DESC for chronological listing
  pgm.createIndex('content_reports', 'created_at', {
    name: 'idx_content_reports_created_at',
    method: 'btree',
  });

  pgm.sql(`
    COMMENT ON TABLE content_reports IS
      'User-submitted content reports for moderation. '
      'Each user can submit one report per content item. '
      'Reports are reviewed by admins and resolved as actioned or dismissed.';
  `);
}

/**
 * Rollback migration: drop content_reports table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('content_reports', 'created_at', {
    name: 'idx_content_reports_created_at',
  });
  pgm.dropIndex('content_reports', 'status', {
    name: 'idx_content_reports_status',
  });
  pgm.dropIndex('content_reports', 'reporter_did', {
    name: 'idx_content_reports_reporter_did',
  });
  pgm.dropIndex('content_reports', 'target_uri', {
    name: 'idx_content_reports_target_uri',
  });
  pgm.dropConstraint('content_reports', 'uq_content_reports_reporter_target');
  pgm.dropTable('content_reports');
}
