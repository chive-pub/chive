/**
 * Migration splitting a backlink's display fields apart.
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
 * The same flattening happened with descriptions. A Leaflet document and a
 * standard.site document each have a title *and* a description, and both were
 * joined with a colon -- so a card read "A tripartite implementation of PDS:
 * How the Haskell implementation regiments the framework's abstractions." as
 * one run-on title.
 *
 * `context` goes back to being what the record calls itself, `context_label`
 * takes the typed value, and `context_detail` takes the description. Each can
 * then be drawn as what it is.
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
    context_detail: {
      type: 'text',
      notNull: false,
      comment: "The source record's description, kept apart from its title.",
    },
  });
}

/**
 * Rollback migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn('backlinks', ['context_label', 'context_detail']);
}
