/**
 * Semble deep integration: connections, follows, collaborators, and Margin annotations.
 *
 * @remarks
 * Adds database support for:
 * - `cosmik_connections_index`: tracks network.cosmik.connection records (edges between links)
 * - `cosmik_follows_index`: tracks network.cosmik.follow records (user/collection follows)
 * - `margin_annotations_index`: tracks at.margin.annotation and at.margin.highlight records
 * - `margin_bookmarks_index`: tracks at.margin.bookmark records
 * - New backlink source types: cosmik.connection, cosmik.follow, margin.annotation,
 *   margin.highlight, margin.bookmark
 * - `margin_count` column on backlink_counts
 * - `collaborators` column on collections_index
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: add Semble integration tables and columns.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =========================================================================
  // 1. Cosmik connections index (edges between links)
  // =========================================================================
  pgm.createTable('cosmik_connections_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    owner_did: { type: 'text', notNull: true },
    source_entity: { type: 'text', notNull: true },
    target_entity: { type: 'text', notNull: true },
    connection_type: { type: 'text' },
    note: { type: 'text' },
    /** AT-URI of the corresponding pub.chive.graph.edge, if dual-written */
    chive_edge_uri: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz' },
    pds_url: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('cosmik_connections_index', 'owner_did');
  pgm.createIndex('cosmik_connections_index', 'source_entity');
  pgm.createIndex('cosmik_connections_index', 'target_entity');
  pgm.createIndex('cosmik_connections_index', 'connection_type');
  pgm.createIndex('cosmik_connections_index', 'chive_edge_uri');

  // =========================================================================
  // 2. Cosmik follows index
  // =========================================================================
  pgm.createTable('cosmik_follows_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    follower_did: { type: 'text', notNull: true },
    /** DID for user follows, AT-URI for collection follows */
    subject: { type: 'text', notNull: true },
    /** 'user' or 'collection' */
    subject_type: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    pds_url: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('cosmik_follows_index', 'follower_did');
  pgm.createIndex('cosmik_follows_index', 'subject');
  pgm.createIndex('cosmik_follows_index', 'subject_type');
  pgm.addConstraint('cosmik_follows_index', 'cosmik_follows_unique_pair', {
    unique: ['follower_did', 'subject'],
  });

  // =========================================================================
  // 3. Margin annotations index
  // =========================================================================
  pgm.createTable('margin_annotations_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    author_did: { type: 'text', notNull: true },
    /** URL being annotated */
    source_url: { type: 'text', notNull: true },
    /** SHA256 of normalized URL for fast lookup */
    source_hash: { type: 'text' },
    /** Record type: 'annotation', 'highlight' */
    record_type: { type: 'text', notNull: true },
    /** W3C motivation: commenting, highlighting, assessing, etc. */
    motivation: { type: 'text' },
    /** Annotation body text */
    body: { type: 'text' },
    /** Body format MIME type */
    body_format: { type: 'text' },
    /** Page title at annotation time */
    page_title: { type: 'text' },
    /** JSON-encoded selector for positioning */
    selector_json: { type: 'jsonb' },
    /** Highlight color (for highlight records) */
    color: { type: 'text' },
    /** JSON-encoded tags array */
    tags: { type: 'jsonb' },
    /** AT-URI of the Chive eprint this targets, if resolved */
    eprint_uri: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    pds_url: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('margin_annotations_index', 'author_did');
  pgm.createIndex('margin_annotations_index', 'source_url');
  pgm.createIndex('margin_annotations_index', 'source_hash');
  pgm.createIndex('margin_annotations_index', 'eprint_uri');
  pgm.createIndex('margin_annotations_index', 'record_type');
  pgm.createIndex('margin_annotations_index', 'motivation');

  // =========================================================================
  // 4. Margin bookmarks index
  // =========================================================================
  pgm.createTable('margin_bookmarks_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    author_did: { type: 'text', notNull: true },
    source_url: { type: 'text', notNull: true },
    source_hash: { type: 'text' },
    title: { type: 'text' },
    description: { type: 'text' },
    tags: { type: 'jsonb' },
    eprint_uri: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    pds_url: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('margin_bookmarks_index', 'author_did');
  pgm.createIndex('margin_bookmarks_index', 'source_url');
  pgm.createIndex('margin_bookmarks_index', 'source_hash');
  pgm.createIndex('margin_bookmarks_index', 'eprint_uri');

  // =========================================================================
  // 5. Add margin_count to backlink_counts
  // =========================================================================
  pgm.addColumns('backlink_counts', {
    margin_count: { type: 'integer', notNull: true, default: 0 },
    cosmik_connection_count: { type: 'integer', notNull: true, default: 0 },
  });

  // =========================================================================
  // 6. Update backlinks source_type check constraint
  // =========================================================================
  pgm.sql(`
    ALTER TABLE backlinks
    DROP CONSTRAINT IF EXISTS backlinks_source_type_check
  `);
  pgm.sql(`
    ALTER TABLE backlinks
    ADD CONSTRAINT backlinks_source_type_check
    CHECK (source_type IN (
      'cosmik.collection',
      'cosmik.connection',
      'cosmik.follow',
      'leaflet.list',
      'whitewind.blog',
      'bluesky.post',
      'bluesky.embed',
      'chive.comment',
      'chive.endorsement',
      'margin.annotation',
      'margin.highlight',
      'margin.bookmark',
      'other'
    ))
  `);

  // =========================================================================
  // 7. Update refresh_backlink_counts function
  // =========================================================================
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_backlink_counts(p_target_uri text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO backlink_counts (
        target_uri,
        cosmik_count,
        cosmik_connection_count,
        margin_count,
        leaflet_count,
        whitewind_count,
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
        COUNT(*) FILTER (WHERE source_type = 'cosmik.connection'),
        COUNT(*) FILTER (WHERE source_type IN ('margin.annotation', 'margin.highlight', 'margin.bookmark')),
        COUNT(*) FILTER (WHERE source_type = 'leaflet.list'),
        COUNT(*) FILTER (WHERE source_type = 'whitewind.blog'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.post'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.embed'),
        COUNT(*) FILTER (WHERE source_type = 'chive.comment'),
        COUNT(*) FILTER (WHERE source_type = 'chive.endorsement'),
        COUNT(*) FILTER (WHERE source_type = 'other'),
        COUNT(*),
        NOW()
      FROM backlinks
      WHERE target_uri = p_target_uri AND is_deleted = false
      ON CONFLICT (target_uri) DO UPDATE SET
        cosmik_count = EXCLUDED.cosmik_count,
        cosmik_connection_count = EXCLUDED.cosmik_connection_count,
        margin_count = EXCLUDED.margin_count,
        leaflet_count = EXCLUDED.leaflet_count,
        whitewind_count = EXCLUDED.whitewind_count,
        bluesky_post_count = EXCLUDED.bluesky_post_count,
        bluesky_embed_count = EXCLUDED.bluesky_embed_count,
        comment_count = EXCLUDED.comment_count,
        endorsement_count = EXCLUDED.endorsement_count,
        other_count = EXCLUDED.other_count,
        total_count = EXCLUDED.total_count,
        last_updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql
  `);

  // =========================================================================
  // 8. Add collaborators column to collections_index
  // =========================================================================
  pgm.addColumns('collections_index', {
    collaborators: { type: 'jsonb', default: "'[]'::jsonb" },
  });

  // =========================================================================
  // 9. Cosmik collection link removals index (tombstones)
  // =========================================================================
  pgm.createTable('cosmik_link_removals_index', {
    uri: { type: 'text', primaryKey: true },
    cid: { type: 'text', notNull: true },
    owner_did: { type: 'text', notNull: true },
    collection_uri: { type: 'text', notNull: true },
    removed_link_uri: { type: 'text', notNull: true },
    removed_at: { type: 'timestamptz', notNull: true },
    pds_url: { type: 'text' },
    indexed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('cosmik_link_removals_index', 'collection_uri');
  pgm.createIndex('cosmik_link_removals_index', 'removed_link_uri');
}

/**
 * Rollback migration.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('cosmik_link_removals_index');
  pgm.dropColumns('collections_index', ['collaborators']);

  // Restore previous refresh_backlink_counts function
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_backlink_counts(p_target_uri text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO backlink_counts (
        target_uri,
        cosmik_count,
        leaflet_count,
        whitewind_count,
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
        COUNT(*) FILTER (WHERE source_type = 'leaflet.list'),
        COUNT(*) FILTER (WHERE source_type = 'whitewind.blog'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.post'),
        COUNT(*) FILTER (WHERE source_type = 'bluesky.embed'),
        COUNT(*) FILTER (WHERE source_type = 'chive.comment'),
        COUNT(*) FILTER (WHERE source_type = 'chive.endorsement'),
        COUNT(*) FILTER (WHERE source_type = 'other'),
        COUNT(*),
        NOW()
      FROM backlinks
      WHERE target_uri = p_target_uri AND is_deleted = false
      ON CONFLICT (target_uri) DO UPDATE SET
        cosmik_count = EXCLUDED.cosmik_count,
        leaflet_count = EXCLUDED.leaflet_count,
        whitewind_count = EXCLUDED.whitewind_count,
        bluesky_post_count = EXCLUDED.bluesky_post_count,
        bluesky_embed_count = EXCLUDED.bluesky_embed_count,
        comment_count = EXCLUDED.comment_count,
        endorsement_count = EXCLUDED.endorsement_count,
        other_count = EXCLUDED.other_count,
        total_count = EXCLUDED.total_count,
        last_updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql
  `);

  // Restore source_type constraint
  pgm.sql(`
    ALTER TABLE backlinks
    DROP CONSTRAINT IF EXISTS backlinks_source_type_check
  `);
  pgm.sql(`
    ALTER TABLE backlinks
    ADD CONSTRAINT backlinks_source_type_check
    CHECK (source_type IN (
      'cosmik.collection',
      'leaflet.list',
      'whitewind.blog',
      'bluesky.post',
      'bluesky.embed',
      'chive.comment',
      'chive.endorsement',
      'other'
    ))
  `);

  pgm.dropColumns('backlink_counts', ['margin_count', 'cosmik_connection_count']);
  pgm.dropTable('margin_bookmarks_index');
  pgm.dropTable('margin_annotations_index');
  pgm.dropTable('cosmik_follows_index');
  pgm.dropTable('cosmik_connections_index');
}
