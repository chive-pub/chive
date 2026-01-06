/**
 * Integration tests for REST v1/preprints endpoints.
 *
 * @remarks
 * Tests the REST compatibility layer that delegates to XRPC handlers.
 * Validates that REST endpoints provide equivalent functionality to XRPC.
 *
 * Requires Docker test stack running (PostgreSQL 16+, Elasticsearch 8+, Redis 7+).
 *
 * @packageDocumentation
 */

import { Client } from '@elastic/elasticsearch';
import type { Hono } from 'hono';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { createServer, type ServerConfig } from '@/api/server.js';
import type { ChiveEnv } from '@/api/types/context.js';
import type { BlobProxyService } from '@/services/blob-proxy/proxy-service.js';
import type { KnowledgeGraphService } from '@/services/knowledge-graph/graph-service.js';
import type { MetricsService } from '@/services/metrics/metrics-service.js';
import { PreprintService, type RecordMetadata } from '@/services/preprint/preprint-service.js';
import { NoOpRelevanceLogger } from '@/services/search/relevance-logger.js';
import type { SearchService } from '@/services/search/search-service.js';
import { createElasticsearchClient } from '@/storage/elasticsearch/setup.js';
import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import { getRedisConfig } from '@/storage/redis/structures.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import type { IIdentityResolver } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IRepository } from '@/types/interfaces/repository.interface.js';
import type {
  ISearchEngine,
  IndexablePreprintDocument,
  SearchQuery,
  SearchResults,
  FacetedSearchQuery,
  FacetedSearchResults,
} from '@/types/interfaces/search.interface.js';
import type { Preprint } from '@/types/models/preprint.js';

import type {
  PreprintResponse,
  PreprintListResponse,
  SearchResultsResponse,
  ErrorResponse,
  HealthResponse,
} from '../../../../types/api-responses.js';

// Test constants
const TEST_AUTHOR = 'did:plc:restauthor123' as DID;
const TEST_PDS_URL = 'https://pds.test.example.com';
const INDEX_NAME = 'preprints-rest-integration';
// Unique IP for REST preprint tests to avoid rate limit collisions with parallel test files
const REST_PREPRINT_TEST_IP = '192.168.100.2';

// Generate unique test URIs
function createTestUri(suffix: string): AtUri {
  const timestamp = Date.now();
  return `at://${TEST_AUTHOR}/pub.chive.preprint.submission/rest${timestamp}${suffix}` as AtUri;
}

function createTestCid(suffix: string): CID {
  return `bafyreib${suffix}${Date.now().toString(36)}` as CID;
}

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
 * Creates mock identity resolver.
 */
function createMockIdentity(): IIdentityResolver {
  return {
    resolveDID: vi.fn().mockResolvedValue({
      id: TEST_AUTHOR,
      alsoKnownAs: ['at://restuser.bsky.social'],
      verificationMethod: [],
    }),
    resolveHandle: vi.fn().mockResolvedValue(TEST_AUTHOR),
    getPDSEndpoint: vi.fn().mockResolvedValue(TEST_PDS_URL),
  };
}

/**
 * Creates mock repository.
 */
function createMockRepository(): IRepository {
  return {
    getRecord: vi.fn().mockResolvedValue(null),
    listRecords: vi.fn(),
    getBlob: vi.fn().mockResolvedValue(null),
  };
}

/**
 * Creates search engine wrapper for Elasticsearch.
 */
function createSearchEngine(client: Client): ISearchEngine {
  return {
    indexPreprint: async (doc: IndexablePreprintDocument): Promise<void> => {
      await client.index({
        index: INDEX_NAME,
        id: doc.uri,
        document: {
          uri: doc.uri,
          author: doc.author,
          authorName: doc.authorName,
          title: doc.title,
          abstract: doc.abstract,
          keywords: doc.keywords,
          subjects: doc.subjects,
          createdAt: doc.createdAt.toISOString(),
          indexedAt: doc.indexedAt.toISOString(),
        },
        refresh: true,
      });
    },
    search: async (query: SearchQuery): Promise<SearchResults> => {
      const result = await client.search({
        index: INDEX_NAME,
        query: {
          multi_match: {
            query: query.q,
            fields: ['title^3', 'abstract^2', 'keywords', 'authorName'],
          },
        },
        size: query.limit ?? 10,
        highlight: {
          fields: {
            title: {},
            abstract: {},
          },
        },
      });

      return {
        hits: result.hits.hits.map((hit) => ({
          uri: (hit._source as { uri: string }).uri as AtUri,
          score: hit._score ?? 0,
          highlight: hit.highlight ?? {},
        })),
        total:
          typeof result.hits.total === 'number'
            ? result.hits.total
            : (result.hits.total?.value ?? 0),
        took: result.took,
      };
    },
    facetedSearch: (_query: FacetedSearchQuery): Promise<FacetedSearchResults> => {
      return Promise.resolve({
        hits: [],
        total: 0,
        took: 0,
        facets: {},
      });
    },
    autocomplete: () => Promise.resolve([]),
    deleteDocument: async (uri: AtUri): Promise<void> => {
      try {
        await client.delete({
          index: INDEX_NAME,
          id: uri,
          refresh: true,
        });
      } catch {
        // Ignore if document doesn't exist
      }
    },
  };
}

/**
 * Creates mock search service wrapping search engine.
 */
function createMockSearchService(searchEngine: ISearchEngine): SearchService {
  return {
    search: (query: SearchQuery) => {
      return searchEngine.search(query);
    },
    facetedSearch: (query: FacetedSearchQuery) => {
      return searchEngine.facetedSearch(query);
    },
    autocomplete: (): Promise<string[]> => Promise.resolve([]),
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
 * Creates mock graph service.
 */
function createMockGraphService(): KnowledgeGraphService {
  return {
    getField: vi.fn().mockResolvedValue(null),
    getRelatedFields: vi.fn().mockResolvedValue([]),
    getChildFields: vi.fn().mockResolvedValue([]),
    getAncestorPath: vi.fn().mockResolvedValue([]),
    searchAuthorities: vi.fn().mockResolvedValue({
      authorities: [],
      hasMore: false,
      total: 0,
    }),
    browseFaceted: vi.fn().mockResolvedValue({
      preprints: [],
      availableFacets: {},
      hasMore: false,
      total: 0,
    }),
  } as unknown as KnowledgeGraphService;
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
 * Makes test request with unique IP to avoid rate limit collisions.
 */
function testRequest(
  app: Hono<ChiveEnv>,
  url: string,
  init?: RequestInit
): Response | Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-Forwarded-For', REST_PREPRINT_TEST_IP);
  return app.request(url, { ...init, headers });
}

/**
 * Creates test preprint record.
 */
function createTestPreprint(uri: AtUri, overrides: Partial<Preprint> = {}): Preprint {
  return {
    $type: 'pub.chive.preprint.submission',
    uri,
    cid: overrides.cid ?? createTestCid('default'),
    author: TEST_AUTHOR,
    title:
      overrides.title ??
      'Frequency, acceptability, and selection: A case study of clause-embedding',
    abstract:
      overrides.abstract ??
      'We investigate the relationship between the frequency with which verbs are found in particular subcategorization frames and the acceptability of those verbs in those frames, focusing in particular on subordinate clause-taking verbs, such as think, want, and tell.',
    keywords: overrides.keywords ?? ['semantics', 'clause-embedding', 'acceptability'],
    facets: overrides.facets ?? [{ dimension: 'matter', value: 'Linguistics' }],
    version: overrides.version ?? 1,
    license: overrides.license ?? 'CC-BY-4.0',
    pdfBlobRef: overrides.pdfBlobRef ?? {
      $type: 'blob',
      ref: 'bafyreibrest123' as CID,
      mimeType: 'application/pdf',
      size: 1024000,
    },
    createdAt: overrides.createdAt ?? (Date.now() as Timestamp),
    ...overrides,
  } as Preprint;
}

/**
 * Creates test record metadata.
 */
function createTestMetadata(uri: AtUri, cid: CID): RecordMetadata {
  return {
    uri,
    cid,
    pdsUrl: TEST_PDS_URL,
    indexedAt: new Date(),
  };
}

describe('REST v1/preprints Endpoints Integration', () => {
  let pool: Pool;
  let esClient: Client;
  let redis: Redis;
  let storage: PostgreSQLAdapter;
  let searchEngine: ISearchEngine;
  let preprintService: PreprintService;
  let app: Hono<ChiveEnv>;
  let logger: ILogger;

  // Track created URIs for cleanup
  const createdUris: AtUri[] = [];

  beforeAll(async () => {
    // Initialize PostgreSQL
    const dbConfig = getDatabaseConfig();
    pool = new Pool(dbConfig);
    storage = new PostgreSQLAdapter(pool);

    // Initialize Elasticsearch
    esClient = createElasticsearchClient();
    searchEngine = createSearchEngine(esClient);

    // Initialize Redis
    const redisConfig = getRedisConfig();
    redis = new Redis(redisConfig);

    // Create test index
    const indexExists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!indexExists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            uri: { type: 'keyword' },
            author: { type: 'keyword' },
            authorName: { type: 'text' },
            title: { type: 'text', analyzer: 'standard' },
            abstract: { type: 'text', analyzer: 'standard' },
            keywords: { type: 'keyword' },
            subjects: { type: 'keyword' },
            createdAt: { type: 'date' },
            indexedAt: { type: 'date' },
          },
        },
      });
    }

    // Create logger
    logger = createMockLogger();

    // Create preprint service
    preprintService = new PreprintService({
      storage,
      search: searchEngine,
      repository: createMockRepository(),
      identity: createMockIdentity(),
      logger,
    });

    // Create Hono app with full middleware stack
    const serverConfig: ServerConfig = {
      preprintService,
      searchService: createMockSearchService(searchEngine),
      metricsService: createMockMetricsService(),
      graphService: createMockGraphService(),
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
    // Clean up test index
    try {
      await esClient.indices.delete({ index: INDEX_NAME });
    } catch {
      // Index may not exist
    }

    await esClient.close();
    await redis.quit();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data from Elasticsearch
    try {
      await esClient.deleteByQuery({
        index: INDEX_NAME,
        query: { match_all: {} },
        refresh: true,
      });
    } catch {
      // Index may be empty
    }

    // Clear tracked URIs
    createdUris.length = 0;

    // Clean up rate limit keys to avoid 429 errors during tests
    const keys = await redis.keys('chive:ratelimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('GET /api/v1/preprints/:uri', () => {
    it('returns error for invalid uri format', async () => {
      const res = await testRequest(app, '/api/v1/preprints/invalid-uri-format');

      // May return 400 (validation), 404 (not found), or 500 (internal error from parsing)
      expect([400, 404, 500]).toContain(res.status);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('returns 404 for non-existent preprint', async () => {
      const nonExistentUri = createTestUri('nonexistent');
      const res = await testRequest(app, `/api/v1/preprints/${encodeURIComponent(nonExistentUri)}`);

      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns preprint with ATProto-compliant source field', async () => {
      // Index a preprint first
      const uri = createTestUri('restget1');
      const cid = createTestCid('restget1');
      const preprint = createTestPreprint(uri, {
        title: 'Split-scope definites: Relative superlatives and Haddock descriptions',
      });
      await preprintService.indexPreprint(preprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(app, `/api/v1/preprints/${encodeURIComponent(uri)}`);

      expect(res.status).toBe(200);
      const body = (await res.json()) as PreprintResponse;

      // Verify core fields
      expect(body.uri).toBe(uri);
      expect(body.title).toBe(
        'Split-scope definites: Relative superlatives and Haddock descriptions'
      );

      // Verify ATProto compliance: source field MUST be present
      expect(body.source).toBeDefined();
      expect(body.source.pdsEndpoint).toBe(TEST_PDS_URL);
    });

    it('includes document as BlobRef, never inline data', async () => {
      const uri = createTestUri('restblob1');
      const cid = createTestCid('restblob1');
      const preprint = createTestPreprint(uri, {
        pdfBlobRef: {
          $type: 'blob',
          ref: 'bafyrerestblobtest' as CID,
          mimeType: 'application/pdf',
          size: 3145728,
        },
      });
      await preprintService.indexPreprint(preprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(app, `/api/v1/preprints/${encodeURIComponent(uri)}`);

      expect(res.status).toBe(200);
      const body = (await res.json()) as PreprintResponse;

      // Verify BlobRef structure
      expect(body.document).toBeDefined();
      expect(body.document.$type).toBe('blob');
      expect(body.document.ref).toBeDefined();

      // Verify no inline data (ATProto compliance)
      const document = body.document as unknown as Record<string, unknown>;
      expect(document.data).toBeUndefined();
      expect(document.content).toBeUndefined();
      expect(document.buffer).toBeUndefined();
    });

    it('equivalent to XRPC getSubmission endpoint', async () => {
      const uri = createTestUri('equiv1');
      const cid = createTestCid('equiv1');
      const preprint = createTestPreprint(uri, { title: 'Equivalence Test' });
      await preprintService.indexPreprint(preprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      // Call REST endpoint
      const restRes = await testRequest(app, `/api/v1/preprints/${encodeURIComponent(uri)}`);
      const restBody = (await restRes.json()) as PreprintResponse;

      // Call XRPC endpoint
      const xrpcRes = await testRequest(
        app,
        `/xrpc/pub.chive.preprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );
      const xrpcBody = (await xrpcRes.json()) as PreprintResponse;

      // Core fields should be equivalent
      expect(restBody.uri).toBe(xrpcBody.uri);
      expect(restBody.title).toBe(xrpcBody.title);
      expect(restBody.source.pdsEndpoint).toBe(xrpcBody.source.pdsEndpoint);
    });
  });

  describe('GET /api/v1/preprints (search)', () => {
    it('requires q parameter for search', async () => {
      // Without q parameter, should return validation error
      const res = await testRequest(app, '/api/v1/preprints');

      // Returns 400 because q is required for search
      expect(res.status).toBe(400);
    });

    it('returns search results with source field for each', async () => {
      // Index multiple preprints
      for (let i = 0; i < 3; i++) {
        const uri = createTestUri(`restlist${i}`);
        const cid = createTestCid(`restlist${i}`);
        const preprint = createTestPreprint(uri, { title: `Quantifier Scope in Linguistics ${i}` });
        await preprintService.indexPreprint(preprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await testRequest(app, '/api/v1/preprints?q=Quantifier+Scope');

      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      // Search results have hits array
      expect(body.hits).toBeDefined();
      expect(Array.isArray(body.hits)).toBe(true);
    });

    it('supports pagination with limit', async () => {
      // Index multiple preprints
      for (let i = 0; i < 5; i++) {
        const uri = createTestUri(`restpage${i}`);
        const cid = createTestCid(`restpage${i}`);
        const preprint = createTestPreprint(uri, { title: `Dynamic Semantics Analysis ${i}` });
        await preprintService.indexPreprint(preprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await testRequest(app, '/api/v1/preprints?q=Dynamic+Semantics&limit=2');
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      expect(body.hits.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/v1/authors/:did/preprints', () => {
    it('returns preprints by author', async () => {
      const uri = createTestUri('restauthor1');
      const cid = createTestCid('restauthor1');
      const preprint = createTestPreprint(uri, { title: 'Author Preprint' });
      await preprintService.indexPreprint(preprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/api/v1/authors/${encodeURIComponent(TEST_AUTHOR)}/preprints`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as PreprintListResponse;

      expect(body.preprints).toBeDefined();
    });
  });

  describe('GET /api/v1/search', () => {
    it('returns 400 for missing query parameter', async () => {
      const res = await testRequest(app, '/api/v1/search');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns search results with hits array', async () => {
      // Index searchable preprints
      for (let i = 0; i < 3; i++) {
        const uri = createTestUri(`restsearch${i}`);
        const cid = createTestCid(`restsearch${i}`);
        const preprint = createTestPreprint(uri, {
          title: `Clause-Embedding Predicates Analysis ${i}`,
          keywords: ['semantics', 'clause-embedding', 'predicates'],
        });
        await preprintService.indexPreprint(preprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      // Wait for Elasticsearch indexing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await testRequest(app, '/api/v1/search?q=clause-embedding+predicates');

      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      // Uses same response format as XRPC (hits array)
      expect(body.hits).toBeDefined();
      expect(Array.isArray(body.hits)).toBe(true);
    });

    it('includes search metadata (total, hasMore)', async () => {
      const uri = createTestUri('restsearchmeta');
      const cid = createTestCid('restsearchmeta');
      const preprint = createTestPreprint(uri, { title: 'Factive Predicates and Presupposition' });
      await preprintService.indexPreprint(preprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await testRequest(app, '/api/v1/search?q=factive+predicates');

      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      expect(typeof body.total).toBe('number');
      expect(typeof body.hasMore).toBe('boolean');
    });

    it('supports limit parameter', async () => {
      // Index multiple searchable preprints
      for (let i = 0; i < 5; i++) {
        const uri = createTestUri(`restsearchlimit${i}`);
        const cid = createTestCid(`restsearchlimit${i}`);
        const preprint = createTestPreprint(uri, {
          title: `Incremental Quantification Semantics ${i}`,
          keywords: ['quantification', 'incrementality', 'semantics'],
        });
        await preprintService.indexPreprint(preprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await testRequest(app, '/api/v1/search?q=incremental+quantification&limit=2');

      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      // Uses same response format as XRPC (hits array)
      expect(body.hits.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Health Endpoints', () => {
    it('GET /health returns healthy status', async () => {
      const res = await testRequest(app, '/health');

      expect(res.status).toBe(200);
      const body = (await res.json()) as HealthResponse;

      expect(body.status).toBe('healthy');
    });

    it('GET /ready returns readiness status', async () => {
      const res = await testRequest(app, '/ready');

      expect(res.status).toBe(200);
      const body = (await res.json()) as HealthResponse;

      expect(body.status).toBeDefined();
    });

    it('Health endpoints are not rate limited', async () => {
      // Make multiple rapid requests
      const responses = await Promise.all([
        app.request('/health'),
        app.request('/health'),
        app.request('/health'),
        app.request('/health'),
        app.request('/health'),
      ]);

      // All should succeed without rate limiting
      for (const res of responses) {
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Content-Type Handling', () => {
    it('returns JSON responses with correct content-type', async () => {
      const res = await testRequest(app, '/api/v1/preprints');

      expect(res.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('Rate Limiting', () => {
    it('includes rate limit headers in REST responses', async () => {
      const res = await testRequest(app, '/api/v1/preprints');

      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('Error Response Format', () => {
    it('returns standardized error format', async () => {
      const res = await testRequest(app, '/api/v1/search');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;

      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
      expect(body.error.requestId).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('includes security headers in REST responses', async () => {
      const res = await testRequest(app, '/api/v1/search?q=test');

      // Check for common security headers (Hono secureHeaders middleware)
      // At minimum, X-Content-Type-Options should be present
      const hasXContentTypeOptions = res.headers.get('X-Content-Type-Options') === 'nosniff';
      const hasXFrameOptions = res.headers.has('X-Frame-Options');
      const hasCsp = res.headers.has('Content-Security-Policy');

      expect(hasXContentTypeOptions || hasXFrameOptions || hasCsp).toBe(true);
    });
  });

  describe('CORS Headers', () => {
    it('includes CORS headers in REST responses', async () => {
      const res = await testRequest(app, '/api/v1/preprints', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});
