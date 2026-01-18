/**
 * Migration: Create votes_index table
 *
 * @remarks
 * Creates the votes_index table to store governance votes from the firehose.
 * Votes are ATProto records (pub.chive.graph.vote) that reference proposals.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create votes_index table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.createTable(
    'votes_index',
    {
      uri: {
        type: 'text',
        primaryKey: true,
        comment: 'AT URI (e.g., at://did:plc:abc/pub.chive.graph.vote/xyz)',
      },
      cid: {
        type: 'text',
        notNull: true,
        comment: 'Record CID for version tracking',
      },
      voter_did: {
        type: 'text',
        notNull: true,
        comment: 'DID of the user who cast this vote',
      },
      proposal_uri: {
        type: 'text',
        notNull: true,
        comment: 'AT URI of the proposal being voted on',
      },
      vote: {
        type: 'text',
        notNull: true,
        comment: 'Vote value (approve or reject)',
      },
      comment: {
        type: 'text',
        comment: 'Optional comment explaining the vote',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        comment: 'When the vote was created',
      },
      // PDS source tracking (ATProto compliance)
      pds_url: {
        type: 'text',
        notNull: true,
        comment: 'URL of the PDS where this record lives',
      },
      indexed_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'When this record was indexed',
      },
      last_synced_at: {
        type: 'timestamptz',
        comment: 'Last sync check time',
      },
    },
    {
      ifNotExists: true,
    }
  );

  // Add check constraint for vote values
  pgm.addConstraint('votes_index', 'check_vote_value', {
    check: `vote IN ('approve', 'reject')`,
  });

  // Create indexes for common queries
  pgm.createIndex('votes_index', 'voter_did', { ifNotExists: true });
  pgm.createIndex('votes_index', 'proposal_uri', { ifNotExists: true });
  pgm.createIndex('votes_index', 'created_at', { ifNotExists: true });
  pgm.createIndex('votes_index', ['proposal_uri', 'voter_did'], {
    name: 'idx_votes_proposal_voter',
    unique: true,
    ifNotExists: true,
  });
}

/**
 * Rollback migration: drop votes_index table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('votes_index', { ifExists: true, cascade: true });
}
