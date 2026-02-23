/**
 * Migration to create extracted_citations and user_related_works_index tables.
 *
 * @remarks
 * Creates storage for:
 * - Auto-extracted citations from external sources (Semantic Scholar, Crossref, GROBID)
 * - User-curated citations from the ATProto firehose
 * - User-curated related work links between eprints
 *
 * Both tables support ATProto compliance:
 * - User records are indexed from the firehose (read-only)
 * - Auto-extracted data is rebuildable from external sources
 * - PDS source tracking for staleness detection
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create citations and related works tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // ==========================================================================
  // extracted_citations: auto-extracted and user-provided citations
  // ==========================================================================
  pgm.createTable('extracted_citations', {
    id: {
      type: 'bigserial',
      primaryKey: true,
      comment: 'Auto-incrementing primary key',
    },
    eprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the citing eprint',
    },
    raw_text: {
      type: 'text',
      comment: 'Raw citation text as extracted from the document',
    },
    title: {
      type: 'text',
      comment: 'Title of the cited work',
    },
    doi: {
      type: 'text',
      comment: 'DOI of the cited work',
    },
    arxiv_id: {
      type: 'text',
      comment: 'arXiv identifier of the cited work',
    },
    authors: {
      type: 'jsonb',
      comment: 'Author names as JSON array of strings',
    },
    year: {
      type: 'integer',
      comment: 'Publication year of the cited work',
    },
    venue: {
      type: 'text',
      comment: 'Publication venue or journal name',
    },
    volume: {
      type: 'text',
      comment: 'Volume number',
    },
    pages: {
      type: 'text',
      comment: 'Page range (e.g., "123-456")',
    },
    source: {
      type: 'text',
      notNull: true,
      default: "'auto'",
      comment:
        "Source of the citation: 'auto' (extracted), 'user-provided', 'semantic-scholar', 'crossref', 'grobid'",
    },
    confidence: {
      type: 'real',
      notNull: true,
      default: 0.0,
      comment: 'Confidence score for auto-extracted citations (0-1)',
    },
    chive_match_uri: {
      type: 'text',
      comment: 'AT-URI of the matched Chive eprint (if the cited work exists in Chive)',
    },
    match_confidence: {
      type: 'real',
      comment: 'Confidence of the Chive match (0-1)',
    },
    match_method: {
      type: 'text',
      comment: "How the Chive match was found ('doi' or 'title')",
    },
    is_influential: {
      type: 'boolean',
      default: false,
      comment: 'Whether this is an influential citation (from Semantic Scholar)',
    },
    citation_type: {
      type: 'text',
      comment: 'Semantic citation type (cites, extends, refutes, reviews, uses-data, uses-method)',
    },
    context: {
      type: 'text',
      comment: 'Contextual note about the citation',
    },
    user_record_uri: {
      type: 'text',
      comment: 'AT-URI of the user-provided citation record (from firehose)',
    },
    curator_did: {
      type: 'text',
      comment: 'DID of the user who curated this citation (for user-provided)',
    },
    extracted_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this citation was first extracted or indexed',
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this citation was last updated',
    },
  });

  // Index on eprint_uri for listing citations by eprint
  pgm.createIndex('extracted_citations', 'eprint_uri', {
    name: 'idx_extracted_citations_eprint',
  });

  // Partial index on doi for deduplication lookups
  pgm.createIndex('extracted_citations', 'doi', {
    name: 'idx_extracted_citations_doi',
    where: 'doi IS NOT NULL',
  });

  // Partial index on chive_match_uri for reverse lookups
  pgm.createIndex('extracted_citations', 'chive_match_uri', {
    name: 'idx_extracted_citations_chive',
    where: 'chive_match_uri IS NOT NULL',
  });

  // Unique partial index on user_record_uri for firehose upserts
  pgm.createIndex('extracted_citations', 'user_record_uri', {
    name: 'idx_extracted_citations_user_record',
    unique: true,
    where: 'user_record_uri IS NOT NULL',
  });

  pgm.sql(`
    COMMENT ON TABLE extracted_citations IS
      'Auto-extracted and user-provided citations for eprints. '
      'Auto-extracted citations come from Semantic Scholar, Crossref, and GROBID. '
      'User-provided citations are indexed from the ATProto firehose.';
  `);

  // ==========================================================================
  // user_related_works_index: user-curated related work links
  // ==========================================================================
  pgm.createTable('user_related_works_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      notNull: true,
      comment: 'AT-URI of the related work record',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'CID of the indexed record version',
    },
    source_eprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the source eprint',
    },
    target_eprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the related eprint',
    },
    relationship_type: {
      type: 'text',
      notNull: true,
      comment:
        'Type of relationship (related, extends, replicates, contradicts, reviews, is-supplement-to)',
    },
    description: {
      type: 'text',
      comment: 'Description of how the eprints are related',
    },
    curator_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of the user who created this link',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      comment: 'When this related work link was created (from record)',
    },
    pds_url: {
      type: 'text',
      comment: 'URL of the PDS where this record lives',
    },
    indexed_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was first indexed',
    },
    last_synced_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was last synced from PDS',
    },
  });

  // Index on source_eprint_uri for listing related works by eprint
  pgm.createIndex('user_related_works_index', 'source_eprint_uri', {
    name: 'idx_user_related_works_source',
  });

  // Index on target_eprint_uri for reverse lookups
  pgm.createIndex('user_related_works_index', 'target_eprint_uri', {
    name: 'idx_user_related_works_target',
  });

  pgm.sql(`
    COMMENT ON TABLE user_related_works_index IS
      'Index of user-curated related work links between eprints from ATProto firehose. '
      'Each record links two eprints with a typed relationship.';
  `);
}

/**
 * Rollback migration: drop citations and related works tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Drop user_related_works_index indexes and table
  pgm.dropIndex('user_related_works_index', 'target_eprint_uri', {
    name: 'idx_user_related_works_target',
  });
  pgm.dropIndex('user_related_works_index', 'source_eprint_uri', {
    name: 'idx_user_related_works_source',
  });
  pgm.dropTable('user_related_works_index');

  // Drop extracted_citations indexes and table
  pgm.dropIndex('extracted_citations', 'user_record_uri', {
    name: 'idx_extracted_citations_user_record',
  });
  pgm.dropIndex('extracted_citations', 'chive_match_uri', {
    name: 'idx_extracted_citations_chive',
  });
  pgm.dropIndex('extracted_citations', 'doi', {
    name: 'idx_extracted_citations_doi',
  });
  pgm.dropIndex('extracted_citations', 'eprint_uri', {
    name: 'idx_extracted_citations_eprint',
  });
  pgm.dropTable('extracted_citations');
}
