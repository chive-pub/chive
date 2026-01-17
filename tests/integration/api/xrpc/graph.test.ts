/**
 * Integration tests for XRPC graph endpoints.
 *
 * @remarks
 * Tests the full request/response cycle for unified knowledge graph XRPC endpoints
 * including getNode, searchNodes, listNodes, getHierarchy, and browseFaceted.
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
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { createServer, type ServerConfig } from '@/api/server.js';
import type { ChiveEnv } from '@/api/types/context.js';
import { EdgeService } from '@/services/governance/edge-service.js';
import { NodeService } from '@/services/governance/node-service.js';
import { Neo4jConnection } from '@/storage/neo4j/connection.js';
import { EdgeRepository } from '@/storage/neo4j/edge-repository.js';
import { NodeRepository } from '@/storage/neo4j/node-repository.js';
import { getRedisConfig } from '@/storage/redis/structures.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

import {
  createMockAuthzService,
  createMockAlphaService,
  createMockLogger,
  createMockEprintService,
  createMockSearchService,
  createMockMetricsService,
  createMockGraphService,
  createMockBlobProxyService,
  createMockReviewService,
  createMockTagManager,
  createMockFacetManager,
  createMockBacklinkService,
  createMockClaimingService,
  createMockImportService,
  createMockPDSSyncService,
  createMockActivityService,
  createNoOpRelevanceLogger,
  createMockServiceAuthVerifier,
} from '../../../helpers/mock-services.js';
import type {
  GraphNodeResponse,
  NodeSearchResponse,
  FacetedBrowseResponse,
  ErrorResponse,
} from '../../../types/api-responses.js';

/**
 * Get Neo4j config from environment variables.
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
const TEST_NODE_ID = 'test-node-cs-ai';
const TEST_NODE_LABEL = 'Artificial Intelligence';
const TEST_GOVERNANCE_DID = 'did:plc:chive-governance' as DID;
// Unique IP for graph tests to avoid rate limit collisions with parallel test files
const GRAPH_TEST_IP = '192.168.100.3';

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

    // Initialize Redis
    const redisConfig = getRedisConfig();
    redis = new Redis(redisConfig);

    // Create logger
    logger = createMockLogger();

    // Create real repositories connected to Neo4j
    const nodeRepository = new NodeRepository(neo4jConnection);
    const edgeRepository = new EdgeRepository(neo4jConnection);

    // Create real services using the repositories
    const nodeService = new NodeService({
      nodeRepository,
      logger,
      cache: redis,
    });
    const edgeService = new EdgeService({
      edgeRepository,
      logger,
    });

    // Create test server with real graph services, mocks for others
    const serverConfig: ServerConfig = {
      eprintService: createMockEprintService(),
      searchService: createMockSearchService(),
      metricsService: createMockMetricsService(),
      graphService: createMockGraphService(),
      blobProxyService: createMockBlobProxyService(),
      reviewService: createMockReviewService(),
      tagManager: createMockTagManager(),
      facetManager: createMockFacetManager(),
      nodeService,
      edgeService,
      nodeRepository,
      edgeRepository,
      backlinkService: createMockBacklinkService(),
      claimingService: createMockClaimingService(),
      importService: createMockImportService(),
      pdsSyncService: createMockPDSSyncService(),
      activityService: createMockActivityService(),
      relevanceLogger: createNoOpRelevanceLogger(),
      authzService: createMockAuthzService(),
      alphaService: createMockAlphaService(),
      redis,
      logger,
      serviceDid: 'did:web:test.chive.pub',
      serviceAuthVerifier: createMockServiceAuthVerifier(),
    };

    app = createServer(serverConfig);
  });

  afterAll(async () => {
    await neo4jConnection.close();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up test data
    await neo4jConnection.executeQuery(
      `MATCH (n) WHERE n.id STARTS WITH 'test' OR n.id STARTS WITH 'test-' DETACH DELETE n`
    );
  });

  describe('GET /xrpc/pub.chive.graph.getNode', () => {
    it('returns node by ID', async () => {
      // Create test node
      const nodeUri = `at://${TEST_GOVERNANCE_DID}/pub.chive.graph.node/${TEST_NODE_ID}`;
      await neo4jConnection.executeQuery(
        `CREATE (n:Node:Type:Field {
          id: $id,
          uri: $uri,
          kind: 'type',
          subkind: 'field',
          label: $label,
          description: 'Study of intelligent agents',
          status: 'established',
          createdAt: datetime()
        })`,
        {
          id: TEST_NODE_ID,
          uri: nodeUri,
          label: TEST_NODE_LABEL,
        }
      );

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.graph.getNode?id=${encodeURIComponent(TEST_NODE_ID)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as GraphNodeResponse;

      expect(body.id).toBe(TEST_NODE_ID);
      expect(body.label).toBe(TEST_NODE_LABEL);
      expect(body.kind).toBe('type');
      expect(body.subkind).toBe('field');
    });

    it('returns 404 for non-existent node', async () => {
      const res = await testRequest(
        app,
        `/xrpc/pub.chive.graph.getNode?id=${encodeURIComponent('nonexistent')}`
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('includes external IDs when available', async () => {
      const nodeUri = `at://${TEST_GOVERNANCE_DID}/pub.chive.graph.node/test-ml-node`;
      await neo4jConnection.executeQuery(
        `CREATE (n:Node:Type:Field {
          id: 'test-ml-node',
          uri: $uri,
          kind: 'type',
          subkind: 'field',
          label: 'Machine Learning',
          status: 'established',
          externalIds: $externalIds,
          createdAt: datetime()
        })`,
        {
          uri: nodeUri,
          externalIds: JSON.stringify([
            { system: 'wikidata', identifier: 'Q2539', matchType: 'exact' },
          ]),
        }
      );

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.graph.getNode?id=${encodeURIComponent('test-ml-node')}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as GraphNodeResponse;

      expect(body.externalIds).toBeDefined();
      expect(body.externalIds?.length).toBeGreaterThan(0);
      expect(body.externalIds?.[0]?.system).toBe('wikidata');
    });

    it('includes requestId in response headers', async () => {
      const res = await testRequest(
        app,
        `/xrpc/pub.chive.graph.getNode?id=${encodeURIComponent('nonexistent')}`
      );

      expect(res.headers.get('X-Request-Id')).toBeDefined();
      expect(res.headers.get('X-Request-Id')).toMatch(/^req_/);
    });
  });

  describe('GET /xrpc/pub.chive.graph.searchNodes', () => {
    it('returns empty results for no matches', async () => {
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.graph.searchNodes?query=nonexistenttermxyz'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as NodeSearchResponse;

      expect(body.nodes).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.hasMore).toBe(false);
    });

    it('supports kind filtering', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.searchNodes?query=test&kind=type');

      expect(res.status).toBe(200);
      const body = (await res.json()) as NodeSearchResponse;

      expect(body.nodes).toBeDefined();
      expect(Array.isArray(body.nodes)).toBe(true);
    });

    it('supports subkind filtering', async () => {
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.graph.searchNodes?query=test&subkind=field'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as NodeSearchResponse;

      expect(body.nodes).toBeDefined();
    });

    it('supports pagination with limit', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.searchNodes?query=test&limit=10');

      expect(res.status).toBe(200);
      const body = (await res.json()) as NodeSearchResponse;

      expect(body.nodes).toBeDefined();
      expect(typeof body.hasMore).toBe('boolean');
    });
  });

  describe('GET /xrpc/pub.chive.graph.listNodes', () => {
    it('lists nodes by kind', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.listNodes?kind=type');

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        nodes: GraphNodeResponse[];
        hasMore: boolean;
        total: number;
      };

      expect(body.nodes).toBeDefined();
      expect(Array.isArray(body.nodes)).toBe(true);
      expect(typeof body.hasMore).toBe('boolean');
    });

    it('lists nodes by subkind', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.listNodes?kind=type&subkind=field');

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        nodes: GraphNodeResponse[];
        hasMore: boolean;
        total: number;
      };

      expect(body.nodes).toBeDefined();
    });
  });

  describe('GET /xrpc/pub.chive.graph.getHierarchy', () => {
    it('returns hierarchy for subkind', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getHierarchy?subkind=field');

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        roots: { node: GraphNodeResponse; children: unknown[]; depth: number }[];
        subkind: string;
      };

      expect(body.roots).toBeDefined();
      expect(Array.isArray(body.roots)).toBe(true);
      expect(body.subkind).toBe('field');
    });
  });

  describe('GET /xrpc/pub.chive.graph.browseFaceted', () => {
    it('returns empty results for no matching facets', async () => {
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

    it('supports multiple facet dimensions', async () => {
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.graph.browseFaceted?personality[]=theoretical&time[]=2020s'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as FacetedBrowseResponse;

      expect(body.hits).toBeDefined();
      expect(body.facets).toBeDefined();
    });

    it('returns aggregated facet counts', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.browseFaceted?limit=10');

      expect(res.status).toBe(200);
      const body = (await res.json()) as FacetedBrowseResponse;

      expect(body.facets).toBeDefined();
      expect(typeof body.facets).toBe('object');
    });

    it('supports pagination', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.browseFaceted?limit=5&cursor=0');

      expect(res.status).toBe(200);
      const body = (await res.json()) as FacetedBrowseResponse;

      expect(body.hits).toBeDefined();
      expect(typeof body.hasMore).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('returns validation error for missing required parameters', async () => {
      // getNode requires uri parameter
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getNode');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns proper error format with requestId', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.graph.getNode');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;

      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
      expect(body.error.requestId).toBeDefined();
    });
  });
});
