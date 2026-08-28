/**
 * Make the governance audit log able to record administrative actions.
 *
 * @remarks
 * Two problems, and the first made the endpoint unusable outright:
 *
 * 1. `AdminService.getAuditLog` selects `g.target_did` and `g.ip_address`.
 *    Neither column exists, so `pub.chive.admin.getAuditLog` failed with
 *    `column g.target_did does not exist` on every call — the admin audit log
 *    has never returned a row.
 *
 * 2. The `action` CHECK constraint admits only `create`, `update` and `delete`,
 *    which are the governance record verbs. Administrative actions — granting a
 *    role, revoking one, deleting content — could not be recorded under a name
 *    that says what happened, so they were written to Redis instead and never
 *    reached the log the endpoint reads.
 *
 * Both new columns are nullable: governance rows written before this migration
 * have no actor address or target account, and back-filling a value would be
 * inventing one.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder } from 'node-pg-migrate';

/** Actions the log may record after this migration. */
const ACTIONS = [
  'create',
  'update',
  'delete',
  'assign_role',
  'revoke_role',
  'delete_content',
] as const;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('governance_audit_log', {
    target_did: { type: 'text', notNull: false },
    ip_address: { type: 'text', notNull: false },
  });

  pgm.createIndex('governance_audit_log', 'target_did');

  pgm.dropConstraint('governance_audit_log', 'check_action');
  pgm.addConstraint('governance_audit_log', 'check_action', {
    check: `action IN (${ACTIONS.map((a) => `'${a}'`).join(', ')})`,
  });
}

export function down(pgm: MigrationBuilder): void {
  // Rows recording the new actions cannot satisfy the narrower constraint, so
  // they are removed before it is restored. This loses audit history, which is
  // why the down migration exists only to make the up reversible in testing.
  pgm.sql(`DELETE FROM governance_audit_log WHERE action NOT IN ('create', 'update', 'delete')`);

  pgm.dropConstraint('governance_audit_log', 'check_action');
  pgm.addConstraint('governance_audit_log', 'check_action', {
    check: `action IN ('create', 'update', 'delete')`,
  });

  pgm.dropIndex('governance_audit_log', 'target_did');
  pgm.dropColumns('governance_audit_log', ['target_did', 'ip_address']);
}
