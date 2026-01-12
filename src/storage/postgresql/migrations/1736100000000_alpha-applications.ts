/**
 * Alpha tester applications table migration.
 *
 * @remarks
 * Creates the `alpha_applications` table for managing alpha tester signups.
 * Users apply via the frontend, applications are reviewed manually.
 *
 * @packageDocumentation
 */

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Apply migration: create alpha applications table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function up(pgm: MigrationBuilder): void {
  pgm.createTable('alpha_applications', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
      comment: 'Application ID',
    },
    did: {
      type: 'text',
      notNull: true,
      unique: true,
      comment: 'Applicant DID',
    },
    handle: {
      type: 'text',
      comment: 'Applicant handle at time of application',
    },
    email: {
      type: 'text',
      notNull: true,
      comment: 'Contact email for notifications',
    },
    sector: {
      type: 'text',
      notNull: true,
      comment:
        'Organization type (academia, industry, government, nonprofit, healthcare, independent, other)',
    },
    sector_other: {
      type: 'text',
      comment: 'Custom sector description if "other" selected',
    },
    career_stage: {
      type: 'text',
      notNull: true,
      comment: 'Career stage/position',
    },
    career_stage_other: {
      type: 'text',
      comment: 'Custom career stage description if "other" selected',
    },
    affiliation_name: {
      type: 'text',
      comment: 'Institutional affiliation name (optional)',
    },
    affiliation_ror_id: {
      type: 'text',
      comment: 'ROR ID for the affiliation (optional)',
    },
    research_field: {
      type: 'text',
      notNull: true,
      comment: 'Primary research field or discipline',
    },
    motivation: {
      type: 'text',
      comment: 'Optional motivation statement',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'approved', 'rejected')",
      comment: 'Application status',
    },
    zulip_invited: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether Zulip community invite was sent',
    },
    reviewed_at: {
      type: 'timestamptz',
      comment: 'When application was reviewed',
    },
    reviewed_by: {
      type: 'text',
      comment: 'DID of reviewer',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When application was submitted',
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
      comment: 'When application was last updated',
    },
  });

  pgm.createIndex('alpha_applications', 'status');
  pgm.createIndex('alpha_applications', 'did');
  pgm.createIndex('alpha_applications', 'created_at');
}

/**
 * Rollback migration: drop alpha applications table.
 *
 * @param pgm - PostgreSQL migration builder
 */
export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('alpha_applications', { ifExists: true });
}
