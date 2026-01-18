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
 * - `eprints_index` - Eprint metadata
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
  // Eprints index table
  pgm.createTable('eprints_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT URI (e.g., at://did:plc:abc/pub.chive.eprint.submission/xyz)',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'Record CID for version tracking',
    },
    submitted_by: {
      type: 'text',
      notNull: true,
      comment: 'DID of the human who submitted this eprint',
    },
    authors: {
      type: 'jsonb',
      notNull: true,
      comment: 'Array of author objects with affiliations, contributions, and metadata',
    },
    paper_did: {
      type: 'text',
      comment: 'DID of the paper own account (if paper has its own PDS)',
    },
    title: {
      type: 'text',
      notNull: true,
      comment: 'Eprint title',
    },
    abstract: {
      type: 'text',
      notNull: true,
      comment: 'Eprint abstract',
    },
    document_blob_cid: {
      type: 'text',
      notNull: true,
      comment: 'BlobRef CID (NOT blob data)',
    },
    document_blob_mime_type: {
      type: 'text',
      notNull: true,
      comment: 'Blob MIME type',
    },
    document_blob_size: {
      type: 'bigint',
      notNull: true,
      comment: 'Blob size in bytes',
    },
    document_format: {
      type: 'text',
      notNull: true,
      default: 'pdf',
      comment: 'Detected or user-specified document format',
    },
    publication_status: {
      type: 'text',
      notNull: true,
      default: 'eprint',
      comment: 'Publication lifecycle status',
    },
    published_version: {
      type: 'jsonb',
      comment: 'Published version metadata (doi, url, journal, publisher, etc.)',
    },
    external_ids: {
      type: 'jsonb',
      comment: 'External persistent identifiers',
    },
    related_works: {
      type: 'jsonb',
      comment: 'Related eprints, datasets, and software',
    },
    repositories: {
      type: 'jsonb',
      comment: 'Linked code, data, protocols, and materials repositories',
    },
    funding: {
      type: 'jsonb',
      comment: 'Funding sources with funder DOI/ROR and grant information',
    },
    conference_presentation: {
      type: 'jsonb',
      comment: 'Conference presentation information',
    },
    supplementary_materials: {
      type: 'jsonb',
      comment: 'Supplementary materials metadata',
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
      comment: 'When eprint was created (from record)',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When eprint was last updated (from record)',
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
  pgm.addConstraint('eprints_index', 'fk_previous_version', {
    foreignKeys: {
      columns: 'previous_version_uri',
      references: 'eprints_index(uri)',
      onDelete: 'SET NULL',
    },
  });

  // Indexes for performance
  pgm.createIndex('eprints_index', 'submitted_by');
  pgm.createIndex('eprints_index', 'paper_did');
  pgm.createIndex('eprints_index', 'created_at');
  pgm.createIndex('eprints_index', 'pds_url');
  pgm.createIndex('eprints_index', 'keywords', { method: 'gin' });
  pgm.createIndex('eprints_index', 'authors', {
    method: 'gin',
    name: 'idx_eprints_authors_gin',
  });
  pgm.createIndex('eprints_index', 'document_format');
  pgm.createIndex('eprints_index', 'publication_status');
  pgm.createIndex('eprints_index', "(published_version->>'doi')", {
    name: 'idx_eprints_published_doi',
    method: 'btree',
  });
  pgm.createIndex('eprints_index', 'external_ids', {
    name: 'idx_eprints_external_ids_gin',
    method: 'gin',
  });
  pgm.createIndex('eprints_index', 'related_works', {
    name: 'idx_eprints_related_works_gin',
    method: 'gin',
  });
  pgm.createIndex('eprints_index', 'supplementary_materials', {
    name: 'idx_eprints_supplementary_gin',
    method: 'gin',
  });

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
    eprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'FK to eprints_index(uri)',
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

  pgm.addConstraint('reviews_index', 'fk_eprint', {
    foreignKeys: {
      columns: 'eprint_uri',
      references: 'eprints_index(uri)',
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

  pgm.createIndex('reviews_index', 'eprint_uri');
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
    eprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'FK to eprints_index(uri)',
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

  pgm.addConstraint('endorsements_index', 'fk_endorsed_eprint', {
    foreignKeys: {
      columns: 'eprint_uri',
      references: 'eprints_index(uri)',
      onDelete: 'CASCADE',
    },
  });

  pgm.createIndex('endorsements_index', 'eprint_uri');
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
    eprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'FK to eprints_index(uri)',
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

  pgm.addConstraint('user_tags_index', 'fk_tagged_eprint', {
    foreignKeys: {
      columns: 'eprint_uri',
      references: 'eprints_index(uri)',
      onDelete: 'CASCADE',
    },
  });

  pgm.createIndex('user_tags_index', 'eprint_uri');
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

  // Contribution types table for knowledge graph governance
  pgm.createTable('contribution_types_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT URI (e.g., at://did:plc:governance/pub.chive.graph.concept/conceptualization)',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'Record CID',
    },
    type_id: {
      type: 'text',
      notNull: true,
      unique: true,
      comment: 'Type identifier (e.g., "conceptualization")',
    },
    label: {
      type: 'text',
      notNull: true,
      comment: 'Human-readable label',
    },
    description: {
      type: 'text',
      comment: 'Detailed description',
    },
    external_mappings: {
      type: 'jsonb',
      default: '[]',
      comment: 'External ontology mappings (CRediT, CRO, etc.)',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'established',
      check: "status IN ('established', 'proposed', 'deprecated')",
      comment: 'Type status',
    },
    proposal_uri: {
      type: 'text',
      comment: 'AT URI of the proposal that created this type (null for seeded types)',
    },
    // PDS source tracking
    pds_url: {
      type: 'text',
      notNull: true,
      default: 'https://governance.chive.pub',
      comment: 'URL of PDS (governance PDS)',
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
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When type was created',
    },
  });

  pgm.createIndex('contribution_types_index', 'type_id');
  pgm.createIndex('contribution_types_index', 'status');

  // Contribution type proposals table
  pgm.createTable('contribution_type_proposals', {
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
    proposer_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of proposer',
    },
    proposal_type: {
      type: 'text',
      notNull: true,
      check: "proposal_type IN ('create', 'update', 'deprecate')",
      comment: 'Type of proposal',
    },
    existing_type_id: {
      type: 'text',
      comment: 'Existing type ID (for update/deprecate proposals)',
    },
    proposed_id: {
      type: 'text',
      notNull: true,
      comment: 'Proposed type identifier',
    },
    proposed_label: {
      type: 'text',
      notNull: true,
      comment: 'Proposed human-readable label',
    },
    proposed_description: {
      type: 'text',
      comment: 'Proposed description',
    },
    external_mappings: {
      type: 'jsonb',
      default: '[]',
      comment: 'Proposed external ontology mappings',
    },
    rationale: {
      type: 'text',
      notNull: true,
      comment: 'Justification for proposal',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'approved', 'rejected')",
      comment: 'Proposal status',
    },
    vote_count_approve: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Number of approval votes',
    },
    vote_count_reject: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Number of rejection votes',
    },
    resolved_at: {
      type: 'timestamptz',
      comment: 'When proposal was resolved',
    },
    result_uri: {
      type: 'text',
      comment: 'AT URI of resulting contribution type (if approved)',
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
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When proposal was created',
    },
  });

  pgm.createIndex('contribution_type_proposals', 'proposer_did');
  pgm.createIndex('contribution_type_proposals', 'status');
  pgm.createIndex('contribution_type_proposals', 'proposed_id');
  pgm.createIndex('contribution_type_proposals', 'created_at');
}

/**
 * Rollback migration: drop all tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('contribution_type_proposals', { ifExists: true });
  pgm.dropTable('contribution_types_index', { ifExists: true });
  pgm.dropTable('pds_sync_status', { ifExists: true });
  pgm.dropTable('firehose_dlq', { ifExists: true });
  pgm.dropTable('firehose_cursor', { ifExists: true });
  pgm.dropTable('user_tags_index', { ifExists: true, cascade: true });
  pgm.dropTable('endorsements_index', { ifExists: true, cascade: true });
  pgm.dropTable('reviews_index', { ifExists: true, cascade: true });
  pgm.dropTable('authors_index', { ifExists: true, cascade: true });
  pgm.dropTable('eprints_index', { ifExists: true, cascade: true });
}
