/**
 * Migration to create eprint_versions_index table for eprint version metadata.
 *
 * @remarks
 * Stores version metadata records (pub.chive.eprint.version) that describe
 * individual versions of an eprint, including version number, a description
 * of changes, and links to the previous version.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create eprint_versions_index table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.createTable('eprint_versions_index', {
    uri: {
      type: 'text',
      primaryKey: true,
      notNull: true,
      comment: 'AT-URI of the version record',
    },
    cid: {
      type: 'text',
      notNull: true,
      comment: 'CID of the indexed version',
    },
    eprint_uri: {
      type: 'text',
      notNull: true,
      comment: 'AT-URI of the eprint this version belongs to',
    },
    version_number: {
      type: 'integer',
      notNull: true,
      comment: 'Sequential version number (starting at 1)',
    },
    previous_version_uri: {
      type: 'text',
      comment: 'AT-URI of the previous version record',
    },
    changes: {
      type: 'text',
      notNull: true,
      comment: 'Changelog describing changes in this version (max 2000 chars)',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      comment: 'When this version was created (from record)',
    },
    pds_url: {
      type: 'text',
      comment: 'URL of the PDS where this record lives',
    },
    indexed_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this version was first indexed',
    },
    last_synced_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When this version was last synced from PDS',
    },
  });

  pgm.createIndex('eprint_versions_index', 'eprint_uri', {
    name: 'idx_eprint_versions_eprint_uri',
  });

  pgm.createIndex('eprint_versions_index', ['eprint_uri', 'version_number'], {
    name: 'idx_eprint_versions_eprint_version',
    unique: true,
  });

  pgm.sql(`
    COMMENT ON TABLE eprint_versions_index IS
      'Index of eprint version metadata from ATProto firehose. Stores version numbers and change descriptions.';
  `);
}

/**
 * Rollback migration: drop eprint_versions_index table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('eprint_versions_index', ['eprint_uri', 'version_number'], {
    name: 'idx_eprint_versions_eprint_version',
  });
  pgm.dropIndex('eprint_versions_index', 'eprint_uri', {
    name: 'idx_eprint_versions_eprint_uri',
  });
  pgm.dropTable('eprint_versions_index');
}
