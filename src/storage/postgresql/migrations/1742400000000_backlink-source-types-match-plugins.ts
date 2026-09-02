/**
 * Align the backlink source type constraint with `BacklinkSourceType`.
 *
 * @remarks
 * `backlinks.source_type` is constrained to a fixed set of values, and the set
 * must be exactly what `BacklinkSourceType` permits: a plugin writing a value
 * the constraint does not list has its row rejected by PostgreSQL, and a
 * backlink that cannot be stored is indistinguishable from one that was never
 * found.
 *
 * The two are easy to drift apart because one lives in TypeScript and the other
 * in SQL. `SOURCE_TYPES` below is the SQL side; a unit test compares it against
 * the union. Adding a source type means editing both.
 *
 * Rows written under earlier names are rewritten rather than dropped, and
 * anything outside the set becomes `other`, so tightening the constraint cannot
 * fail on data already stored.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Every value `BacklinkSourceType` permits.
 *
 * Kept in the same order as the union so the two can be compared by eye.
 */
const SOURCE_TYPES = [
  'cosmik.collection',
  'cosmik.connection',
  'cosmik.follow',
  'leaflet.document',
  'leaflet.comment',
  'bluesky.post',
  'bluesky.embed',
  'margin.annotation',
  'margin.highlight',
  'margin.bookmark',
  'standard.document',
  'calendar.event',
  'other',
] as const;

/**
 * Earlier source type names, mapped to their current equivalents.
 *
 * Rows carrying an old name are rewritten so they survive the tightened
 * constraint.
 */
const RENAMED: readonly (readonly [string, string])[] = [
  ['semble.collection', 'cosmik.collection'],
  ['leaflet.list', 'leaflet.document'],
];

const quoted = SOURCE_TYPES.map((type) => `'${type}'`).join(', ');

export function up(pgm: MigrationBuilder): void {
  // Rewrite before tightening, or the constraint rejects rows already stored.
  for (const [from, to] of RENAMED) {
    pgm.sql(`UPDATE backlinks SET source_type = '${to}' WHERE source_type = '${from}'`);
  }

  // WhiteWind support is gone, and its counts column with it. Nothing wrote to
  // it, so there is nothing to preserve.
  pgm.sql(`DELETE FROM backlinks WHERE source_type = 'whitewind.blog'`);
  pgm.sql(`ALTER TABLE backlink_counts DROP COLUMN IF EXISTS whitewind_count`);

  // Anything else outside the new set becomes 'other' rather than blocking the
  // migration. A backlink with an unrecognised source is still a backlink.
  pgm.sql(`
    UPDATE backlinks
    SET source_type = 'other'
    WHERE source_type NOT IN (${quoted})
  `);

  pgm.sql(`ALTER TABLE backlinks DROP CONSTRAINT IF EXISTS backlinks_source_type_check`);
  pgm.sql(`
    ALTER TABLE backlinks
    ADD CONSTRAINT backlinks_source_type_check
    CHECK (source_type IN (${quoted}))
  `);

  // Counts bucket by prefix, so a new `cosmik.*` or `leaflet.*` subtype is
  // counted without another migration.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_backlink_counts(p_target_uri text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO backlink_counts (
        target_uri,
        semble_count,
        leaflet_count,
        bluesky_count,
        comment_count,
        endorsement_count,
        total_count,
        updated_at
      )
      SELECT
        p_target_uri,
        COUNT(*) FILTER (WHERE source_type LIKE 'cosmik.%'),
        COUNT(*) FILTER (WHERE source_type LIKE 'leaflet.%'),
        COUNT(*) FILTER (WHERE source_type IN ('bluesky.post', 'bluesky.embed')),
        COUNT(*) FILTER (WHERE source_type = 'chive.comment'),
        COUNT(*) FILTER (WHERE source_type = 'chive.endorsement'),
        COUNT(*),
        NOW()
      FROM backlinks
      WHERE target_uri = p_target_uri AND is_deleted = false
      ON CONFLICT (target_uri) DO UPDATE SET
        semble_count = EXCLUDED.semble_count,
        leaflet_count = EXCLUDED.leaflet_count,
        bluesky_count = EXCLUDED.bluesky_count,
        comment_count = EXCLUDED.comment_count,
        endorsement_count = EXCLUDED.endorsement_count,
        total_count = EXCLUDED.total_count,
        updated_at = EXCLUDED.updated_at;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Recount, since the stored totals were computed under the previous
  // bucketing.
  pgm.sql(`
    DO $$
    DECLARE target text;
    BEGIN
      FOR target IN SELECT DISTINCT target_uri FROM backlinks LOOP
        PERFORM refresh_backlink_counts(target);
      END LOOP;
    END $$;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Only the constraint is reverted. Renamed rows are left as they are, since
  // the old names refer to record types that do not exist.
  pgm.sql(`ALTER TABLE backlinks DROP CONSTRAINT IF EXISTS backlinks_source_type_check`);
}
