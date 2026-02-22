/**
 * Migration to create collections and personal graph tables.
 *
 * @remarks
 * Creates storage for:
 * - Personal graph nodes: user-created nodes (not governance-approved)
 * - Personal graph edges: user-created edges linking nodes
 * - Collections index: a subset of personal graph nodes with subkind='collection'
 * - Collection edges index: edges associated with collections (CONTAINS, SUBCOLLECTION_OF)
 * - Profile display configuration: per-user profile layout settings
 *
 * ATProto Compliance:
 * - All tables are indexed from the firehose (read-only)
 * - PDS source tracking for staleness detection
 * - All data is rebuildable from firehose replay
 * - No blob data stored; only BlobRef CIDs where applicable
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create personal graph, collections, and profile config tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // ==========================================================================
  // 1. personal_graph_nodes_index: user-created graph nodes
  // ==========================================================================

  pgm.createTable('personal_graph_nodes_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT-URI of the personal graph node record',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'CID of the indexed record version',
    },
    owner_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of the user who owns this node',
    },
    node_id: {
      type: 'text',
      comment: 'Unique ID of the node within its record (rkey)',
    },
    kind: {
      type: 'text',
      notNull: true,
      comment: 'Primary kind of the node (e.g., object, type)',
    },
    subkind: {
      type: 'text',
      comment: 'Optional subkind for further classification (e.g., collection, reading-list)',
    },
    label: {
      type: 'text',
      notNull: true,
      comment: 'Human-readable label for the node',
    },
    alternate_labels: {
      type: 'jsonb',
      comment: 'Alternative labels as a JSON array of strings',
    },
    description: {
      type: 'text',
      comment: 'Optional description of the node',
    },
    status: {
      type: 'text',
      notNull: true,
      default: "'established'",
      comment: 'Lifecycle status of the node (established, archived, etc.)',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When this node was created (from record)',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When this record was last updated in the index',
    },
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of the PDS where this record lives',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was first indexed',
    },
    last_synced_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was last synced from the PDS',
    },
  });

  pgm.createIndex('personal_graph_nodes_index', 'owner_did', {
    name: 'idx_pgn_owner',
  });

  pgm.createIndex('personal_graph_nodes_index', 'subkind', {
    name: 'idx_pgn_subkind',
  });

  pgm.sql(`
    CREATE INDEX idx_pgn_label
      ON personal_graph_nodes_index
      USING GIN (to_tsvector('english', label))
  `);

  pgm.sql(`
    COMMENT ON TABLE personal_graph_nodes_index IS
      'User-created personal graph nodes indexed from the ATProto firehose. '
      'These are not governance-approved; they live in user PDSes.';
  `);

  // ==========================================================================
  // 2. personal_graph_edges_index: user-created graph edges
  // ==========================================================================

  pgm.createTable('personal_graph_edges_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT-URI of the personal graph edge record',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'CID of the indexed record version',
    },
    owner_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of the user who owns this edge',
    },
    edge_id: {
      type: 'text',
      comment: 'Unique ID of the edge within its record (rkey)',
    },
    source_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the source node',
    },
    target_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the target node',
    },
    relation_slug: {
      type: 'text',
      notNull: true,
      comment: 'Slug identifying the relationship type (e.g., contains, related-to)',
    },
    weight: {
      type: 'real',
      comment: 'Optional numeric weight for the edge',
    },
    status: {
      type: 'text',
      notNull: true,
      default: "'established'",
      comment: 'Lifecycle status of the edge (established, archived, etc.)',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When this edge was created (from record)',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When this record was last updated in the index',
    },
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of the PDS where this record lives',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was first indexed',
    },
    last_synced_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was last synced from the PDS',
    },
  });

  pgm.createIndex('personal_graph_edges_index', 'owner_did', {
    name: 'idx_pge_owner',
  });

  pgm.createIndex('personal_graph_edges_index', 'source_uri', {
    name: 'idx_pge_source',
  });

  pgm.createIndex('personal_graph_edges_index', 'target_uri', {
    name: 'idx_pge_target',
  });

  pgm.createIndex('personal_graph_edges_index', 'relation_slug', {
    name: 'idx_pge_relation',
  });

  pgm.sql(`
    COMMENT ON TABLE personal_graph_edges_index IS
      'User-created personal graph edges indexed from the ATProto firehose. '
      'Each edge links a source node to a target node with a typed relationship.';
  `);

  // ==========================================================================
  // 3. collections_index: denormalized collection view
  // ==========================================================================

  pgm.createTable('collections_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT-URI of the collection record',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'CID of the indexed record version',
    },
    owner_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of the user who owns this collection',
    },
    label: {
      type: 'text',
      notNull: true,
      comment: 'Display name of the collection',
    },
    description: {
      type: 'text',
      comment: 'Optional description of the collection',
    },
    visibility: {
      type: 'text',
      notNull: true,
      default: "'public'",
      comment: 'Visibility setting (public, unlisted, private)',
    },
    item_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Number of items in this collection',
    },
    tags: {
      type: 'jsonb',
      default: "'[]'",
      comment: 'Tags applied to this collection as a JSON array',
    },
    metadata: {
      type: 'jsonb',
      default: "'{}'",
      comment: 'Additional metadata as a JSON object',
    },
    semble_collection_uri: {
      type: 'text',
      comment: 'AT-URI of a linked Semble collection (if any)',
    },
    parent_collection_uri: {
      type: 'text',
      comment: 'AT-URI of the parent collection for nested hierarchies',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When this collection was created (from record)',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When this collection was last updated (from record)',
    },
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of the PDS where this record lives',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was first indexed',
    },
    last_synced_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was last synced from the PDS',
    },
  });

  pgm.createIndex('collections_index', 'owner_did', {
    name: 'idx_collections_owner',
  });

  pgm.createIndex('collections_index', 'visibility', {
    name: 'idx_collections_visibility',
  });

  pgm.sql(`
    CREATE INDEX idx_collections_created
      ON collections_index (created_at DESC)
  `);

  pgm.createIndex('collections_index', 'parent_collection_uri', {
    name: 'idx_collections_parent',
    where: 'parent_collection_uri IS NOT NULL',
  });

  pgm.sql(`
    COMMENT ON TABLE collections_index IS
      'Denormalized index of user collections (subset of personal_graph_nodes_index '
      'where subkind is collection). Provides efficient querying for collection '
      'listings, visibility filtering, and nested hierarchies.';
  `);

  // ==========================================================================
  // 4. collection_edges_index: collection-related edges (CONTAINS, SUBCOLLECTION_OF)
  // ==========================================================================

  pgm.createTable('collection_edges_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      comment: 'AT-URI of the collection edge record',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'CID of the indexed record version',
    },
    owner_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of the user who owns this edge',
    },
    source_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the source node (collection for CONTAINS, child for SUBCOLLECTION_OF)',
    },
    target_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the target node (item for CONTAINS, parent for SUBCOLLECTION_OF)',
    },
    relation_slug: {
      type: 'text',
      notNull: true,
      comment: 'Relationship type slug (contains, subcollection-of)',
    },
    weight: {
      type: 'real',
      comment: 'Optional numeric weight for ordering',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When this edge was created (from record)',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When this record was last updated in the index',
    },
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of the PDS where this record lives',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was first indexed',
    },
    last_synced_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was last synced from the PDS',
    },
  });

  pgm.createIndex('collection_edges_index', 'source_uri', {
    name: 'idx_cei_source',
  });

  pgm.createIndex('collection_edges_index', 'target_uri', {
    name: 'idx_cei_target',
  });

  pgm.createIndex('collection_edges_index', 'relation_slug', {
    name: 'idx_cei_relation',
  });

  pgm.sql(`
    COMMENT ON TABLE collection_edges_index IS
      'Edges associated with collections (CONTAINS and SUBCOLLECTION_OF relationships). '
      'Indexed from the ATProto firehose. Used for item count computation, '
      'subcollection hierarchy, and cascade deletion logic.';
  `);

  // ==========================================================================
  // 5. profile_config: profile display configuration
  // ==========================================================================

  pgm.createTable('profile_config', {
    did: {
      type: 'text',
      primaryKey: true,
      comment: 'DID of the user whose profile this configures',
    },
    uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the profile config record',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'CID of the indexed record version',
    },
    profile_type: {
      type: 'text',
      default: "'individual'",
      comment: 'Type of profile (individual, lab, organization)',
    },
    sections: {
      type: 'jsonb',
      notNull: true,
      default: "'[]'",
      comment: 'Ordered list of profile sections as a JSON array',
    },
    featured_collection_uri: {
      type: 'text',
      comment: 'AT-URI of the featured collection displayed on the profile',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When this profile config was created (from record)',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When this profile config was last updated (from record)',
    },
    pds_url: {
      type: 'text',
      notNull: true,
      comment: 'URL of the PDS where this record lives',
    },
    indexed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this record was first indexed',
    },
  });

  pgm.sql(`
    COMMENT ON TABLE profile_config IS
      'Per-user profile display configuration indexed from the ATProto firehose. '
      'Controls how a user profile page is rendered (sections, featured collection, etc.).';
  `);
}

/**
 * Rollback migration: drop all collections and personal graph tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  // Drop in reverse order to respect foreign key dependencies

  // 5. profile_config
  pgm.dropTable('profile_config', { ifExists: true });

  // 4. collection_edges_index
  pgm.dropTable('collection_edges_index', { ifExists: true });

  // 3. collections_index
  pgm.dropTable('collections_index', { ifExists: true });

  // 2. personal_graph_edges_index
  pgm.dropTable('personal_graph_edges_index', { ifExists: true });

  // 1. personal_graph_nodes_index (drop GIN index explicitly since it was created via raw SQL)
  pgm.sql('DROP INDEX IF EXISTS idx_pgn_label');
  pgm.dropTable('personal_graph_nodes_index', { ifExists: true });
}
