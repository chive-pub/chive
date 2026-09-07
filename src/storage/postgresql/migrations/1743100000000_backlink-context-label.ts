/**
 * Migration adding a structured label to a backlink.
 *
 * @remarks
 * Several source records carry a typed field alongside their prose: a Margin
 * annotation has a motivation (`commenting`, `questioning`), a Cosmik
 * connection has a relation (`builds-on`, `contradicts`). The plugins had
 * nowhere to put those, so they prefixed them onto `context` -- the free text a
 * reader sees -- and the eprint page rendered the result as a title. A card
 * read "commenting: The gradable adjective case…" or "type: builds-on - PDS
 * generalises…", with structured data presented as the opening words of a
 * sentence.
 *
 * `context_label` is where that value belongs. `context` goes back to being the
 * text the source record actually wrote, and the label can be drawn as what it
 * is.
 *
 * Nullable, because most source types have no such field and because rows
 * written before this migration have none. Those keep their prefixed `context`
 * until the record is seen on the firehose again.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add the structured label column.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('backlinks', {
    context_label: {
      type: 'text',
      notNull: false,
      comment: "The source record's own typed field, such as a Margin motivation.",
    },
  });
}

/**
 * Rollback migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn('backlinks', 'context_label');
}
