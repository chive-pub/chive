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
  // `whitewind_count` is kept and pinned to zero rather than dropped: the
  // column is NOT NULL and other definitions of this function reference it, so
  // removing it turns a rollback into a broken function.

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

  // The counts function is rebuilt against `backlink_counts` as it stands
  // today, which has grown since the definition this replaces: `semble_count`
  // became `cosmik_count`, `bluesky_count` split into post and embed, and
  // `other_count`, `margin_count` and `cosmik_connection_count` were added.
  // Every column is NOT NULL, so one omitted from the insert takes its default
  // and silently stops being maintained.
  //
  // `other_count` is everything not bucketed by a column of its own, which is
  // where standard.site documents and calendar events land.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_backlink_counts(p_target_uri text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO backlink_counts (
        target_uri,
        cosmik_count,
        cosmik_connection_count,
        leaflet_count,
        whitewind_count,
        margin_count,
        bluesky_post_count,
        bluesky_embed_count,
        comment_count,
        endorsement_count,
        other_count,
        total_count,
        last_updated_at
      )
      SELECT
        p_target_uri,
        COUNT(*) FILTER (WHERE source_type = 'cosmik.collection'),
        COUNT(*) FILTER (WHERE source_type IN ('cosmik.connection', 'cosmik.follow')),
        COUNT(*) FILTER (WHERE source_type LIKE 'leaflet.%'),
        0,
        COUNT(*) FILTER (WHERE source_type LIKE 'margin.%'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.post'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.embed'),
        COUNT(*) FILTER (WHERE source_type = 'chive.comment'),
        COUNT(*) FILTER (WHERE source_type = 'chive.endorsement'),
        COUNT(*) FILTER (
          WHERE source_type NOT LIKE 'cosmik.%'
            AND source_type NOT LIKE 'leaflet.%'
            AND source_type NOT LIKE 'margin.%'
            AND source_type NOT IN (
              'bluesky.post', 'bluesky.embed', 'chive.comment', 'chive.endorsement'
            )
        ),
        COUNT(*),
        NOW()
      FROM backlinks
      WHERE target_uri = p_target_uri AND is_deleted = false
      ON CONFLICT (target_uri) DO UPDATE SET
        cosmik_count = EXCLUDED.cosmik_count,
        cosmik_connection_count = EXCLUDED.cosmik_connection_count,
        leaflet_count = EXCLUDED.leaflet_count,
        whitewind_count = EXCLUDED.whitewind_count,
        margin_count = EXCLUDED.margin_count,
        bluesky_post_count = EXCLUDED.bluesky_post_count,
        bluesky_embed_count = EXCLUDED.bluesky_embed_count,
        comment_count = EXCLUDED.comment_count,
        endorsement_count = EXCLUDED.endorsement_count,
        other_count = EXCLUDED.other_count,
        total_count = EXCLUDED.total_count,
        last_updated_at = EXCLUDED.last_updated_at;
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
