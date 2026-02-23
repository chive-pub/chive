/**
 * Migration to add label column to collection_edges_index.
 *
 * @remarks
 * Adds user-entered label storage to collection edges so items can be
 * displayed with custom names chosen by the collection curator.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('collection_edges_index', {
    label: {
      type: 'text',
      comment: 'User-entered label for the item in this collection',
    },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn('collection_edges_index', 'label');
}
