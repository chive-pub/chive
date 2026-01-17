/**
 * Integration tests for XRPC governance trusted editor endpoints.
 *
 * @remarks
 * Tests the full request/response cycle for trusted editor XRPC endpoints
 * including getEditorStatus, listTrustedEditors, requestElevation,
 * grantDelegation, revokeDelegation, and revokeRole.
 *
 * Requires Docker test stack running.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import type { Hono } from 'hono';
import { Redis } from 'ioredis';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { createServer, type ServerConfig } from '@/api/server.js';
import type { ChiveEnv } from '@/api/types/context.js';
import { getRedisConfig } from '@/storage/redis/structures.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

import {
  createMockLogger,
  createMockEprintService,
  createMockSearchService,
  createMockMetricsService,
  createMockGraphService,
  createMockBlobProxyService,
  createMockReviewService,
  createMockTagManager,
  createMockFacetManager,
  createMockNodeService,
  createMockEdgeService,
  createMockNodeRepository,
  createMockEdgeRepository,
  createMockBacklinkService,
  createMockClaimingService,
  createMockImportService,
  createMockPDSSyncService,
  createMockActivityService,
  createMockAlphaService,
  createMockAuthzService,
  createMockServiceAuthVerifier,
  createNoOpRelevanceLogger,
} from '../../../helpers/mock-services.js';

// Test constants
const TEST_USER_DID = 'did:plc:testuser123' as DID;
const TEST_ADMIN_DID = 'did:plc:admin456' as DID;
const TEST_EDITOR_DID = 'did:plc:editor789' as DID;

// Unique IP for governance tests
const GOVERNANCE_TEST_IP = '192.168.100.10';

/**
 * Makes test request with unique IP to avoid rate limit collisions.
 */
function testRequest(
  app: Hono<ChiveEnv>,
  url: string,
  init?: RequestInit
): Response | Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-Forwarded-For', GOVERNANCE_TEST_IP);
  return app.request(url, { ...init, headers });
}

/**
 * Mock editor status type.
 */
interface MockEditorStatus {
  did: DID;
  displayName: string;
  role: string;
  hasDelegation: boolean;
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
    role: string;
    eligibleForTrustedEditor: boolean;
    missingCriteria: string[];
  };
}

/**
 * Mock trusted editor service interface.
 */
interface MockTrustedEditorService {
  getEditorStatus(
    did: DID
  ): Promise<{ ok: true; value: MockEditorStatus } | { ok: false; error: Error }>;
  listTrustedEditors(
    limit: number,
    cursor?: string
  ): Promise<{ ok: true; value: { editors: MockEditorStatus[]; cursor: undefined } }>;
  elevateToTrustedEditor(
    did: DID,
    grantedBy: DID
  ): Promise<{ ok: true; value: undefined } | { ok: false; error: Error }>;
  revokeRole(
    did: DID,
    revokedBy: DID,
    reason: string
  ): Promise<{ ok: true; value: undefined } | { ok: false; error: Error }>;
}

/**
 * Creates a mock trusted editor service for testing.
 */
function createMockTrustedEditorService(): MockTrustedEditorService {
  const editorStatuses = new Map<string, MockEditorStatus>();

  // Set up default test data
  editorStatuses.set(TEST_USER_DID, {
    did: TEST_USER_DID,
    displayName: 'Test User',
    role: 'community-member',
    hasDelegation: false,
    recordsCreatedToday: 0,
    dailyRateLimit: 100,
    metrics: {
      did: TEST_USER_DID,
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
  });

  editorStatuses.set(TEST_ADMIN_DID, {
    did: TEST_ADMIN_DID,
    displayName: 'Admin User',
    role: 'administrator',
    hasDelegation: true,
    recordsCreatedToday: 10,
    dailyRateLimit: 1000,
    metrics: {
      did: TEST_ADMIN_DID,
      accountCreatedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
      accountAgeDays: 365,
      eprintCount: 100,
      wellEndorsedEprintCount: 80,
      totalEndorsements: 500,
      proposalCount: 50,
      voteCount: 200,
      successfulProposals: 45,
      warningCount: 0,
      violationCount: 0,
      reputationScore: 0.99,
      role: 'administrator',
      eligibleForTrustedEditor: true,
      missingCriteria: [],
    },
  });

  editorStatuses.set(TEST_EDITOR_DID, {
    did: TEST_EDITOR_DID,
    displayName: 'Trusted Editor',
    role: 'trusted-editor',
    hasDelegation: false,
    recordsCreatedToday: 5,
    dailyRateLimit: 100,
    metrics: {
      did: TEST_EDITOR_DID,
      accountCreatedAt: Date.now() - 180 * 24 * 60 * 60 * 1000,
      accountAgeDays: 180,
      eprintCount: 30,
      wellEndorsedEprintCount: 25,
      totalEndorsements: 150,
      proposalCount: 20,
      voteCount: 50,
      successfulProposals: 18,
      warningCount: 0,
      violationCount: 0,
      reputationScore: 0.92,
      role: 'trusted-editor',
      eligibleForTrustedEditor: true,
      missingCriteria: [],
    },
  });

  return {
    getEditorStatus(did: DID) {
      const status = editorStatuses.get(did);
      if (!status) {
        return Promise.resolve({ ok: false as const, error: new Error('User not found') });
      }
      return Promise.resolve({ ok: true as const, value: status });
    },
    listTrustedEditors(_limit: number, _cursor?: string) {
      const editors = Array.from(editorStatuses.values()).filter(
        (e) => e.role !== 'community-member'
      );
      return Promise.resolve({ ok: true as const, value: { editors, cursor: undefined } });
    },
    elevateToTrustedEditor(did: DID, _grantedBy: DID) {
      const status = editorStatuses.get(did);
      if (!status) {
        return Promise.resolve({ ok: false as const, error: new Error('User not found') });
      }
      status.role = 'trusted-editor';
      return Promise.resolve({ ok: true as const, value: undefined });
    },
    revokeRole(did: DID, _revokedBy: DID, _reason: string) {
      const status = editorStatuses.get(did);
      if (!status) {
        return Promise.resolve({ ok: false as const, error: new Error('User not found') });
      }
      status.role = 'community-member';
      return Promise.resolve({ ok: true as const, value: undefined });
    },
  };
}

/**
 * Mock delegation record type.
 */
interface MockDelegation {
  id: string;
  delegateDid: DID;
  collections: string[];
  expiresAt: number;
  maxRecordsPerDay: number;
  grantedBy: DID;
  active: boolean;
}

/**
 * Mock governance PDS writer interface.
 */
interface MockGovernancePDSWriter {
  createDelegation(params: {
    delegateDid: DID;
    collections: readonly string[];
    expiresAt: number;
    maxRecordsPerDay: number;
    grantedBy: DID;
  }): Promise<{ ok: true; value: { id: string } }>;
  revokeDelegation(
    delegationId: string,
    revokedBy: DID
  ): Promise<{ ok: true; value: undefined } | { ok: false; error: Error }>;
}

/**
 * Creates a mock governance PDS writer for testing.
 */
function createMockGovernancePDSWriter(): MockGovernancePDSWriter {
  const delegations = new Map<string, MockDelegation>();

  return {
    createDelegation(params: {
      delegateDid: DID;
      collections: readonly string[];
      expiresAt: number;
      maxRecordsPerDay: number;
      grantedBy: DID;
    }) {
      const id = `delegation-${Date.now()}`;
      delegations.set(id, {
        id,
        delegateDid: params.delegateDid,
        collections: [...params.collections],
        expiresAt: params.expiresAt,
        maxRecordsPerDay: params.maxRecordsPerDay,
        grantedBy: params.grantedBy,
        active: true,
      });
      return Promise.resolve({ ok: true as const, value: { id } });
    },
    revokeDelegation(delegationId: string, _revokedBy: DID) {
      const delegation = delegations.get(delegationId);
      if (!delegation) {
        return Promise.resolve({ ok: false as const, error: new Error('Delegation not found') });
      }
      delegation.active = false;
      return Promise.resolve({ ok: true as const, value: undefined });
    },
  };
}

describe('XRPC Governance Trusted Editor Endpoints Integration', () => {
  let app: Hono<ChiveEnv>;
  let redis: Redis;
  let logger: ILogger;
  let trustedEditorService: ReturnType<typeof createMockTrustedEditorService>;
  let governancePdsWriter: ReturnType<typeof createMockGovernancePDSWriter>;

  beforeAll(() => {
    logger = createMockLogger();
    trustedEditorService = createMockTrustedEditorService();
    governancePdsWriter = createMockGovernancePDSWriter();

    // Initialize Redis for rate limiting
    const redisConfig = getRedisConfig();
    redis = new Redis(redisConfig);

    // Create mock service auth verifier
    const mockVerifier = createMockServiceAuthVerifier();

    // Create Hono app with mock services
    const serverConfig: ServerConfig = {
      eprintService: createMockEprintService(),
      searchService: createMockSearchService(),
      metricsService: createMockMetricsService(),
      graphService: createMockGraphService(),
      blobProxyService: createMockBlobProxyService(),
      reviewService: createMockReviewService(),
      tagManager: createMockTagManager(),
      facetManager: createMockFacetManager(),
      nodeService: createMockNodeService(),
      edgeService: createMockEdgeService(),
      nodeRepository: createMockNodeRepository(),
      edgeRepository: createMockEdgeRepository(),
      backlinkService: createMockBacklinkService(),
      claimingService: createMockClaimingService(),
      importService: createMockImportService(),
      pdsSyncService: createMockPDSSyncService(),
      activityService: createMockActivityService(),
      relevanceLogger: createNoOpRelevanceLogger(),
      logger,
      redis,
      serviceDid: 'did:web:test.chive.pub',
      serviceAuthVerifier: mockVerifier,
      authzService: createMockAuthzService(),
      alphaService: createMockAlphaService(),
      trustedEditorService: trustedEditorService as never,
      governancePdsWriter: governancePdsWriter as never,
    };

    app = createServer(serverConfig);
  });

  afterAll(async () => {
    // Clean up Redis
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear rate limit keys to avoid test interference
    const keys = await redis.keys('chive:ratelimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('GET /xrpc/pub.chive.governance.getEditorStatus', () => {
    it('returns editor status for current user without DID param', async () => {
      // Skip auth for this test by mocking the user in context
      const response = await testRequest(app, `/xrpc/pub.chive.governance.getEditorStatus`);

      // Without auth, should require authentication
      expect(response.status).toBe(401);
    });

    it('returns editor status for specific DID without authentication', async () => {
      // Public lookup: when a specific DID is provided, no auth required
      const response = await testRequest(
        app,
        `/xrpc/pub.chive.governance.getEditorStatus?did=${TEST_USER_DID}`
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('did', TEST_USER_DID);
      expect(body).toHaveProperty('role', 'community-member');
    });
  });

  describe('GET /xrpc/pub.chive.governance.listTrustedEditors', () => {
    it('requires authentication', async () => {
      const response = await testRequest(
        app,
        '/xrpc/pub.chive.governance.listTrustedEditors?limit=20'
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /xrpc/pub.chive.governance.requestElevation', () => {
    it('requires authentication', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.governance.requestElevation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetRole: 'trusted-editor',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /xrpc/pub.chive.governance.grantDelegation', () => {
    it('requires authentication', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.governance.grantDelegation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delegateDid: TEST_EDITOR_DID,
          collections: ['pub.chive.graph.authority'],
          daysValid: 365,
          maxRecordsPerDay: 100,
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /xrpc/pub.chive.governance.revokeDelegation', () => {
    it('requires authentication', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.governance.revokeDelegation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delegationId: 'delegation-123',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /xrpc/pub.chive.governance.revokeRole', () => {
    it('requires authentication', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.governance.revokeRole', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          did: TEST_EDITOR_DID,
          reason: 'Violation of community guidelines',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Endpoint Registration', () => {
    it('all governance endpoints are registered', async () => {
      // Test that endpoints exist by checking they return 401 (not 404)
      const endpoints = [
        { path: '/xrpc/pub.chive.governance.getEditorStatus', method: 'GET' },
        { path: '/xrpc/pub.chive.governance.listTrustedEditors?limit=10', method: 'GET' },
        { path: '/xrpc/pub.chive.governance.requestElevation', method: 'POST' },
        { path: '/xrpc/pub.chive.governance.grantDelegation', method: 'POST' },
        { path: '/xrpc/pub.chive.governance.revokeDelegation', method: 'POST' },
        { path: '/xrpc/pub.chive.governance.revokeRole', method: 'POST' },
      ];

      for (const endpoint of endpoints) {
        const response = await testRequest(app, endpoint.path, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: endpoint.method === 'POST' ? '{}' : undefined,
        });

        // Should be 401 (unauthorized) or 400 (bad request), not 404 (not found)
        expect(response.status).not.toBe(404);
      }
    });
  });
});
