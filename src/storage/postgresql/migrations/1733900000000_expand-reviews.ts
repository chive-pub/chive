/**
 * Expand reviews_index table migration.
 *
 * @remarks
 * Adds new columns to the reviews_index table to support:
 * - CID and rkey for record identification
 * - Threaded discussions (parent_uri, root_uri, reply_depth)
 * - Inline annotations (anchor column with JSON selector)
 * - Content format (plain text vs markdown)
 * - Annotation motivation (W3C Web Annotation)
 * - Reply and endorsement counts
 *
 * ATProto Compliance Notes:
 * - All data is AppView-specific (ephemeral, rebuildable from firehose)
 * - Never stores source of truth - all reviews live in user PDSes
 * - Tracks PDS source for staleness detection
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: expand reviews_index table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =============================================================
  // ADD NEW COLUMNS TO reviews_index
  // =============================================================

  // Record identification (cid already exists in initial schema)
  pgm.addColumn('reviews_index', {
    rkey: {
      type: 'text',
      notNull: false, // Initially nullable for existing rows
      comment: 'Record key from AT URI',
    },
    eprint_cid: {
      type: 'text',
      notNull: false, // Initially nullable for existing rows
      comment: 'CID of the eprint at time of review',
    },
  });

  // Content format and motivation
  pgm.addColumn('reviews_index', {
    content_format: {
      type: 'text',
      notNull: true,
      default: 'plain',
      comment: 'Content format: plain or markdown',
    },
    motivation: {
      type: 'text',
      notNull: true,
      default: 'commenting',
      comment: 'Annotation motivation (W3C Web Annotation vocabulary)',
    },
  });

  // Threading support
  pgm.addColumn('reviews_index', {
    parent_uri: {
      type: 'text',
      comment: 'AT URI of parent review for replies',
    },
    root_uri: {
      type: 'text',
      comment: 'AT URI of root review for thread tracking',
    },
    reply_depth: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Depth in reply tree (0 = top-level)',
    },
  });

  // Inline annotation anchor (JSON column)
  pgm.addColumn('reviews_index', {
    anchor: {
      type: 'jsonb',
      comment: 'JSON anchor for inline annotations (source, selector, page)',
    },
  });

  // Counts for denormalized access
  pgm.addColumn('reviews_index', {
    reply_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Number of replies to this review',
    },
    endorsement_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Number of endorsements for this review',
    },
  });

  // =============================================================
  // CREATE INDEXES FOR NEW COLUMNS
  // =============================================================

  // Thread navigation indexes
  pgm.createIndex('reviews_index', 'parent_uri', {
    name: 'idx_reviews_parent_uri',
    where: 'parent_uri IS NOT NULL',
  });

  pgm.createIndex('reviews_index', 'root_uri', {
    name: 'idx_reviews_root_uri',
    where: 'root_uri IS NOT NULL',
  });

  // Motivation index for filtering by type
  pgm.createIndex('reviews_index', 'motivation', {
    name: 'idx_reviews_motivation',
  });

  // Reply depth for efficient thread queries
  pgm.createIndex('reviews_index', 'reply_depth', {
    name: 'idx_reviews_reply_depth',
  });

  // GIN index for anchor JSON queries
  pgm.createIndex('reviews_index', 'anchor', {
    name: 'idx_reviews_anchor',
    method: 'gin',
    where: 'anchor IS NOT NULL',
  });

  // =============================================================
  // ADD CHECK CONSTRAINTS
  // =============================================================

  pgm.addConstraint('reviews_index', 'chk_content_format', {
    check: "content_format IN ('plain', 'markdown')",
  });

  pgm.addConstraint('reviews_index', 'chk_motivation', {
    check: `motivation IN (
      'commenting', 'highlighting', 'questioning', 'replying',
      'assessing', 'bookmarking', 'classifying', 'describing',
      'editing', 'linking', 'moderating', 'tagging'
    )`,
  });

  pgm.addConstraint('reviews_index', 'chk_reply_depth', {
    check: 'reply_depth >= 0',
  });

  pgm.addConstraint('reviews_index', 'chk_reply_count', {
    check: 'reply_count >= 0',
  });

  pgm.addConstraint('reviews_index', 'chk_endorsement_count', {
    check: 'endorsement_count >= 0',
  });

  // =============================================================
  // HELPER FUNCTIONS
  // =============================================================

  // Function to increment reply count for parent review
  pgm.sql(`
    CREATE OR REPLACE FUNCTION increment_review_reply_count(p_parent_uri text)
    RETURNS void AS $$
    BEGIN
      UPDATE reviews_index
      SET reply_count = reply_count + 1
      WHERE uri = p_parent_uri;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Function to decrement reply count for parent review
  pgm.sql(`
    CREATE OR REPLACE FUNCTION decrement_review_reply_count(p_parent_uri text)
    RETURNS void AS $$
    BEGIN
      UPDATE reviews_index
      SET reply_count = GREATEST(reply_count - 1, 0)
      WHERE uri = p_parent_uri;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Function to find all replies in a thread
  pgm.sql(`
    CREATE OR REPLACE FUNCTION get_review_thread(p_root_uri text, p_max_depth integer DEFAULT 10)
    RETURNS TABLE(
      uri text,
      parent_uri text,
      reply_depth integer,
      content text,
      reviewer_did text,
      created_at timestamptz
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        r.uri,
        r.parent_uri,
        r.reply_depth,
        r.content,
        r.reviewer_did,
        r.created_at
      FROM reviews_index r
      WHERE (r.root_uri = p_root_uri OR r.uri = p_root_uri)
        AND r.reply_depth <= p_max_depth
      ORDER BY r.created_at ASC;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

/**
 * Rollback migration: remove expanded columns.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Drop helper functions
  pgm.sql('DROP FUNCTION IF EXISTS get_review_thread(text, integer)');
  pgm.sql('DROP FUNCTION IF EXISTS decrement_review_reply_count(text)');
  pgm.sql('DROP FUNCTION IF EXISTS increment_review_reply_count(text)');

  // Drop constraints
  pgm.dropConstraint('reviews_index', 'chk_endorsement_count', { ifExists: true });
  pgm.dropConstraint('reviews_index', 'chk_reply_count', { ifExists: true });
  pgm.dropConstraint('reviews_index', 'chk_reply_depth', { ifExists: true });
  pgm.dropConstraint('reviews_index', 'chk_motivation', { ifExists: true });
  pgm.dropConstraint('reviews_index', 'chk_content_format', { ifExists: true });

  // Drop indexes
  pgm.dropIndex('reviews_index', 'anchor', { name: 'idx_reviews_anchor', ifExists: true });
  pgm.dropIndex('reviews_index', 'reply_depth', {
    name: 'idx_reviews_reply_depth',
    ifExists: true,
  });
  pgm.dropIndex('reviews_index', 'motivation', { name: 'idx_reviews_motivation', ifExists: true });
  pgm.dropIndex('reviews_index', 'root_uri', { name: 'idx_reviews_root_uri', ifExists: true });
  pgm.dropIndex('reviews_index', 'parent_uri', { name: 'idx_reviews_parent_uri', ifExists: true });

  // Drop columns in reverse order of creation (cid was already in initial schema, don't drop)
  pgm.dropColumn('reviews_index', 'endorsement_count', { ifExists: true });
  pgm.dropColumn('reviews_index', 'reply_count', { ifExists: true });
  pgm.dropColumn('reviews_index', 'anchor', { ifExists: true });
  pgm.dropColumn('reviews_index', 'reply_depth', { ifExists: true });
  pgm.dropColumn('reviews_index', 'root_uri', { ifExists: true });
  pgm.dropColumn('reviews_index', 'parent_uri', { ifExists: true });
  pgm.dropColumn('reviews_index', 'motivation', { ifExists: true });
  pgm.dropColumn('reviews_index', 'content_format', { ifExists: true });
  pgm.dropColumn('reviews_index', 'eprint_cid', { ifExists: true });
  pgm.dropColumn('reviews_index', 'rkey', { ifExists: true });
}
