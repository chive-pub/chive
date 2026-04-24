/**
 * Add `chive_relation_slug` to cosmik_connections_index.
 *
 * @remarks
 * When a `network.cosmik.connection` is indexed from the firehose, the
 * cosmik-connections plugin resolves its `connectionType` against the
 * `externalIds` of Chive relation-type nodes. The resolved slug (if any)
 * is stored here so Chive UIs can render the connection as if it were a
 * native Chive edge with that relation.
 *
 * The original `connection_type` column retains the raw Cosmik value for
 * auditability and for cases where no Chive relation matches.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('cosmik_connections_index', {
    chive_relation_slug: { type: 'text' },
    chive_relation_uri: { type: 'text' },
  });

  pgm.createIndex('cosmik_connections_index', 'chive_relation_slug');
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumns('cosmik_connections_index', ['chive_relation_slug', 'chive_relation_uri']);
}
