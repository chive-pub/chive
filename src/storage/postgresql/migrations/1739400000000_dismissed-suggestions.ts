/**
 * Migration to create dismissed_suggestions table.
 *
 * @remarks
 * Tracks which paper suggestions a user has dismissed so they are not shown again.
 * This is AppView-specific data (rebuildable; not stored in user PDSes).
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create dismissed_suggestions table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.createTable('dismissed_suggestions', {
    id: {
      type: 'serial',
      primaryKey: true,
      comment: 'Auto-incrementing primary key',
    },
    user_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of the user who dismissed the suggestion',
    },
    source: {
      type: 'text',
      notNull: true,
      comment: 'External source of the suggestion (e.g., arxiv, semanticscholar)',
    },
    external_id: {
      type: 'text',
      notNull: true,
      comment: 'Source-specific identifier of the dismissed paper',
    },
    dismissed_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When the suggestion was dismissed',
    },
  });

  // Unique constraint to prevent duplicate dismissals
  pgm.addConstraint('dismissed_suggestions', 'uq_dismissed_suggestions_user_source_external', {
    unique: ['user_did', 'source', 'external_id'],
  });

  // Index on user_did for fast lookups of dismissed suggestions by user
  pgm.createIndex('dismissed_suggestions', 'user_did', {
    name: 'idx_dismissed_suggestions_user',
  });

  pgm.sql(`
    COMMENT ON TABLE dismissed_suggestions IS
      'Tracks paper suggestions dismissed by users. '
      'AppView-specific data used to filter the suggestions list.';
  `);
}

/**
 * Rollback migration: drop dismissed_suggestions table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('dismissed_suggestions', 'user_did', {
    name: 'idx_dismissed_suggestions_user',
  });
  pgm.dropConstraint('dismissed_suggestions', 'uq_dismissed_suggestions_user_source_external');
  pgm.dropTable('dismissed_suggestions');
}
