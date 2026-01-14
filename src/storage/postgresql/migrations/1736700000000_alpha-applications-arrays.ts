/**
 * Alpha applications table migration for arrays.
 *
 * @remarks
 * Updates the `alpha_applications` table to support:
 * - Multiple affiliations (JSONB array)
 * - Multiple research keywords (JSONB array)
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add arrays for affiliations and research keywords.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // Add new JSONB columns for arrays
  pgm.addColumns('alpha_applications', {
    affiliations: {
      type: 'jsonb',
      default: '[]',
      comment: 'Array of affiliations [{name, rorId?}]',
    },
    research_keywords: {
      type: 'jsonb',
      default: '[]',
      comment: 'Array of research keywords [{label, fastId?, wikidataId?}]',
    },
  });

  // Migrate existing single affiliation data to array format
  pgm.sql(`
    UPDATE alpha_applications
    SET affiliations = CASE
      WHEN affiliation_name IS NOT NULL THEN
        jsonb_build_array(
          jsonb_build_object(
            'name', affiliation_name,
            'rorId', affiliation_ror_id
          )
        )
      ELSE '[]'::jsonb
    END
  `);

  // Migrate existing research_field to research_keywords array
  pgm.sql(`
    UPDATE alpha_applications
    SET research_keywords = CASE
      WHEN research_field IS NOT NULL AND research_field != '' THEN
        jsonb_build_array(
          jsonb_build_object(
            'label', research_field
          )
        )
      ELSE '[]'::jsonb
    END
  `);

  // Drop old columns
  pgm.dropColumns('alpha_applications', [
    'affiliation_name',
    'affiliation_ror_id',
    'research_field',
  ]);
}

/**
 * Rollback migration: restore single affiliation and research_field columns.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Re-add old columns
  pgm.addColumns('alpha_applications', {
    affiliation_name: {
      type: 'text',
      comment: 'Institutional affiliation name (optional)',
    },
    affiliation_ror_id: {
      type: 'text',
      comment: 'ROR ID for the affiliation (optional)',
    },
    research_field: {
      type: 'text',
      notNull: true,
      default: '',
      comment: 'Primary research field or discipline',
    },
  });

  // Migrate data back from arrays
  pgm.sql(`
    UPDATE alpha_applications
    SET
      affiliation_name = COALESCE((affiliations->0->>'name'), NULL),
      affiliation_ror_id = COALESCE((affiliations->0->>'rorId'), NULL),
      research_field = COALESCE((research_keywords->0->>'label'), '')
  `);

  // Drop new JSONB columns
  pgm.dropColumns('alpha_applications', ['affiliations', 'research_keywords']);
}
