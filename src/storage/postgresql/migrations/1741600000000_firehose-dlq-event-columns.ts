/**
 * Adds the event-identity and error-classification columns the dead letter
 * queue has always written to.
 *
 * @remarks
 * `DeadLetterQueue.add` inserts `seq`, `repo_did`, `event_type` and
 * `error_type`, and `list`/`getStats` select them, but the initial schema never
 * created them and no later migration added them. Production acquired the
 * columns out of band, so the drift stayed invisible there while any database
 * built from migrations — CI, a fresh deploy, a restored backup — had a queue
 * that raised `column "seq" of relation "firehose_dlq" does not exist` on every
 * write. The failure is swallowed by the event processor's own error handling,
 * so the record was dropped exactly as if no queue existed.
 *
 * `IF NOT EXISTS` keeps this a no-op against the drifted production table.
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns(
    'firehose_dlq',
    {
      seq: { type: 'bigint' },
      repo_did: { type: 'text' },
      event_type: { type: 'text' },
      error_type: { type: 'text' },
    },
    { ifNotExists: true }
  );

  // The queue is read by repo, by event type and by error class when triaging
  // a backlog; the retry worker also scans unprocessed entries by age.
  pgm.createIndex('firehose_dlq', 'repo_did', {
    name: 'idx_firehose_dlq_repo_did',
    ifNotExists: true,
  });
  pgm.createIndex('firehose_dlq', 'event_type', {
    name: 'idx_firehose_dlq_event_type',
    ifNotExists: true,
  });
  pgm.createIndex('firehose_dlq', 'error_type', {
    name: 'idx_firehose_dlq_error_type',
    ifNotExists: true,
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('firehose_dlq', 'error_type', {
    name: 'idx_firehose_dlq_error_type',
    ifExists: true,
  });
  pgm.dropIndex('firehose_dlq', 'event_type', {
    name: 'idx_firehose_dlq_event_type',
    ifExists: true,
  });
  pgm.dropIndex('firehose_dlq', 'repo_did', {
    name: 'idx_firehose_dlq_repo_did',
    ifExists: true,
  });
  pgm.dropColumns('firehose_dlq', ['seq', 'repo_did', 'event_type', 'error_type'], {
    ifExists: true,
  });
}
