/**
 * Integration tests for XRPC alpha application endpoints.
 *
 * @remarks
 * Tests the full request/response cycle through the Hono server
 * including middleware, handlers, and service integration.
 *
 * Requires Docker test stack running (PostgreSQL 16+, Redis 7+).
 *
 * @packageDocumentation
 */

import type { Hono } from 'hono';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { createServer, type ServerConfig } from '@/api/server.js';
import type { ChiveEnv } from '@/api/types/context.js';
import { AlphaApplicationService } from '@/services/alpha/alpha-application-service.js';
import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import { getRedisConfig } from '@/storage/redis/structures.js';
import type { DID } from '@/types/atproto.js';

import {
  createMockAuthzService,
  createMockLogger,
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
  createMockEprintService,
  createNoOpRelevanceLogger,
  createMockServiceAuthVerifier,
} from '../../../helpers/mock-services.js';

// Test constants
const TEST_USER = 'did:plc:alphauser123' as DID;
const TEST_USER_2 = 'did:plc:alphauser456' as DID;
// Unique IPs for alpha tests to avoid rate limit collisions
const ALPHA_TEST_IP = '192.168.200.1';
// Separate IPs for unauthenticated tests to avoid cross-test rate limiting
const UNAUTH_TEST_IP_1 = '192.168.200.100';
const UNAUTH_TEST_IP_2 = '192.168.200.101';

/**
 * Makes test request with unique IP to avoid rate limit collisions.
 */
function testRequest(
  app: Hono<ChiveEnv>,
  url: string,
  init?: RequestInit
): Response | Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-Forwarded-For', ALPHA_TEST_IP);
  return app.request(url, { ...init, headers });
}

/**
 * Response type for alpha apply endpoint.
 */
interface AlphaApplyResponse {
  applicationId: string;
  status: string;
}

/**
 * Response type for alpha status endpoint.
 */
interface AlphaStatusResponse {
  status: string;
  appliedAt?: string;
  reviewedAt?: string;
}

/**
 * ATProto-compliant error response type.
 */
interface ErrorResponse {
  error: string;
  message: string;
}

describe('XRPC Alpha Application Endpoints Integration', () => {
  let app: Hono<ChiveEnv>;
  let pool: Pool;
  let redis: Redis;
  let alphaService: AlphaApplicationService;
  let mockAuthz: ReturnType<typeof createMockAuthzService>;
  const logger = createMockLogger();

  beforeAll(() => {
    // Initialize PostgreSQL
    const dbConfig = getDatabaseConfig();
    pool = new Pool(dbConfig);

    // Initialize Redis
    const redisConfig = getRedisConfig();
    redis = new Redis(redisConfig);

    // Create real alpha service with database
    alphaService = new AlphaApplicationService({ pool, logger });

    // Create mocks
    mockAuthz = createMockAuthzService();
    const mockVerifier = createMockServiceAuthVerifier();

    // Create server with full configuration
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
      authzService: mockAuthz,
      alphaService,
      redis,
      logger,
      serviceDid: 'did:web:test.chive.pub',
      serviceAuthVerifier: mockVerifier,
    };

    app = createServer(serverConfig);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query("DELETE FROM alpha_applications WHERE email LIKE '%test%'");
    await redis.quit();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test applications
    await pool.query("DELETE FROM alpha_applications WHERE did LIKE 'did:plc:alpha%'");

    // Clear rate limit keys
    const keys = await redis.keys('chive:ratelimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    vi.clearAllMocks();

    // Reset mock to return no roles by default
    vi.mocked(mockAuthz.getRoles).mockResolvedValue([]);
  });

  describe('POST /xrpc/pub.chive.alpha.apply', () => {
    it('creates a new alpha application', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.alpha.apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer token-for-${TEST_USER}`,
        },
        body: JSON.stringify({
          email: 'researcher-test@university.edu',
          sector: 'academia',
          careerStage: 'postdoc',
          researchKeywords: [{ label: 'Computational Linguistics' }],
          motivation: 'I want to test the platform',
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as AlphaApplyResponse;
      expect(body.applicationId).toBeDefined();
      expect(body.status).toBe('pending');
    });

    it('rejects application without authentication', async () => {
      // Use unique IP to avoid rate limit interference from other tests
      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Forwarded-For': UNAUTH_TEST_IP_1,
      });
      const response = await app.request('/xrpc/pub.chive.alpha.apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: 'test@example.com',
          sector: 'academia',
          careerStage: 'postdoc',
          researchKeywords: [{ label: 'Test Field' }],
        }),
      });

      expect(response.status).toBe(401);
    });

    it('rejects duplicate applications', async () => {
      // First application
      await testRequest(app, '/xrpc/pub.chive.alpha.apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer token-for-${TEST_USER}`,
        },
        body: JSON.stringify({
          email: 'duplicate-test@university.edu',
          sector: 'academia',
          careerStage: 'graduate-phd',
          researchKeywords: [{ label: 'Syntax' }],
        }),
      });

      // Second application from same user
      const response = await testRequest(app, '/xrpc/pub.chive.alpha.apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer token-for-${TEST_USER}`,
        },
        body: JSON.stringify({
          email: 'duplicate-test2@university.edu',
          sector: 'academia',
          careerStage: 'postdoc',
          researchKeywords: [{ label: 'Semantics' }],
        }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as ErrorResponse;
      expect(body.message).toMatch(/already submitted/i);
    });

    it('validates required fields', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.alpha.apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer token-for-${TEST_USER_2}`,
        },
        body: JSON.stringify({
          // Missing required fields
          motivation: 'optional field only',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('validates email format', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.alpha.apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer token-for-${TEST_USER_2}`,
        },
        body: JSON.stringify({
          email: 'not-an-email',
          sector: 'academia',
          careerStage: 'postdoc',
          researchKeywords: [{ label: 'Test Field' }],
        }),
      });

      expect(response.status).toBe(400);
    });

    it('accepts "other" sector with write-in', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.alpha.apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer token-for-${TEST_USER_2}`,
        },
        body: JSON.stringify({
          email: 'other-sector-test@university.edu',
          sector: 'other',
          sectorOther: 'Science journalism',
          careerStage: 'other',
          careerStageOther: 'Freelance consultant',
          researchKeywords: [{ label: 'Science Communication' }],
        }),
      });

      expect(response.status).toBe(200);
    });

    it('accepts application with affiliation', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.alpha.apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer token-for-${TEST_USER_2}`,
        },
        body: JSON.stringify({
          email: 'affiliation-test@mit.edu',
          sector: 'academia',
          careerStage: 'junior-faculty',
          affiliations: [
            {
              name: 'Massachusetts Institute of Technology',
              rorId: 'https://ror.org/042nb2s44',
            },
          ],
          researchKeywords: [{ label: 'Computer Science' }],
        }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /xrpc/pub.chive.alpha.checkStatus', () => {
    it('returns "none" for users without application', async () => {
      const response = await testRequest(app, '/xrpc/pub.chive.alpha.checkStatus', {
        method: 'GET',
        headers: {
          Authorization: `Bearer token-for-${TEST_USER_2}`,
        },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as AlphaStatusResponse;
      expect(body.status).toBe('none');
    });

    it('returns "pending" for submitted application', async () => {
      // Submit an application first
      await testRequest(app, '/xrpc/pub.chive.alpha.apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer token-for-${TEST_USER}`,
        },
        body: JSON.stringify({
          email: 'status-test@university.edu',
          sector: 'academia',
          careerStage: 'graduate-phd',
          researchKeywords: [{ label: 'Phonology' }],
        }),
      });

      // Check status
      const response = await testRequest(app, '/xrpc/pub.chive.alpha.checkStatus', {
        method: 'GET',
        headers: {
          Authorization: `Bearer token-for-${TEST_USER}`,
        },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as AlphaStatusResponse;
      expect(body.status).toBe('pending');
      expect(body.appliedAt).toBeDefined();
      expect(body.reviewedAt).toBeUndefined();
    });

    it('rejects status check without authentication', async () => {
      // Use unique IP to avoid rate limit interference from other tests
      const headers = new Headers({
        'X-Forwarded-For': UNAUTH_TEST_IP_2,
      });
      const response = await app.request('/xrpc/pub.chive.alpha.checkStatus', {
        method: 'GET',
        headers,
      });

      expect(response.status).toBe(401);
    });
  });
});
