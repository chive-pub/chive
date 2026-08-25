/**
 * Records verified ORCID iDs durably, independent of the author index.
 *
 * @remarks
 * ORCID verification wrote its result with `UPDATE authors_index ... WHERE did`
 * and, when that matched no rows, logged that the value would "be picked up
 * when they are indexed" and discarded it. Nothing persisted it, so there was
 * nothing for indexing to pick up: an author who verified before appearing in
 * the index lost the verification permanently, and the OAuth round trip that
 * produced it reported success.
 *
 * The index row is also rebuilt from the firehose, and that upsert assigned
 * `orcid` straight from the incoming profile record — so even for an indexed
 * author, the next profile update overwrote a verified ORCID with whatever the
 * PDS record happened to carry, including null. Verification cannot live only
 * in a table that is reconstructed from someone else's data.
 *
 * This table is the source of truth for the verification itself. It is not
 * firehose-derived and is therefore not rebuildable from it, which is correct:
 * it records something Chive observed (a completed ORCID OAuth flow) rather
 * than something a PDS holds. `authors_index.orcid` stays as the denormalized
 * copy that queries read.
 *
 * `orcid` is unique: an ORCID iD identifies one researcher, and two DIDs
 * claiming the same one is a conflict to surface rather than to store twice.
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.createTable(
    'orcid_verifications',
    {
      did: { type: 'text', primaryKey: true, comment: 'DID of the verified account' },
      orcid: { type: 'text', notNull: true, comment: 'Verified ORCID iD' },
      verified_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'When the ORCID OAuth flow completed',
      },
    },
    { ifNotExists: true }
  );

  pgm.createConstraint('orcid_verifications', 'orcid_verifications_orcid_unique', {
    unique: 'orcid',
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('orcid_verifications', { ifExists: true });
}
