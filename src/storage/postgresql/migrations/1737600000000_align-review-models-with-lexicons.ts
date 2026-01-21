/**
 * Migration to align review/endorsement models with lexicon definitions.
 *
 * @remarks
 * Updates the data model to match pub.chive.review.endorsement and
 * pub.chive.review.comment lexicons.
 *
 * Changes:
 * - endorsements_index: Replace `endorsement_type` with `contributions TEXT[]`
 * - reviews_index: Replace `content` with `body JSONB`, add motivation fields
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =========================================================================
  // ENDORSEMENTS: Add contributions array, migrate data, drop endorsement_type
  // =========================================================================

  // Add new contributions column
  pgm.addColumn('endorsements_index', {
    contributions: {
      type: 'text[]',
      default: '{}',
      comment: 'Array of endorsement-contribution slugs (e.g., methodological, empirical)',
    },
  });

  // Migrate existing endorsement_type to contributions array
  // methods -> ['methodological']
  // results -> ['empirical']
  // overall -> ['conceptual']
  pgm.sql(`
    UPDATE endorsements_index
    SET contributions = CASE endorsement_type
      WHEN 'methods' THEN ARRAY['methodological']
      WHEN 'results' THEN ARRAY['empirical']
      WHEN 'overall' THEN ARRAY['conceptual']
      ELSE ARRAY[]::text[]
    END
  `);

  // Make contributions not null after migration
  pgm.alterColumn('endorsements_index', 'contributions', {
    notNull: true,
  });

  // Drop the old endorsement_type column and its check constraint
  pgm.dropColumn('endorsements_index', 'endorsement_type');

  // Add GIN index for contributions array
  pgm.createIndex('endorsements_index', 'contributions', {
    method: 'gin',
    name: 'idx_endorsements_contributions_gin',
  });

  // =========================================================================
  // REVIEWS: Add rich text body and motivation fields
  // =========================================================================

  // Add new body column (JSONB array of text/nodeRef/eprintRef items)
  pgm.addColumn('reviews_index', {
    body: {
      type: 'jsonb',
      comment: 'Rich text body as array of textItem/nodeRefItem/eprintRefItem',
    },
  });

  // Add motivation fields
  pgm.addColumn('reviews_index', {
    motivation_uri: {
      type: 'text',
      comment: 'AT URI of motivation node (if using graph-based motivation)',
    },
    motivation_fallback: {
      type: 'text',
      comment: 'Fallback motivation type if URI not available',
    },
  });

  // Rename parent_review_uri to parent_comment for lexicon alignment
  pgm.renameColumn('reviews_index', 'parent_review_uri', 'parent_comment');

  // Update the foreign key constraint name
  pgm.dropConstraint('reviews_index', 'fk_parent_review');
  pgm.addConstraint('reviews_index', 'fk_parent_comment', {
    foreignKeys: {
      columns: 'parent_comment',
      references: 'reviews_index(uri)',
      onDelete: 'CASCADE',
    },
  });

  // Migrate existing content to body format
  // Wrap plain text content in a textItem array
  pgm.sql(`
    UPDATE reviews_index
    SET body = jsonb_build_array(
      jsonb_build_object(
        'type', 'text',
        'content', content
      )
    )
    WHERE content IS NOT NULL AND body IS NULL
  `);

  // Make body not null after migration
  pgm.alterColumn('reviews_index', 'body', {
    notNull: true,
    default: pgm.func("'[]'::jsonb"),
  });

  // Drop the content column (replaced by body JSONB)
  pgm.dropColumn('reviews_index', 'content');

  // Add index on motivation_uri for lookups
  pgm.createIndex('reviews_index', 'motivation_uri', {
    name: 'idx_reviews_motivation_uri',
    where: 'motivation_uri IS NOT NULL',
  });
}

/**
 * Rollback migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // =========================================================================
  // REVIEWS: Restore content column, drop new columns
  // =========================================================================

  // Add back content column
  pgm.addColumn('reviews_index', {
    content: {
      type: 'text',
      comment: 'Review content',
    },
  });

  // Extract text from body back to content
  pgm.sql(`
    UPDATE reviews_index
    SET content = COALESCE(
      (
        SELECT string_agg(item->>'content', E'\\n')
        FROM jsonb_array_elements(body) AS item
        WHERE item->>'type' = 'text'
      ),
      ''
    )
  `);

  // Make content not null
  pgm.alterColumn('reviews_index', 'content', {
    notNull: true,
  });

  // Drop new columns
  pgm.dropIndex('reviews_index', 'motivation_uri', {
    name: 'idx_reviews_motivation_uri',
  });
  pgm.dropColumn('reviews_index', 'motivation_fallback');
  pgm.dropColumn('reviews_index', 'motivation_uri');
  pgm.dropColumn('reviews_index', 'body');

  // Rename parent_comment back to parent_review_uri
  pgm.dropConstraint('reviews_index', 'fk_parent_comment');
  pgm.renameColumn('reviews_index', 'parent_comment', 'parent_review_uri');
  pgm.addConstraint('reviews_index', 'fk_parent_review', {
    foreignKeys: {
      columns: 'parent_review_uri',
      references: 'reviews_index(uri)',
      onDelete: 'CASCADE',
    },
  });

  // =========================================================================
  // ENDORSEMENTS: Restore endorsement_type column
  // =========================================================================

  // Drop GIN index
  pgm.dropIndex('endorsements_index', 'contributions', {
    name: 'idx_endorsements_contributions_gin',
  });

  // Add back endorsement_type column
  pgm.addColumn('endorsements_index', {
    endorsement_type: {
      type: 'text',
      comment: 'Type of endorsement',
    },
  });

  // Migrate contributions back to endorsement_type (take first contribution)
  pgm.sql(`
    UPDATE endorsements_index
    SET endorsement_type = CASE
      WHEN 'methodological' = ANY(contributions) THEN 'methods'
      WHEN 'empirical' = ANY(contributions) THEN 'results'
      WHEN 'conceptual' = ANY(contributions) THEN 'overall'
      ELSE 'overall'
    END
  `);

  // Make endorsement_type not null and add check constraint
  pgm.alterColumn('endorsements_index', 'endorsement_type', {
    notNull: true,
  });
  pgm.addConstraint('endorsements_index', 'check_endorsement_type', {
    check: "endorsement_type IN ('methods', 'results', 'overall')",
  });

  // Drop contributions column
  pgm.dropColumn('endorsements_index', 'contributions');
}
