/**
 * Unit tests for XRPC trusted editor handlers.
 *
 * @remarks
 * Tests getEditorStatus, listTrustedEditors, requestElevation,
 * grantDelegation, revokeDelegation, and revokeRole handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getEditorStatusHandler } from '@/api/handlers/xrpc/governance/getEditorStatus.js';
import { grantDelegationHandler } from '@/api/handlers/xrpc/governance/grantDelegation.js';
import { listTrustedEditorsHandler } from '@/api/handlers/xrpc/governance/listTrustedEditors.js';
import { requestElevationHandler } from '@/api/handlers/xrpc/governance/requestElevation.js';
import { revokeDelegationHandler } from '@/api/handlers/xrpc/governance/revokeDelegation.js';
import { revokeRoleHandler } from '@/api/handlers/xrpc/governance/revokeRole.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

type GovernanceRole =
  | 'community-member'
  | 'trusted-editor'
  | 'authority-editor'
  | 'domain-expert'
  | 'administrator';

interface MockEditorStatus {
  did: DID;
  displayName?: string;
  role: GovernanceRole;
  roleGrantedAt?: number;
  roleGrantedBy?: string;
  hasDelegation: boolean;
  delegationExpiresAt?: number;
  delegationCollections?: string[];
  recordsCreatedToday: number;
  dailyRateLimit: number;
  metrics: {
    did: DID;
    accountCreatedAt: number;
    accountAgeDays: number;
    eprintCount: number;
    wellEndorsedEprintCount: number;
    totalEndorsements: number;
    proposalCount: number;
    voteCount: number;
    successfulProposals: number;
    warningCount: number;
    violationCount: number;
    reputationScore: number;
    role: GovernanceRole;
    eligibleForTrustedEditor: boolean;
    missingCriteria: string[];
  };
}

const createMockEditorStatus = (overrides?: Partial<MockEditorStatus>): MockEditorStatus => ({
  did: 'did:plc:user123' as DID,
  displayName: 'Test User',
  role: 'community-member',
  hasDelegation: false,
  recordsCreatedToday: 0,
  dailyRateLimit: 100,
  metrics: {
    did: 'did:plc:user123' as DID,
    accountCreatedAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
    accountAgeDays: 100,
    eprintCount: 15,
    wellEndorsedEprintCount: 12,
    totalEndorsements: 50,
    proposalCount: 10,
    voteCount: 25,
    successfulProposals: 8,
    warningCount: 0,
    violationCount: 0,
    reputationScore: 0.85,
    role: 'community-member',
    eligibleForTrustedEditor: true,
    missingCriteria: [],
  },
  ...overrides,
});

interface MockTrustedEditorService {
  getEditorStatus: ReturnType<typeof vi.fn>;
  listTrustedEditors: ReturnType<typeof vi.fn>;
  elevateToTrustedEditor: ReturnType<typeof vi.fn>;
  revokeRole: ReturnType<typeof vi.fn>;
}

interface MockGovernancePDSWriter {
  createDelegation: ReturnType<typeof vi.fn>;
  revokeDelegation: ReturnType<typeof vi.fn>;
}

const createMockTrustedEditorService = (): MockTrustedEditorService => ({
  getEditorStatus: vi.fn(),
  listTrustedEditors: vi.fn(),
  elevateToTrustedEditor: vi.fn(),
  revokeRole: vi.fn(),
});

const createMockGovernancePDSWriter = (): MockGovernancePDSWriter => ({
  createDelegation: vi.fn(),
  revokeDelegation: vi.fn(),
});

describe('XRPC Trusted Editor Handlers', () => {
  let mockLogger: ILogger;
  let mockTrustedEditorService: MockTrustedEditorService;
  let mockGovernancePDSWriter: MockGovernancePDSWriter;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockTrustedEditorService = createMockTrustedEditorService();
    mockGovernancePDSWriter = createMockGovernancePDSWriter();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              trustedEditor: mockTrustedEditorService,
              governancePdsWriter: mockGovernancePDSWriter,
            };
          case 'logger':
            return mockLogger;
          case 'user':
            return { did: 'did:plc:currentuser' as DID };
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  });

  describe('getEditorStatusHandler', () => {
    it('returns editor status for the current user when no DID specified', async () => {
      const status = createMockEditorStatus({ did: 'did:plc:currentuser' as DID });
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: status,
      });

      const result = await getEditorStatusHandler(
        mockContext as unknown as Parameters<typeof getEditorStatusHandler>[0],
        {}
      );

      expect(result.did).toBe('did:plc:currentuser');
      expect(result.role).toBe('community-member');
      expect(mockTrustedEditorService.getEditorStatus).toHaveBeenCalledWith('did:plc:currentuser');
    });

    it('returns editor status for a specific DID', async () => {
      const status = createMockEditorStatus({ did: 'did:plc:target' as DID });
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: status,
      });

      const result = await getEditorStatusHandler(
        mockContext as unknown as Parameters<typeof getEditorStatusHandler>[0],
        { did: 'did:plc:target' }
      );

      expect(result.did).toBe('did:plc:target');
      expect(mockTrustedEditorService.getEditorStatus).toHaveBeenCalledWith('did:plc:target');
    });

    it('throws NotFoundError when user not found', async () => {
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: false,
        error: new Error('User not found'),
      });

      await expect(
        getEditorStatusHandler(
          mockContext as unknown as Parameters<typeof getEditorStatusHandler>[0],
          { did: 'did:plc:nonexistent' }
        )
      ).rejects.toThrow();
    });

    it('includes delegation information for trusted editors', async () => {
      const status = createMockEditorStatus({
        role: 'trusted-editor',
        hasDelegation: true,
        delegationExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        delegationCollections: ['pub.chive.graph.authority'],
        recordsCreatedToday: 5,
        dailyRateLimit: 100,
      });
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: status,
      });

      const result = await getEditorStatusHandler(
        mockContext as unknown as Parameters<typeof getEditorStatusHandler>[0],
        {}
      );

      expect(result.role).toBe('trusted-editor');
      expect(result.hasDelegation).toBe(true);
      expect(result.delegationCollections).toContain('pub.chive.graph.authority');
    });

    it('includes eligibility information for community members', async () => {
      const status = createMockEditorStatus({
        metrics: {
          ...createMockEditorStatus().metrics,
          eligibleForTrustedEditor: false,
          missingCriteria: ['Need 10+ well-endorsed eprints'],
        },
      });
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: status,
      });

      const result = await getEditorStatusHandler(
        mockContext as unknown as Parameters<typeof getEditorStatusHandler>[0],
        {}
      );

      expect(result.metrics.eligibleForTrustedEditor).toBe(false);
      expect(result.metrics.missingCriteria).toContain('Need 10+ well-endorsed eprints');
    });
  });

  describe('listTrustedEditorsHandler', () => {
    it('returns list of trusted editors', async () => {
      const editors = [
        createMockEditorStatus({ did: 'did:plc:editor1' as DID, role: 'trusted-editor' }),
        createMockEditorStatus({ did: 'did:plc:editor2' as DID, role: 'administrator' }),
      ];
      mockTrustedEditorService.listTrustedEditors.mockResolvedValue({
        ok: true,
        value: { editors, cursor: undefined },
      });

      // Set admin user
      mockContext.get = vi.fn((key: string) => {
        if (key === 'services')
          return {
            trustedEditor: mockTrustedEditorService,
            governancePdsWriter: mockGovernancePDSWriter,
          };
        if (key === 'logger') return mockLogger;
        if (key === 'user') return { did: 'did:plc:admin' as DID };
        return undefined;
      });
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: createMockEditorStatus({ role: 'administrator' }),
      });

      const result = await listTrustedEditorsHandler(
        mockContext as unknown as Parameters<typeof listTrustedEditorsHandler>[0],
        { limit: 20 }
      );

      expect(result.editors).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('throws AuthorizationError for non-admin users', async () => {
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: createMockEditorStatus({ role: 'community-member' }),
      });

      await expect(
        listTrustedEditorsHandler(
          mockContext as unknown as Parameters<typeof listTrustedEditorsHandler>[0],
          { limit: 20 }
        )
      ).rejects.toThrow('Administrator access required');
    });

    it('filters by role', async () => {
      const editors = [
        createMockEditorStatus({ did: 'did:plc:editor1' as DID, role: 'trusted-editor' }),
      ];
      mockTrustedEditorService.listTrustedEditors.mockResolvedValue({
        ok: true,
        value: { editors, cursor: undefined },
      });
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: createMockEditorStatus({ role: 'administrator' }),
      });

      const result = await listTrustedEditorsHandler(
        mockContext as unknown as Parameters<typeof listTrustedEditorsHandler>[0],
        { limit: 20, role: 'trusted-editor' }
      );

      expect(result.editors[0]?.role).toBe('trusted-editor');
    });
  });

  describe('requestElevationHandler', () => {
    it('elevates eligible user to trusted editor', async () => {
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: createMockEditorStatus({
          role: 'community-member',
          metrics: {
            ...createMockEditorStatus().metrics,
            eligibleForTrustedEditor: true,
          },
        }),
      });
      mockTrustedEditorService.elevateToTrustedEditor.mockResolvedValue({
        ok: true,
        value: undefined,
      });

      const result = await requestElevationHandler(
        mockContext as unknown as Parameters<typeof requestElevationHandler>[0],
        { targetRole: 'trusted-editor' }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully elevated');
    });

    it('rejects ineligible user', async () => {
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: createMockEditorStatus({
          role: 'community-member',
          metrics: {
            ...createMockEditorStatus().metrics,
            eligibleForTrustedEditor: false,
            missingCriteria: ['Account age < 90 days', 'Need 10+ well-endorsed eprints'],
          },
        }),
      });

      const result = await requestElevationHandler(
        mockContext as unknown as Parameters<typeof requestElevationHandler>[0],
        { targetRole: 'trusted-editor' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Not yet eligible');
    });

    it('rejects user who already has the role', async () => {
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: createMockEditorStatus({ role: 'trusted-editor' }),
      });

      const result = await requestElevationHandler(
        mockContext as unknown as Parameters<typeof requestElevationHandler>[0],
        { targetRole: 'trusted-editor' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already have');
    });
  });

  describe('grantDelegationHandler', () => {
    beforeEach(() => {
      // Set admin context
      mockContext.get = vi.fn((key: string) => {
        if (key === 'services')
          return {
            trustedEditor: mockTrustedEditorService,
            governancePdsWriter: mockGovernancePDSWriter,
          };
        if (key === 'logger') return mockLogger;
        if (key === 'user') return { did: 'did:plc:admin' as DID };
        return undefined;
      });
    });

    it('grants delegation to trusted editor', async () => {
      mockTrustedEditorService.getEditorStatus
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({ role: 'administrator' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({
            did: 'did:plc:delegate' as DID,
            role: 'trusted-editor',
            hasDelegation: false,
          }),
        });
      mockGovernancePDSWriter.createDelegation.mockResolvedValue({
        ok: true,
        value: { id: 'delegation-123' },
      });

      const result = await grantDelegationHandler(
        mockContext as unknown as Parameters<typeof grantDelegationHandler>[0],
        {
          delegateDid: 'did:plc:delegate',
          collections: ['pub.chive.graph.authority'],
          daysValid: 365,
          maxRecordsPerDay: 100,
        }
      );

      expect(result.success).toBe(true);
      expect(result.delegationId).toBe('delegation-123');
    });

    it('rejects delegation to community member', async () => {
      mockTrustedEditorService.getEditorStatus
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({ role: 'administrator' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({
            did: 'did:plc:member' as DID,
            role: 'community-member',
          }),
        });

      await expect(
        grantDelegationHandler(
          mockContext as unknown as Parameters<typeof grantDelegationHandler>[0],
          {
            delegateDid: 'did:plc:member',
            collections: ['pub.chive.graph.authority'],
            daysValid: 365,
            maxRecordsPerDay: 100,
          }
        )
      ).rejects.toThrow('must have trusted editor or higher role');
    });

    it('rejects if delegate already has delegation', async () => {
      mockTrustedEditorService.getEditorStatus
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({ role: 'administrator' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({
            role: 'trusted-editor',
            hasDelegation: true,
          }),
        });

      const result = await grantDelegationHandler(
        mockContext as unknown as Parameters<typeof grantDelegationHandler>[0],
        {
          delegateDid: 'did:plc:delegate',
          collections: ['pub.chive.graph.authority'],
          daysValid: 365,
          maxRecordsPerDay: 100,
        }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already has an active delegation');
    });
  });

  describe('revokeDelegationHandler', () => {
    beforeEach(() => {
      mockContext.get = vi.fn((key: string) => {
        if (key === 'services')
          return {
            trustedEditor: mockTrustedEditorService,
            governancePdsWriter: mockGovernancePDSWriter,
          };
        if (key === 'logger') return mockLogger;
        if (key === 'user') return { did: 'did:plc:admin' as DID };
        return undefined;
      });
    });

    it('revokes delegation', async () => {
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: createMockEditorStatus({ role: 'administrator' }),
      });
      mockGovernancePDSWriter.revokeDelegation.mockResolvedValue({
        ok: true,
        value: undefined,
      });

      const result = await revokeDelegationHandler(
        mockContext as unknown as Parameters<typeof revokeDelegationHandler>[0],
        { delegationId: 'delegation-123' }
      );

      expect(result.success).toBe(true);
      expect(result.delegationId).toBe('delegation-123');
    });

    it('throws AuthorizationError for non-admin', async () => {
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: createMockEditorStatus({ role: 'trusted-editor' }),
      });

      await expect(
        revokeDelegationHandler(
          mockContext as unknown as Parameters<typeof revokeDelegationHandler>[0],
          { delegationId: 'delegation-123' }
        )
      ).rejects.toThrow('Administrator access required');
    });
  });

  describe('revokeRoleHandler', () => {
    beforeEach(() => {
      mockContext.get = vi.fn((key: string) => {
        if (key === 'services')
          return {
            trustedEditor: mockTrustedEditorService,
            governancePdsWriter: mockGovernancePDSWriter,
          };
        if (key === 'logger') return mockLogger;
        if (key === 'user') return { did: 'did:plc:admin' as DID };
        return undefined;
      });
    });

    it('revokes role from trusted editor', async () => {
      mockTrustedEditorService.getEditorStatus
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({ role: 'administrator' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({
            did: 'did:plc:target' as DID,
            role: 'trusted-editor',
          }),
        });
      mockTrustedEditorService.revokeRole.mockResolvedValue({
        ok: true,
        value: undefined,
      });

      const result = await revokeRoleHandler(
        mockContext as unknown as Parameters<typeof revokeRoleHandler>[0],
        { did: 'did:plc:target', reason: 'Violation of community guidelines' }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Role revoked');
    });

    it('prevents revoking own role', async () => {
      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: createMockEditorStatus({ role: 'administrator' }),
      });

      await expect(
        revokeRoleHandler(mockContext as unknown as Parameters<typeof revokeRoleHandler>[0], {
          did: 'did:plc:admin',
          reason: 'Testing',
        })
      ).rejects.toThrow('Cannot revoke your own role');
    });

    it('returns error for community member', async () => {
      mockTrustedEditorService.getEditorStatus
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({ role: 'administrator' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createMockEditorStatus({
            did: 'did:plc:member' as DID,
            role: 'community-member',
          }),
        });

      const result = await revokeRoleHandler(
        mockContext as unknown as Parameters<typeof revokeRoleHandler>[0],
        { did: 'did:plc:member', reason: 'Testing' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('does not have a special role');
    });
  });
});
