/**
 * A record of citation extraction attempts per eprint.
 *
 * @remarks
 * Extraction runs once, when an eprint is indexed. If it fails — GROBID
 * unreachable, the PDS slow, the container restarting mid-job — nothing retries
 * it and nothing records that it happened. The only trace is an absence of rows
 * in `extracted_citations`, which is indistinguishable from a paper whose
 * references genuinely could not be found. On production this left 18 of 66
 * eprints with a PDF and no references at all, undetected, because an empty
 * citation list looks exactly like a paper that cites nothing indexed.
 *
 * This table makes the attempt itself observable, so a backfill can select
 * eprints never successfully processed without re-running GROBID over papers
 * that were processed and genuinely yielded nothing.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('citation_extraction_attempts', {
    eprint_uri: { type: 'text', primaryKey: true },
    attempted_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    succeeded: { type: 'boolean', notNull: true },
    reference_count: { type: 'integer', notNull: true, default: 0 },
    // Kept so a recurring failure can be diagnosed without re-running it.
    error: { type: 'text' },
  });

  pgm.createIndex('citation_extraction_attempts', ['succeeded', 'attempted_at']);

  // Seed from what the data already proves.
  //
  // The table starts empty, and the backfill selects eprints with no successful
  // attempt recorded. Without this every eprint would look never-attempted on
  // the first run and the whole corpus would go back through GROBID -- tens of
  // minutes of work to rediscover references already stored. An eprint with
  // rows in `extracted_citations` has demonstrably been processed, so its
  // attempt is recorded as the success it was, timed to its most recent
  // citation rather than to now.
  pgm.sql(`
    INSERT INTO citation_extraction_attempts (eprint_uri, attempted_at, succeeded, reference_count)
    SELECT eprint_uri, NOW(), true, COUNT(*)
    FROM extracted_citations
    GROUP BY eprint_uri
    ON CONFLICT (eprint_uri) DO NOTHING
  `);

  await Promise.resolve();
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('citation_extraction_attempts');
  await Promise.resolve();
}
