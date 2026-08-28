/**
 * Index `pub.chive.actor.mute` records.
 *
 * @remarks
 * The frontend writes these records to the user's PDS and reads them back from
 * it directly (`web/lib/hooks/use-muted-authors.ts` calls
 * `com.atproto.repo.listRecords`), so the client side works.
 *
 * The server side did not exist. The firehose processor had no branch for this
 * collection, so every mute was dropped on arrival and Chive could not apply
 * one anywhere it matters — feeds, search, notifications — because it did not
 * know the mute existed. Muting an author hid them in one browser tab's view
 * and nowhere else.
 *
 * `(muter_did, subject_did)` is unique: muting the same author twice is the
 * same mute, and a client that writes a second record should not produce a
 * second row. The record URI is kept so a deletion arriving from the firehose
 * can find the row it refers to.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('muted_authors_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    muter_did: { type: 'text', notNull: true },
    subject_did: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    // Every `*_index` table carries these two: `pds_url` records which server
    // the record came from, and `last_synced_at` when it was last checked
    // against that server. Together they are what makes staleness detection
    // possible, which is why the schema tests require them of every index.
    last_synced_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    pds_url: { type: 'text', notNull: true },
  });

  pgm.createIndex('muted_authors_index', 'muter_did');
  pgm.createIndex('muted_authors_index', 'subject_did');
  pgm.addConstraint('muted_authors_index', 'muted_authors_unique_pair', {
    unique: ['muter_did', 'subject_did'],
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('muted_authors_index');
}
