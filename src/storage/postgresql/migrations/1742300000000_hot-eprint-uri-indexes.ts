/**
 * Index the shape the eprint page actually queries.
 *
 * @remarks
 * Reviews, endorsements and annotations are all read the same way when a
 * reader opens a paper:
 *
 * ```sql
 * WHERE eprint_uri = $1 AND deleted_at IS NULL ORDER BY created_at DESC
 * ```
 *
 * The existing indexes cover `eprint_uri` alone, so PostgreSQL matches the
 * URI, then filters the soft-deleted rows, then sorts — a sort per request,
 * growing with the number of reviews a paper has. The busiest papers, which
 * are the ones most often opened, pay the most for it.
 *
 * A partial index on `(eprint_uri, created_at DESC) WHERE deleted_at IS NULL`
 * answers the whole query from the index in the order it is wanted. Partial
 * rather than full because a soft-deleted row is never returned by these reads,
 * so indexing it costs write throughput and saves nothing.
 *
 * The single-column indexes stay: other queries filter on `eprint_uri` without
 * this predicate, and dropping them would trade one plan for another.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

/** Tables read with the eprint-page pattern. */
const TABLES = ['reviews_index', 'endorsements_index', 'annotations_index'] as const;

function indexName(table: string): string {
  return `${table}_eprint_uri_created_at_live_idx`;
}

export function up(pgm: MigrationBuilder): void {
  for (const table of TABLES) {
    pgm.sql(`
      CREATE INDEX IF NOT EXISTS ${indexName(table)}
      ON ${table} (eprint_uri, created_at DESC)
      WHERE deleted_at IS NULL
    `);
  }
}

export function down(pgm: MigrationBuilder): void {
  for (const table of TABLES) {
    pgm.sql(`DROP INDEX IF EXISTS ${indexName(table)}`);
  }
}
