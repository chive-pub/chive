/**
 * A user with no granted governance role still gets a valid editor status.
 *
 * @remarks
 * `governance_roles` is LEFT JOINed, so its columns come back as `null` for
 * anyone who has never been granted a role — which is every user by default,
 * platform administrators included. The lexicon declares `roleGrantedBy` an
 * optional string, and `null` is not a string, so passing the column through
 * unguarded failed output validation and returned a 500.
 *
 * That made the governance admin dashboard unreachable for everyone: the
 * frontend reads the role from this endpoint, and a failed request leaves it
 * undefined, which reads as "not an administrator".
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';

import { TrustedEditorService } from '../../../../src/services/governance/trusted-editor-service.js';
import type { DID } from '../../../../src/types/atproto.js';

const ADMIN = 'did:plc:admin' as DID;

function build(roleRow: Record<string, unknown>) {
  const query = vi.fn().mockImplementation((sql: string) => {
    if (String(sql).includes('governance_delegations')) return Promise.resolve({ rows: [] });
    if (String(sql).includes('COALESCE(gr.role')) return Promise.resolve({ rows: [roleRow] });
    return Promise.resolve({ rows: [{}] });
  });
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  const service = new TrustedEditorService({
    pool: { query } as never,
    logger: logger as never,
    platformAdminDids: [ADMIN],
  });
  return { service };
}

describe('getEditorStatus with no granted role', () => {
  it('never emits null for an optional string the lexicon expects', async () => {
    const { service } = build({
      display_name: 'Ada',
      role: 'community-member',
      role_granted_at: null,
      role_granted_by: null,
      created_at: new Date('2026-01-01'),
    });

    const result = await service.getEditorStatus(ADMIN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // null would fail `Output/roleGrantedBy must be a string` at the boundary.
    expect(result.value.roleGrantedBy).toBeUndefined();
    expect(result.value.roleGrantedAt).toBeUndefined();
    expect(result.value.delegationCollections).toBeUndefined();
  });

  it('still promotes a platform admin who holds no stored role', async () => {
    const { service } = build({
      display_name: 'Ada',
      role: 'community-member',
      role_granted_at: null,
      role_granted_by: null,
      created_at: new Date('2026-01-01'),
    });

    const result = await service.getEditorStatus(ADMIN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The whole point of the platform-admin list: the first administrator of a
    // deployment exists before any elevation request can be approved.
    expect(result.value.role).toBe('administrator');
  });
});
