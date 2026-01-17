/**
 * Unit tests for XRPC governance admin handlers.
 *
 * @remarks
 * Tests listElevationRequests, approveElevation, rejectElevation, and listDelegations handlers.
 * Validates admin-only access and proper error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { approveElevationHandler } from '@/api/handlers/xrpc/governance/approveElevation.js';
import { listDelegationsHandler } from '@/api/handlers/xrpc/governance/listDelegations.js';
import { listElevationRequestsHandler } from '@/api/handlers/xrpc/governance/listElevationRequests.js';
import { rejectElevationHandler } from '@/api/handlers/xrpc/governance/rejectElevation.js';
import type { DID } from '@/types/atproto.js';
import { AuthenticationError, AuthorizationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const makeDID = (did: string): DID => did as DID;

interface MockTrustedEditorService {
  getEditorStatus: ReturnType<typeof vi.fn>;
  listElevationRequests: ReturnType<typeof vi.fn>;
  approveElevationRequest: ReturnType<typeof vi.fn>;
  rejectElevationRequest: ReturnType<typeof vi.fn>;
  listDelegations: ReturnType<typeof vi.fn>;
  calculateReputationMetrics: ReturnType<typeof vi.fn>;
}

const createMockTrustedEditorService = (): MockTrustedEditorService => ({
  getEditorStatus: vi.fn(),
  listElevationRequests: vi.fn(),
  approveElevationRequest: vi.fn(),
  rejectElevationRequest: vi.fn(),
  listDelegations: vi.fn(),
  calculateReputationMetrics: vi.fn(),
});

describe('XRPC Governance Admin Handlers', () => {
  let mockLogger: ILogger;
  let mockTrustedEditorService: MockTrustedEditorService;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockTrustedEditorService = createMockTrustedEditorService();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              trustedEditor: mockTrustedEditorService,
            };
          case 'logger':
            return mockLogger;
          case 'user':
            return { did: makeDID('did:plc:admin') };
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  });

  const setupAdminAuth = (): void => {
    mockTrustedEditorService.getEditorStatus.mockResolvedValue({
      ok: true,
      value: { role: 'administrator' },
    });
  };

  const setupNonAdminAuth = (): void => {
    mockTrustedEditorService.getEditorStatus.mockResolvedValue({
      ok: true,
      value: { role: 'trusted-editor' },
    });
  };

  describe('listElevationRequestsHandler', () => {
    it('returns list of pending elevation requests for admin', async () => {
      setupAdminAuth();

      const mockRequests = [
        {
          id: 'req-1',
          did: makeDID('did:plc:user1'),
          handle: 'alice.test',
          displayName: 'Alice',
          requestedRole: 'trusted-editor',
          currentRole: 'community-member',
          status: 'pending',
          requestedAt: Date.now(),
        },
      ];

      mockTrustedEditorService.listElevationRequests.mockResolvedValue({
        ok: true,
        value: {
          requests: mockRequests,
          total: 1,
        },
      });

      mockTrustedEditorService.calculateReputationMetrics.mockResolvedValue({
        ok: true,
        value: {
          did: 'did:plc:user1',
          accountAgeDays: 100,
          eprintCount: 15,
          wellEndorsedEprintCount: 12,
          totalEndorsements: 50,
          proposalCount: 25,
          voteCount: 30,
          successfulProposals: 20,
          warningCount: 0,
          violationCount: 0,
          reputationScore: 0.8,
          role: 'community-member',
          eligibleForTrustedEditor: true,
          missingCriteria: [],
        },
      });

      const result = await listElevationRequestsHandler(
        mockContext as unknown as Parameters<typeof listElevationRequestsHandler>[0],
        { limit: 20 }
      );

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.did).toBe('did:plc:user1');
      expect(result.requests[0]?.metrics).toBeDefined();
      expect(result.total).toBe(1);
    });

    it('throws AuthenticationError when not authenticated', async () => {
      mockContext.get = vi.fn((key: string) => {
        if (key === 'user') return undefined;
        if (key === 'logger') return mockLogger;
        if (key === 'services') return { trustedEditor: mockTrustedEditorService };
        return undefined;
      });

      await expect(
        listElevationRequestsHandler(
          mockContext as unknown as Parameters<typeof listElevationRequestsHandler>[0],
          { limit: 20 }
        )
      ).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthorizationError for non-admin users', async () => {
      setupNonAdminAuth();

      await expect(
        listElevationRequestsHandler(
          mockContext as unknown as Parameters<typeof listElevationRequestsHandler>[0],
          { limit: 20 }
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('throws error when service not configured', async () => {
      mockContext.get = vi.fn((key: string) => {
        if (key === 'user') return { did: makeDID('did:plc:admin') };
        if (key === 'logger') return mockLogger;
        if (key === 'services') return { trustedEditor: undefined };
        return undefined;
      });

      await expect(
        listElevationRequestsHandler(
          mockContext as unknown as Parameters<typeof listElevationRequestsHandler>[0],
          { limit: 20 }
        )
      ).rejects.toThrow('Trusted editor service not configured');
    });

    it('handles empty request list', async () => {
      setupAdminAuth();

      mockTrustedEditorService.listElevationRequests.mockResolvedValue({
        ok: true,
        value: {
          requests: [],
          total: 0,
        },
      });

      const result = await listElevationRequestsHandler(
        mockContext as unknown as Parameters<typeof listElevationRequestsHandler>[0],
        { limit: 20 }
      );

      expect(result.requests).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('approveElevationHandler', () => {
    it('approves elevation request successfully', async () => {
      setupAdminAuth();

      mockTrustedEditorService.approveElevationRequest.mockResolvedValue({
        ok: true,
        value: {
          requestId: 'req-1',
          message: 'Elevated to trusted-editor',
        },
      });

      const result = await approveElevationHandler(
        mockContext as unknown as Parameters<typeof approveElevationHandler>[0],
        { requestId: 'req-1', verificationNotes: 'Verified ORCID' }
      );

      expect(result.success).toBe(true);
      expect(result.requestId).toBe('req-1');
      expect(result.message).toContain('trusted-editor');
    });

    it('returns failure when service returns error', async () => {
      setupAdminAuth();

      mockTrustedEditorService.approveElevationRequest.mockResolvedValue({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Request not found' },
      });

      const result = await approveElevationHandler(
        mockContext as unknown as Parameters<typeof approveElevationHandler>[0],
        { requestId: 'nonexistent' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Request not found');
    });

    it('throws AuthenticationError when not authenticated', async () => {
      mockContext.get = vi.fn((key: string) => {
        if (key === 'user') return undefined;
        if (key === 'logger') return mockLogger;
        if (key === 'services') return { trustedEditor: mockTrustedEditorService };
        return undefined;
      });

      await expect(
        approveElevationHandler(
          mockContext as unknown as Parameters<typeof approveElevationHandler>[0],
          { requestId: 'req-1' }
        )
      ).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthorizationError for non-admin users', async () => {
      setupNonAdminAuth();

      await expect(
        approveElevationHandler(
          mockContext as unknown as Parameters<typeof approveElevationHandler>[0],
          { requestId: 'req-1' }
        )
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('rejectElevationHandler', () => {
    it('rejects elevation request with reason', async () => {
      setupAdminAuth();

      mockTrustedEditorService.rejectElevationRequest.mockResolvedValue({
        ok: true,
        value: {
          requestId: 'req-1',
          message: 'Elevation request rejected',
        },
      });

      const result = await rejectElevationHandler(
        mockContext as unknown as Parameters<typeof rejectElevationHandler>[0],
        { requestId: 'req-1', reason: 'Insufficient contribution history' }
      );

      expect(result.success).toBe(true);
      expect(result.requestId).toBe('req-1');
      expect(result.message).toBe('Elevation request rejected');
    });

    it('returns failure when service returns error', async () => {
      setupAdminAuth();

      mockTrustedEditorService.rejectElevationRequest.mockResolvedValue({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Request already processed' },
      });

      const result = await rejectElevationHandler(
        mockContext as unknown as Parameters<typeof rejectElevationHandler>[0],
        { requestId: 'req-1', reason: 'Reason' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already processed');
    });

    it('throws AuthenticationError when not authenticated', async () => {
      mockContext.get = vi.fn((key: string) => {
        if (key === 'user') return undefined;
        if (key === 'logger') return mockLogger;
        if (key === 'services') return { trustedEditor: mockTrustedEditorService };
        return undefined;
      });

      await expect(
        rejectElevationHandler(
          mockContext as unknown as Parameters<typeof rejectElevationHandler>[0],
          { requestId: 'req-1', reason: 'Reason' }
        )
      ).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthorizationError for non-admin users', async () => {
      setupNonAdminAuth();

      await expect(
        rejectElevationHandler(
          mockContext as unknown as Parameters<typeof rejectElevationHandler>[0],
          { requestId: 'req-1', reason: 'Reason' }
        )
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('listDelegationsHandler', () => {
    it('returns list of active delegations for admin', async () => {
      setupAdminAuth();

      const mockDelegations = [
        {
          id: 'del-1',
          delegateDid: makeDID('did:plc:delegate1'),
          handle: 'bob.test',
          displayName: 'Bob',
          collections: ['pub.chive.graph.fieldProposal'],
          expiresAt: Date.now() + 86400000,
          maxRecordsPerDay: 100,
          recordsCreatedToday: 5,
          grantedAt: Date.now(),
          grantedBy: makeDID('did:plc:admin'),
          active: true,
        },
      ];

      mockTrustedEditorService.listDelegations.mockResolvedValue({
        ok: true,
        value: {
          delegations: mockDelegations,
          total: 1,
        },
      });

      const result = await listDelegationsHandler(
        mockContext as unknown as Parameters<typeof listDelegationsHandler>[0],
        { limit: 20 }
      );

      expect(result.delegations).toHaveLength(1);
      expect(result.delegations[0]?.delegateDid).toBe('did:plc:delegate1');
      expect(result.delegations[0]?.collections).toContain('pub.chive.graph.fieldProposal');
      expect(result.total).toBe(1);
    });

    it('throws AuthenticationError when not authenticated', async () => {
      mockContext.get = vi.fn((key: string) => {
        if (key === 'user') return undefined;
        if (key === 'logger') return mockLogger;
        if (key === 'services') return { trustedEditor: mockTrustedEditorService };
        return undefined;
      });

      await expect(
        listDelegationsHandler(
          mockContext as unknown as Parameters<typeof listDelegationsHandler>[0],
          { limit: 20 }
        )
      ).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthorizationError for non-admin users', async () => {
      setupNonAdminAuth();

      await expect(
        listDelegationsHandler(
          mockContext as unknown as Parameters<typeof listDelegationsHandler>[0],
          { limit: 20 }
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('handles empty delegation list', async () => {
      setupAdminAuth();

      mockTrustedEditorService.listDelegations.mockResolvedValue({
        ok: true,
        value: {
          delegations: [],
          total: 0,
        },
      });

      const result = await listDelegationsHandler(
        mockContext as unknown as Parameters<typeof listDelegationsHandler>[0],
        { limit: 20 }
      );

      expect(result.delegations).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('handles pagination with cursor', async () => {
      setupAdminAuth();

      mockTrustedEditorService.listDelegations.mockResolvedValue({
        ok: true,
        value: {
          delegations: [],
          cursor: '20',
          total: 100,
        },
      });

      const result = await listDelegationsHandler(
        mockContext as unknown as Parameters<typeof listDelegationsHandler>[0],
        { limit: 20, cursor: '0' }
      );

      expect(result.cursor).toBe('20');
      expect(result.total).toBe(100);
    });
  });
});
