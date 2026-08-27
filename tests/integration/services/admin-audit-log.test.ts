/**
 * Admin audit log integration tests.
 *
 * @remarks
 * `pub.chive.admin.getAuditLog` failed on every call: the query selected
 * `g.target_did` and `g.ip_address`, and neither column existed. The failure was
 * swallowed by a catch that logged "table not available" and returned an empty
 * result, so the endpoint reported no audit entries and anyone investigating
 * was sent to look for a table that was there all along.
 *
 * Separately, the two actions an admin audit log exists for — granting a role
 * and deleting content — were written to Redis only and never reached it.
 *
 * These tests run against a real PostgreSQL because the bug was in SQL against
 * a real schema, which is exactly what a mocked pool cannot catch.
 *
 * @packageDocumentation
 */

import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { AdminService } from '@/services/admin/admin-service.js';
import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const ACTOR = 'did:plc:auditactortest';
const TARGET = 'did:plc:audittargettest';

function createLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

describe('admin audit log', () => {
  let pool: Pool;
  let admin: AdminService;

  beforeAll(() => {
    pool = new Pool(getDatabaseConfig());
    // Only the pool is exercised here; the other dependencies are not touched
    // by the audit-log paths.
    admin = new AdminService(pool, {} as never, {} as never, {} as never, createLogger());
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM governance_audit_log WHERE editor_did = $1`, [ACTOR]);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM governance_audit_log WHERE editor_did = $1`, [ACTOR]);
  });

  it('reads without throwing', async () => {
    // The regression: this used to fail on `column g.target_did does not exist`.
    await expect(admin.getAuditLog(10, 0)).resolves.toBeDefined();
  });

  it('records and returns a role grant', async () => {
    await admin.recordAuditEntry({
      action: 'assign_role',
      collection: 'chive.admin.role',
      uri: `did:role:${TARGET}:moderator`,
      actorDid: ACTOR,
      targetDid: TARGET,
      ipAddress: '203.0.113.7',
      details: { role: 'moderator' },
    });

    const { entries, total } = await admin.getAuditLog(10, 0, ACTOR);

    expect(total).toBe(1);
    expect(entries[0]?.action).toBe('assign_role');
    expect(entries[0]?.targetDid).toBe(TARGET);
    expect(entries[0]?.ipAddress).toBe('203.0.113.7');
    expect(entries[0]?.details).toMatchObject({ role: 'moderator' });
  });

  it('records a content deletion', async () => {
    await admin.recordAuditEntry({
      action: 'delete_content',
      collection: 'pub.chive.eprint.submission',
      uri: 'at://did:plc:someone/pub.chive.eprint.submission/abc',
      actorDid: ACTOR,
      details: { reason: 'spam', deleted: true },
    });

    const { entries } = await admin.getAuditLog(10, 0, ACTOR);
    expect(entries[0]?.action).toBe('delete_content');
    expect(entries[0]?.details).toMatchObject({ reason: 'spam' });
  });

  it('accepts an entry with no target or address', async () => {
    // Both columns are nullable on purpose: rows written before the migration
    // have neither, and inventing a value would be worse than recording none.
    await expect(
      admin.recordAuditEntry({
        action: 'delete_content',
        collection: 'pub.chive.review.comment',
        uri: 'at://did:plc:someone/pub.chive.review.comment/x',
        actorDid: ACTOR,
        details: {},
      })
    ).resolves.toBeUndefined();

    const { entries } = await admin.getAuditLog(10, 0, ACTOR);
    expect(entries[0]?.targetDid).toBeUndefined();
    expect(entries[0]?.ipAddress).toBeUndefined();
  });

  it('filters by actor', async () => {
    await admin.recordAuditEntry({
      action: 'assign_role',
      collection: 'chive.admin.role',
      uri: 'did:role:x:y',
      actorDid: ACTOR,
      details: {},
    });

    const mine = await admin.getAuditLog(10, 0, ACTOR);
    const other = await admin.getAuditLog(10, 0, 'did:plc:nobodyatall');

    expect(mine.total).toBe(1);
    expect(other.total).toBe(0);
  });

  it('orders newest first', async () => {
    for (const role of ['first', 'second', 'third']) {
      await admin.recordAuditEntry({
        action: 'assign_role',
        collection: 'chive.admin.role',
        uri: `did:role:${TARGET}:${role}`,
        actorDid: ACTOR,
        details: { role },
      });
    }

    const { entries } = await admin.getAuditLog(10, 0, ACTOR);
    expect(entries).toHaveLength(3);
    expect((entries[0]?.details as { role?: string })?.role).toBe('third');
  });
});
