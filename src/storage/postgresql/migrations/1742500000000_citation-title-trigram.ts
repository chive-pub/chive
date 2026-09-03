/**
 * Trigram index and extension for near-title citation matching.
 *
 * @remarks
 * Citations are resolved to eprints by identifier first and by title second.
 * An exact title comparison rejects every reference GROBID hands back with the
 * citation's own furniture attached -- a leading year label, "in press.", a
 * dropped first word -- so a near match is tried before giving up, using
 * trigram similarity.
 *
 * The extension is created here rather than assumed: without it the near-match
 * query raises `function similarity(text, text) does not exist`, which would
 * turn a matching pass into a failing one. The index makes the comparison a
 * lookup rather than a scan of every eprint per citation.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Normalised title expression, matching the service's `NORMALIZED_TITLE_SQL`.
 *
 * @remarks
 * The index has to be built over the same expression the query uses, or the
 * planner cannot use it.
 */
const NORMALIZED_TITLE = `btrim(regexp_replace(lower(regexp_replace(title, '[^a-zA-Z0-9[:space:]]', '', 'g')), '\\s+', ' ', 'g'))`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_eprints_normalized_title_trgm
    ON eprints_index USING gin ((${NORMALIZED_TITLE}) gin_trgm_ops)
  `);
  await Promise.resolve();
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP INDEX IF EXISTS idx_eprints_normalized_title_trgm`);
  // The extension is left in place: other work may have come to depend on it,
  // and dropping it is not the inverse of creating it if it already existed.
  await Promise.resolve();
}
