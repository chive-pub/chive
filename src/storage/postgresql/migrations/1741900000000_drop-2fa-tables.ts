/**
 * Drops the second-factor authentication tables.
 *
 * @remarks
 * Chive does not offer 2FA. The WebAuthn and TOTP layer these tables were built
 * for was never reachable — no route, handler or service imported it — and the
 * services that did exist wrote their state to Redis with TTLs rather than
 * here, so these tables have never held a row in any deployment. The code was
 * removed alongside this migration.
 *
 * They are dropped rather than left in place because an empty table for a
 * feature that does not exist is a standing invitation to wire something up
 * against it, and because the schema should describe what the system does.
 *
 * `IF EXISTS` keeps this a no-op against a database where they were never
 * created. `down()` recreates them faithfully, so reverting the migration
 * restores the schema — though not the removed service code, which lives in
 * version control.
 *
 * Only the 2FA tables are touched. `user_roles`, `oauth_clients` and
 * `oauth_authorization_codes` came from the same original migration and are
 * left alone: they are not second-factor state, and whether they are live is a
 * separate question from this one.
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.dropTable('webauthn_credentials', { ifExists: true });
  pgm.dropTable('mfa_enrollments', { ifExists: true });
}

export function down(pgm: MigrationBuilder): void {
  pgm.createTable('webauthn_credentials', {
    credential_id: {
      type: 'text',
      primaryKey: true,
      comment: 'Credential ID (base64url encoded)',
    },
    did: { type: 'text', notNull: true, comment: 'User DID' },
    public_key: { type: 'text', notNull: true, comment: 'Credential public key' },
    counter: { type: 'bigint', notNull: true, default: 0, comment: 'Signature counter' },
    transports: { type: 'text[]', comment: 'Supported transports' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_used_at: { type: 'timestamptz' },
  });
  pgm.createIndex('webauthn_credentials', 'did');

  pgm.createTable('mfa_enrollments', {
    did: { type: 'text', primaryKey: true, comment: 'User DID' },
    totp_secret_encrypted: { type: 'text', comment: 'Encrypted TOTP secret' },
    backup_codes_hashed: { type: 'text[]', comment: 'Hashed backup codes' },
    enrolled_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_verified_at: { type: 'timestamptz' },
  });
}
