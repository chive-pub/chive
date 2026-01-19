/**
 * Add fields column to eprints_index for knowledge graph field references.
 *
 * @remarks
 * Stores references to knowledge graph field nodes that categorize eprints.
 * These are NOT facets (PMEST taxonomy) - they are direct references to
 * knowledge graph nodes representing research fields.
 *
 * **Column Added:**
 * - `fields` - JSONB array of { uri, label, id } field references
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add fields column.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Add fields column to eprints_index
  pgm.addColumns('eprints_index', {
    fields: {
      type: 'jsonb',
      comment: 'Array of knowledge graph field references: [{ uri, label, id }]',
    },
  });

  // Create GIN index for efficient JSONB queries on fields
  pgm.createIndex('eprints_index', 'fields', {
    method: 'gin',
    name: 'idx_eprints_fields_gin',
  });
}

/**
 * Rollback migration: remove fields column.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('eprints_index', 'fields', { name: 'idx_eprints_fields_gin', ifExists: true });
  pgm.dropColumns('eprints_index', ['fields']);
}
