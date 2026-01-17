/**
 * Unit tests for TrustedEditorService.
 *
 * @remarks
 * Tests elevation request handling, delegation management, and role operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { TrustedEditorService } from '@/services/governance/trusted-editor-service.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// Mock pg Pool
const createMockPool = (): { query: ReturnType<typeof vi.fn> } => ({
  query: vi.fn(),
});

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const makeDID = (did: string): DID => did as DID;

describe('TrustedEditorService', () => {
  let service: TrustedEditorService;
  let mockPool: ReturnType<typeof createMockPool>;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockPool = createMockPool();
    mockLogger = createMockLogger();
    service = new TrustedEditorService({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pool: mockPool as any,
      logger: mockLogger,
    });
  });

  describe('listElevationRequests', () => {
    it('returns empty array when no pending requests', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Main query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Count query

      const result = await service.listElevationRequests(20);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requests).toHaveLength(0);
        expect(result.value.total).toBe(0);
      }
    });

    it('returns pending elevation requests with user data', async () => {
      const now = new Date();
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'req-1',
              did: 'did:plc:user1',
              requested_role: 'trusted-editor',
              current_role: 'community-member',
              status: 'pending',
              verification_notes: null,
              rejection_reason: null,
              requested_at: now,
              processed_at: null,
              processed_by: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({
          rows: [{ handle: 'alice.test', display_name: 'Alice' }],
        });

      const result = await service.listElevationRequests(20);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requests).toHaveLength(1);
        expect(result.value.requests[0]?.did).toBe('did:plc:user1');
        expect(result.value.requests[0]?.requestedRole).toBe('trusted-editor');
        expect(result.value.requests[0]?.handle).toBe('alice.test');
        expect(result.value.requests[0]?.displayName).toBe('Alice');
        expect(result.value.total).toBe(1);
      }
    });

    it('handles pagination with cursor', async () => {
      const now = new Date();
      // Return more items than limit to trigger cursor
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'req-1',
              did: 'did:plc:user1',
              requested_role: 'trusted-editor',
              current_role: 'community-member',
              status: 'pending',
              verification_notes: null,
              rejection_reason: null,
              requested_at: now,
              processed_at: null,
              processed_by: null,
            },
            {
              id: 'req-2',
              did: 'did:plc:user2',
              requested_role: 'trusted-editor',
              current_role: 'community-member',
              status: 'pending',
              verification_notes: null,
              rejection_reason: null,
              requested_at: now,
              processed_at: null,
              processed_by: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ handle: 'alice.test', display_name: 'Alice' }] });

      const result = await service.listElevationRequests(1, '0');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requests).toHaveLength(1);
        expect(result.value.cursor).toBe('1');
        expect(result.value.total).toBe(5);
      }
    });

    it('returns error on database failure', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.listElevationRequests(20);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  describe('approveElevationRequest', () => {
    const adminDid = makeDID('did:plc:admin');
    const requestId = 'req-123';

    it('approves pending request and grants role', async () => {
      // Mock getEditorStatus for existing user
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: requestId,
              did: 'did:plc:user1',
              requested_role: 'trusted-editor',
              status: 'pending',
            },
          ],
        })
        // setRole INSERT
        .mockResolvedValueOnce({ rows: [] })
        // Update elevation_requests
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.approveElevationRequest(
        requestId,
        adminDid,
        'Verified credentials'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requestId).toBe(requestId);
        expect(result.value.message).toContain('trusted-editor');
      }
    });

    it('returns error for non-existent request', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.approveElevationRequest('nonexistent', adminDid);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns error for already processed request', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: requestId,
            did: 'did:plc:user1',
            requested_role: 'trusted-editor',
            status: 'approved', // Already approved
          },
        ],
      });

      const result = await service.approveElevationRequest(requestId, adminDid);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('already been approved');
      }
    });

    it('handles database error during approval', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: requestId,
              did: 'did:plc:user1',
              requested_role: 'trusted-editor',
              status: 'pending',
            },
          ],
        })
        .mockRejectedValueOnce(new Error('Database write failed'));

      const result = await service.approveElevationRequest(requestId, adminDid);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  describe('rejectElevationRequest', () => {
    const adminDid = makeDID('did:plc:admin');
    const requestId = 'req-456';

    it('rejects pending request with reason', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: requestId,
              did: 'did:plc:user1',
              requested_role: 'trusted-editor',
              status: 'pending',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // Update query

      const result = await service.rejectElevationRequest(
        requestId,
        adminDid,
        'Insufficient contributions'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requestId).toBe(requestId);
        expect(result.value.message).toBe('Elevation request rejected');
      }
    });

    it('returns error for non-existent request', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.rejectElevationRequest('nonexistent', adminDid, 'Reason');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns error for already rejected request', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: requestId,
            did: 'did:plc:user1',
            requested_role: 'trusted-editor',
            status: 'rejected',
          },
        ],
      });

      const result = await service.rejectElevationRequest(requestId, adminDid, 'Reason');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('already been rejected');
      }
    });
  });

  describe('listDelegations', () => {
    it('returns empty array when no active delegations', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await service.listDelegations(20);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.delegations).toHaveLength(0);
        expect(result.value.total).toBe(0);
      }
    });

    it('returns active delegations with user data', async () => {
      const now = new Date();
      const expiresAt = new Date(Date.now() + 86400000); // 1 day from now

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'del-1',
              delegate_did: 'did:plc:delegate1',
              collections: ['pub.chive.graph.fieldProposal'],
              expires_at: expiresAt,
              max_records_per_day: 100,
              records_created_today: 5,
              granted_at: now,
              granted_by: 'did:plc:admin',
              active: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({
          rows: [{ handle: 'bob.test', display_name: 'Bob' }],
        });

      const result = await service.listDelegations(20);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.delegations).toHaveLength(1);
        expect(result.value.delegations[0]?.delegateDid).toBe('did:plc:delegate1');
        expect(result.value.delegations[0]?.collections).toContain('pub.chive.graph.fieldProposal');
        expect(result.value.delegations[0]?.handle).toBe('bob.test');
        expect(result.value.delegations[0]?.active).toBe(true);
        expect(result.value.total).toBe(1);
      }
    });

    it('handles pagination correctly', async () => {
      const now = new Date();
      const expiresAt = new Date(Date.now() + 86400000);

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'del-1',
              delegate_did: 'did:plc:delegate1',
              collections: ['pub.chive.graph.fieldProposal'],
              expires_at: expiresAt,
              max_records_per_day: 100,
              records_created_today: 0,
              granted_at: now,
              granted_by: 'did:plc:admin',
              active: true,
            },
            {
              id: 'del-2',
              delegate_did: 'did:plc:delegate2',
              collections: ['pub.chive.graph.fieldProposal'],
              expires_at: expiresAt,
              max_records_per_day: 100,
              records_created_today: 0,
              granted_at: now,
              granted_by: 'did:plc:admin',
              active: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ handle: 'bob.test', display_name: 'Bob' }] });

      const result = await service.listDelegations(1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.delegations).toHaveLength(1);
        expect(result.value.cursor).toBe('1');
      }
    });
  });

  describe('grantDelegation', () => {
    const delegateDid = makeDID('did:plc:delegate');
    const grantedBy = makeDID('did:plc:admin');

    it('creates new delegation', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.grantDelegation(
        delegateDid,
        ['pub.chive.graph.fieldProposal'],
        30, // 30 days
        grantedBy
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.delegationId).toBeDefined();
        expect(result.value.message).toContain('30 days');
      }

      // Verify INSERT was called with correct params
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO governance_delegations'),
        expect.arrayContaining([
          expect.any(String), // delegationId
          delegateDid,
          ['pub.chive.graph.fieldProposal'],
          expect.any(Date), // expiresAt
          grantedBy,
        ])
      );
    });

    it('handles database error', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Insert failed'));

      const result = await service.grantDelegation(
        delegateDid,
        ['pub.chive.graph.fieldProposal'],
        30,
        grantedBy
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  describe('revokeDelegation', () => {
    const revokedBy = makeDID('did:plc:admin');
    const validDelegationId = '01234567-89ab-cdef-0123-456789abcdef';
    const validDelegationId2 = '11111111-2222-3333-4444-555555555555';

    it('revokes active delegation', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: validDelegationId }] });

      const result = await service.revokeDelegation(validDelegationId, revokedBy);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.message).toBe('Delegation revoked');
      }
    });

    it('returns error for non-existent delegation', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const result = await service.revokeDelegation(validDelegationId2, revokedBy);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('not found or already revoked');
      }
    });

    it('returns error for invalid delegation ID format', async () => {
      const result = await service.revokeDelegation('invalid-id', revokedBy);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('not found or already revoked');
      }
    });

    it('handles database error', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Update failed'));

      const result = await service.revokeDelegation(validDelegationId, revokedBy);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });
});
