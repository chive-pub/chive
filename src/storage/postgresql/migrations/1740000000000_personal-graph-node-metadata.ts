/**
 * Migration to add metadata JSONB column to personal_graph_nodes_index.
 *
 * @remarks
 * Stores subkind-specific metadata (e.g., eprintUri, did, handle, clonedFrom)
 * so that collection items can be fully resolved from the personal graph index
 * without joining eprints_index or authors_index.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('personal_graph_nodes_index', {
    metadata: {
      type: 'jsonb',
      default: pgm.func("'{}'::jsonb"),
      comment: 'Subkind-specific metadata (e.g., eprintUri, did, handle, clonedFrom)',
    },
  });

  pgm.sql(`
    CREATE INDEX idx_pgn_metadata_gin
      ON personal_graph_nodes_index
      USING GIN (metadata jsonb_path_ops)
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql('DROP INDEX IF EXISTS idx_pgn_metadata_gin');
  pgm.dropColumn('personal_graph_nodes_index', 'metadata');
}
