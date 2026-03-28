/**
 * Unit tests for all XRPC admin handlers and actor.getMyRoles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getMyRoles } from '@/api/handlers/xrpc/actor/getMyRoles.js';
import { assignRole } from '@/api/handlers/xrpc/admin/assignRole.js';
import { cancelBackfill } from '@/api/handlers/xrpc/admin/cancelBackfill.js';
import { deleteContent } from '@/api/handlers/xrpc/admin/deleteContent.js';
import { dismissDLQEntry } from '@/api/handlers/xrpc/admin/dismissDLQEntry.js';
import { getActivityCorrelation } from '@/api/handlers/xrpc/admin/getActivityCorrelation.js';
import { getAuditLog } from '@/api/handlers/xrpc/admin/getAuditLog.js';
import { getBackfillHistory } from '@/api/handlers/xrpc/admin/getBackfillHistory.js';
import { getBackfillStatus } from '@/api/handlers/xrpc/admin/getBackfillStatus.js';
import { getEndpointMetrics } from '@/api/handlers/xrpc/admin/getEndpointMetrics.js';
import { getFirehoseStatus } from '@/api/handlers/xrpc/admin/getFirehoseStatus.js';
import { getGraphStats } from '@/api/handlers/xrpc/admin/getGraphStats.js';
import { getMetricsOverview } from '@/api/handlers/xrpc/admin/getMetricsOverview.js';
import { getNodeMetrics } from '@/api/handlers/xrpc/admin/getNodeMetrics.js';
import { getOverview } from '@/api/handlers/xrpc/admin/getOverview.js';
import { getPrometheusMetrics } from '@/api/handlers/xrpc/admin/getPrometheusMetrics.js';
import { getSearchAnalytics } from '@/api/handlers/xrpc/admin/getSearchAnalytics.js';
import { getSystemHealth } from '@/api/handlers/xrpc/admin/getSystemHealth.js';
import { getTrendingVelocity } from '@/api/handlers/xrpc/admin/getTrendingVelocity.js';
import { getUserDetail } from '@/api/handlers/xrpc/admin/getUserDetail.js';
import { getViewDownloadTimeSeries } from '@/api/handlers/xrpc/admin/getViewDownloadTimeSeries.js';
import { listDLQEntries } from '@/api/handlers/xrpc/admin/listDLQEntries.js';
import { listEndorsements } from '@/api/handlers/xrpc/admin/listEndorsements.js';
import { listEprints } from '@/api/handlers/xrpc/admin/listEprints.js';
import { listImports } from '@/api/handlers/xrpc/admin/listImports.js';
import { listPDSes } from '@/api/handlers/xrpc/admin/listPDSes.js';
import { listReviews } from '@/api/handlers/xrpc/admin/listReviews.js';
import { listViolations } from '@/api/handlers/xrpc/admin/listViolations.js';
import { listWarnings } from '@/api/handlers/xrpc/admin/listWarnings.js';
import { purgeOldDLQ } from '@/api/handlers/xrpc/admin/purgeOldDLQ.js';
import { rescanPDS } from '@/api/handlers/xrpc/admin/rescanPDS.js';
import { retryAllDLQ } from '@/api/handlers/xrpc/admin/retryAllDLQ.js';
import { retryDLQEntry } from '@/api/handlers/xrpc/admin/retryDLQEntry.js';
import { revokeRole } from '@/api/handlers/xrpc/admin/revokeRole.js';
import { searchUsers } from '@/api/handlers/xrpc/admin/searchUsers.js';
import { triggerBackfill } from '@/api/handlers/xrpc/admin/triggerBackfill.js';
import { triggerCitationExtraction } from '@/api/handlers/xrpc/admin/triggerCitationExtraction.js';
import { triggerDIDSync } from '@/api/handlers/xrpc/admin/triggerDIDSync.js';
import { triggerFreshnessScan } from '@/api/handlers/xrpc/admin/triggerFreshnessScan.js';
import { triggerFullReindex } from '@/api/handlers/xrpc/admin/triggerFullReindex.js';
import { triggerGovernanceSync } from '@/api/handlers/xrpc/admin/triggerGovernanceSync.js';
import { triggerPDSScan } from '@/api/handlers/xrpc/admin/triggerPDSScan.js';
import { AuthorizationError, ServiceUnavailableError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

import { TEST_USER_DIDS } from '../../../../test-constants.js';

// ---------------------------------------------------------------------------
// Mock prom-client so handlers that import it do not fail
// ---------------------------------------------------------------------------
vi.mock('prom-client', () => ({
  register: {
    getMetricsAsJSON: vi.fn().mockResolvedValue([]),
  },
  Counter: vi.fn().mockImplementation(() => ({ inc: vi.fn() })),
  Gauge: vi.fn().mockImplementation(() => ({ set: vi.fn(), dec: vi.fn(), inc: vi.fn() })),
  Histogram: vi.fn().mockImplementation(() => ({ observe: vi.fn() })),
}));

// Mock prometheus-registry metrics used directly by handlers
vi.mock('@/observability/prometheus-registry.js', () => ({
  adminMetrics: { actionsTotal: { inc: vi.fn() } },
  dlqMetrics: {
    entriesTotal: { set: vi.fn(), dec: vi.fn() },
    retriesTotal: { inc: vi.fn() },
  },
  prometheusRegistry: {
    getMetricsAsJSON: vi.fn().mockResolvedValue([]),
  },
}));

// Mock governance sync job
vi.mock('@/jobs/governance-sync-job.js', () => ({
  GovernanceSyncJob: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock graph config
vi.mock('@/config/graph.js', () => ({
  getGraphPdsDid: vi.fn().mockReturnValue('did:plc:chive-governance'),
}));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: () => createMockLogger(),
});

const ADMIN_DID = TEST_USER_DIDS.ADMIN;
const NON_ADMIN_DID = TEST_USER_DIDS.USER_1;

interface MockAdminService {
  getOverview: ReturnType<typeof vi.fn>;
  getSystemHealth: ReturnType<typeof vi.fn>;
  searchUsers: ReturnType<typeof vi.fn>;
  getUserDetail: ReturnType<typeof vi.fn>;
  listEprints: ReturnType<typeof vi.fn>;
  listReviews: ReturnType<typeof vi.fn>;
  listEndorsements: ReturnType<typeof vi.fn>;
  deleteContent: ReturnType<typeof vi.fn>;
  listPDSEntries: ReturnType<typeof vi.fn>;
  listImports: ReturnType<typeof vi.fn>;
  getPendingProposalCount: ReturnType<typeof vi.fn>;
  getSearchAnalytics: ReturnType<typeof vi.fn>;
  getViewDownloadTimeSeries: ReturnType<typeof vi.fn>;
  getAuditLog: ReturnType<typeof vi.fn>;
  listWarnings: ReturnType<typeof vi.fn>;
  listViolations: ReturnType<typeof vi.fn>;
}

interface MockBackfillManager {
  startOperation: ReturnType<typeof vi.fn>;
  completeOperation: ReturnType<typeof vi.fn>;
  failOperation: ReturnType<typeof vi.fn>;
  updateProgress: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
  listOperations: ReturnType<typeof vi.fn>;
  cancelOperation: ReturnType<typeof vi.fn>;
}

interface MockRedis {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  sadd: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
  smembers: ReturnType<typeof vi.fn>;
  llen: ReturnType<typeof vi.fn>;
  lrange: ReturnType<typeof vi.fn>;
  rpush: ReturnType<typeof vi.fn>;
  lset: ReturnType<typeof vi.fn>;
  lrem: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
}

const createMockAdminService = (): MockAdminService => ({
  getOverview: vi.fn().mockResolvedValue({
    eprints: 10,
    authors: 5,
    reviews: 3,
    endorsements: 2,
    collections: 1,
    tags: 7,
  }),
  getSystemHealth: vi.fn().mockResolvedValue({
    status: 'healthy',
    databases: [],
    uptime: 3600,
    timestamp: new Date().toISOString(),
  }),
  searchUsers: vi
    .fn()
    .mockResolvedValue([{ did: 'did:plc:user1', handle: 'user1.test', eprintCount: 3 }]),
  getUserDetail: vi.fn().mockResolvedValue({
    did: 'did:plc:user1',
    handle: 'user1.test',
    displayName: 'Test User',
    eprintCount: 5,
    reviewCount: 2,
    endorsementCount: 1,
    roles: ['reader'],
    createdAt: '2024-01-01T00:00:00Z',
  }),
  listEprints: vi.fn().mockResolvedValue({
    items: [{ uri: 'at://did:plc:test/pub.chive.eprint.submission/1', title: 'Test' }],
    total: 1,
  }),
  listReviews: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  listEndorsements: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  deleteContent: vi.fn().mockResolvedValue({ deleted: true }),
  listPDSEntries: vi.fn().mockResolvedValue([
    { pdsUrl: 'https://pds1.test', status: 'active', recordCount: 10 },
    { pdsUrl: 'https://pds2.test', status: 'unreachable', recordCount: 0 },
  ]),
  listImports: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getPendingProposalCount: vi.fn().mockResolvedValue(3),
  getSearchAnalytics: vi.fn().mockResolvedValue({ topQueries: [], totalSearches: 100 }),
  getViewDownloadTimeSeries: vi.fn().mockResolvedValue({ series: [] }),
  getAuditLog: vi.fn().mockResolvedValue({ entries: [{ id: '1', action: 'test' }], total: 1 }),
  listWarnings: vi.fn().mockResolvedValue({ warnings: [{ id: '1', message: 'warn' }] }),
  listViolations: vi.fn().mockResolvedValue({ violations: [{ id: '1', message: 'violation' }] }),
});

const createMockBackfillManager = (): MockBackfillManager => ({
  startOperation: vi.fn().mockResolvedValue({ operation: { id: 'op-123', status: 'running' } }),
  completeOperation: vi.fn().mockResolvedValue(undefined),
  failOperation: vi.fn().mockResolvedValue(undefined),
  updateProgress: vi.fn().mockResolvedValue(undefined),
  getStatus: vi.fn().mockResolvedValue({ id: 'op-123', status: 'running' }),
  listOperations: vi.fn().mockResolvedValue([
    { id: 'op-1', status: 'completed', startedAt: '2024-01-01T00:00:00Z' },
    { id: 'op-2', status: 'running', startedAt: '2024-01-02T00:00:00Z' },
    { id: 'op-3', status: 'failed', startedAt: '2024-01-03T00:00:00Z' },
  ]),
  cancelOperation: vi.fn().mockResolvedValue(true),
});

const createMockRedis = (): MockRedis => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  sadd: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  llen: vi.fn().mockResolvedValue(0),
  lrange: vi.fn().mockResolvedValue([]),
  rpush: vi.fn().mockResolvedValue(1),
  lset: vi.fn().mockResolvedValue('OK'),
  lrem: vi.fn().mockResolvedValue(1),
  publish: vi.fn().mockResolvedValue(1),
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('XRPC Admin Handlers', () => {
  let mockLogger: ILogger;
  let mockAdminService: MockAdminService;
  let mockBackfillManager: MockBackfillManager;
  let mockRedis: MockRedis;
  let mockContext: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  const adminUser = { did: ADMIN_DID, handle: 'admin.test', isAdmin: true };
  const nonAdminUser = { did: NON_ADMIN_DID, handle: 'user.test', isAdmin: false };

  const mockMetricsService = {
    getTrending: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue({
      totalViews: 100,
      totalDownloads: 20,
      totalEndorsements: 5,
    }),
    recordView: vi.fn(),
    recordDownload: vi.fn(),
    recordEndorsement: vi.fn(),
  };

  const mockEprintService = {
    getEprint: vi.fn().mockResolvedValue(null),
    getEprintByUri: vi.fn().mockResolvedValue(null),
    listEprints: vi.fn().mockResolvedValue({ eprints: [], cursor: undefined }),
    getEprintsByAuthor: vi.fn().mockResolvedValue({ eprints: [], total: 0 }),
    indexEprint: vi.fn().mockResolvedValue(undefined),
    deleteEprint: vi.fn().mockResolvedValue(undefined),
  };

  const mockActivityService = {
    getCorrelationMetrics: vi.fn().mockResolvedValue({ ok: true, value: [{ metric: 'test' }] }),
    logActivity: vi.fn(),
    correlateWithFirehose: vi.fn(),
    markFailed: vi.fn(),
    timeoutStaleActivities: vi.fn(),
    getActivityFeed: vi.fn(),
    getActivity: vi.fn(),
    batchCorrelate: vi.fn(),
    getPendingCount: vi.fn(),
  };

  const mockNodeRepository = {
    listNodes: vi.fn().mockResolvedValue({ total: 100, nodes: [], hasMore: false }),
    getNode: vi.fn().mockResolvedValue(null),
    searchNodes: vi.fn().mockResolvedValue({ nodes: [], total: 0, hasMore: false }),
    createNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    getSubkinds: vi.fn().mockResolvedValue([]),
    getHierarchy: vi.fn().mockResolvedValue([]),
  };

  const mockEdgeRepository = {
    listEdges: vi.fn().mockResolvedValue({ total: 50, edges: [], hasMore: false }),
    getEdge: vi.fn().mockResolvedValue(null),
    createEdge: vi.fn(),
    updateEdge: vi.fn(),
    deleteEdge: vi.fn(),
    getRelations: vi.fn().mockResolvedValue([]),
  };

  const mockPdsRegistry = {
    getPDSesForScan: vi.fn().mockResolvedValue([]),
    registerPDS: vi.fn().mockResolvedValue(undefined),
  };

  const mockPdsScanner = {
    scanMultiplePDSes: vi.fn().mockResolvedValue(new Map()),
    scanDID: vi.fn().mockResolvedValue(5),
  };

  const mockPdsSync = {
    detectStaleRecords: vi.fn().mockResolvedValue([]),
    refreshRecord: vi.fn().mockResolvedValue({ ok: true }),
  };

  const mockCitationExtraction = {
    extractCitations: vi.fn().mockResolvedValue({ totalExtracted: 3 }),
  };

  const mockSearchService = {
    indexEprintForSearch: vi.fn().mockResolvedValue({ ok: true }),
    search: vi.fn(),
    facetedSearch: vi.fn(),
    autocomplete: vi.fn(),
  };

  const mockNodeService = {
    getNode: vi.fn().mockResolvedValue(null),
    searchNodes: vi.fn().mockResolvedValue({ nodes: [], total: 0, hasMore: false }),
    listNodes: vi.fn().mockResolvedValue({ nodes: [], hasMore: false }),
    getHierarchy: vi.fn().mockResolvedValue([]),
    getSubkinds: vi.fn().mockResolvedValue([]),
    proposeNode: vi.fn(),
  };

  const mockEdgeService = {
    getEdge: vi.fn().mockResolvedValue(null),
    listEdges: vi.fn().mockResolvedValue({ edges: [], hasMore: false }),
    getRelations: vi.fn().mockResolvedValue([]),
    proposeEdge: vi.fn(),
  };

  function buildContext(user: typeof adminUser | typeof nonAdminUser | null): {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  } {
    return {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'user':
            return user;
          case 'services':
            return {
              admin: mockAdminService,
              backfillManager: mockBackfillManager,
              pdsRegistry: mockPdsRegistry,
              pdsScanner: mockPdsScanner,
              pdsSync: mockPdsSync,
              citationExtraction: mockCitationExtraction,
              eprint: mockEprintService,
              search: mockSearchService,
              metrics: mockMetricsService,
              activity: mockActivityService,
              nodeRepository: mockNodeRepository,
              edgeRepository: mockEdgeRepository,
              nodeService: mockNodeService,
              edgeService: mockEdgeService,
            };
          case 'logger':
            return mockLogger;
          case 'redis':
            return mockRedis;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  }

  function buildContextWithoutAdmin(user: typeof adminUser): {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  } {
    return {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'user':
            return user;
          case 'services':
            return {
              admin: null,
              backfillManager: null,
              pdsRegistry: null,
              pdsScanner: null,
              pdsSync: null,
              citationExtraction: null,
              eprint: mockEprintService,
              search: mockSearchService,
              metrics: mockMetricsService,
              activity: null,
              nodeRepository: mockNodeRepository,
              edgeRepository: mockEdgeRepository,
              nodeService: mockNodeService,
              edgeService: mockEdgeService,
            };
          case 'logger':
            return mockLogger;
          case 'redis':
            return mockRedis;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockAdminService = createMockAdminService();
    mockBackfillManager = createMockBackfillManager();
    mockRedis = createMockRedis();
    mockContext = buildContext(adminUser);
  });

  // =========================================================================
  // System: getOverview
  // =========================================================================
  describe('getOverview', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getOverview.handler({ params: undefined, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        getOverview.handler({ params: undefined, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('returns overview with correct encoding', async () => {
      const result = await getOverview.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(result.encoding).toBe('application/json');
      expect(result.body).toMatchObject({ eprints: 10, authors: 5 });
      expect(mockAdminService.getOverview).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // System: getSystemHealth
  // =========================================================================
  describe('getSystemHealth', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getSystemHealth.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        getSystemHealth.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('returns system health', async () => {
      const result = await getSystemHealth.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toMatchObject({ status: 'healthy' });
    });
  });

  // =========================================================================
  // System: getPrometheusMetrics
  // =========================================================================
  describe('getPrometheusMetrics', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getPrometheusMetrics.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('returns metrics with timestamp', async () => {
      const result = await getPrometheusMetrics.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(result.encoding).toBe('application/json');
      expect(result.body).toHaveProperty('metrics');
      expect(result.body).toHaveProperty('timestamp');
    });
  });

  // =========================================================================
  // System: getEndpointMetrics
  // =========================================================================
  describe('getEndpointMetrics', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getEndpointMetrics.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('returns empty metrics when prom-client has no data', async () => {
      const result = await getEndpointMetrics.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toMatchObject({ metrics: [] });
    });
  });

  // =========================================================================
  // System: getNodeMetrics
  // =========================================================================
  describe('getNodeMetrics', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getNodeMetrics.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('returns process info and metrics', async () => {
      const result = await getNodeMetrics.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toHaveProperty('metrics');
      expect(result.body).toHaveProperty('processInfo');
      const processInfo = (result.body as { processInfo: { pid: number } }).processInfo;
      expect(processInfo.pid).toBe(process.pid);
    });
  });

  // =========================================================================
  // Users: searchUsers
  // =========================================================================
  describe('searchUsers', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        searchUsers.handler({
          params: { query: 'test' },
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        searchUsers.handler({
          params: { query: 'test' },
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('throws ValidationError when query is empty', async () => {
      await expect(
        searchUsers.handler({
          params: { query: '' },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Query is required');
    });

    it('uses default limit of 20', async () => {
      await searchUsers.handler({
        params: { query: 'alice' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.searchUsers).toHaveBeenCalledWith('alice', 20);
    });

    it('uses custom limit', async () => {
      await searchUsers.handler({
        params: { query: 'alice', limit: 5 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.searchUsers).toHaveBeenCalledWith('alice', 5);
    });

    it('returns users in correct shape', async () => {
      const result = await searchUsers.handler({
        params: { query: 'test' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { users: unknown[] };
      expect(body.users).toHaveLength(1);
    });
  });

  // =========================================================================
  // Users: getUserDetail
  // =========================================================================
  describe('getUserDetail', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getUserDetail.handler({
          params: { did: 'did:plc:user1' },
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        getUserDetail.handler({
          params: { did: 'did:plc:user1' },
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('throws ValidationError when DID is empty', async () => {
      await expect(
        getUserDetail.handler({
          params: { did: '' },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('DID is required');
    });

    it('throws NotFoundError when user does not exist', async () => {
      mockAdminService.getUserDetail.mockResolvedValueOnce(null);
      await expect(
        getUserDetail.handler({
          params: { did: 'did:plc:missing' },
          input: undefined,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow();
    });

    it('returns user detail', async () => {
      const result = await getUserDetail.handler({
        params: { did: 'did:plc:user1' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toMatchObject({ did: 'did:plc:user1', eprintCount: 5 });
    });
  });

  // =========================================================================
  // Users: assignRole
  // =========================================================================
  describe('assignRole', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        assignRole.handler({
          params: undefined,
          input: { did: 'did:plc:user1', role: 'moderator' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('throws ValidationError for missing input', async () => {
      await expect(
        assignRole.handler({
          params: undefined,
          input: undefined as never,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('DID and role are required');
    });

    it('throws ValidationError for invalid role', async () => {
      await expect(
        assignRole.handler({
          params: undefined,
          input: { did: 'did:plc:user1', role: 'superuser' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Invalid role');
    });

    it('stores role in Redis and returns success', async () => {
      const result = await assignRole.handler({
        params: undefined,
        input: { did: 'did:plc:user1', role: 'moderator' },
        auth: null,
        c: mockContext as never,
      });
      expect(mockRedis.sadd).toHaveBeenCalledWith('chive:authz:roles:did:plc:user1', 'moderator');
      expect(mockRedis.set).toHaveBeenCalled();
      expect(result.body).toMatchObject({ success: true, did: 'did:plc:user1', role: 'moderator' });
    });

    it('accepts all valid roles', async () => {
      const validRoles = [
        'admin',
        'moderator',
        'graph-editor',
        'author',
        'reader',
        'alpha-tester',
        'premium',
      ];
      for (const role of validRoles) {
        vi.clearAllMocks();
        mockContext = buildContext(adminUser);
        const result = await assignRole.handler({
          params: undefined,
          input: { did: 'did:plc:user1', role },
          auth: null,
          c: mockContext as never,
        });
        expect(result.body).toMatchObject({ success: true, role });
      }
    });
  });

  // =========================================================================
  // Users: revokeRole
  // =========================================================================
  describe('revokeRole', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        revokeRole.handler({
          params: undefined,
          input: { did: 'did:plc:user1', role: 'moderator' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('throws ValidationError for missing input', async () => {
      await expect(
        revokeRole.handler({
          params: undefined,
          input: undefined as never,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('DID and role are required');
    });

    it('removes role from Redis and returns success', async () => {
      const result = await revokeRole.handler({
        params: undefined,
        input: { did: 'did:plc:user1', role: 'moderator' },
        auth: null,
        c: mockContext as never,
      });
      expect(mockRedis.srem).toHaveBeenCalledWith('chive:authz:roles:did:plc:user1', 'moderator');
      expect(mockRedis.del).toHaveBeenCalledWith('chive:authz:assignments:did:plc:user1:moderator');
      expect(result.body).toMatchObject({ success: true, did: 'did:plc:user1', role: 'moderator' });
    });
  });

  // =========================================================================
  // Content: listEprints
  // =========================================================================
  describe('listEprints', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        listEprints.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        listEprints.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('uses default limit 50 and offset 0', async () => {
      await listEprints.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listEprints).toHaveBeenCalledWith(undefined, 50, 0);
    });

    it('passes query, limit, and offset', async () => {
      await listEprints.handler({
        params: { q: 'neural', limit: 10, offset: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listEprints).toHaveBeenCalledWith('neural', 10, 20);
    });
  });

  // =========================================================================
  // Content: listReviews
  // =========================================================================
  describe('listReviews', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        listReviews.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        listReviews.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('uses default limit 50 and offset 0', async () => {
      await listReviews.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listReviews).toHaveBeenCalledWith(50, 0);
    });

    it('parses cursor as numeric offset', async () => {
      await listReviews.handler({
        params: { limit: 10, cursor: '25' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listReviews).toHaveBeenCalledWith(10, 25);
    });
  });

  // =========================================================================
  // Content: listEndorsements
  // =========================================================================
  describe('listEndorsements', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        listEndorsements.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        listEndorsements.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('uses default limit 50 and offset 0', async () => {
      await listEndorsements.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listEndorsements).toHaveBeenCalledWith(50, 0);
    });

    it('parses cursor as numeric offset', async () => {
      await listEndorsements.handler({
        params: { limit: 5, cursor: '15' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listEndorsements).toHaveBeenCalledWith(5, 15);
    });
  });

  // =========================================================================
  // Content: deleteContent
  // =========================================================================
  describe('deleteContent', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        deleteContent.handler({
          params: undefined,
          input: { uri: 'at://test', collection: 'pub.chive.eprint.submission' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        deleteContent.handler({
          params: undefined,
          input: { uri: 'at://test', collection: 'pub.chive.eprint.submission' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('throws ValidationError for missing input', async () => {
      await expect(
        deleteContent.handler({
          params: undefined,
          input: undefined as never,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('URI and collection are required');
    });

    it('throws ValidationError for unsupported collection', async () => {
      await expect(
        deleteContent.handler({
          params: undefined,
          input: { uri: 'at://test', collection: 'pub.chive.unknown.type' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Unsupported collection');
    });

    it('soft-deletes content and publishes event', async () => {
      const result = await deleteContent.handler({
        params: undefined,
        input: {
          uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
          collection: 'pub.chive.eprint.submission',
          reason: 'spam',
        },
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.deleteContent).toHaveBeenCalledWith(
        'at://did:plc:test/pub.chive.eprint.submission/123',
        'eprints_index'
      );
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'chive:admin:content-deleted',
        expect.stringContaining('"reason":"spam"')
      );
      expect(result.body).toMatchObject({ success: true });
    });

    it('maps all supported collections to correct tables', async () => {
      const collectionMap: Record<string, string> = {
        'pub.chive.eprint.submission': 'eprints_index',
        'pub.chive.review.comment': 'reviews_index',
        'pub.chive.review.endorsement': 'endorsements_index',
        'pub.chive.eprint.userTag': 'user_tags_index',
      };

      for (const [collection, table] of Object.entries(collectionMap)) {
        vi.clearAllMocks();
        mockAdminService = createMockAdminService();
        mockRedis = createMockRedis();
        mockContext = buildContext(adminUser);

        await deleteContent.handler({
          params: undefined,
          input: { uri: 'at://test', collection },
          auth: null,
          c: mockContext as never,
        });
        expect(mockAdminService.deleteContent).toHaveBeenCalledWith('at://test', table);
      }
    });
  });

  // =========================================================================
  // Firehose: getFirehoseStatus
  // =========================================================================
  describe('getFirehoseStatus', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getFirehoseStatus.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('returns cursor and DLQ count from Redis', async () => {
      mockRedis.get.mockResolvedValueOnce('12345');
      mockRedis.llen.mockResolvedValueOnce(3);

      const result = await getFirehoseStatus.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toMatchObject({ cursor: '12345', dlqCount: 3 });
      expect(result.body).toHaveProperty('timestamp');
    });

    it('handles llen failure gracefully', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.llen.mockRejectedValueOnce(new Error('Redis error'));

      const result = await getFirehoseStatus.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toMatchObject({ cursor: null, dlqCount: 0 });
    });
  });

  // =========================================================================
  // Firehose: listDLQEntries
  // =========================================================================
  describe('listDLQEntries', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        listDLQEntries.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('uses default limit 50 and offset 0', async () => {
      mockRedis.lrange.mockResolvedValueOnce([]);
      mockRedis.llen.mockResolvedValueOnce(0);

      await listDLQEntries.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockRedis.lrange).toHaveBeenCalledWith('chive:firehose:dlq', 0, 49);
    });

    it('uses custom limit and offset', async () => {
      mockRedis.lrange.mockResolvedValueOnce([]);
      mockRedis.llen.mockResolvedValueOnce(0);

      await listDLQEntries.handler({
        params: { limit: 10, offset: 5 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockRedis.lrange).toHaveBeenCalledWith('chive:firehose:dlq', 5, 14);
    });

    it('parses JSON entries and handles invalid entries', async () => {
      mockRedis.lrange.mockResolvedValueOnce([
        JSON.stringify({ error: 'timeout', uri: 'at://test' }),
        'not-valid-json',
      ]);
      mockRedis.llen.mockResolvedValueOnce(2);

      const result = await listDLQEntries.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { entries: unknown[]; total: number };
      expect(body.entries).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.entries[1]).toMatchObject({ raw: 'not-valid-json' });
    });
  });

  // =========================================================================
  // Firehose: retryDLQEntry
  // =========================================================================
  describe('retryDLQEntry', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        retryDLQEntry.handler({
          params: undefined,
          input: { index: 0 },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('throws ValidationError when index is missing', async () => {
      await expect(
        retryDLQEntry.handler({
          params: undefined,
          input: {} as never,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Index is required');
    });

    it('returns failure when entry not found at index', async () => {
      mockRedis.lrange.mockResolvedValueOnce([]);

      const result = await retryDLQEntry.handler({
        params: undefined,
        input: { index: 99 },
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toMatchObject({ success: false });
    });

    it('requeues entry to retry queue on success', async () => {
      mockRedis.lrange.mockResolvedValueOnce(['{"error":"timeout"}']);

      const result = await retryDLQEntry.handler({
        params: undefined,
        input: { index: 0 },
        auth: null,
        c: mockContext as never,
      });
      expect(mockRedis.rpush).toHaveBeenCalledWith('chive:firehose:retry', '{"error":"timeout"}');
      expect(result.body).toMatchObject({ success: true });
    });
  });

  // =========================================================================
  // Firehose: retryAllDLQ
  // =========================================================================
  describe('retryAllDLQ', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        retryAllDLQ.handler({
          params: undefined,
          input: {},
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('retries all entries and clears DLQ when no errorType filter', async () => {
      mockRedis.lrange.mockResolvedValueOnce(['{"error":"a"}', '{"error":"b"}']);

      const result = await retryAllDLQ.handler({
        params: undefined,
        input: {},
        auth: null,
        c: mockContext as never,
      });
      expect(mockRedis.rpush).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledWith('chive:firehose:dlq');
      expect(result.body).toMatchObject({ success: true, retriedCount: 2 });
    });

    it('filters by errorType when specified', async () => {
      mockRedis.lrange.mockResolvedValueOnce([
        JSON.stringify({ errorType: 'timeout' }),
        JSON.stringify({ errorType: 'parse' }),
        JSON.stringify({ errorType: 'timeout' }),
      ]);

      const result = await retryAllDLQ.handler({
        params: undefined,
        input: { errorType: 'timeout' },
        auth: null,
        c: mockContext as never,
      });
      expect(mockRedis.rpush).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(result.body).toMatchObject({ retriedCount: 2 });
    });
  });

  // =========================================================================
  // Firehose: dismissDLQEntry
  // =========================================================================
  describe('dismissDLQEntry', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        dismissDLQEntry.handler({
          params: undefined,
          input: { index: 0 },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('throws ValidationError when index is missing', async () => {
      await expect(
        dismissDLQEntry.handler({
          params: undefined,
          input: {} as never,
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Index is required');
    });

    it('removes entry via sentinel pattern', async () => {
      const result = await dismissDLQEntry.handler({
        params: undefined,
        input: { index: 3 },
        auth: null,
        c: mockContext as never,
      });
      expect(mockRedis.lset).toHaveBeenCalledWith(
        'chive:firehose:dlq',
        3,
        expect.stringContaining('__DISMISSED_')
      );
      expect(mockRedis.lrem).toHaveBeenCalled();
      expect(result.body).toMatchObject({ success: true });
    });
  });

  // =========================================================================
  // Firehose: purgeOldDLQ
  // =========================================================================
  describe('purgeOldDLQ', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        purgeOldDLQ.handler({
          params: undefined,
          input: {},
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('uses default 7 days when olderThanDays not specified', async () => {
      mockRedis.lrange.mockResolvedValueOnce([]);

      const result = await purgeOldDLQ.handler({
        params: undefined,
        input: {},
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toMatchObject({ success: true, purgedCount: 0 });
    });

    it('purges entries older than cutoff', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const newDate = new Date().toISOString();

      mockRedis.lrange.mockResolvedValueOnce([
        JSON.stringify({ timestamp: oldDate }),
        JSON.stringify({ timestamp: newDate }),
      ]);

      const result = await purgeOldDLQ.handler({
        params: undefined,
        input: { olderThanDays: 7 },
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toMatchObject({ purgedCount: 1 });
      expect(mockRedis.lset).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Backfill: triggerPDSScan
  // =========================================================================
  describe('triggerPDSScan', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        triggerPDSScan.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        triggerPDSScan.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('starts operation and returns immediately', async () => {
      const result = await triggerPDSScan.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.startOperation).toHaveBeenCalledWith('pdsScan');
      expect(result.body).toMatchObject({ operationId: 'op-123', status: 'running' });
    });
  });

  // =========================================================================
  // Backfill: triggerFreshnessScan
  // =========================================================================
  describe('triggerFreshnessScan', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        triggerFreshnessScan.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        triggerFreshnessScan.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('starts freshnessScan operation', async () => {
      const result = await triggerFreshnessScan.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.startOperation).toHaveBeenCalledWith('freshnessScan');
      expect(result.body).toMatchObject({ status: 'running' });
    });
  });

  // =========================================================================
  // Backfill: triggerCitationExtraction
  // =========================================================================
  describe('triggerCitationExtraction', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        triggerCitationExtraction.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        triggerCitationExtraction.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('starts citationExtraction operation', async () => {
      const result = await triggerCitationExtraction.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.startOperation).toHaveBeenCalledWith('citationExtraction');
      expect(result.body).toMatchObject({ status: 'running' });
    });
  });

  // =========================================================================
  // Backfill: triggerFullReindex
  // =========================================================================
  describe('triggerFullReindex', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        triggerFullReindex.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        triggerFullReindex.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('starts fullReindex operation', async () => {
      const result = await triggerFullReindex.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.startOperation).toHaveBeenCalledWith('fullReindex');
      expect(result.body).toMatchObject({ status: 'running' });
    });
  });

  // =========================================================================
  // Backfill: triggerGovernanceSync
  // =========================================================================
  describe('triggerGovernanceSync', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        triggerGovernanceSync.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        triggerGovernanceSync.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('starts governanceSync operation', async () => {
      const result = await triggerGovernanceSync.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.startOperation).toHaveBeenCalledWith('governanceSync');
      expect(result.body).toMatchObject({ status: 'running' });
    });
  });

  // =========================================================================
  // Backfill: triggerDIDSync
  // =========================================================================
  describe('triggerDIDSync', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        triggerDIDSync.handler({
          params: undefined,
          input: { did: 'did:plc:test' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('throws ValidationError when DID is missing', async () => {
      await expect(
        triggerDIDSync.handler({
          params: undefined,
          input: { did: '' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('DID is required');
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        triggerDIDSync.handler({
          params: undefined,
          input: { did: 'did:plc:test' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('starts didSync operation with DID metadata', async () => {
      const result = await triggerDIDSync.handler({
        params: undefined,
        input: { did: 'did:plc:target' },
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.startOperation).toHaveBeenCalledWith('didSync', {
        did: 'did:plc:target',
      });
      expect(result.body).toMatchObject({ did: 'did:plc:target', status: 'running' });
    });
  });

  // =========================================================================
  // Backfill: triggerBackfill (generic)
  // =========================================================================
  describe('triggerBackfill', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        triggerBackfill.handler({
          params: undefined,
          input: { type: 'pdsScan' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('throws ValidationError when type is missing', async () => {
      await expect(
        triggerBackfill.handler({
          params: undefined,
          input: { type: '' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Backfill type is required');
    });

    it('throws ValidationError for invalid type', async () => {
      await expect(
        triggerBackfill.handler({
          params: undefined,
          input: { type: 'invalidOperation' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Invalid backfill type');
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        triggerBackfill.handler({
          params: undefined,
          input: { type: 'pdsScan' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('starts operation with type and metadata', async () => {
      const result = await triggerBackfill.handler({
        params: undefined,
        input: { type: 'fullReindex' },
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.startOperation).toHaveBeenCalledWith('fullReindex', {
        startedBy: ADMIN_DID,
      });
      expect(result.body).toHaveProperty('operation');
    });

    it('accepts all valid backfill types', async () => {
      const validTypes = [
        'pdsScan',
        'freshnessScan',
        'citationExtraction',
        'fullReindex',
        'governanceSync',
        'didSync',
      ];
      for (const type of validTypes) {
        vi.clearAllMocks();
        mockBackfillManager = createMockBackfillManager();
        mockContext = buildContext(adminUser);
        await triggerBackfill.handler({
          params: undefined,
          input: { type },
          auth: null,
          c: mockContext as never,
        });
        expect(mockBackfillManager.startOperation).toHaveBeenCalledWith(type, expect.any(Object));
      }
    });
  });

  // =========================================================================
  // Backfill: getBackfillStatus
  // =========================================================================
  describe('getBackfillStatus', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getBackfillStatus.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        getBackfillStatus.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('returns single operation when id is provided', async () => {
      const result = await getBackfillStatus.handler({
        params: { id: 'op-123' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.getStatus).toHaveBeenCalledWith('op-123');
      expect(result.body).toHaveProperty('operation');
    });

    it('lists operations with status filter', async () => {
      const result = await getBackfillStatus.handler({
        params: { status: 'running' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.listOperations).toHaveBeenCalledWith('running');
      expect(result.body).toHaveProperty('operations');
    });

    it('lists all operations when no params', async () => {
      const result = await getBackfillStatus.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.listOperations).toHaveBeenCalledWith(undefined);
      expect(result.body).toHaveProperty('operations');
    });
  });

  // =========================================================================
  // Backfill: getBackfillHistory
  // =========================================================================
  describe('getBackfillHistory', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getBackfillHistory.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        getBackfillHistory.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('filters out running operations and sorts by startedAt descending', async () => {
      const result = await getBackfillHistory.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { operations: { id: string; status: string }[] };
      // From our mock: op-1 completed, op-2 running, op-3 failed
      // Running (op-2) should be filtered out, sorted: op-3 (2024-01-03) then op-1 (2024-01-01)
      expect(body.operations).toHaveLength(2);
      expect(body.operations[0]?.id).toBe('op-3');
      expect(body.operations[1]?.id).toBe('op-1');
    });
  });

  // =========================================================================
  // Backfill: cancelBackfill
  // =========================================================================
  describe('cancelBackfill', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        cancelBackfill.handler({
          params: undefined,
          input: { id: 'op-123' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('throws ValidationError when id is missing', async () => {
      await expect(
        cancelBackfill.handler({
          params: undefined,
          input: { id: '' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('Operation ID is required');
    });

    it('rejects missing backfill manager', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        cancelBackfill.handler({
          params: undefined,
          input: { id: 'op-123' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('cancels operation and returns result', async () => {
      const result = await cancelBackfill.handler({
        params: undefined,
        input: { id: 'op-123' },
        auth: null,
        c: mockContext as never,
      });
      expect(mockBackfillManager.cancelOperation).toHaveBeenCalledWith('op-123');
      expect(result.body).toMatchObject({ success: true, id: 'op-123' });
    });
  });

  // =========================================================================
  // PDS: listPDSes
  // =========================================================================
  describe('listPDSes', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        listPDSes.handler({ params: undefined, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        listPDSes.handler({ params: undefined, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('computes stats from PDS entries', async () => {
      const result = await listPDSes.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as {
        stats: {
          total: number;
          healthy: number;
          unhealthy: number;
          withRecords: number;
        };
      };
      expect(body.stats.total).toBe(2);
      expect(body.stats.healthy).toBe(1);
      expect(body.stats.unhealthy).toBe(1);
      expect(body.stats.withRecords).toBe(1);
    });
  });

  // =========================================================================
  // PDS: rescanPDS
  // =========================================================================
  describe('rescanPDS', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        rescanPDS.handler({
          params: undefined,
          input: { pdsUrl: 'https://pds.test' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('throws ValidationError when pdsUrl is missing', async () => {
      await expect(
        rescanPDS.handler({
          params: undefined,
          input: { pdsUrl: '' },
          auth: null,
          c: mockContext as never,
        })
      ).rejects.toThrow('PDS URL is required');
    });

    it('registers PDS and returns success', async () => {
      const result = await rescanPDS.handler({
        params: undefined,
        input: { pdsUrl: 'https://pds.test' },
        auth: null,
        c: mockContext as never,
      });
      expect(mockPdsRegistry.registerPDS).toHaveBeenCalledWith('https://pds.test', 'did_mention');
      expect(result.body).toMatchObject({ success: true, pdsUrl: 'https://pds.test' });
    });
  });

  // =========================================================================
  // PDS: listImports
  // =========================================================================
  describe('listImports', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        listImports.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        listImports.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('uses default limit of 50', async () => {
      await listImports.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listImports).toHaveBeenCalledWith(50, 0, undefined);
    });

    it('passes source filter', async () => {
      await listImports.handler({
        params: { limit: 10, source: 'arxiv' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listImports).toHaveBeenCalledWith(10, 0, 'arxiv');
    });
  });

  // =========================================================================
  // Knowledge Graph: getGraphStats
  // =========================================================================
  describe('getGraphStats', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getGraphStats.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('queries node and edge counts in parallel', async () => {
      const result = await getGraphStats.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockNodeRepository.listNodes).toHaveBeenCalled();
      expect(mockEdgeRepository.listEdges).toHaveBeenCalled();
      const body = result.body as { totalNodes: number; totalEdges: number };
      expect(body.totalNodes).toBe(100);
      expect(body.totalEdges).toBe(50);
    });

    it('includes pending proposals count', async () => {
      const result = await getGraphStats.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { pendingProposals: number };
      expect(body.pendingProposals).toBe(3);
    });
  });

  // =========================================================================
  // Metrics: getMetricsOverview
  // =========================================================================
  describe('getMetricsOverview', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getMetricsOverview.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('uses default 7 days', async () => {
      const result = await getMetricsOverview.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockMetricsService.getTrending).toHaveBeenCalledWith('7d', 20);
      const body = result.body as { periodInfo: { days: number } };
      expect(body.periodInfo.days).toBe(7);
    });

    it('maps days=1 to 24h window', async () => {
      await getMetricsOverview.handler({
        params: { days: 1 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockMetricsService.getTrending).toHaveBeenCalledWith('24h', 20);
    });

    it('maps days=30 to 30d window', async () => {
      await getMetricsOverview.handler({
        params: { days: 30 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockMetricsService.getTrending).toHaveBeenCalledWith('30d', 20);
    });
  });

  // =========================================================================
  // Metrics: getSearchAnalytics
  // =========================================================================
  describe('getSearchAnalytics', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getSearchAnalytics.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        getSearchAnalytics.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('returns analytics from admin service', async () => {
      const result = await getSearchAnalytics.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(result.body).toMatchObject({ totalSearches: 100 });
    });
  });

  // =========================================================================
  // Metrics: getActivityCorrelation
  // =========================================================================
  describe('getActivityCorrelation', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getActivityCorrelation.handler({
          params: undefined,
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('returns empty metrics when activity service is not configured', async () => {
      const ctx = {
        get: vi.fn((key: string) => {
          if (key === 'user') return adminUser;
          if (key === 'services') return { activity: null };
          if (key === 'logger') return mockLogger;
          return undefined;
        }),
        set: vi.fn(),
      };

      const result = await getActivityCorrelation.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: ctx as never,
      });
      const body = result.body as { metrics: unknown[] };
      expect(body.metrics).toEqual([]);
    });

    it('returns metrics from activity service', async () => {
      const result = await getActivityCorrelation.handler({
        params: undefined,
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { metrics: unknown[] };
      expect(body.metrics).toHaveLength(1);
    });
  });

  // =========================================================================
  // Metrics: getTrendingVelocity
  // =========================================================================
  describe('getTrendingVelocity', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getTrendingVelocity.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('uses default window 24h and limit 20', async () => {
      await getTrendingVelocity.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockMetricsService.getTrending).toHaveBeenCalledWith('24h', 20);
    });

    it('enriches entries with title and metrics', async () => {
      mockMetricsService.getTrending.mockResolvedValueOnce([
        { uri: 'at://test', score: 50, velocity: 0.5 },
      ]);
      mockEprintService.getEprint = vi.fn().mockResolvedValue({ title: 'Test Paper' });
      mockMetricsService.getMetrics.mockResolvedValueOnce({
        totalViews: 200,
        totalDownloads: 30,
      });

      const result = await getTrendingVelocity.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { items: { title: string; trend: string }[] };
      expect(body.items[0]?.title).toBe('Test Paper');
      expect(body.items[0]?.trend).toBe('rising');
    });
  });

  // =========================================================================
  // Metrics: getViewDownloadTimeSeries
  // =========================================================================
  describe('getViewDownloadTimeSeries', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getViewDownloadTimeSeries.handler({
          params: {},
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        getViewDownloadTimeSeries.handler({
          params: {},
          input: undefined,
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('passes uri and granularity to admin service', async () => {
      await getViewDownloadTimeSeries.handler({
        params: { uri: 'at://test', granularity: 'day' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.getViewDownloadTimeSeries).toHaveBeenCalledWith('at://test', 'day');
    });
  });

  // =========================================================================
  // Governance: getAuditLog
  // =========================================================================
  describe('getAuditLog', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        getAuditLog.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        getAuditLog.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('uses default limit 50 and offset 0', async () => {
      await getAuditLog.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.getAuditLog).toHaveBeenCalledWith(50, 0, undefined);
    });

    it('parses cursor as numeric offset and passes actorDid', async () => {
      await getAuditLog.handler({
        params: { limit: 10, cursor: '5', actorDid: 'did:plc:actor' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.getAuditLog).toHaveBeenCalledWith(10, 5, 'did:plc:actor');
    });

    it('returns entries with cursor for pagination', async () => {
      mockAdminService.getAuditLog.mockResolvedValueOnce({
        entries: [{ id: '1' }],
        total: 10,
      });

      const result = await getAuditLog.handler({
        params: { limit: 1 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { entries: unknown[]; cursor: string; total: number };
      expect(body.cursor).toBe('1');
      expect(body.total).toBe(10);
    });

    it('returns undefined cursor when all entries have been returned', async () => {
      mockAdminService.getAuditLog.mockResolvedValueOnce({
        entries: [{ id: '1' }],
        total: 1,
      });

      const result = await getAuditLog.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { cursor: string | undefined };
      expect(body.cursor).toBeUndefined();
    });
  });

  // =========================================================================
  // Governance: listWarnings
  // =========================================================================
  describe('listWarnings', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        listWarnings.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        listWarnings.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('uses default limit 50 and passes optional DID filter', async () => {
      await listWarnings.handler({
        params: { did: 'did:plc:offender' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listWarnings).toHaveBeenCalledWith(50, 'did:plc:offender');
    });

    it('returns warnings', async () => {
      const result = await listWarnings.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { warnings: unknown[] };
      expect(body.warnings).toHaveLength(1);
    });
  });

  // =========================================================================
  // Governance: listViolations
  // =========================================================================
  describe('listViolations', () => {
    it('rejects non-admin users', async () => {
      const ctx = buildContext(nonAdminUser);
      await expect(
        listViolations.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects missing admin service', async () => {
      const ctx = buildContextWithoutAdmin(adminUser);
      await expect(
        listViolations.handler({ params: {}, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('uses default limit 50 and passes optional DID filter', async () => {
      await listViolations.handler({
        params: { limit: 25, did: 'did:plc:violator' },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      expect(mockAdminService.listViolations).toHaveBeenCalledWith(25, 'did:plc:violator');
    });

    it('returns violations', async () => {
      const result = await listViolations.handler({
        params: {},
        input: undefined,
        auth: null,
        c: mockContext as never,
      });
      const body = result.body as { violations: unknown[] };
      expect(body.violations).toHaveLength(1);
    });
  });

  // =========================================================================
  // Null user (no auth at all)
  // =========================================================================
  describe('null user auth checks', () => {
    it('rejects null user for getOverview', async () => {
      const ctx = buildContext(null);
      await expect(
        getOverview.handler({ params: undefined, input: undefined, auth: null, c: ctx as never })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects null user for assignRole', async () => {
      const ctx = buildContext(null);
      await expect(
        assignRole.handler({
          params: undefined,
          input: { did: 'did:plc:x', role: 'admin' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects null user for deleteContent', async () => {
      const ctx = buildContext(null);
      await expect(
        deleteContent.handler({
          params: undefined,
          input: { uri: 'at://x', collection: 'pub.chive.eprint.submission' },
          auth: null,
          c: ctx as never,
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });
});

// ===========================================================================
// actor.getMyRoles
// ===========================================================================
describe('XRPC actor.getMyRoles', () => {
  let mockLogger: ILogger;
  let mockRedis: MockRedis;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockRedis = createMockRedis();
  });

  function buildCtx(user: { did: string; isAdmin?: boolean } | null): {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  } {
    return {
      get: vi.fn((key: string) => {
        if (key === 'user') return user;
        if (key === 'logger') return mockLogger;
        if (key === 'redis') return mockRedis;
        return undefined;
      }),
      set: vi.fn(),
    };
  }

  it('throws AuthenticationError when user is not authenticated', async () => {
    const ctx = buildCtx(null);
    await expect(
      getMyRoles.handler({ params: undefined, input: undefined, auth: null, c: ctx as never })
    ).rejects.toThrow('Authentication required');
  });

  it('throws AuthenticationError when user has no DID', async () => {
    const ctx = buildCtx({ did: '' });
    await expect(
      getMyRoles.handler({ params: undefined, input: undefined, auth: null, c: ctx as never })
    ).rejects.toThrow('Authentication required');
  });

  it('returns roles from Redis', async () => {
    mockRedis.smembers.mockResolvedValueOnce(['reader', 'alpha-tester']);
    const ctx = buildCtx({ did: 'did:plc:user1' });

    const result = await getMyRoles.handler({
      params: undefined,
      input: undefined,
      auth: null,
      c: ctx as never,
    });
    expect(mockRedis.smembers).toHaveBeenCalledWith('chive:authz:roles:did:plc:user1');
    expect(result.body.roles).toEqual(['reader', 'alpha-tester']);
    expect(result.body.isAdmin).toBe(false);
    expect(result.body.isAlphaTester).toBe(true);
    expect(result.body.isPremium).toBe(false);
  });

  it('sets isAdmin true when user has admin role', async () => {
    mockRedis.smembers.mockResolvedValueOnce(['admin']);
    const ctx = buildCtx({ did: 'did:plc:admin1' });

    const result = await getMyRoles.handler({
      params: undefined,
      input: undefined,
      auth: null,
      c: ctx as never,
    });
    expect(result.body.isAdmin).toBe(true);
    expect(result.body.isAlphaTester).toBe(true);
    expect(result.body.isPremium).toBe(true);
  });

  it('returns empty roles when user has none', async () => {
    mockRedis.smembers.mockResolvedValueOnce([]);
    const ctx = buildCtx({ did: 'did:plc:empty' });

    const result = await getMyRoles.handler({
      params: undefined,
      input: undefined,
      auth: null,
      c: ctx as never,
    });
    expect(result.body.roles).toEqual([]);
    expect(result.body.isAdmin).toBe(false);
    expect(result.body.isAlphaTester).toBe(false);
    expect(result.body.isPremium).toBe(false);
  });

  it('grants premium access to admin users', async () => {
    mockRedis.smembers.mockResolvedValueOnce(['admin']);
    const ctx = buildCtx({ did: 'did:plc:admin2' });

    const result = await getMyRoles.handler({
      params: undefined,
      input: undefined,
      auth: null,
      c: ctx as never,
    });
    expect(result.body.isPremium).toBe(true);
  });
});
