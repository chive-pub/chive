/**
 * Migration indexing what a Semble collection holds.
 *
 * @remarks
 * Semble publishes no address for an individual card. Verified against live
 * records: `semble.so/profile/{did}/cards/{rkey}` returns the same empty shell
 * for a real record key as for an invented one, and a populated collection page
 * carries no links to the cards on it -- they are rendered inline. The only
 * per-record page Semble serves is the collection.
 *
 * So a card that cites an eprint can be opened on Semble only through the
 * collection it belongs to, and membership is its own record:
 * `network.cosmik.collectionLink` names a card and a collection. Chive had
 * never indexed it. It indexed `collectionLinkRemoval` -- the tombstone written
 * when a collection owner removes a collaborator's link, which it cannot delete
 * from another user's repository -- and so watched links being taken out of
 * collections it had never seen them put into.
 *
 * Two tables:
 *
 * - `cosmik_collection_links_index` is the membership edge, keyed on the link
 *   record. `is_removed` carries the tombstone, because the link record itself
 *   stays in its author's repository after the collection owner removes it.
 * - `cosmik_collections_index` holds the collection's name, so a card can say
 *   which collection it is in rather than only that it is in one. A collection
 *   is indexed whether or not it references an eprint, since the collection a
 *   citing card sits in is usually about something else entirely.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add the collection and membership indexes.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.createTable('cosmik_collections_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    owner_did: { type: 'text', notNull: true },
    name: { type: 'text' },
    description: { type: 'text' },
    access_type: { type: 'text' },
    created_at: { type: 'timestamptz' },
    pds_url: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('cosmik_collections_index', 'owner_did');

  pgm.createTable('cosmik_collection_links_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    owner_did: { type: 'text', notNull: true },
    card_uri: { type: 'text', notNull: true },
    collection_uri: { type: 'text', notNull: true },
    added_by: { type: 'text' },
    added_at: { type: 'timestamptz' },
    /**
     * Set when the collection's owner writes a `collectionLinkRemoval`.
     *
     * @remarks
     * A flag rather than a delete: the link record is still in its author's
     * repository, so a replay of the firehose would write the row again, and a
     * removal that arrived before the link it removes must still be honoured.
     */
    is_removed: { type: 'boolean', notNull: true, default: false },
    pds_url: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // The read path asks "which collection is this card in", once per Semble
  // card on an eprint page.
  pgm.createIndex('cosmik_collection_links_index', 'card_uri');
  pgm.createIndex('cosmik_collection_links_index', 'collection_uri');
}

/**
 * Rollback migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('cosmik_collection_links_index');
  pgm.dropTable('cosmik_collections_index');
}
