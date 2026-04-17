/**
 * Adds record_data JSONB column to pending_collection_edges so that pending
 * edges can be promoted to collection_edges_index without re-fetching from
 * the PDS.
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('pending_collection_edges', {
    cid: { type: 'text' },
    pds_url: { type: 'text' },
    weight: { type: 'real' },
    label: { type: 'text' },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn('pending_collection_edges', ['cid', 'pds_url', 'weight', 'label']);
}
