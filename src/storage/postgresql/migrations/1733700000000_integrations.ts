/**
 * Integrations system tables migration.
 *
 * @remarks
 * Creates tables for the eprint importing, claiming, backlinks, and
 * reconciliation systems.
 *
 * Tables created:
 * - `imported_eprints` - External eprint cache (arXiv, LingBuzz, etc.)
 * - `claim_requests` - Pending claim requests with evidence
 * - `backlinks` - Cross-app references from ATProto ecosystem
 * - `backlink_counts` - Aggregated counts cache
 * - `reconciliations` - Import → canonical record mappings
 *
 * ATProto Compliance Notes:
 * - All data is AppView-specific (ephemeral, rebuildable)
 * - imported_eprints can be rebuilt from external sources
 * - backlinks can be rebuilt from firehose replay
 * - reconciliations are also published to Governance PDS for portability
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Valid import sources.
 *
 * @remarks
 * Includes linguistics archives (LingBuzz, Semantics Archive) and
 * general academic sources (arXiv, bioRxiv, OpenReview, etc.)
 */
const IMPORT_SOURCES = [
  'arxiv',
  'biorxiv',
  'medrxiv',
  'psyarxiv',
  'lingbuzz',
  'semanticsarchive',
  'openreview',
  'ssrn',
  'osf',
  'zenodo',
  'philpapers',
  'other',
] as const;

/**
 * Valid backlink source types.
 */
const BACKLINK_SOURCE_TYPES = [
  'semble.collection',
  'leaflet.list',
  'whitewind.post',
  'bluesky.post',
  'bluesky.embed',
  'chive.comment',
  'chive.endorsement',
  'external',
] as const;

/**
 * Apply migration: create integrations tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =============================================================
  // IMPORTED EPRINTS TABLE
  // =============================================================
  // Caches eprints from external sources (arXiv, LingBuzz, etc.)
  // This is AppView-specific and can be rebuilt from external sources.
  // =============================================================

  pgm.createTable('imported_eprints', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    source: {
      type: 'text',
      notNull: true,
      check: `source IN (${IMPORT_SOURCES.map((s) => `'${s}'`).join(', ')})`,
      comment: 'External source identifier',
    },
    external_id: {
      type: 'text',
      notNull: true,
      comment: 'Source-specific identifier (e.g., arXiv ID, LingBuzz number)',
    },
    external_url: {
      type: 'text',
      notNull: true,
      comment: 'URL to the eprint on the external source',
    },
    title: {
      type: 'text',
      notNull: true,
      comment: 'Eprint title',
    },
    abstract: {
      type: 'text',
      comment: 'Eprint abstract',
    },
    authors: {
      type: 'jsonb',
      notNull: true,
      comment: 'Author list as JSON array [{name, orcid?, affiliation?, email?}]',
    },
    publication_date: {
      type: 'date',
      comment: 'Publication/submission date',
    },
    original_categories: {
      type: 'text[]',
      comment: 'Original categories/subjects from source',
    },
    doi: {
      type: 'text',
      comment: 'DOI if available',
    },
    pdf_url: {
      type: 'text',
      comment: 'PDF URL (not stored, just referenced)',
    },
    imported_by_plugin: {
      type: 'text',
      notNull: true,
      comment: 'Plugin ID that imported this eprint',
    },
    imported_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When eprint was imported',
    },
    last_synced_at: {
      type: 'timestamptz',
      comment: 'Last sync with external source',
    },
    sync_status: {
      type: 'text',
      notNull: true,
      default: 'active',
      check: "sync_status IN ('active', 'stale', 'unavailable')",
      comment: 'Sync status with external source',
    },
    claim_status: {
      type: 'text',
      notNull: true,
      default: 'unclaimed',
      check: "claim_status IN ('unclaimed', 'pending', 'claimed')",
      comment: 'Claim status',
    },
    canonical_uri: {
      type: 'text',
      comment: 'AT-URI of canonical record after claiming',
    },
    claimed_by_did: {
      type: 'text',
      comment: 'DID of user who claimed this eprint',
    },
    claimed_at: {
      type: 'timestamptz',
      comment: 'When eprint was claimed',
    },
    metadata: {
      type: 'jsonb',
      comment: 'Additional source-specific metadata',
    },
  });

  // Unique constraint on source + external_id
  pgm.addConstraint('imported_eprints', 'uq_imported_eprints_source_external_id', {
    unique: ['source', 'external_id'],
  });

  // Indexes for common queries
  pgm.createIndex('imported_eprints', 'source');
  pgm.createIndex('imported_eprints', 'external_id');
  pgm.createIndex('imported_eprints', 'claim_status');
  pgm.createIndex('imported_eprints', 'canonical_uri', {
    where: 'canonical_uri IS NOT NULL',
  });
  pgm.createIndex('imported_eprints', 'claimed_by_did', {
    where: 'claimed_by_did IS NOT NULL',
  });
  pgm.createIndex('imported_eprints', 'doi', {
    where: 'doi IS NOT NULL',
  });
  pgm.createIndex('imported_eprints', 'authors', { method: 'gin' });
  pgm.createIndex('imported_eprints', 'imported_at');

  // Full-text search index
  pgm.sql(`
    ALTER TABLE imported_eprints
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(abstract, '')), 'B')
    ) STORED
  `);
  pgm.createIndex('imported_eprints', 'search_vector', { method: 'gin' });

  // =============================================================
  // CLAIM REQUESTS TABLE
  // =============================================================
  // Tracks claim requests with multi-authority evidence.
  // =============================================================

  pgm.createTable('claim_requests', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    import_id: {
      type: 'bigint',
      notNull: true,
      references: 'imported_eprints(id)',
      onDelete: 'CASCADE',
      comment: 'Reference to imported eprint',
    },
    claimant_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of user making the claim',
    },
    evidence: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
      comment: 'Collected evidence as JSON array [{type, source, confidence, data, verifiedAt}]',
    },
    verification_score: {
      type: 'decimal(4,3)',
      comment: 'Computed confidence score (0.000-1.000)',
    },
    decision: {
      type: 'text',
      check: "decision IN ('auto-approve', 'expedited', 'manual', 'insufficient')",
      comment: 'Automated decision based on score',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'approved', 'rejected', 'completed', 'expired')",
      comment: 'Claim status',
    },
    canonical_uri: {
      type: 'text',
      comment: 'AT-URI of canonical record (set after user creates it)',
    },
    rejection_reason: {
      type: 'text',
      comment: 'Reason for rejection (if rejected)',
    },
    reviewed_by_did: {
      type: 'text',
      comment: 'DID of reviewer (for manual review)',
    },
    reviewed_at: {
      type: 'timestamptz',
      comment: 'When claim was reviewed',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When claim was created',
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When claim was last updated',
    },
  });

  // Indexes
  pgm.createIndex('claim_requests', 'import_id');
  pgm.createIndex('claim_requests', 'claimant_did');
  pgm.createIndex('claim_requests', 'status');
  pgm.createIndex('claim_requests', 'decision');
  pgm.createIndex('claim_requests', 'created_at');

  // Partial index for pending claims needing review
  pgm.createIndex('claim_requests', ['decision', 'created_at'], {
    where: "status = 'pending' AND decision IN ('expedited', 'manual')",
    name: 'idx_claim_requests_pending_review',
  });

  // =============================================================
  // BACKLINKS TABLE
  // =============================================================
  // Tracks references to Chive eprints from ATProto ecosystem.
  // Rebuildable from firehose replay.
  // =============================================================

  pgm.createTable('backlinks', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    source_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the source record',
    },
    source_type: {
      type: 'text',
      notNull: true,
      check: `source_type IN (${BACKLINK_SOURCE_TYPES.map((s) => `'${s}'`).join(', ')})`,
      comment: 'Type of backlink source',
    },
    source_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of the source record owner',
    },
    target_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the target eprint',
    },
    context: {
      type: 'text',
      comment: 'Optional context (title, snippet)',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When backlink was indexed',
    },
    is_deleted: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether source record was deleted',
    },
    deleted_at: {
      type: 'timestamptz',
      comment: 'When deletion was detected',
    },
  });

  // Unique constraint on source_uri (one backlink per source record)
  pgm.addConstraint('backlinks', 'uq_backlinks_source_uri', {
    unique: ['source_uri'],
  });

  // Indexes
  pgm.createIndex('backlinks', 'source_type');
  pgm.createIndex('backlinks', 'source_did');
  pgm.createIndex('backlinks', 'target_uri');
  pgm.createIndex('backlinks', 'indexed_at');

  // Partial index for active backlinks
  pgm.createIndex('backlinks', 'target_uri', {
    where: 'is_deleted = false',
    name: 'idx_backlinks_active_target',
  });

  // =============================================================
  // BACKLINK COUNTS TABLE
  // =============================================================
  // Aggregated counts for efficient display.
  // Periodically refreshed from backlinks table.
  // =============================================================

  pgm.createTable('backlink_counts', {
    target_uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT-URI of the target eprint',
    },
    semble_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of Semble collection references',
    },
    leaflet_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of Leaflet reading list references',
    },
    whitewind_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of WhiteWind blog mentions',
    },
    bluesky_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of Bluesky shares/embeds',
    },
    comment_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of Chive comments',
    },
    endorsement_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Count of Chive endorsements',
    },
    total_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Total backlink count',
    },
    last_updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When counts were last updated',
    },
  });

  // =============================================================
  // RECONCILIATIONS TABLE
  // =============================================================
  // Links imported eprints to canonical ATProto records.
  // Also published to Governance PDS for portability.
  // =============================================================

  pgm.createTable('reconciliations', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    import_uri: {
      type: 'text',
      notNull: true,
      unique: true,
      comment: 'Reference to imported eprint (internal or AT-URI)',
    },
    canonical_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of user canonical record in their PDS',
    },
    reconciliation_type: {
      type: 'text',
      notNull: true,
      check: "reconciliation_type IN ('claim', 'merge', 'supersede')",
      comment: 'Type of reconciliation',
    },
    evidence: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
      comment: 'Evidence summary [{type, score}]',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'verified',
      check: "status IN ('verified', 'disputed', 'superseded')",
      comment: 'Reconciliation status',
    },
    verified_by: {
      type: 'text',
      comment: 'DID of verifying authority',
    },
    verified_at: {
      type: 'timestamptz',
      comment: 'When verification occurred',
    },
    notes: {
      type: 'text',
      comment: 'Additional notes or context',
    },
    atproto_uri: {
      type: 'text',
      comment: 'AT-URI in Governance PDS (if published)',
    },
    atproto_cid: {
      type: 'text',
      comment: 'CID of Governance PDS record',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When reconciliation was created',
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When reconciliation was last updated',
    },
  });

  // Indexes
  pgm.createIndex('reconciliations', 'canonical_uri');
  pgm.createIndex('reconciliations', 'status');
  pgm.createIndex('reconciliations', 'atproto_uri', {
    where: 'atproto_uri IS NOT NULL',
  });

  // =============================================================
  // HELPER FUNCTION: Refresh backlink counts
  // =============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_backlink_counts(p_target_uri text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO backlink_counts (
        target_uri,
        semble_count,
        leaflet_count,
        whitewind_count,
        bluesky_count,
        comment_count,
        endorsement_count,
        total_count,
        last_updated_at
      )
      SELECT
        p_target_uri,
        COUNT(*) FILTER (WHERE source_type = 'semble.collection'),
        COUNT(*) FILTER (WHERE source_type = 'leaflet.list'),
        COUNT(*) FILTER (WHERE source_type = 'whitewind.post'),
        COUNT(*) FILTER (WHERE source_type IN ('bluesky.post', 'bluesky.embed')),
        COUNT(*) FILTER (WHERE source_type = 'chive.comment'),
        COUNT(*) FILTER (WHERE source_type = 'chive.endorsement'),
        COUNT(*),
        NOW()
      FROM backlinks
      WHERE target_uri = p_target_uri AND is_deleted = false
      ON CONFLICT (target_uri) DO UPDATE SET
        semble_count = EXCLUDED.semble_count,
        leaflet_count = EXCLUDED.leaflet_count,
        whitewind_count = EXCLUDED.whitewind_count,
        bluesky_count = EXCLUDED.bluesky_count,
        comment_count = EXCLUDED.comment_count,
        endorsement_count = EXCLUDED.endorsement_count,
        total_count = EXCLUDED.total_count,
        last_updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql;
  `);
}

/**
 * Rollback migration: drop integrations tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.sql('DROP FUNCTION IF EXISTS refresh_backlink_counts(text)');
  pgm.dropTable('reconciliations', { ifExists: true });
  pgm.dropTable('backlink_counts', { ifExists: true });
  pgm.dropTable('backlinks', { ifExists: true });
  pgm.dropTable('claim_requests', { ifExists: true, cascade: true });
  pgm.dropTable('imported_eprints', { ifExists: true, cascade: true });
}
