/**
 * Chive-native collaboration schema.
 *
 * @remarks
 * Stores `pub.chive.collaboration.invite` and
 * `pub.chive.collaboration.inviteAcceptance` records indexed from the
 * firehose, plus two "pending" tables that handle out-of-order delivery.
 *
 * ## Design
 *
 * Collaboration is generic over any Chive record type (not just collections),
 * so tables are keyed on `subject_uri` rather than a collection-specific
 * foreign key. AppView logic surfacing active collaborators computes
 * `(invite, acceptance) not-deleted` pairs per subject.
 *
 * See `.claude/design/collaboration.md` for the full write-authority model.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  // =========================================================================
  // Invite records (authored in the subject's author's PDS)
  // =========================================================================
  pgm.createTable('collaboration_invites_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    inviter_did: { type: 'text', notNull: true },
    invitee_did: { type: 'text', notNull: true },
    subject_uri: { type: 'text', notNull: true },
    subject_author_did: { type: 'text', notNull: true },
    subject_collection: { type: 'text', notNull: true },
    role: { type: 'text' },
    message: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true },
    expires_at: { type: 'timestamptz' },
    /** When set, the record has been withdrawn by the inviter. */
    deleted_at: { type: 'timestamptz' },
    pds_url: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_synced_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('collaboration_invites_index', 'invitee_did');
  pgm.createIndex('collaboration_invites_index', 'inviter_did');
  pgm.createIndex('collaboration_invites_index', 'subject_uri');
  pgm.createIndex('collaboration_invites_index', 'subject_collection');

  // =========================================================================
  // Acceptance records (authored in the invitee's PDS)
  // =========================================================================
  pgm.createTable('collaboration_acceptances_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    accepter_did: { type: 'text', notNull: true },
    invite_uri: { type: 'text', notNull: true },
    subject_uri: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true },
    /** When set, the record has been revoked by the invitee. */
    deleted_at: { type: 'timestamptz' },
    pds_url: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_synced_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('collaboration_acceptances_index', 'accepter_did');
  pgm.createIndex('collaboration_acceptances_index', 'invite_uri');
  pgm.createIndex('collaboration_acceptances_index', 'subject_uri');

  // =========================================================================
  // Pending collaboration state.
  // =========================================================================
  // Tracks invitation-acceptance pairs where one side of the handshake has
  // been observed but the other has not yet, due to firehose ordering. On
  // each invite/acceptance create or delete we re-evaluate the rows for the
  // affected (subject_uri, did) pair. Rows become "active" when both sides
  // are present and non-deleted; they are then surfaced by
  // `getActiveCollaborators`.
  pgm.createTable('collaboration_pending_state', {
    id: { type: 'serial', primaryKey: true },
    subject_uri: { type: 'text', notNull: true },
    did: { type: 'text', notNull: true },
    invite_uri: { type: 'text' },
    acceptance_uri: { type: 'text' },
    state: {
      type: 'text',
      notNull: true,
      check: "state IN ('pending-acceptance','pending-invite','active','inactive')",
    },
    received_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('collaboration_pending_state', 'collaboration_pending_state_unique_pair', {
    unique: ['subject_uri', 'did'],
  });
  pgm.createIndex('collaboration_pending_state', 'subject_uri');
  pgm.createIndex('collaboration_pending_state', 'did');
  pgm.createIndex('collaboration_pending_state', 'state');

  // =========================================================================
  // Collection edges awaiting collaborator authorization.
  // =========================================================================
  // When we see a `contains` edge from a foreign DID against a mirrored
  // collection, the DID may not yet be an active collaborator (invite or
  // acceptance not indexed yet). We park these edges here and re-evaluate
  // when collaboration state changes.
  pgm.createTable('pending_collection_edges', {
    edge_uri: { type: 'text', primaryKey: true },
    collection_uri: { type: 'text', notNull: true },
    source_uri: { type: 'text', notNull: true },
    target_uri: { type: 'text', notNull: true },
    added_by_did: { type: 'text', notNull: true },
    relation_slug: { type: 'text', notNull: true },
    /** When set, the edge has been promoted to `collection_edges_index`. */
    resolved_at: { type: 'timestamptz' },
    received_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('pending_collection_edges', 'collection_uri');
  pgm.createIndex('pending_collection_edges', 'added_by_did');
  pgm.createIndex('pending_collection_edges', 'resolved_at');
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('pending_collection_edges');
  pgm.dropTable('collaboration_pending_state');
  pgm.dropTable('collaboration_acceptances_index');
  pgm.dropTable('collaboration_invites_index');
}
