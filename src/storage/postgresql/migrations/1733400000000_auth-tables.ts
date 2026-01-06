/**
 * Authentication and authorization tables migration.
 *
 * @remarks
 * Creates tables for authentication, authorization, and security features.
 *
 * Tables created:
 * - `user_roles` - User-role assignments for RBAC
 * - `oauth_clients` - OAuth 2.0 client registrations
 * - `oauth_authorization_codes` - Temporary auth codes for OAuth flow
 * - `webauthn_credentials` - WebAuthn/passkey credentials
 * - `mfa_enrollments` - MFA enrollment data (TOTP)
 * - `audit_log` - Security audit trail
 *
 * **Note**: Sessions and tokens are stored in Redis, not PostgreSQL.
 * These tables store persistent auth data that survives restarts.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create authentication and authorization tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  // User roles table for RBAC
  pgm.createTable('user_roles', {
    did: {
      type: 'text',
      notNull: true,
      comment: 'User DID',
    },
    role: {
      type: 'text',
      notNull: true,
      check: "role IN ('admin', 'moderator', 'authority-editor', 'author', 'reader')",
      comment: 'Role name',
    },
    assigned_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When role was assigned',
    },
    assigned_by: {
      type: 'text',
      comment: 'DID of user who assigned this role',
    },
    expires_at: {
      type: 'timestamptz',
      comment: 'When role expires (null = permanent)',
    },
  });

  pgm.addConstraint('user_roles', 'pk_user_roles', {
    primaryKey: ['did', 'role'],
  });

  pgm.createIndex('user_roles', 'did');
  pgm.createIndex('user_roles', 'role');
  pgm.createIndex('user_roles', 'expires_at', {
    where: 'expires_at IS NOT NULL',
  });

  // OAuth 2.0 clients table
  pgm.createTable('oauth_clients', {
    client_id: {
      type: 'text',
      primaryKey: true,
      comment: 'Client ID (UUID)',
    },
    client_secret_hash: {
      type: 'text',
      comment: 'Hashed client secret (null for public clients)',
    },
    client_type: {
      type: 'text',
      notNull: true,
      check: "client_type IN ('public', 'confidential')",
      comment: 'Client type',
    },
    name: {
      type: 'text',
      notNull: true,
      comment: 'Client application name',
    },
    description: {
      type: 'text',
      comment: 'Client description',
    },
    redirect_uris: {
      type: 'text[]',
      notNull: true,
      comment: 'Allowed redirect URIs',
    },
    scopes: {
      type: 'text[]',
      notNull: true,
      default: pgm.func("ARRAY['read:preprints']"),
      comment: 'Allowed scopes',
    },
    owner_did: {
      type: 'text',
      notNull: true,
      comment: 'DID of client owner',
    },
    logo_uri: {
      type: 'text',
      comment: 'Client logo URI',
    },
    homepage_uri: {
      type: 'text',
      comment: 'Client homepage URI',
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Whether client is active',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When client was created',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When client was last updated',
    },
  });

  pgm.createIndex('oauth_clients', 'owner_did');
  pgm.createIndex('oauth_clients', 'is_active');

  // OAuth authorization codes (temporary, for auth code flow)
  pgm.createTable('oauth_authorization_codes', {
    code: {
      type: 'text',
      primaryKey: true,
      comment: 'Authorization code',
    },
    client_id: {
      type: 'text',
      notNull: true,
      references: 'oauth_clients(client_id)',
      onDelete: 'CASCADE',
      comment: 'Client that initiated flow',
    },
    did: {
      type: 'text',
      notNull: true,
      comment: 'User DID who authorized',
    },
    redirect_uri: {
      type: 'text',
      notNull: true,
      comment: 'Redirect URI used in request',
    },
    scope: {
      type: 'text[]',
      notNull: true,
      comment: 'Granted scopes',
    },
    code_challenge: {
      type: 'text',
      notNull: true,
      comment: 'PKCE code challenge',
    },
    code_challenge_method: {
      type: 'text',
      notNull: true,
      default: 'S256',
      check: "code_challenge_method IN ('plain', 'S256')",
      comment: 'PKCE challenge method',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When code was created',
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
      comment: 'When code expires',
    },
    used_at: {
      type: 'timestamptz',
      comment: 'When code was used (null = unused)',
    },
  });

  pgm.createIndex('oauth_authorization_codes', 'client_id');
  pgm.createIndex('oauth_authorization_codes', 'expires_at');

  // WebAuthn credentials table
  pgm.createTable('webauthn_credentials', {
    credential_id: {
      type: 'text',
      primaryKey: true,
      comment: 'Credential ID (base64url encoded)',
    },
    did: {
      type: 'text',
      notNull: true,
      comment: 'User DID',
    },
    public_key: {
      type: 'text',
      notNull: true,
      comment: 'COSE public key (base64 encoded)',
    },
    counter: {
      type: 'bigint',
      notNull: true,
      default: 0,
      comment: 'Signature counter for replay detection',
    },
    transports: {
      type: 'text[]',
      comment: 'Authenticator transports (usb, nfc, ble, internal, hybrid)',
    },
    aaguid: {
      type: 'text',
      comment: 'Authenticator AAGUID',
    },
    nickname: {
      type: 'text',
      comment: 'User-assigned nickname',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When credential was registered',
    },
    last_used_at: {
      type: 'timestamptz',
      comment: 'Last authentication time',
    },
  });

  pgm.createIndex('webauthn_credentials', 'did');
  pgm.createIndex('webauthn_credentials', 'aaguid');

  // MFA enrollments table
  pgm.createTable('mfa_enrollments', {
    did: {
      type: 'text',
      primaryKey: true,
      comment: 'User DID',
    },
    totp_secret_encrypted: {
      type: 'text',
      comment: 'Encrypted TOTP secret (AES-256-GCM)',
    },
    totp_enabled: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether TOTP is enabled',
    },
    totp_enrolled_at: {
      type: 'timestamptz',
      comment: 'When TOTP was enrolled',
    },
    backup_codes_hash: {
      type: 'text[]',
      comment: 'Hashed backup codes (SHA-256)',
    },
    backup_codes_generated_at: {
      type: 'timestamptz',
      comment: 'When backup codes were generated',
    },
    last_verified_at: {
      type: 'timestamptz',
      comment: 'Last MFA verification time',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When enrollment record was created',
    },
    updated_at: {
      type: 'timestamptz',
      comment: 'When enrollment was last updated',
    },
  });

  pgm.createIndex('mfa_enrollments', 'totp_enabled', {
    where: 'totp_enabled = true',
  });

  // Security audit log
  pgm.createTable('audit_log', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    event_type: {
      type: 'text',
      notNull: true,
      comment: 'Event type (login, logout, role_change, etc.)',
    },
    actor_did: {
      type: 'text',
      comment: 'DID of actor (null for system events)',
    },
    target_did: {
      type: 'text',
      comment: 'DID of target (for role changes, etc.)',
    },
    resource_type: {
      type: 'text',
      comment: 'Resource type affected',
    },
    resource_id: {
      type: 'text',
      comment: 'Resource ID affected',
    },
    action: {
      type: 'text',
      notNull: true,
      comment: 'Action performed',
    },
    result: {
      type: 'text',
      notNull: true,
      check: "result IN ('success', 'failure', 'denied')",
      comment: 'Action result',
    },
    ip_address: {
      type: 'inet',
      comment: 'Client IP address',
    },
    user_agent: {
      type: 'text',
      comment: 'Client user agent',
    },
    details: {
      type: 'jsonb',
      comment: 'Additional event details',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When event occurred',
    },
  });

  pgm.createIndex('audit_log', 'event_type');
  pgm.createIndex('audit_log', 'actor_did');
  pgm.createIndex('audit_log', 'target_did');
  pgm.createIndex('audit_log', 'created_at');
  pgm.createIndex('audit_log', 'details', { method: 'gin' });

  // Create partial index for failed auth events (security monitoring)
  pgm.createIndex('audit_log', ['actor_did', 'created_at'], {
    where: "event_type = 'login' AND result = 'failure'",
    name: 'idx_audit_failed_logins',
  });
}

/**
 * Rollback migration: drop authentication tables.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('audit_log', { ifExists: true });
  pgm.dropTable('mfa_enrollments', { ifExists: true });
  pgm.dropTable('webauthn_credentials', { ifExists: true });
  pgm.dropTable('oauth_authorization_codes', { ifExists: true, cascade: true });
  pgm.dropTable('oauth_clients', { ifExists: true, cascade: true });
  pgm.dropTable('user_roles', { ifExists: true });
}
