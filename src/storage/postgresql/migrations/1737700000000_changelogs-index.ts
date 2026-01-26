/**
 * Migration to create changelogs_index table for eprint version changelogs.
 *
 * @remarks
 * This migration creates storage for structured changelog entries that describe
 * changes between eprint versions. Each changelog is linked to an eprint and
 * contains categorized sections with individual change items.
 *
 * Changelogs use semantic versioning (MAJOR.MINOR.PATCH) and support:
 * - Summary of changes
 * - Categorized sections (methodology, results, etc.)
 * - Individual change items with types (added, changed, fixed, etc.)
 * - Location references within the document
 * - Reviewer response for peer review revisions
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create changelogs_index table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Create the changelogs_index table
  pgm.createTable('changelogs_index', {
    // Primary key: AT-URI of the changelog record
    uri: {
      type: 'text',
      primaryKey: true,
      notNull: true,
      comment: 'AT-URI of the changelog record',
    },
    // CID for version tracking
    cid: {
      type: 'text',
      notNull: true,
      comment: 'CID of the indexed changelog version',
    },
    // Foreign key to eprints_index
    eprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the eprint this changelog belongs to',
    },
    // Semantic version as JSONB (major, minor, patch, prerelease)
    version: {
      type: 'jsonb',
      notNull: true,
      comment: 'Semantic version this changelog describes (JSONB object)',
    },
    // Previous version for reference
    previous_version: {
      type: 'jsonb',
      comment: 'Previous semantic version (JSONB object)',
    },
    // One-line summary
    summary: {
      type: 'text',
      comment: 'One-line summary of changes (max 500 chars)',
    },
    // Structured sections as JSONB array
    sections: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
      comment: 'Structured changelog sections (JSONB array)',
    },
    // Response to peer review
    reviewer_response: {
      type: 'text',
      comment: 'Response to peer review feedback',
    },
    // Timestamp from the record
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      comment: 'When this changelog was created (from record)',
    },
    // PDS tracking for ATProto compliance
    pds_url: {
      type: 'text',
      comment: 'URL of the PDS where this record lives',
    },
    // Index metadata
    indexed_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this changelog was first indexed',
    },
    last_synced_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this changelog was last synced from PDS',
    },
  });

  // Index on eprint_uri for listing changelogs by eprint
  pgm.createIndex('changelogs_index', 'eprint_uri', {
    name: 'idx_changelogs_eprint_uri',
  });

  // Composite index for efficient eprint + created_at queries (newest first)
  pgm.createIndex('changelogs_index', ['eprint_uri', 'created_at'], {
    name: 'idx_changelogs_eprint_created',
  });

  // GIN index on sections for querying change categories
  pgm.createIndex('changelogs_index', 'sections', {
    method: 'gin',
    name: 'idx_changelogs_sections_gin',
  });

  // GIN index on version for version queries
  pgm.createIndex('changelogs_index', 'version', {
    method: 'gin',
    name: 'idx_changelogs_version_gin',
  });

  // Add table comment
  pgm.sql(`
    COMMENT ON TABLE changelogs_index IS
      'Index of eprint version changelogs from ATProto firehose. Stores structured change documentation.';
  `);
}

/**
 * Rollback migration: drop changelogs_index table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Drop indexes first
  pgm.dropIndex('changelogs_index', 'sections', {
    name: 'idx_changelogs_sections_gin',
  });
  pgm.dropIndex('changelogs_index', 'version', {
    name: 'idx_changelogs_version_gin',
  });
  pgm.dropIndex('changelogs_index', ['eprint_uri', 'created_at'], {
    name: 'idx_changelogs_eprint_created',
  });
  pgm.dropIndex('changelogs_index', 'eprint_uri', {
    name: 'idx_changelogs_eprint_uri',
  });

  // Drop the table
  pgm.dropTable('changelogs_index');
}
