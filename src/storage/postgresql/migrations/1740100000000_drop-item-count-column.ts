/**
 * Migration to drop the dead item_count column from collections_index.
 *
 * @remarks
 * The item_count column was never maintained; all queries compute item count
 * dynamically with COUNT(e.uri)::text AS item_count via a LEFT JOIN on
 * collection_edges_index. Removing the column eliminates dead code.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.dropColumn('collections_index', 'item_count');
}

export function down(pgm: MigrationBuilder): void {
  pgm.addColumn('collections_index', {
    item_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Number of items in this collection',
    },
  });
}
