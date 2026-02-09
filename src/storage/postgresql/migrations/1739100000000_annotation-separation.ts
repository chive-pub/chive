/**
 * Separate inline annotations and entity links from reviews_index.
 *
 * @remarks
 * Splits the reviews_index table into three distinct tables by concern:
 *
 * - `reviews_index` retains top-level reviews (no anchor)
 * - `annotations_index` holds inline text annotations (anchor required)
 * - `entity_links_index` holds knowledge graph entity links
 *
 * Records with an anchor in reviews_index are migrated into the appropriate
 * new table based on their motivation. The anchor column distinguishes
 * annotations (anchor NOT NULL) from top-level reviews (anchor NULL).
 *
 * Data migration:
 * - Inline reviews (anchor IS NOT NULL, motivation != 'linking') move to annotations_index
 * - Entity links (anchor IS NOT NULL, motivation = 'linking') move to entity_links_index
 * - Top-level reviews (anchor IS NULL) remain in reviews_index
 *
 * ATProto Compliance:
 * - All tables are rebuildable from firehose
 * - PDS source tracking columns preserved in every new table
 * - No blob data stored; only BlobRef CIDs and metadata
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create annotations_index and entity_links_index tables,
 * migrate data from reviews_index, and remove migrated rows.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // =========================================================================
  // 1. CREATE annotations_index TABLE
  // =========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS annotations_index (
      uri TEXT PRIMARY KEY,
      cid TEXT NOT NULL,
      eprint_uri TEXT NOT NULL,
      annotator_did TEXT NOT NULL,
      body JSONB,
      facets JSONB,
      anchor JSONB NOT NULL,
      page_number INTEGER,
      motivation TEXT NOT NULL DEFAULT 'commenting',
      parent_annotation TEXT,
      reply_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ,
      pds_url TEXT NOT NULL,
      indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      deletion_source TEXT,
      CONSTRAINT fk_annotation_eprint
        FOREIGN KEY (eprint_uri) REFERENCES eprints_index(uri) ON DELETE CASCADE,
      CONSTRAINT fk_parent_annotation
        FOREIGN KEY (parent_annotation) REFERENCES annotations_index(uri) ON DELETE CASCADE
    )
  `);

  // Indexes for annotations_index
  pgm.createIndex('annotations_index', 'eprint_uri', {
    name: 'idx_annotations_eprint',
    ifNotExists: true,
  });

  pgm.createIndex('annotations_index', 'annotator_did', {
    name: 'idx_annotations_annotator',
    ifNotExists: true,
  });

  pgm.createIndex('annotations_index', ['eprint_uri', 'page_number'], {
    name: 'idx_annotations_eprint_page',
    where: 'deleted_at IS NULL',
    ifNotExists: true,
  });

  pgm.createIndex('annotations_index', 'parent_annotation', {
    name: 'idx_annotations_parent',
    where: 'parent_annotation IS NOT NULL',
    ifNotExists: true,
  });

  pgm.createIndex('annotations_index', 'motivation', {
    name: 'idx_annotations_motivation',
    ifNotExists: true,
  });

  pgm.createIndex('annotations_index', 'created_at', {
    name: 'idx_annotations_created',
    ifNotExists: true,
  });

  pgm.createIndex('annotations_index', 'anchor', {
    name: 'idx_annotations_anchor',
    method: 'gin',
    ifNotExists: true,
  });

  pgm.createIndex('annotations_index', 'facets', {
    name: 'idx_annotations_facets',
    method: 'gin',
    where: 'facets IS NOT NULL',
    ifNotExists: true,
  });

  // =========================================================================
  // 2. CREATE entity_links_index TABLE
  // =========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS entity_links_index (
      uri TEXT PRIMARY KEY,
      cid TEXT NOT NULL,
      eprint_uri TEXT NOT NULL,
      creator_did TEXT NOT NULL,
      anchor JSONB NOT NULL,
      page_number INTEGER,
      entity_type TEXT NOT NULL,
      entity_data JSONB NOT NULL,
      entity_label TEXT NOT NULL,
      confidence INTEGER,
      created_at TIMESTAMPTZ NOT NULL,
      pds_url TEXT NOT NULL,
      indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      deletion_source TEXT,
      CONSTRAINT fk_entitylink_eprint
        FOREIGN KEY (eprint_uri) REFERENCES eprints_index(uri) ON DELETE CASCADE
    )
  `);

  // Indexes for entity_links_index
  pgm.createIndex('entity_links_index', 'eprint_uri', {
    name: 'idx_entitylinks_eprint',
    ifNotExists: true,
  });

  pgm.createIndex('entity_links_index', 'creator_did', {
    name: 'idx_entitylinks_creator',
    ifNotExists: true,
  });

  pgm.createIndex('entity_links_index', ['eprint_uri', 'page_number'], {
    name: 'idx_entitylinks_eprint_page',
    where: 'deleted_at IS NULL',
    ifNotExists: true,
  });

  pgm.createIndex('entity_links_index', 'entity_type', {
    name: 'idx_entitylinks_type',
    ifNotExists: true,
  });

  pgm.createIndex('entity_links_index', 'entity_data', {
    name: 'idx_entitylinks_entity',
    method: 'gin',
    ifNotExists: true,
  });

  // =========================================================================
  // 3. MIGRATE INLINE REVIEWS TO annotations_index
  // =========================================================================

  pgm.sql(`
    INSERT INTO annotations_index (
      uri, cid, eprint_uri, annotator_did, body, facets,
      anchor, page_number, motivation, parent_annotation,
      created_at, updated_at, pds_url, indexed_at, last_synced_at,
      deleted_at, deletion_source
    )
    SELECT
      uri, cid, eprint_uri, reviewer_did, body, facets,
      anchor,
      (anchor->>'pageNumber')::integer,
      COALESCE(motivation, 'commenting'),
      parent_comment,
      created_at, updated_at, pds_url, indexed_at, last_synced_at,
      deleted_at, deletion_source
    FROM reviews_index
    WHERE anchor IS NOT NULL
      AND COALESCE(motivation, 'commenting') != 'linking'
  `);

  // =========================================================================
  // 4. MIGRATE ENTITY LINKS TO entity_links_index
  // =========================================================================

  pgm.sql(`
    INSERT INTO entity_links_index (
      uri, cid, eprint_uri, creator_did,
      anchor, page_number,
      entity_type, entity_data, entity_label,
      confidence, created_at, pds_url, indexed_at, last_synced_at,
      deleted_at, deletion_source
    )
    SELECT
      uri, cid, eprint_uri, reviewer_did,
      anchor,
      (anchor->>'pageNumber')::integer,
      'graphNode',
      COALESCE(facets, '[]'::jsonb),
      COALESCE(body->>0, 'Unknown'),
      1000,
      created_at, pds_url, indexed_at, last_synced_at,
      deleted_at, deletion_source
    FROM reviews_index
    WHERE anchor IS NOT NULL
      AND motivation = 'linking'
  `);

  // =========================================================================
  // 5. DELETE MIGRATED ROWS FROM reviews_index
  // =========================================================================

  pgm.sql(`
    DELETE FROM reviews_index WHERE anchor IS NOT NULL
  `);

  // =========================================================================
  // 6. TABLE COMMENTS
  // =========================================================================

  pgm.sql(`
    COMMENT ON TABLE annotations_index IS
      'Index of inline text annotations on eprints (text comments with targets)';
    COMMENT ON TABLE entity_links_index IS
      'Index of entity links connecting text spans to knowledge graph entities';
  `);
}

/**
 * Rollback migration: move annotations and entity links back to reviews_index,
 * then drop the new tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // =========================================================================
  // 1. MOVE ANNOTATIONS BACK TO reviews_index
  // =========================================================================

  pgm.sql(`
    INSERT INTO reviews_index (
      uri, cid, eprint_uri, reviewer_did, body, facets,
      anchor, motivation, parent_comment,
      created_at, updated_at, pds_url, indexed_at, last_synced_at,
      deleted_at, deletion_source
    )
    SELECT
      uri, cid, eprint_uri, annotator_did, body, facets,
      anchor, motivation, parent_annotation,
      created_at, updated_at, pds_url, indexed_at, last_synced_at,
      deleted_at, deletion_source
    FROM annotations_index
  `);

  // =========================================================================
  // 2. MOVE ENTITY LINKS BACK TO reviews_index
  // =========================================================================

  pgm.sql(`
    INSERT INTO reviews_index (
      uri, cid, eprint_uri, reviewer_did, body, facets,
      anchor, motivation,
      created_at, pds_url, indexed_at, last_synced_at,
      deleted_at, deletion_source
    )
    SELECT
      uri, cid, eprint_uri, creator_did,
      to_jsonb(ARRAY[json_build_object('type', 'text', 'content', entity_label)]),
      entity_data,
      anchor, 'linking',
      created_at, pds_url, indexed_at, last_synced_at,
      deleted_at, deletion_source
    FROM entity_links_index
  `);

  // =========================================================================
  // 3. DROP NEW TABLES
  // =========================================================================

  pgm.dropTable('entity_links_index', { ifExists: true });
  pgm.dropTable('annotations_index', { ifExists: true });
}
