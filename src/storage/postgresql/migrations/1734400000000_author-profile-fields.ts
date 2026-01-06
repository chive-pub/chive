/**
 * Author profile fields migration.
 *
 * @remarks
 * Adds new fields to authors_index table for improved paper matching
 * and author identification. These fields support:
 * - Name variants for fuzzy matching (maiden names, transliterations, initials)
 * - Previous affiliations for historical paper matching
 * - Research keywords for content-based suggestions
 * - External authority IDs (Semantic Scholar, OpenAlex, arXiv, etc.)
 *
 * ATProto Compliance Notes:
 * - All data is AppView-specific (ephemeral, rebuildable)
 * - Fields sourced from user PDSes via pub.chive.actor.profile records
 * - Can be rebuilt from firehose by re-indexing profiles
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add author profile fields.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =============================================================
  // ADD NEW COLUMNS TO AUTHORS_INDEX
  // =============================================================

  // Name variants for fuzzy matching
  pgm.addColumn('authors_index', {
    name_variants: {
      type: 'text[]',
      comment: 'Alternative name forms (maiden names, transliterations, initials)',
    },
  });

  // Previous affiliations for historical matching
  pgm.addColumn('authors_index', {
    previous_affiliations: {
      type: 'text[]',
      comment: 'Past institutional affiliations from older papers',
    },
  });

  // Research keywords for content matching
  pgm.addColumn('authors_index', {
    research_keywords: {
      type: 'text[]',
      comment: 'Research topics and keywords for content-based suggestions',
    },
  });

  // External authority IDs
  pgm.addColumn('authors_index', {
    semantic_scholar_id: {
      type: 'text',
      comment: 'Semantic Scholar author ID',
    },
  });

  pgm.addColumn('authors_index', {
    openalex_id: {
      type: 'text',
      comment: 'OpenAlex author ID (e.g., A5023888391)',
    },
  });

  pgm.addColumn('authors_index', {
    google_scholar_id: {
      type: 'text',
      comment: 'Google Scholar profile ID',
    },
  });

  pgm.addColumn('authors_index', {
    arxiv_author_id: {
      type: 'text',
      comment: 'arXiv author identifier',
    },
  });

  pgm.addColumn('authors_index', {
    openreview_id: {
      type: 'text',
      comment: 'OpenReview profile ID',
    },
  });

  pgm.addColumn('authors_index', {
    dblp_id: {
      type: 'text',
      comment: 'DBLP author identifier',
    },
  });

  pgm.addColumn('authors_index', {
    scopus_author_id: {
      type: 'text',
      comment: 'Scopus author ID',
    },
  });

  // =============================================================
  // INDEXES FOR EFFICIENT LOOKUPS
  // =============================================================

  // GIN index for name variants array search
  pgm.createIndex('authors_index', 'name_variants', {
    name: 'idx_authors_name_variants',
    method: 'gin',
  });

  // GIN index for research keywords array search
  pgm.createIndex('authors_index', 'research_keywords', {
    name: 'idx_authors_research_keywords',
    method: 'gin',
  });

  // B-tree indexes for external ID lookups
  pgm.createIndex('authors_index', 'semantic_scholar_id', {
    name: 'idx_authors_semantic_scholar_id',
    where: 'semantic_scholar_id IS NOT NULL',
  });

  pgm.createIndex('authors_index', 'openalex_id', {
    name: 'idx_authors_openalex_id',
    where: 'openalex_id IS NOT NULL',
  });

  pgm.createIndex('authors_index', 'arxiv_author_id', {
    name: 'idx_authors_arxiv_author_id',
    where: 'arxiv_author_id IS NOT NULL',
  });

  pgm.createIndex('authors_index', 'openreview_id', {
    name: 'idx_authors_openreview_id',
    where: 'openreview_id IS NOT NULL',
  });

  pgm.createIndex('authors_index', 'dblp_id', {
    name: 'idx_authors_dblp_id',
    where: 'dblp_id IS NOT NULL',
  });

  // =============================================================
  // FULL-TEXT SEARCH ON NAME VARIANTS
  // =============================================================
  // Create a generated column for full-text search across all name forms

  // Create an IMMUTABLE function for tsvector generation
  // PostgreSQL requires generated column expressions to be fully immutable,
  // and to_tsvector is only STABLE by default
  pgm.sql(`
    CREATE OR REPLACE FUNCTION author_name_to_tsvector(
      display_name text,
      name_variants text[]
    )
    RETURNS tsvector AS $$
    BEGIN
      RETURN
        setweight(to_tsvector('simple'::regconfig, COALESCE(display_name, '')), 'A') ||
        setweight(to_tsvector('simple'::regconfig, COALESCE(array_to_string(name_variants, ' '), '')), 'B');
    END;
    $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
  `);

  pgm.sql(`
    ALTER TABLE authors_index
    ADD COLUMN name_search_vector tsvector
    GENERATED ALWAYS AS (
      author_name_to_tsvector(display_name, name_variants)
    ) STORED;
  `);

  pgm.createIndex('authors_index', 'name_search_vector', {
    name: 'idx_authors_name_search',
    method: 'gin',
  });
}

/**
 * Rollback migration: remove author profile fields.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Drop indexes first
  pgm.dropIndex('authors_index', 'name_search_vector', {
    name: 'idx_authors_name_search',
  });
  pgm.dropIndex('authors_index', 'dblp_id', { name: 'idx_authors_dblp_id' });
  pgm.dropIndex('authors_index', 'openreview_id', { name: 'idx_authors_openreview_id' });
  pgm.dropIndex('authors_index', 'arxiv_author_id', { name: 'idx_authors_arxiv_author_id' });
  pgm.dropIndex('authors_index', 'openalex_id', { name: 'idx_authors_openalex_id' });
  pgm.dropIndex('authors_index', 'semantic_scholar_id', {
    name: 'idx_authors_semantic_scholar_id',
  });
  pgm.dropIndex('authors_index', 'research_keywords', { name: 'idx_authors_research_keywords' });
  pgm.dropIndex('authors_index', 'name_variants', { name: 'idx_authors_name_variants' });

  // Drop generated column
  pgm.dropColumn('authors_index', 'name_search_vector');

  // Drop helper function
  pgm.sql('DROP FUNCTION IF EXISTS author_name_to_tsvector(text, text[])');

  // Drop columns
  pgm.dropColumn('authors_index', 'scopus_author_id');
  pgm.dropColumn('authors_index', 'dblp_id');
  pgm.dropColumn('authors_index', 'openreview_id');
  pgm.dropColumn('authors_index', 'arxiv_author_id');
  pgm.dropColumn('authors_index', 'google_scholar_id');
  pgm.dropColumn('authors_index', 'openalex_id');
  pgm.dropColumn('authors_index', 'semantic_scholar_id');
  pgm.dropColumn('authors_index', 'research_keywords');
  pgm.dropColumn('authors_index', 'previous_affiliations');
  pgm.dropColumn('authors_index', 'name_variants');
}
