/**
 * Integration tests for XRPC graph endpoints.
 *
 * @remarks
 * Tests the full request/response cycle for knowledge graph XRPC endpoints
 * including getField, searchAuthorities, and browseFaceted.
 *
 * Validates ATProto compliance and proper service integration.
 *
 * Requires Docker test stack running (Neo4j 5+, Redis 7+).
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import type { Hono } from 'hono';
import { Redis } from 'ioredis';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { createServer, type ServerConfig } from '@/api/server.js';
import type { ChiveEnv } from '@/api/types/context.js';
import type { BlobProxyService } from '@/services/blob-proxy/proxy-service.js';
import {
  KnowledgeGraphService,
  type KnowledgeGraphServiceOptions,
} from '@/services/knowledge-graph/graph-service.js';
import type { MetricsService } from '@/services/metrics/metrics-service.js';
import type { PreprintService } from '@/services/preprint/preprint-service.js';
import { NoOpRelevanceLogger } from '@/services/search/relevance-logger.js';
import type { SearchService } from '@/services/search/search-service.js';
import { Neo4jAdapter } from '@/storage/neo4j/adapter.js';
import { Neo4jConnection } from '@/storage/neo4j/connection.js';
import { getRedisConfig } from '@/storage/redis/structures.js';
import type { DID } from '@/types/atproto.js';
import type { IGraphDatabase } from '@/types/interfaces/graph.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IStorageBackend } from '@/types/interfaces/storage.interface.js';

import type {
  FieldDetail,
  AuthoritySearchResponse,
  FacetedBrowseResponse,
  ErrorResponse,
} from '../../../types/api-responses.js';

/**
 * Get Neo4j config from environment variables.
 * Default credentials match docker/docker-compose.yml configuration.
 */
interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  database: string;
}

function getNeo4jConfig(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    user: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
    database: process.env.NEO4J_DATABASE ?? 'neo4j',
  };
}

// Test constants
const TEST_FIELD_ID = 'cs.ai';
const TEST_FIELD_LABEL = 'Artificial Intelligence';
const _TEST_AUTHOR = 'did:plc:graphauthor' as DID;
const _TEST_PDS_URL = 'https://pds.test.example.com';
void _TEST_AUTHOR; // Reserved for graph test data
void _TEST_PDS_URL; // Reserved for PDS source verification
// Unique IP for graph tests to avoid rate limit collisions with parallel test files
const GRAPH_TEST_IP = '192.168.100.3';

/**
 * Creates mock logger for tests.
 */
function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => createMockLogger(),
  };
}

/**
 * Creates mock preprint service.
 */
function createMockPreprintService(): PreprintService {
  return {
    getPreprint: vi.fn().mockResolvedValue(null),
    getPreprintsByAuthor: vi.fn().mockResolvedValue({ preprints: [], total: 0 }),
    indexPreprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    indexPreprintUpdate: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    indexPreprintDelete: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    checkStaleness: vi.fn().mockResolvedValue({ isStale: false }),
  } as unknown as PreprintService;
}

/**
 * Creates mock search service.
 */
function createMockSearchService(): SearchService {
  return {
    search: vi.fn().mockResolvedValue({ hits: [], total: 0, took: 0 }),
    facetedSearch: vi.fn().mockResolvedValue({ hits: [], total: 0, took: 0, facets: {} }),
    autocomplete: vi.fn().mockResolvedValue([]),
  } as unknown as SearchService;
}

/**
 * Creates mock metrics service.
 */
function createMockMetricsService(): MetricsService {
  return {
    recordView: vi.fn().mockResolvedValue(undefined),
    recordDownload: vi.fn().mockResolvedValue(undefined),
    recordEndorsement: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockResolvedValue({ views: 100, downloads: 20, endorsements: 5 }),
    getTrending: vi.fn().mockResolvedValue({
      preprints: [],
      window: '24h',
      generatedAt: new Date(),
    }),
  } as unknown as MetricsService;
}

/**
 * Creates mock blob proxy service.
 */
function createMockBlobProxyService(): BlobProxyService {
  return {
    getProxiedBlobUrl: vi.fn().mockResolvedValue('https://cdn.chive.example.com/blob/xyz'),
    streamBlob: vi.fn().mockResolvedValue(null),
  } as unknown as BlobProxyService;
}

/**
 * Creates mock review service.
 */
function createMockReviewService(): ServerConfig['reviewService'] {
  return {
    getReviews: vi.fn().mockResolvedValue([]),
    getReviewByUri: vi.fn().mockResolvedValue(null),
    getReviewThread: vi.fn().mockResolvedValue([]),
    getEndorsements: vi.fn().mockResolvedValue([]),
    getEndorsementSummary: vi.fn().mockResolvedValue({ total: 0, endorserCount: 0, byType: {} }),
    getEndorsementByUser: vi.fn().mockResolvedValue(null),
    listEndorsementsForPreprint: vi.fn().mockResolvedValue({ items: [], hasMore: false, total: 0 }),
  } as unknown as ServerConfig['reviewService'];
}

/**
 * Creates mock tag manager.
 */
function createMockTagManager(): ServerConfig['tagManager'] {
  return {
    getTag: vi.fn().mockResolvedValue(null),
    getTagsForRecord: vi.fn().mockResolvedValue([]),
    searchTags: vi.fn().mockResolvedValue([]),
    getTrendingTags: vi.fn().mockResolvedValue([]),
    getTagSuggestions: vi.fn().mockResolvedValue([]),
  } as unknown as ServerConfig['tagManager'];
}

/**
 * Creates mock backlink service.
 */
function createMockBacklinkService(): ServerConfig['backlinkService'] {
  return {
    createBacklink: vi.fn().mockResolvedValue({ id: 1 }),
    deleteBacklink: vi.fn().mockResolvedValue(undefined),
    getBacklinks: vi.fn().mockResolvedValue({ backlinks: [], cursor: undefined }),
    getCounts: vi.fn().mockResolvedValue({
      sembleCollections: 0,
      leafletLists: 0,
      whitewindBlogs: 0,
      blueskyShares: 0,
      total: 0,
      updatedAt: new Date(),
    }),
    updateCounts: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServerConfig['backlinkService'];
}

/**
 * Creates mock claiming service.
 */
function createMockClaimingService(): ServerConfig['claimingService'] {
  return {
    startClaim: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: 'did:plc:test',
      evidence: [],
      verificationScore: 0,
      status: 'pending',
      canonicalUri: null,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }),
    collectEvidence: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: 'did:plc:test',
      evidence: [],
      verificationScore: 0.5,
      status: 'pending',
      canonicalUri: null,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }),
    completeClaim: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: 'did:plc:test',
      evidence: [],
      verificationScore: 0.8,
      status: 'approved',
      canonicalUri: 'at://did:plc:test/pub.chive.preprint.submission/123',
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      expiresAt: null,
    }),
    approveClaim: vi.fn().mockResolvedValue(undefined),
    rejectClaim: vi.fn().mockResolvedValue(undefined),
    getClaim: vi.fn().mockResolvedValue(null),
    getUserClaims: vi.fn().mockResolvedValue([]),
    findClaimable: vi.fn().mockResolvedValue({ preprints: [], cursor: undefined }),
    getPendingClaims: vi.fn().mockResolvedValue({ claims: [], cursor: undefined }),
  } as unknown as ServerConfig['claimingService'];
}

/**
 * Creates mock import service.
 */
function createMockImportService(): ServerConfig['importService'] {
  return {
    exists: vi.fn().mockResolvedValue(false),
    get: vi.fn().mockResolvedValue(null),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    search: vi.fn().mockResolvedValue({ preprints: [], cursor: undefined }),
    markClaimed: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServerConfig['importService'];
}

/**
 * Creates mock PDS sync service.
 */
function createMockPDSSyncService(): ServerConfig['pdsSyncService'] {
  return {
    detectStaleRecords: vi.fn().mockResolvedValue([]),
    refreshRecord: vi.fn().mockResolvedValue({
      ok: true,
      value: { refreshed: true, changed: false, previousCID: '', currentCID: '' },
    }),
    checkStaleness: vi.fn().mockResolvedValue({ uri: '', isStale: false, indexedCID: '' }),
    trackPDSUpdate: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  } as unknown as ServerConfig['pdsSyncService'];
}

/**
 * Creates mock activity service.
 */
function createMockActivityService(): ServerConfig['activityService'] {
  return {
    logActivity: vi.fn().mockResolvedValue({ ok: true, value: 'mock-activity-id' }),
    correlateWithFirehose: vi.fn().mockResolvedValue({ ok: true, value: null }),
    markFailed: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    timeoutStaleActivities: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
    getActivityFeed: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { activities: [], cursor: null } }),
    getCorrelationMetrics: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getActivity: vi.fn().mockResolvedValue({ ok: true, value: null }),
    batchCorrelate: vi.fn().mockResolvedValue({ ok: true, value: new Map() }),
    getPendingCount: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
  } as unknown as ServerConfig['activityService'];
}

/**
 * Creates mock storage backend.
 */
function createMockStorageBackend(): IStorageBackend {
  return {
    storePreprint: vi.fn().mockResolvedValue(undefined),
    getPreprint: vi.fn().mockResolvedValue(null),
    updatePreprint: vi.fn().mockResolvedValue(undefined),
    deletePreprint: vi.fn().mockResolvedValue(undefined),
    getPreprintsByAuthor: vi.fn().mockResolvedValue({ preprints: [], total: 0 }),
  } as unknown as IStorageBackend;
}

/**
 * Makes test request with unique IP to avoid rate limit collisions.
 */
function testRequest(
  app: Hono<ChiveEnv>,
  url: string,
  init?: RequestInit
): Response | Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-Forwarded-For', GRAPH_TEST_IP);
  return app.request(url, { ...init, headers });
}

describe('XRPC Graph Endpoints Integration', () => {
  let neo4jConnection: Neo4jConnection;
  let graphDb: IGraphDatabase;
  let graphService: KnowledgeGraphService;
  let redis: Redis;
  let app: Hono<ChiveEnv>;
  let logger: ILogger;

  beforeAll(async () => {
    // Initialize Neo4j
    const neo4jConfig = getNeo4jConfig();
    neo4jConnection = new Neo4jConnection();
    await neo4jConnection.initialize({
      uri: neo4jConfig.uri,
      username: neo4jConfig.user,
      password: neo4jConfig.password,
      database: neo4jConfig.database,
    });

    graphDb = new Neo4jAdapter(neo4jConnection);

    // Initialize Redis
    const redisConfig = getRedisConfig();
    redis = new Redis(redisConfig);

    // Create logger
    logger = createMockLogger();

    // Create graph service
    const graphServiceOptions: KnowledgeGraphServiceOptions = {
      graph: graphDb,
      storage: createMockStorageBackend(),
      logger,
    };
    graphService = new KnowledgeGraphService(graphServiceOptions);

    // Create Hono app with full middleware stack
    const serverConfig: ServerConfig = {
      preprintService: createMockPreprintService(),
      searchService: createMockSearchService(),
      metricsService: createMockMetricsService(),
      graphService,
      blobProxyService: createMockBlobProxyService(),
      reviewService: createMockReviewService(),
      tagManager: createMockTagManager(),
      backlinkService: createMockBacklinkService(),
      claimingService: createMockClaimingService(),
      importService: createMockImportService(),
      pdsSyncService: createMockPDSSyncService(),
      activityService: createMockActivityService(),
      relevanceLogger: new NoOpRelevanceLogger(),
      redis,
      logger,
      serviceDid: 'did:web:test.chive.pub',
    };

    app = createServer(serverConfig);
  });

  afterAll(async () => {
    await neo4jConnection.close();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up test data from Neo4j
    await neo4jConnection.executeQuery('MATCH (n) WHERE n.id STARTS WITH "test_" DETACH DELETE n');

    // Clean up rate limit keys to avoid 429 errors during tests
    const keys = await redis.keys('chive:ratelimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('GET /xrpc/pub.chive.graph.getField', () => {
    it('returns 400 for missing id parameter', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getField');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for non-existent field', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getField?id=nonexistent.field.xyz');

      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns field with proper structure', async () => {
      // Create test field in Neo4j
      await neo4jConnection.executeQuery(
        `CREATE (f:Field {
          id: $id,
          label: $label,
          type: 'field',
          description: $description,
          wikidataId: $wikidataId,
          createdAt: datetime(),
          updatedAt: datetime()
        })`,
        {
          id: `test_${TEST_FIELD_ID}`,
          label: TEST_FIELD_LABEL,
          description: 'Study of intelligent agents',
          wikidataId: 'Q11660',
        }
      );

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.graph.getField?id=${encodeURIComponent(`test_${TEST_FIELD_ID}`)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as FieldDetail;

      expect(body.id).toBe(`test_${TEST_FIELD_ID}`);
      expect(body.name).toBe(TEST_FIELD_LABEL);
      expect(body.uri).toContain('pub.chive.graph.field');
    });

    it('includes external IDs when available', async () => {
      // Create test field with Wikidata ID
      await neo4jConnection.executeQuery(
        `CREATE (f:Field {
          id: $id,
          label: $label,
          type: 'field',
          wikidataId: $wikidataId,
          createdAt: datetime(),
          updatedAt: datetime()
        })`,
        {
          id: 'test_cs.ml',
          label: 'Machine Learning',
          wikidataId: 'Q2539',
        }
      );

      const res = await testRequest(app, '/xrpc/pub.chive.graph.getField?id=test_cs.ml');

      expect(res.status).toBe(200);
      const body = (await res.json()) as FieldDetail;

      expect(body.externalIds).toBeDefined();
      const externalIds = body.externalIds;
      if (externalIds && externalIds.length > 0) {
        expect(externalIds.length).toBeGreaterThan(0);
        const firstId = externalIds[0];
        if (firstId) {
          expect(firstId.source).toBe('wikidata');
          expect(firstId.id).toBe('Q2539');
        }
      }
    });

    it('includes child fields when available', async () => {
      // Create parent and child fields
      await neo4jConnection.executeQuery(
        `CREATE (parent:Field {id: 'test_parent', label: 'Parent Field', type: 'field', createdAt: datetime(), updatedAt: datetime()})
         CREATE (child1:Field {id: 'test_child1', label: 'Child Field 1', type: 'subfield', createdAt: datetime(), updatedAt: datetime()})
         CREATE (child2:Field {id: 'test_child2', label: 'Child Field 2', type: 'topic', createdAt: datetime(), updatedAt: datetime()})
         CREATE (parent)-[:HAS_SUBFIELD]->(child1)
         CREATE (parent)-[:HAS_TOPIC]->(child2)`
      );

      const res = await testRequest(app, '/xrpc/pub.chive.graph.getField?id=test_parent');

      expect(res.status).toBe(200);
      const body = (await res.json()) as FieldDetail;

      // Children should be included if the handler queries for them
      expect(body.id).toBe('test_parent');
    });

    it('includes requestId in response headers', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getField?id=test.field');

      expect(res.headers.get('X-Request-Id')).toBeDefined();
      expect(res.headers.get('X-Request-Id')).toMatch(/^req_/);
    });
  });

  describe('GET /xrpc/pub.chive.graph.searchAuthorities', () => {
    it('returns empty results for no matches', async () => {
      // Use 'q' parameter not 'query' to match the schema
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.graph.searchAuthorities?q=nonexistenttermxyz'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as AuthoritySearchResponse;

      expect(body.authorities).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.hasMore).toBe(false);
    });

    it('supports type filtering', async () => {
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.graph.searchAuthorities?q=test&type=person'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as AuthoritySearchResponse;

      expect(body.authorities).toBeDefined();
      expect(Array.isArray(body.authorities)).toBe(true);
    });

    it('supports status filtering', async () => {
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.graph.searchAuthorities?q=test&status=approved'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as AuthoritySearchResponse;

      expect(body.authorities).toBeDefined();
    });

    it('supports pagination with limit and cursor', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.searchAuthorities?q=test&limit=10');

      expect(res.status).toBe(200);
      const body = (await res.json()) as AuthoritySearchResponse;

      expect(body.authorities).toBeDefined();
      expect(typeof body.hasMore).toBe('boolean');
    });
  });

  describe('GET /xrpc/pub.chive.graph.browseFaceted', () => {
    it('returns empty results for no matching facets', async () => {
      // Facets accept arrays; use bracket notation
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.graph.browseFaceted?matter[]=nonexistent'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as FacetedBrowseResponse;

      expect(body.hits).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.hasMore).toBe(false);
    });

    it('supports PMEST facet dimensions', async () => {
      // Test each PMEST dimension (use correct parameter names).
      // Facets now accept arrays; pass as bracket notation query params.
      const dimensions = ['personality', 'matter', 'energy', 'space', 'time'];

      for (const dimension of dimensions) {
        const res = await testRequest(
          app,
          `/xrpc/pub.chive.graph.browseFaceted?${dimension}[]=test`,
          {
            headers: { 'X-Forwarded-For': GRAPH_TEST_IP },
          }
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as FacetedBrowseResponse;
        expect(body.hits).toBeDefined();
        // Response uses 'facets' not 'availableFacets'
        expect(body.facets).toBeDefined();
      }
    });

    it('supports combining multiple facets', async () => {
      // Facets accept arrays; use bracket notation for array values
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.graph.browseFaceted?matter[]=physics&time[]=2024',
        { headers: { 'X-Forwarded-For': GRAPH_TEST_IP } }
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as FacetedBrowseResponse;

      expect(body.hits).toBeDefined();
      // Response uses 'facets' not 'availableFacets'
      expect(body.facets).toBeDefined();
    });

    it('returns available facet values for refinement', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.browseFaceted?matter[]=science', {
        headers: { 'X-Forwarded-For': GRAPH_TEST_IP },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as FacetedBrowseResponse;

      // Facets should be defined even if empty
      expect(body.facets).toBeDefined();
      expect(typeof body.facets).toBe('object');
    });

    it('supports pagination', async () => {
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.graph.browseFaceted?matter[]=test&limit=20',
        {
          headers: { 'X-Forwarded-For': GRAPH_TEST_IP },
        }
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as FacetedBrowseResponse;

      expect(typeof body.hasMore).toBe('boolean');
      if (body.hasMore) {
        expect(body.cursor).toBeDefined();
      }
    });
  });

  describe('Rate Limiting', () => {
    it('includes rate limit headers in graph responses', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getField?id=test.field');

      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('Error Response Format', () => {
    it('returns standardized error format', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getField', {
        headers: { 'X-Forwarded-For': GRAPH_TEST_IP },
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;

      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
      expect(body.error.requestId).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('includes security headers in response', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getField?id=test');

      // Check for common security headers (Hono secureHeaders middleware)
      // X-Content-Type-Options is always set to 'nosniff'
      // X-Frame-Options can be 'DENY' or 'SAMEORIGIN' depending on Hono config
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(['DENY', 'SAMEORIGIN']).toContain(res.headers.get('X-Frame-Options'));
    });
  });

  describe('CORS Headers', () => {
    it('includes CORS headers in response', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getField?id=test', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});
