/**
 * Migration: Governance roles and delegations.
 *
 * @remarks
 * Adds tables for trusted editor management, delegation tracking,
 * and governance audit logging.
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  // Governance roles table
  pgm.createTable('governance_roles', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    did: {
      type: 'text',
      notNull: true,
    },
    role: {
      type: 'text',
      notNull: true,
    },
    granted_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    granted_by: {
      type: 'text',
    },
    verification_notes: {
      type: 'text',
    },
    active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    revoked_at: {
      type: 'timestamptz',
    },
    revoked_by: {
      type: 'text',
    },
    revocation_reason: {
      type: 'text',
    },
  });

  pgm.addConstraint('governance_roles', 'check_role', {
    check: `role IN ('community-member', 'trusted-editor', 'authority-editor', 'domain-expert', 'administrator')`,
  });

  pgm.createIndex('governance_roles', 'did');
  pgm.createIndex('governance_roles', 'role', { where: 'active = true' });
  pgm.createIndex('governance_roles', 'active');

  // Governance delegations table
  pgm.createTable('governance_delegations', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    delegate_did: {
      type: 'text',
      notNull: true,
    },
    collections: {
      type: 'text[]',
      notNull: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    max_records_per_day: {
      type: 'integer',
      notNull: true,
      default: 100,
    },
    records_created_today: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    last_reset_date: {
      type: 'text',
      notNull: true,
    },
    granted_by: {
      type: 'text',
      notNull: true,
    },
    granted_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    revoked_at: {
      type: 'timestamptz',
    },
    revoked_by: {
      type: 'text',
    },
  });

  pgm.createIndex('governance_delegations', 'delegate_did');
  pgm.createIndex('governance_delegations', ['active', 'expires_at']);

  // Governance audit log table
  pgm.createTable('governance_audit_log', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    action: {
      type: 'text',
      notNull: true,
    },
    collection: {
      type: 'text',
      notNull: true,
    },
    uri: {
      type: 'text',
      notNull: true,
    },
    editor_did: {
      type: 'text',
      notNull: true,
    },
    record_snapshot: {
      type: 'jsonb',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('governance_audit_log', 'check_action', {
    check: `action IN ('create', 'update', 'delete')`,
  });

  pgm.createIndex('governance_audit_log', 'editor_did');
  pgm.createIndex('governance_audit_log', 'collection');
  pgm.createIndex('governance_audit_log', 'created_at', { method: 'btree' });

  // User warnings table
  pgm.createTable('user_warnings', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    user_did: {
      type: 'text',
      notNull: true,
    },
    reason: {
      type: 'text',
      notNull: true,
    },
    issued_by: {
      type: 'text',
      notNull: true,
    },
    issued_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    expires_at: {
      type: 'timestamptz',
    },
    active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    resolved_at: {
      type: 'timestamptz',
    },
    resolved_by: {
      type: 'text',
    },
  });

  pgm.createIndex('user_warnings', 'user_did');
  pgm.createIndex('user_warnings', 'active');

  // User violations table
  pgm.createTable('user_violations', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    user_did: {
      type: 'text',
      notNull: true,
    },
    violation_type: {
      type: 'text',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: true,
    },
    issued_by: {
      type: 'text',
      notNull: true,
    },
    issued_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    related_uri: {
      type: 'text',
    },
  });

  pgm.createIndex('user_violations', 'user_did');

  // Field proposals index (if not exists)
  pgm.createTable(
    'field_proposals_index',
    {
      uri: {
        type: 'text',
        primaryKey: true,
      },
      cid: {
        type: 'text',
        notNull: true,
      },
      proposer_did: {
        type: 'text',
        notNull: true,
      },
      field_id: {
        type: 'text',
      },
      action: {
        type: 'text',
        notNull: true,
      },
      status: {
        type: 'text',
        notNull: true,
        default: 'pending',
      },
      title: {
        type: 'text',
        notNull: true,
      },
      description: {
        type: 'text',
      },
      pds_url: {
        type: 'text',
        notNull: true,
      },
      indexed_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
      },
      last_synced_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
      },
    },
    { ifNotExists: true }
  );

  // Add constraints only if they don't exist
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE field_proposals_index
        ADD CONSTRAINT check_action CHECK (action IN ('create', 'update', 'merge', 'delete'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE field_proposals_index
        ADD CONSTRAINT check_status CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  pgm.createIndex('field_proposals_index', 'proposer_did', { ifNotExists: true });
  pgm.createIndex('field_proposals_index', 'status', { ifNotExists: true });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('governance_audit_log', { ifExists: true });
  pgm.dropTable('governance_delegations', { ifExists: true });
  pgm.dropTable('governance_roles', { ifExists: true });
  pgm.dropTable('user_warnings', { ifExists: true });
  pgm.dropTable('user_violations', { ifExists: true });
  // Don't drop field_proposals_index as it may have data
}
