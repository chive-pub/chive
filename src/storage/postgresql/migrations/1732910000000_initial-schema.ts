/**
 * Initial database schema migration.
 *
 * @remarks
 * Creates all index tables for Chive's local search and browse functionality.
 *
 * **CRITICAL ATProto Compliance**:
 * - All tables use `_index` suffix (semantic clarity: these are indexes, not source data)
 * - Every index table tracks PDS source (`pds_url`, `indexed_at`, `last_synced_at`)
 * - Foreign keys reference AT URIs (not internal sequential IDs)
 * - No blob data columns (only BlobRef CIDs)
 * - All data can be rebuilt from AT Protocol firehose
 *
 * Tables created:
 * - `preprints_index` - Preprint metadata
 * - `authors_index` - Author profiles
 * - `reviews_index` - Review comments
 * - `endorsements_index` - Endorsements
 * - `user_tags_index` - User-contributed tags
 * - `firehose_cursor` - Cursor persistence for firehose consumer
 * - `firehose_dlq` - Dead letter queue for failed events
 * - `pds_sync_status` - PDS health tracking
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create initial schema.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Preprints index table
  pgm.createTable('preprints_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT URI (e.g., at://did:plc:abc/pub.chive.preprint.submission/xyz)',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'Record CID for version tracking',
    },
    author_did: {
      type: 'text',
      notNull: true,
      comment: 'Author DID',
    },
    title: {
      type: 'text',
      notNull: true,
      comment: 'Preprint title',
    },
    abstract: {
      type: 'text',
      notNull: true,
      comment: 'Preprint abstract',
    },
    pdf_blob_cid: {
      type: 'text',
      notNull: true,
      comment: 'BlobRef CID (NOT blob data)',
    },
    pdf_blob_mime_type: {
      type: 'text',
      notNull: true,
      comment: 'Blob MIME type',
    },
    pdf_blob_size: {
      type: 'bigint',
      notNull: true,
      comment: 'Blob size in bytes',
    },
    keywords: {
      type: 'text[]',
      default: '{}',
      comment: 'User-provided keywords',
    },
    version: {
      type: 'integer',
      default: 1,
      comment: 'Version number',
    },
    previous_version_uri: {
      type: 'text',
      comment: 'AT URI of previous version (if applicable)',
    },
    license: {
      type: 'text',
      notNull: true,
      comment: 'License identifier (e.g., CC-BY-4.0)',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When preprint was created (from record)',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When preprint was last updated (from record)',
    },
    // PDS source tracking (CRITICAL for ATProto compliance)
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of PDS where this record lives',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When Chive indexed this record',
    },
    last_synced_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'Last successful sync with PDS',
    },
  });

  // Foreign key for version history
  pgm.addConstraint('preprints_index', 'fk_previous_version', {
    foreignKeys: {
      columns: 'previous_version_uri',
      references: 'preprints_index(uri)',
      onDelete: 'SET NULL',
    },
  });

  // Indexes for performance
  pgm.createIndex('preprints_index', 'author_did');
  pgm.createIndex('preprints_index', 'created_at');
  pgm.createIndex('preprints_index', 'pds_url');
  pgm.createIndex('preprints_index', 'keywords', { method: 'gin' });

  // Authors index (profile data)
  pgm.createTable('authors_index', {
    did: {
      type: 'text',
      primaryKey: true,
      comment: 'Author DID',
    },
    handle: {
      type: 'text',
      comment: 'AT Protocol handle',
    },
    display_name: {
      type: 'text',
      comment: 'Display name',
    },
    bio: {
      type: 'text',
      comment: 'Biography',
    },
    avatar_blob_cid: {
      type: 'text',
      comment: 'BlobRef CID for avatar (NOT blob data)',
    },
    orcid: {
      type: 'text',
      comment: 'ORCID identifier',
    },
    affiliations: {
      type: 'text[]',
      default: '{}',
      comment: 'Institutional affiliations',
    },
    field_ids: {
      type: 'text[]',
      default: '{}',
      comment: 'Knowledge graph field IDs',
    },
    // PDS source tracking
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of PDS',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When indexed',
    },
    last_synced_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'Last sync',
    },
  });

  pgm.createIndex('authors_index', 'handle');
  pgm.createIndex('authors_index', 'orcid');

  // Reviews index
  pgm.createTable('reviews_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT URI',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'Record CID',
    },
    preprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'FK to preprints_index(uri)',
    },
    reviewer_did: {
      type: 'text',
      notNull: true,
      comment: 'Reviewer DID',
    },
    content: {
      type: 'text',
      notNull: true,
      comment: 'Review content',
    },
    line_number: {
      type: 'integer',
      comment: 'Line number for inline comments',
    },
    parent_review_uri: {
      type: 'text',
      comment: 'Parent review URI for threaded comments',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When created',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When updated',
    },
    // PDS source tracking
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of PDS',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When indexed',
    },
    last_synced_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'Last sync',
    },
  });

  pgm.addConstraint('reviews_index', 'fk_preprint', {
    foreignKeys: {
      columns: 'preprint_uri',
      references: 'preprints_index(uri)',
      onDelete: 'CASCADE',
    },
  });

  pgm.addConstraint('reviews_index', 'fk_parent_review', {
    foreignKeys: {
      columns: 'parent_review_uri',
      references: 'reviews_index(uri)',
      onDelete: 'CASCADE',
    },
  });

  pgm.createIndex('reviews_index', 'preprint_uri');
  pgm.createIndex('reviews_index', 'reviewer_did');
  pgm.createIndex('reviews_index', 'created_at');

  // Endorsements index
  pgm.createTable('endorsements_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT URI',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'Record CID',
    },
    preprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'FK to preprints_index(uri)',
    },
    endorser_did: {
      type: 'text',
      notNull: true,
      comment: 'Endorser DID',
    },
    endorsement_type: {
      type: 'text',
      notNull: true,
      check: "endorsement_type IN ('methods', 'results', 'overall')",
      comment: 'Type of endorsement',
    },
    comment: {
      type: 'text',
      comment: 'Optional comment',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When created',
    },
    // PDS source tracking
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of PDS',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When indexed',
    },
    last_synced_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'Last sync',
    },
  });

  pgm.addConstraint('endorsements_index', 'fk_endorsed_preprint', {
    foreignKeys: {
      columns: 'preprint_uri',
      references: 'preprints_index(uri)',
      onDelete: 'CASCADE',
    },
  });

  pgm.createIndex('endorsements_index', 'preprint_uri');
  pgm.createIndex('endorsements_index', 'endorser_did');

  // User tags index (TaxoFolk)
  pgm.createTable('user_tags_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT URI',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'Record CID',
    },
    preprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'FK to preprints_index(uri)',
    },
    tagger_did: {
      type: 'text',
      notNull: true,
      comment: 'User who applied tag',
    },
    tag: {
      type: 'text',
      notNull: true,
      comment: 'Tag text',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When created',
    },
    // PDS source tracking
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of PDS',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When indexed',
    },
    last_synced_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'Last sync',
    },
  });

  pgm.addConstraint('user_tags_index', 'fk_tagged_preprint', {
    foreignKeys: {
      columns: 'preprint_uri',
      references: 'preprints_index(uri)',
      onDelete: 'CASCADE',
    },
  });

  pgm.createIndex('user_tags_index', 'preprint_uri');
  pgm.createIndex('user_tags_index', 'tag');

  // Firehose cursor persistence
  pgm.createTable('firehose_cursor', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    service_name: {
      type: 'text',
      notNull: true,
      unique: true,
      comment: 'Service name (e.g., "main" for primary consumer)',
    },
    cursor_seq: {
      type: 'bigint',
      notNull: true,
      comment: 'Current cursor sequence number',
    },
    last_updated: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'Last cursor update time',
    },
  });

  // Dead letter queue for failed events
  pgm.createTable('firehose_dlq', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    event_data: {
      type: 'jsonb',
      notNull: true,
      comment: 'Failed event JSON',
    },
    error_message: {
      type: 'text',
      notNull: true,
      comment: 'Error description',
    },
    retry_count: {
      type: 'integer',
      default: 0,
      comment: 'Number of retry attempts',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When event failed',
    },
    last_retry_at: {
      type: 'timestamptz',
      comment: 'Last retry attempt time',
    },
  });

  pgm.createIndex('firehose_dlq', ['retry_count', 'created_at']);

  // PDS staleness tracking
  pgm.createTable('pds_sync_status', {
    pds_url: {
      type: 'text',
      primaryKey: true,
      comment: 'PDS URL',
    },
    last_synced: {
      type: 'timestamptz',
      notNull: true,
      comment: 'Last successful sync',
    },
    last_error: {
      type: 'text',
      comment: 'Last error message (if any)',
    },
    error_count: {
      type: 'integer',
      default: 0,
      comment: 'Consecutive error count',
    },
    is_healthy: {
      type: 'boolean',
      default: true,
      comment: 'Whether PDS is healthy',
    },
  });
}

/**
 * Rollback migration: drop all tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('pds_sync_status', { ifExists: true });
  pgm.dropTable('firehose_dlq', { ifExists: true });
  pgm.dropTable('firehose_cursor', { ifExists: true });
  pgm.dropTable('user_tags_index', { ifExists: true, cascade: true });
  pgm.dropTable('endorsements_index', { ifExists: true, cascade: true });
  pgm.dropTable('reviews_index', { ifExists: true, cascade: true });
  pgm.dropTable('authors_index', { ifExists: true, cascade: true });
  pgm.dropTable('preprints_index', { ifExists: true, cascade: true });
}
