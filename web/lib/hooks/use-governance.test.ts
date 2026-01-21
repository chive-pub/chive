/**
 * Unit tests for governance hooks.
 *
 * @remarks
 * Tests for trusted editor status hooks, list editors, request elevation,
 * grant delegation, revoke delegation, and revoke role mutations.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';

import {
  governanceKeys,
  useMyEditorStatus,
  useEditorStatus,
  useTrustedEditors,
  useRequestElevation,
  useGrantDelegation,
  useRevokeDelegation,
  useRevokeRole,
  GOVERNANCE_ROLE_LABELS,
} from './use-governance';

// Mock functions using vi.hoisted for proper hoisting
const {
  mockGetEditorStatus,
  mockAuthGetEditorStatus,
  mockListTrustedEditors,
  mockRequestElevation,
  mockGrantDelegation,
  mockRevokeDelegation,
  mockRevokeRole,
} = vi.hoisted(() => ({
  mockGetEditorStatus: vi.fn(),
  mockAuthGetEditorStatus: vi.fn(),
  mockListTrustedEditors: vi.fn(),
  mockRequestElevation: vi.fn(),
  mockGrantDelegation: vi.fn(),
  mockRevokeDelegation: vi.fn(),
  mockRevokeRole: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        governance: {
          getEditorStatus: mockGetEditorStatus,
          requestElevation: mockRequestElevation,
          grantDelegation: mockGrantDelegation,
          revokeDelegation: mockRevokeDelegation,
          revokeRole: mockRevokeRole,
        },
      },
    },
  },
  authApi: {
    pub: {
      chive: {
        governance: {
          getEditorStatus: mockAuthGetEditorStatus,
          listTrustedEditors: mockListTrustedEditors,
        },
      },
    },
  },
}));

const createMockEditorStatus = (overrides = {}) => ({
  did: 'did:plc:user123',
  displayName: 'Test User',
  role: 'community-member' as const,
  hasDelegation: false,
  recordsCreatedToday: 0,
  dailyRateLimit: 100,
  metrics: {
    did: 'did:plc:user123',
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
    role: 'community-member' as const,
    eligibleForTrustedEditor: true,
    missingCriteria: [],
  },
  ...overrides,
});

const createMockTrustedEditorsResponse = (editors = [createMockEditorStatus()]) => ({
  editors,
  cursor: undefined,
  total: editors.length,
});

describe('governanceKeys', () => {
  it('generates all key', () => {
    expect(governanceKeys.all).toEqual(['governance']);
  });

  it('generates trustedEditors key', () => {
    expect(governanceKeys.trustedEditors()).toEqual(['governance', 'trusted-editors']);
  });

  it('generates trustedEditorsList key', () => {
    expect(governanceKeys.trustedEditorsList()).toEqual([
      'governance',
      'trusted-editors',
      'list',
      undefined,
    ]);
  });

  it('generates trustedEditorsList key with params', () => {
    const params = { role: 'trusted-editor' as const, limit: 20 };
    expect(governanceKeys.trustedEditorsList(params)).toEqual([
      'governance',
      'trusted-editors',
      'list',
      params,
    ]);
  });

  it('generates editorStatus key', () => {
    const did = 'did:plc:user123';
    expect(governanceKeys.editorStatus(did)).toEqual([
      'governance',
      'trusted-editors',
      'status',
      did,
    ]);
  });

  it('generates myEditorStatus key', () => {
    expect(governanceKeys.myEditorStatus()).toEqual(['governance', 'trusted-editors', 'my-status']);
  });
});

describe('useMyEditorStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches current user editor status', async () => {
    const mockStatus = createMockEditorStatus();
    mockAuthGetEditorStatus.mockResolvedValueOnce({
      data: mockStatus,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMyEditorStatus(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockStatus);
    expect(mockAuthGetEditorStatus).toHaveBeenCalledWith({});
  });

  it('can be disabled via options', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMyEditorStatus({ enabled: false }), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockAuthGetEditorStatus).not.toHaveBeenCalled();
  });

  it('includes metrics in response', async () => {
    const mockStatus = createMockEditorStatus({
      metrics: {
        did: 'did:plc:user123',
        accountAgeDays: 100,
        eprintCount: 15,
        eligibleForTrustedEditor: true,
        missingCriteria: [],
        reputationScore: 0.85,
        accountCreatedAt: Date.now(),
        wellEndorsedEprintCount: 12,
        totalEndorsements: 50,
        proposalCount: 10,
        voteCount: 25,
        successfulProposals: 8,
        warningCount: 0,
        violationCount: 0,
        role: 'community-member' as const,
      },
    });
    mockAuthGetEditorStatus.mockResolvedValueOnce({
      data: mockStatus,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMyEditorStatus(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.metrics.eligibleForTrustedEditor).toBe(true);
    expect(result.current.data?.metrics.reputationScore).toBe(0.85);
  });
});

describe('useEditorStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches editor status for specific DID', async () => {
    const targetDid = 'did:plc:target';
    const mockStatus = createMockEditorStatus({ did: targetDid });
    mockGetEditorStatus.mockResolvedValueOnce({
      data: mockStatus,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEditorStatus(targetDid), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockStatus);
    expect(mockGetEditorStatus).toHaveBeenCalledWith({
      did: targetDid,
    });
  });

  it('is disabled when DID is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useEditorStatus(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetEditorStatus).not.toHaveBeenCalled();
  });
});

describe('useTrustedEditors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches list of trusted editors', async () => {
    const mockResponse = createMockTrustedEditorsResponse([
      createMockEditorStatus({ role: 'trusted-editor' }),
      createMockEditorStatus({ did: 'did:plc:admin', role: 'administrator' }),
    ]);
    mockListTrustedEditors.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrustedEditors(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.editors).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
    expect(mockListTrustedEditors).toHaveBeenCalledWith({
      limit: 20,
      cursor: undefined,
      role: undefined,
    });
  });

  it('filters by role', async () => {
    const mockResponse = createMockTrustedEditorsResponse([
      createMockEditorStatus({ role: 'trusted-editor' }),
    ]);
    mockListTrustedEditors.mockResolvedValueOnce({
      data: mockResponse,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrustedEditors({ role: 'trusted-editor' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockListTrustedEditors).toHaveBeenCalledWith({
      limit: 20,
      cursor: undefined,
      role: 'trusted-editor',
    });
  });

  it('passes pagination params', async () => {
    mockListTrustedEditors.mockResolvedValueOnce({
      data: createMockTrustedEditorsResponse(),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTrustedEditors({ limit: 50, cursor: 'next-page' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockListTrustedEditors).toHaveBeenCalledWith({
      limit: 50,
      cursor: 'next-page',
      role: undefined,
    });
  });
});

describe('useRequestElevation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests elevation successfully', async () => {
    mockRequestElevation.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Successfully elevated to trusted editor',
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRequestElevation(), { wrapper: Wrapper });

    const response = await result.current.mutateAsync();

    expect(response.success).toBe(true);
    expect(response.message).toContain('elevated');
    expect(mockRequestElevation).toHaveBeenCalledWith({
      targetRole: 'trusted-editor',
    });
  });

  it('handles rejection', async () => {
    mockRequestElevation.mockResolvedValueOnce({
      data: {
        success: false,
        message: 'Not yet eligible. Missing criteria: Need 10+ well-endorsed eprints',
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRequestElevation(), { wrapper: Wrapper });

    const response = await result.current.mutateAsync();

    expect(response.success).toBe(false);
    expect(response.message).toContain('Not yet eligible');
  });
});

describe('useGrantDelegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grants delegation successfully', async () => {
    mockGrantDelegation.mockResolvedValueOnce({
      data: {
        success: true,
        delegationId: 'delegation-123',
        message: 'Delegation granted successfully',
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGrantDelegation(), { wrapper: Wrapper });

    const response = await result.current.mutateAsync({
      delegateDid: 'did:plc:delegate',
      collections: ['pub.chive.graph.authority'],
      daysValid: 365,
      maxRecordsPerDay: 100,
    });

    expect(response.success).toBe(true);
    expect(response.delegationId).toBe('delegation-123');
    expect(mockGrantDelegation).toHaveBeenCalledWith({
      delegateDid: 'did:plc:delegate',
      collections: ['pub.chive.graph.authority'],
      daysValid: 365,
      maxRecordsPerDay: 100,
    });
  });

  it('uses default values for optional parameters', async () => {
    mockGrantDelegation.mockResolvedValueOnce({
      data: {
        success: true,
        delegationId: 'delegation-456',
        message: 'Delegation granted successfully',
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGrantDelegation(), { wrapper: Wrapper });

    await result.current.mutateAsync({
      delegateDid: 'did:plc:delegate',
      collections: ['pub.chive.graph.authority'],
    });

    expect(mockGrantDelegation).toHaveBeenCalledWith({
      delegateDid: 'did:plc:delegate',
      collections: ['pub.chive.graph.authority'],
      daysValid: 365,
      maxRecordsPerDay: 100,
    });
  });
});

describe('useRevokeDelegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes delegation successfully', async () => {
    mockRevokeDelegation.mockResolvedValueOnce({
      data: {
        success: true,
        delegationId: 'delegation-123',
        message: 'Delegation revoked successfully',
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevokeDelegation(), { wrapper: Wrapper });

    const response = await result.current.mutateAsync({
      delegationId: 'delegation-123',
    });

    expect(response.success).toBe(true);
    expect(response.delegationId).toBe('delegation-123');
    expect(mockRevokeDelegation).toHaveBeenCalledWith({
      delegationId: 'delegation-123',
    });
  });
});

describe('useRevokeRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes role successfully', async () => {
    mockRevokeRole.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Role revoked successfully. User is now a community member.',
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevokeRole(), { wrapper: Wrapper });

    const response = await result.current.mutateAsync({
      did: 'did:plc:target',
      reason: 'Violation of community guidelines',
    });

    expect(response.success).toBe(true);
    expect(response.message).toContain('Role revoked');
    expect(mockRevokeRole).toHaveBeenCalledWith({
      did: 'did:plc:target',
      reason: 'Violation of community guidelines',
    });
  });

  it('handles failure', async () => {
    mockRevokeRole.mockResolvedValueOnce({
      data: {
        success: false,
        message: 'User does not have a special role to revoke',
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevokeRole(), { wrapper: Wrapper });

    const response = await result.current.mutateAsync({
      did: 'did:plc:member',
      reason: 'Testing',
    });

    expect(response.success).toBe(false);
    expect(response.message).toContain('does not have a special role');
  });
});

describe('GOVERNANCE_ROLE_LABELS', () => {
  it('has labels for all governance roles', () => {
    expect(GOVERNANCE_ROLE_LABELS['community-member']).toBe('Community Member');
    expect(GOVERNANCE_ROLE_LABELS['trusted-editor']).toBe('Trusted Editor');
    expect(GOVERNANCE_ROLE_LABELS['graph-editor']).toBe('Graph Editor');
    expect(GOVERNANCE_ROLE_LABELS['domain-expert']).toBe('Domain Expert');
    expect(GOVERNANCE_ROLE_LABELS['administrator']).toBe('Administrator');
  });
});
