/**
 * Migration recording the other end of a backlink's source record.
 *
 * @remarks
 * A Cosmik connection is an edge: it names two entities and says how they
 * relate. Chive stored only the note and the relation, so a card on the eprint
 * page read "PDS generalises the projection machinery developed for the
 * factivity study" with no way to reach the factivity study -- half of what the
 * record actually says, dropped at index time.
 *
 * `related_uri` takes the end that is not this eprint. It is an AT-URI when the
 * source named a record and a URL otherwise, because the entities a connection
 * joins are frequently neither eprints nor even ATProto records: of the
 * connections on the author's own repository, most point at DOIs and library
 * catalogue pages.
 *
 * No title is stored beside it. Where the other end is an eprint Chive has
 * indexed, the read path joins `eprints_index` for its current title; a copy
 * taken at index time would be a second source of truth for something the
 * index already holds, and would go stale the first time the paper was
 * retitled.
 *
 * Nullable: most source types join nothing to anything, and rows written
 * before this migration carry no such value until the record is seen on the
 * firehose again.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add the related-end column and the index the read join needs.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('backlinks', {
    related_uri: {
      type: 'text',
      notNull: false,
      comment: 'The end of the source record that is not this eprint, as an AT-URI or a URL.',
    },
  });

  // The read path left-joins `eprints_index` on this column for every backlink
  // it returns, so it is worth an index even though most rows are null.
  pgm.createIndex('backlinks', 'related_uri', { where: 'related_uri IS NOT NULL' });
}

/**
 * Rollback migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn('backlinks', ['related_uri']);
}
