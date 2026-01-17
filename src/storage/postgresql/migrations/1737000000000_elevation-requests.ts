/**
 * Migration: Create elevation_requests table
 *
 * @remarks
 * Stores pending requests from users wanting to elevate their governance role.
 * Admins can approve or reject these requests.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create elevation_requests table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.createTable(
    'elevation_requests',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      did: {
        type: 'text',
        notNull: true,
        comment: 'DID of the user requesting elevation',
      },
      requested_role: {
        type: 'text',
        notNull: true,
        comment: 'Role being requested',
      },
      current_role: {
        type: 'text',
        notNull: true,
        default: 'community-member',
        comment: 'Current role at time of request',
      },
      status: {
        type: 'text',
        notNull: true,
        default: 'pending',
        comment: 'Request status: pending, approved, rejected',
      },
      verification_notes: {
        type: 'text',
        comment: 'Notes from admin during approval',
      },
      rejection_reason: {
        type: 'text',
        comment: 'Reason for rejection',
      },
      requested_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
      },
      processed_at: {
        type: 'timestamptz',
        comment: 'When the request was approved/rejected',
      },
      processed_by: {
        type: 'text',
        comment: 'Admin DID who processed the request',
      },
    },
    {
      ifNotExists: true,
    }
  );

  // Add check constraints
  pgm.addConstraint('elevation_requests', 'check_requested_role', {
    check: `requested_role IN ('trusted-editor', 'authority-editor', 'domain-expert', 'administrator')`,
  });

  pgm.addConstraint('elevation_requests', 'check_status', {
    check: `status IN ('pending', 'approved', 'rejected')`,
  });

  // Create indexes
  pgm.createIndex('elevation_requests', 'did', { ifNotExists: true });
  pgm.createIndex('elevation_requests', 'status', { ifNotExists: true });
  pgm.createIndex('elevation_requests', 'requested_at', { ifNotExists: true });
  pgm.createIndex('elevation_requests', ['did', 'status'], {
    name: 'idx_elevation_requests_did_status',
    ifNotExists: true,
  });
}

/**
 * Rollback migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('elevation_requests', { ifExists: true, cascade: true });
}
