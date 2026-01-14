/**
 * Co-author claims table migration.
 *
 * @remarks
 * Creates the `coauthor_claim_requests` table for managing co-authorship
 * requests on eprints in another user's PDS. When approved, the PDS owner
 * updates their record to add the claimant as co-author.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create co-author claims table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.createTable('coauthor_claim_requests', {
    id: {
      type: 'bigserial',
      primaryKey: true,
      comment: 'Request ID',
    },
    eprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the eprint record',
    },
    eprint_owner_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of the PDS owner',
    },
    claimant_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of person requesting co-authorship',
    },
    claimant_name: {
      type: 'text',
      notNull: true,
      comment: 'Display name at time of request (for display purposes)',
    },
    author_index: {
      type: 'integer',
      notNull: true,
      comment: 'Index of the author entry being claimed (0-based)',
    },
    author_name: {
      type: 'text',
      notNull: true,
      comment: 'Name of the author entry being claimed (for display)',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'approved', 'rejected')",
      comment: 'Request status',
    },
    message: {
      type: 'text',
      comment: 'Optional message from claimant',
    },
    rejection_reason: {
      type: 'text',
      comment: 'Reason for rejection if rejected',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When request was submitted',
    },
    reviewed_at: {
      type: 'timestamptz',
      comment: 'When request was reviewed',
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When request was last updated',
    },
  });

  // Prevent duplicate requests from same claimant for same eprint
  pgm.addConstraint('coauthor_claim_requests', 'unique_eprint_claimant', {
    unique: ['eprint_uri', 'claimant_did'],
  });

  // Indexes for common queries
  pgm.createIndex('coauthor_claim_requests', 'eprint_uri');
  pgm.createIndex('coauthor_claim_requests', 'eprint_owner_did');
  pgm.createIndex('coauthor_claim_requests', 'claimant_did');
  pgm.createIndex('coauthor_claim_requests', 'status');
  pgm.createIndex('coauthor_claim_requests', 'created_at');
}

/**
 * Rollback migration: drop co-author claims table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('coauthor_claim_requests', { ifExists: true });
}
