/**
 * Subscriptions and recommendations from the standard.site graph.
 *
 * @remarks
 * `site.standard.graph.subscription` is written by a *reader* into their own
 * repository and names a publication. `site.standard.graph.recommend` is
 * written the same way and names a document. Neither lives anywhere Chive
 * controls, so both are indexed from the firehose like any other foreign
 * record, and both are rebuildable from it.
 *
 * A publication belongs to the repository that holds it, so the DID in the
 * publication's AT-URI identifies the author being subscribed to. That is
 * stored alongside the URI rather than derived at query time, because every
 * read of this table wants to answer "whose papers does this reader follow".
 *
 * Deletions are soft, matching how backlinks record them: a subscription that
 * is withdrawn and reinstated should not lose the fact that it once existed,
 * and a hard delete would make the count jitter while the firehose replays.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('standard_site_subscriptions', {
    // The subscription record's own AT-URI, in the subscriber's repo.
    uri: { type: 'text', primaryKey: true },
    subscriber_did: { type: 'text', notNull: true },
    publication_uri: { type: 'text', notNull: true },
    /** DID of the repository holding the publication: the author subscribed to. */
    publication_did: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    is_deleted: { type: 'boolean', notNull: true, default: false },
    deleted_at: { type: 'timestamptz' },
  });

  // "Who subscribes to this author" and "what does this reader follow" are the
  // two questions asked of this table; neither should scan it.
  pgm.createIndex('standard_site_subscriptions', ['publication_did', 'is_deleted']);
  pgm.createIndex('standard_site_subscriptions', ['subscriber_did', 'is_deleted']);

  pgm.createTable('standard_site_publications', {
    uri: { type: 'text', primaryKey: true },
    /** DID of the repository holding it: the author it belongs to. */
    author_did: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    url: { type: 'text' },
    description: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    is_deleted: { type: 'boolean', notNull: true, default: false },
  });

  pgm.createIndex('standard_site_publications', ['author_did', 'is_deleted']);

  pgm.createTable('standard_site_recommendations', {
    uri: { type: 'text', primaryKey: true },
    recommender_did: { type: 'text', notNull: true },
    /** The `site.standard.document` recommended. */
    document_uri: { type: 'text', notNull: true },
    /** The eprint that document describes, once resolved. */
    eprint_uri: { type: 'text' },
    created_at: { type: 'timestamptz' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    is_deleted: { type: 'boolean', notNull: true, default: false },
    deleted_at: { type: 'timestamptz' },
  });

  pgm.createIndex('standard_site_recommendations', ['eprint_uri', 'is_deleted']);
  pgm.createIndex('standard_site_recommendations', ['document_uri']);

  await Promise.resolve();
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('standard_site_recommendations');
  pgm.dropTable('standard_site_publications');
  pgm.dropTable('standard_site_subscriptions');
  await Promise.resolve();
}
