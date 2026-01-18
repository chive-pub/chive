/**
 * Migration to convert eprint abstracts to rich text format.
 *
 * @remarks
 * This migration adds support for rich text abstracts with embedded
 * knowledge graph node references (FOVEA GlossItem pattern).
 *
 * Changes:
 * - Converts `abstract` from TEXT to JSONB (RichTextBody format)
 * - Adds `abstract_plain_text` for full-text search indexing
 * - Migrates existing plain text abstracts to the new format
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: convert abstract to rich text format.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // 1. Add new columns for rich text abstract
  pgm.addColumn('eprints_index', {
    abstract_rich: {
      type: 'jsonb',
      comment: 'Rich text abstract with embedded node references (RichTextBody format)',
    },
    abstract_plain_text: {
      type: 'text',
      comment: 'Plain text abstract for full-text search indexing',
    },
  });

  // 2. Migrate existing plain text abstracts to rich text format
  // Wrap existing text in the RichTextBody structure:
  // { type: 'RichText', items: [{ type: 'text', content: <existing_abstract> }], format: '...' }
  pgm.sql(`
    UPDATE eprints_index
    SET
      abstract_rich = jsonb_build_object(
        'type', 'RichText',
        'items', jsonb_build_array(
          jsonb_build_object('type', 'text', 'content', abstract)
        ),
        'format', 'application/x-chive-gloss+json'
      ),
      abstract_plain_text = abstract
    WHERE abstract IS NOT NULL
  `);

  // 3. Drop old abstract column
  pgm.dropColumn('eprints_index', 'abstract');

  // 4. Rename new columns to final names
  pgm.renameColumn('eprints_index', 'abstract_rich', 'abstract');
  // abstract_plain_text keeps its name

  // 5. Add NOT NULL constraints and defaults using raw SQL to avoid escaping issues
  pgm.sql(`
    ALTER TABLE eprints_index
      ALTER COLUMN abstract SET DEFAULT '{"type":"RichText","items":[],"format":"application/x-chive-gloss+json"}'::jsonb,
      ALTER COLUMN abstract SET NOT NULL;
  `);
  pgm.sql(`
    ALTER TABLE eprints_index
      ALTER COLUMN abstract_plain_text SET DEFAULT '',
      ALTER COLUMN abstract_plain_text SET NOT NULL;
  `);

  // 6. Update column comments
  pgm.sql(`
    COMMENT ON COLUMN eprints_index.abstract IS
      'Rich text abstract with embedded knowledge graph references (RichTextBody format)';
    COMMENT ON COLUMN eprints_index.abstract_plain_text IS
      'Plain text abstract for full-text search indexing (auto-generated from abstract)';
  `);

  // 7. Create GIN index on abstract for JSONB querying (node references)
  pgm.createIndex('eprints_index', 'abstract', {
    method: 'gin',
    name: 'idx_eprints_abstract_gin',
  });

  // 8. Create full-text search index on plain text abstract
  pgm.createIndex('eprints_index', [{ name: 'abstract_plain_text', opclass: 'text_pattern_ops' }], {
    name: 'idx_eprints_abstract_plain_text',
  });
}

/**
 * Rollback migration: revert abstract to plain text format.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // 1. Drop indexes
  pgm.dropIndex('eprints_index', 'abstract', {
    name: 'idx_eprints_abstract_gin',
  });
  pgm.dropIndex('eprints_index', 'abstract_plain_text', {
    name: 'idx_eprints_abstract_plain_text',
  });

  // 2. Rename abstract column
  pgm.renameColumn('eprints_index', 'abstract', 'abstract_rich');

  // 3. Add old abstract column back
  pgm.addColumn('eprints_index', {
    abstract: {
      type: 'text',
      comment: 'Eprint abstract',
    },
  });

  // 4. Migrate data back (extract plain text from rich format)
  pgm.sql(`
    UPDATE eprints_index
    SET abstract = abstract_plain_text
    WHERE abstract_plain_text IS NOT NULL AND abstract_plain_text != ''
  `);

  // Set NOT NULL on abstract
  pgm.alterColumn('eprints_index', 'abstract', {
    notNull: true,
    default: '',
  });

  // 5. Drop rich text columns
  pgm.dropColumn('eprints_index', 'abstract_rich');
  pgm.dropColumn('eprints_index', 'abstract_plain_text');
}
