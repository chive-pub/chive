/**
 * Integration tests for elevation request lifecycle.
 *
 * @remarks
 * Tests the full lifecycle of elevation requests from request to
 * approval/rejection by administrators.
 */

import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { TrustedEditorService } from '@/services/governance/trusted-editor-service.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// Skip if not in integration test environment
const SKIP_INTEGRATION = !process.env.DATABASE_URL || process.env.SKIP_INTEGRATION_TESTS === 'true';

const createMockLogger = (): ILogger => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => createMockLogger(),
});

const makeDID = (did: string): DID => did as DID;

describe.skipIf(SKIP_INTEGRATION)('Elevation Request Lifecycle', () => {
  let pool: Pool;
  let service: TrustedEditorService;
  let logger: ILogger;

  const adminDid = makeDID('did:plc:test-admin');
  const userDid = makeDID('did:plc:test-user');

  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    logger = createMockLogger();
    service = new TrustedEditorService({ pool, logger });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM elevation_requests WHERE did LIKE 'did:plc:test-%'`);
    await pool.query(`DELETE FROM governance_roles WHERE did LIKE 'did:plc:test-%'`);
    await pool.query(`DELETE FROM governance_delegations WHERE delegate_did LIKE 'did:plc:test-%'`);

    // Ensure admin exists with administrator role
    await pool.query(
      `
      INSERT INTO authors_index (did, handle, display_name, indexed_at, pds_url)
      VALUES ($1, 'admin.test', 'Test Admin', NOW(), 'https://test.pds')
      ON CONFLICT (did) DO NOTHING
    `,
      [adminDid]
    );

    // Deactivate any existing roles first, then insert the admin role
    await pool.query(
      `
      UPDATE governance_roles SET active = false WHERE did = $1
    `,
      [adminDid]
    );
    await pool.query(
      `
      INSERT INTO governance_roles (id, did, role, granted_at, granted_by, active)
      VALUES (gen_random_uuid(), $1, 'administrator', NOW(), $1, true)
    `,
      [adminDid]
    );

    // Ensure test user exists
    await pool.query(
      `
      INSERT INTO authors_index (did, handle, display_name, indexed_at, pds_url)
      VALUES ($1, 'user.test', 'Test User', NOW() - INTERVAL '180 days', 'https://test.pds')
      ON CONFLICT (did) DO NOTHING
    `,
      [userDid]
    );
  });

  describe('elevation request creation and listing', () => {
    it('creates and lists elevation requests', async () => {
      // Create elevation request
      // Note: current_role is a PostgreSQL reserved keyword, must be quoted
      await pool.query(
        `
        INSERT INTO elevation_requests (
          id, did, requested_role, "current_role", status, requested_at
        ) VALUES (
          gen_random_uuid(), $1, 'trusted-editor', 'community-member', 'pending', NOW()
        )
      `,
        [userDid]
      );

      // List pending requests
      const result = await service.listElevationRequests(20);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const userRequest = result.value.requests.find((r) => r.did === userDid);
        expect(userRequest).toBeDefined();
        expect(userRequest?.requestedRole).toBe('trusted-editor');
        expect(userRequest?.currentRole).toBe('community-member');
        expect(userRequest?.status).toBe('pending');
      }
    });

    it('does not return already processed requests', async () => {
      // Create approved request
      await pool.query(
        `
        INSERT INTO elevation_requests (
          id, did, requested_role, "current_role", status, requested_at, processed_at
        ) VALUES (
          gen_random_uuid(), $1, 'trusted-editor', 'community-member', 'approved', NOW(), NOW()
        )
      `,
        [userDid]
      );

      const result = await service.listElevationRequests(20);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const userRequest = result.value.requests.find((r) => r.did === userDid);
        expect(userRequest).toBeUndefined();
      }
    });
  });

  describe('elevation request approval', () => {
    it('approves request and grants role', async () => {
      // Create pending request
      const requestId = crypto.randomUUID();
      await pool.query(
        `
        INSERT INTO elevation_requests (
          id, did, requested_role, "current_role", status, requested_at
        ) VALUES (
          $1, $2, 'trusted-editor', 'community-member', 'pending', NOW()
        )
      `,
        [requestId, userDid]
      );

      // Approve the request
      const result = await service.approveElevationRequest(
        requestId,
        adminDid,
        'Verified contributions'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.message).toContain('trusted-editor');
      }

      // Verify request was updated
      const requestResult = await pool.query(
        `
        SELECT status, processed_by, verification_notes
        FROM elevation_requests WHERE id = $1
      `,
        [requestId]
      );

      expect(requestResult.rows[0]?.status).toBe('approved');
      expect(requestResult.rows[0]?.processed_by).toBe(adminDid);
      expect(requestResult.rows[0]?.verification_notes).toBe('Verified contributions');

      // Verify role was granted
      const roleResult = await pool.query(
        `
        SELECT role FROM governance_roles WHERE did = $1 AND active = true
      `,
        [userDid]
      );

      expect(roleResult.rows[0]?.role).toBe('trusted-editor');
    });

    it('returns error for already approved request', async () => {
      const requestId = crypto.randomUUID();
      await pool.query(
        `
        INSERT INTO elevation_requests (
          id, did, requested_role, "current_role", status, requested_at, processed_at
        ) VALUES (
          $1, $2, 'trusted-editor', 'community-member', 'approved', NOW(), NOW()
        )
      `,
        [requestId, userDid]
      );

      const result = await service.approveElevationRequest(requestId, adminDid);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('already been approved');
      }
    });

    it('returns error for non-existent request', async () => {
      // Use a valid UUID format that doesn't exist in the database
      const nonExistentId = crypto.randomUUID();
      const result = await service.approveElevationRequest(nonExistentId, adminDid);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('elevation request rejection', () => {
    it('rejects request with reason', async () => {
      const requestId = crypto.randomUUID();
      await pool.query(
        `
        INSERT INTO elevation_requests (
          id, did, requested_role, "current_role", status, requested_at
        ) VALUES (
          $1, $2, 'trusted-editor', 'community-member', 'pending', NOW()
        )
      `,
        [requestId, userDid]
      );

      const result = await service.rejectElevationRequest(
        requestId,
        adminDid,
        'Insufficient contribution history'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.message).toBe('Elevation request rejected');
      }

      // Verify request was updated
      const requestResult = await pool.query(
        `
        SELECT status, processed_by, rejection_reason
        FROM elevation_requests WHERE id = $1
      `,
        [requestId]
      );

      expect(requestResult.rows[0]?.status).toBe('rejected');
      expect(requestResult.rows[0]?.processed_by).toBe(adminDid);
      expect(requestResult.rows[0]?.rejection_reason).toBe('Insufficient contribution history');

      // Verify role was NOT granted
      const roleResult = await pool.query(
        `
        SELECT role FROM governance_roles WHERE did = $1 AND active = true
      `,
        [userDid]
      );

      expect(roleResult.rows.length).toBe(0);
    });

    it('returns error for already rejected request', async () => {
      const requestId = crypto.randomUUID();
      await pool.query(
        `
        INSERT INTO elevation_requests (
          id, did, requested_role, "current_role", status, requested_at, processed_at
        ) VALUES (
          $1, $2, 'trusted-editor', 'community-member', 'rejected', NOW(), NOW()
        )
      `,
        [requestId, userDid]
      );

      const result = await service.rejectElevationRequest(requestId, adminDid, 'Another reason');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('already been rejected');
      }
    });
  });
});

describe.skipIf(SKIP_INTEGRATION)('Delegation Lifecycle', () => {
  let pool: Pool;
  let service: TrustedEditorService;
  let logger: ILogger;

  const adminDid = makeDID('did:plc:test-admin-del');
  const delegateDid = makeDID('did:plc:test-delegate');

  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    logger = createMockLogger();
    service = new TrustedEditorService({ pool, logger });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM governance_delegations WHERE delegate_did LIKE 'did:plc:test-%'`);
    await pool.query(`DELETE FROM governance_roles WHERE did LIKE 'did:plc:test-%'`);

    // Ensure delegate user exists
    await pool.query(
      `
      INSERT INTO authors_index (did, handle, display_name, indexed_at, pds_url)
      VALUES ($1, 'delegate.test', 'Test Delegate', NOW(), 'https://test.pds')
      ON CONFLICT (did) DO NOTHING
    `,
      [delegateDid]
    );
  });

  describe('delegation grant', () => {
    it('grants delegation with expiration', async () => {
      const result = await service.grantDelegation(
        delegateDid,
        ['pub.chive.graph.fieldProposal'],
        30, // 30 days
        adminDid
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.delegationId).toBeDefined();
        expect(result.value.message).toContain('30 days');
      }

      // Verify delegation was created
      const delResult = await pool.query(
        `
        SELECT * FROM governance_delegations WHERE delegate_did = $1 AND active = true
      `,
        [delegateDid]
      );

      expect(delResult.rows.length).toBe(1);
      expect(delResult.rows[0]?.collections).toContain('pub.chive.graph.fieldProposal');
      expect(delResult.rows[0]?.granted_by).toBe(adminDid);
    });

    it('lists active delegations', async () => {
      // Create delegation
      await service.grantDelegation(delegateDid, ['pub.chive.graph.fieldProposal'], 30, adminDid);

      const result = await service.listDelegations(20);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const delegation = result.value.delegations.find((d) => d.delegateDid === delegateDid);
        expect(delegation).toBeDefined();
        expect(delegation?.collections).toContain('pub.chive.graph.fieldProposal');
        expect(delegation?.active).toBe(true);
      }
    });

    it('does not list expired delegations', async () => {
      // Create expired delegation directly in DB
      await pool.query(
        `
        INSERT INTO governance_delegations (
          id, delegate_did, collections, expires_at, max_records_per_day,
          records_created_today, last_reset_date, granted_at, granted_by, active
        ) VALUES (
          gen_random_uuid(), $1, $2, NOW() - INTERVAL '1 day', 100, 0, CURRENT_DATE::text, NOW(), $3, true
        )
      `,
        [delegateDid, ['pub.chive.graph.fieldProposal'], adminDid]
      );

      const result = await service.listDelegations(20);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const delegation = result.value.delegations.find((d) => d.delegateDid === delegateDid);
        expect(delegation).toBeUndefined();
      }
    });
  });

  describe('delegation revocation', () => {
    it('revokes active delegation', async () => {
      // Create delegation
      const grantResult = await service.grantDelegation(
        delegateDid,
        ['pub.chive.graph.fieldProposal'],
        30,
        adminDid
      );

      expect(grantResult.ok).toBe(true);
      if (!grantResult.ok) return;

      // Revoke it
      const revokeResult = await service.revokeDelegation(grantResult.value.delegationId, adminDid);

      expect(revokeResult.ok).toBe(true);
      if (revokeResult.ok) {
        expect(revokeResult.value.message).toBe('Delegation revoked');
      }

      // Verify delegation is inactive
      const delResult = await pool.query(
        `
        SELECT active FROM governance_delegations WHERE id = $1
      `,
        [grantResult.value.delegationId]
      );

      expect(delResult.rows[0]?.active).toBe(false);
    });

    it('returns error for non-existent delegation', async () => {
      const result = await service.revokeDelegation('nonexistent-id', adminDid);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('not found');
      }
    });

    it('returns error for already revoked delegation', async () => {
      // Create and immediately revoke delegation
      const grantResult = await service.grantDelegation(
        delegateDid,
        ['pub.chive.graph.fieldProposal'],
        30,
        adminDid
      );

      expect(grantResult.ok).toBe(true);
      if (!grantResult.ok) return;

      await service.revokeDelegation(grantResult.value.delegationId, adminDid);

      // Try to revoke again
      const secondRevokeResult = await service.revokeDelegation(
        grantResult.value.delegationId,
        adminDid
      );

      expect(secondRevokeResult.ok).toBe(false);
      if (!secondRevokeResult.ok) {
        expect(secondRevokeResult.error.message).toContain('already revoked');
      }
    });
  });
});
