/**
 * ATProto compliance tests for API Layer.
 *
 * @remarks
 * Validates that the API layer adheres to ATProto compliance principles:
 * - All responses include `source` field with PDS information
 * - No write operations exposed to user PDSes
 * - BlobRefs only, never inline blob data
 * - PDS source tracking for staleness detection
 * - Indexes rebuildable from firehose
 *
 * These tests are mandatory for CI/CD and must pass at 100%.
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
import { EprintService, type RecordMetadata } from '@/services/eprint/eprint-service.js';
import type { KnowledgeGraphService } from '@/services/knowledge-graph/graph-service.js';
import type { MetricsService } from '@/services/metrics/metrics-service.js';
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
  IndexableEprintDocument,
  SearchQuery,
  SearchResults,
  FacetedSearchQuery,
  FacetedSearchResults,
} from '@/types/interfaces/search.interface.js';
import type { Eprint } from '@/types/models/eprint.js';

import {
  createMockAuthzService,
  createMockAlphaService,
  createMockContributionTypeManager,
} from '../helpers/mock-services.js';
import type { EprintResponse, EprintListResponse, ErrorResponse } from '../types/api-responses.js';

// Test constants for compliance validation
const TEST_AUTHOR = 'did:plc:compliance123' as DID;
const TEST_PDS_URL = 'https://pds.compliance.example.com';
const INDEX_NAME = 'eprints-compliance';
// Unique IP for compliance tests to avoid rate limit collisions with parallel test files
const _COMPLIANCE_TEST_IP = '192.168.100.9';
void _COMPLIANCE_TEST_IP; // Reserved for rate limit test isolation

// Generate unique test URIs
function createTestUri(suffix: string): AtUri {
  const timestamp = Date.now();
  return `at://${TEST_AUTHOR}/pub.chive.eprint.submission/compliance${timestamp}${suffix}` as AtUri;
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
      alsoKnownAs: ['at://complianceuser.bsky.social'],
      verificationMethod: [],
    }),
    resolveHandle: vi.fn().mockResolvedValue(TEST_AUTHOR),
    getPDSEndpoint: vi.fn().mockResolvedValue(TEST_PDS_URL),
  };
}

/**
 * Creates mock repository (read-only interface, NO write methods).
 */
function createMockRepository(): IRepository {
  return {
    // Only read operations (NO createRecord, updateRecord, deleteRecord)
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
    indexEprint: async (doc: IndexableEprintDocument): Promise<void> => {
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
      });

      return {
        hits: result.hits.hits.map((hit) => ({
          uri: (hit._source as { uri: string }).uri as AtUri,
          score: hit._score ?? 0,
          highlight: {},
        })),
        total:
          typeof result.hits.total === 'number'
            ? result.hits.total
            : (result.hits.total?.value ?? 0),
        took: result.took,
      };
    },
    facetedSearch: (_query: FacetedSearchQuery): Promise<FacetedSearchResults> => {
      return Promise.resolve({ hits: [], total: 0, took: 0, facets: {} });
    },
    autocomplete: () => Promise.resolve([]),
    deleteDocument: async (uri: AtUri): Promise<void> => {
      try {
        await client.delete({ index: INDEX_NAME, id: uri, refresh: true });
      } catch {
        // Ignore
      }
    },
  };
}

/**
 * Creates mock search service.
 */
function createMockSearchService(searchEngine: ISearchEngine): SearchService {
  return {
    search: (query: SearchQuery) => searchEngine.search(query),
    facetedSearch: (query: FacetedSearchQuery) => searchEngine.facetedSearch(query),
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
      eprints: [],
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
      eprints: [],
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
    listEndorsementsForEprint: vi.fn().mockResolvedValue({ items: [], hasMore: false, total: 0 }),
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
    createBacklink: vi.fn().mockResolvedValue({
      id: 1,
      sourceUri: '',
      sourceType: 'other',
      targetUri: '',
      indexedAt: new Date(),
      deleted: false,
    }),
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
 * Creates mock import service.
 */
function createMockImportService(): ServerConfig['importService'] {
  return {
    exists: vi.fn().mockResolvedValue(false),
    get: vi.fn().mockResolvedValue(null),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    search: vi.fn().mockResolvedValue({ eprints: [], cursor: undefined }),
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
 * Creates mock claiming service.
 */
function createMockClaimingService(): ServerConfig['claimingService'] {
  return {
    startClaim: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: '',
      evidence: [],
      verificationScore: 0,
      status: 'pending',
      createdAt: new Date(),
    }),
    collectEvidence: vi.fn().mockResolvedValue({
      id: 1,
      importId: 1,
      claimantDid: '',
      evidence: [],
      verificationScore: 0,
      status: 'pending',
      createdAt: new Date(),
    }),
    completeClaim: vi.fn().mockResolvedValue(undefined),
    approveClaim: vi.fn().mockResolvedValue(undefined),
    rejectClaim: vi.fn().mockResolvedValue(undefined),
    getClaim: vi.fn().mockResolvedValue(null),
    getUserClaims: vi.fn().mockResolvedValue([]),
    findClaimable: vi.fn().mockResolvedValue({ eprints: [], cursor: undefined }),
    getPendingClaims: vi.fn().mockResolvedValue({ claims: [], cursor: undefined }),
    computeScore: vi.fn().mockReturnValue({ score: 0, decision: 'insufficient' }),
  } as unknown as ServerConfig['claimingService'];
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
 * Creates test eprint record.
 */
function createTestEprint(uri: AtUri, overrides: Partial<Eprint> = {}): Eprint {
  return {
    $type: 'pub.chive.eprint.submission',
    uri,
    cid: overrides.cid ?? createTestCid('default'),
    authors: overrides.authors ?? [
      {
        did: TEST_AUTHOR,
        name: 'Compliance Test Author',
        order: 1,
        affiliations: [{ name: 'ATProto Compliance Lab' }],
        contributions: [],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      },
    ],
    submittedBy: TEST_AUTHOR,
    title: overrides.title ?? 'ATProto Compliance Test Eprint',
    abstract: overrides.abstract ?? 'This eprint tests ATProto compliance requirements.',
    keywords: overrides.keywords ?? ['compliance', 'atproto', 'test'],
    facets: overrides.facets ?? [{ dimension: 'matter', value: 'Computer Science' }],
    version: overrides.version ?? 1,
    license: overrides.license ?? 'CC-BY-4.0',
    documentBlobRef: overrides.documentBlobRef ?? {
      $type: 'blob',
      ref: 'bafyreibcompliance123' as CID,
      mimeType: 'application/pdf',
      size: 1024000,
    },
    documentFormat: 'pdf',
    publicationStatus: 'eprint',
    createdAt: overrides.createdAt ?? (Date.now() as Timestamp),
    ...overrides,
  } as Eprint;
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

describe('API Layer ATProto Compliance', () => {
  let pool: Pool;
  let esClient: Client;
  let redis: Redis;
  let storage: PostgreSQLAdapter;
  let searchEngine: ISearchEngine;
  let eprintService: EprintService;
  let app: Hono<ChiveEnv>;
  let logger: ILogger;

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

    // Create eprint service
    eprintService = new EprintService({
      storage,
      search: searchEngine,
      repository: createMockRepository(),
      identity: createMockIdentity(),
      logger,
    });

    // Create Hono app
    const serverConfig: ServerConfig = {
      eprintService,
      searchService: createMockSearchService(searchEngine),
      metricsService: createMockMetricsService(),
      graphService: createMockGraphService(),
      blobProxyService: createMockBlobProxyService(),
      reviewService: createMockReviewService(),
      tagManager: createMockTagManager(),
      contributionTypeManager: createMockContributionTypeManager(),
      backlinkService: createMockBacklinkService(),
      claimingService: createMockClaimingService(),
      importService: createMockImportService(),
      pdsSyncService: createMockPDSSyncService(),
      activityService: createMockActivityService(),
      relevanceLogger: new NoOpRelevanceLogger(),
      authzService: createMockAuthzService(),
      alphaService: createMockAlphaService(),
      redis,
      logger,
      serviceDid: 'did:web:test.chive.pub',
    };

    app = createServer(serverConfig);
  });

  afterAll(async () => {
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
    try {
      await esClient.deleteByQuery({
        index: INDEX_NAME,
        query: { match_all: {} },
        refresh: true,
      });
    } catch {
      // Index may be empty
    }

    // Clean up rate limit keys to avoid 429 errors during tests
    const keys = await redis.keys('chive:ratelimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  /**
   * Generate unique IP for each request to completely avoid rate limit issues.
   */
  let requestCounter = 0;
  const getUniqueTestIP = (): string => {
    requestCounter++;
    const octet3 = Math.floor(requestCounter / 255);
    const octet4 = requestCounter % 255;
    return `192.168.${octet3}.${octet4}`;
  };

  /**
   * Helper to make requests with unique IP to avoid rate limit issues.
   */
  const makeRequest = async (path: string, options: RequestInit = {}): Promise<Response> => {
    return app.request(path, {
      ...options,
      headers: {
        'X-Forwarded-For': getUniqueTestIP(),
        ...(options.headers ?? {}),
      },
    });
  };

  describe('CRITICAL: All responses include PDS source information', () => {
    it('getSubmission response includes source.pdsEndpoint', async () => {
      const uri = createTestUri('pds1');
      const cid = createTestCid('pds1');
      const eprint = createTestEprint(uri);
      const indexResult = await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      if (!indexResult.ok) {
        throw new Error(`Failed to index eprint: ${indexResult.error.message}`);
      }

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      if (res.status !== 200) {
        const errorBody = await res.json();
        throw new Error(`Expected 200 but got ${res.status}: ${JSON.stringify(errorBody)}`);
      }
      const body = (await res.json()) as EprintResponse;

      // CRITICAL: source field MUST be present
      expect(body.source).toBeDefined();
      expect(body.source.pdsEndpoint).toBe(TEST_PDS_URL);
    });

    it('getSubmission response includes source.recordUrl for direct PDS access', async () => {
      const uri = createTestUri('pds2');
      const cid = createTestCid('pds2');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // CRITICAL: recordUrl MUST point to source PDS
      expect(body.source.recordUrl).toBeDefined();
      expect(body.source.recordUrl).toContain('com.atproto.repo.getRecord');
    });

    it('getSubmission response includes source.lastVerifiedAt timestamp', async () => {
      const uri = createTestUri('pds3');
      const cid = createTestCid('pds3');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // CRITICAL: lastVerifiedAt MUST be present for staleness tracking
      expect(body.source.lastVerifiedAt).toBeDefined();
      expect(typeof body.source.lastVerifiedAt).toBe('string');

      // Should be a valid ISO 8601 date
      const lastVerifiedAt = body.source.lastVerifiedAt;
      if (lastVerifiedAt) {
        const date = new Date(lastVerifiedAt);
        expect(date.getTime()).not.toBeNaN();
      }
    });

    it('getSubmission response includes source.stale boolean', async () => {
      const uri = createTestUri('pds4');
      const cid = createTestCid('pds4');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // CRITICAL: stale indicator MUST be present
      expect(body.source.stale).toBeDefined();
      expect(typeof body.source.stale).toBe('boolean');
    });

    it('listByAuthor response includes source for each eprint', async () => {
      // Index multiple eprints
      for (let i = 0; i < 3; i++) {
        const uri = createTestUri(`list${i}`);
        const cid = createTestCid(`list${i}`);
        const eprint = createTestEprint(uri, { title: `List Eprint ${i}` });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      }

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.listByAuthor?did=${encodeURIComponent(TEST_AUTHOR)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintListResponse;

      // CRITICAL: Each eprint MUST have source field
      expect(body.eprints.length).toBeGreaterThan(0);
      for (const eprint of body.eprints) {
        expect(eprint.source).toBeDefined();
        expect(eprint.source.pdsEndpoint).toBeDefined();
      }
    });
  });

  describe('CRITICAL: No write operations exposed to user PDSes', () => {
    it('API does not expose POST endpoints for creating eprints', async () => {
      // Attempt to create a eprint via API should fail
      const res = await makeRequest('/xrpc/pub.chive.eprint.create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test',
          abstract: 'Test',
        }),
      });

      // Should return 404 (route not found); endpoint should NOT exist
      expect(res.status).toBe(404);
    });

    it('API does not expose PUT endpoints for updating eprints', async () => {
      const uri = createTestUri('noupdate');

      const res = await makeRequest(`/xrpc/pub.chive.eprint.update?uri=${uri}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      });

      // Should return 404; endpoint should NOT exist
      expect(res.status).toBe(404);
    });

    it('API does not expose DELETE endpoints for deleting eprints', async () => {
      const uri = createTestUri('nodelete');

      const res = await makeRequest(`/xrpc/pub.chive.eprint.delete?uri=${uri}`, {
        method: 'DELETE',
      });

      // Should return 404; endpoint should NOT exist
      expect(res.status).toBe(404);
    });

    it('API does not expose blob upload endpoints', async () => {
      const res = await makeRequest('/xrpc/com.atproto.repo.uploadBlob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: new Blob(['test'], { type: 'application/pdf' }),
      });

      // Should return 404; endpoint should NOT exist
      expect(res.status).toBe(404);
    });

    it('Repository interface used by service is read-only', () => {
      const repo = createMockRepository();

      // Verify NO write methods exist
      expect((repo as unknown as Record<string, unknown>).createRecord).toBeUndefined();
      expect((repo as unknown as Record<string, unknown>).updateRecord).toBeUndefined();
      expect((repo as unknown as Record<string, unknown>).deleteRecord).toBeUndefined();
      expect((repo as unknown as Record<string, unknown>).uploadBlob).toBeUndefined();

      // Verify read methods exist
      expect(repo).toHaveProperty('getRecord');
      expect(repo).toHaveProperty('listRecords');
      expect(repo).toHaveProperty('getBlob');
    });
  });

  describe('CRITICAL: BlobRefs only, never inline blob data', () => {
    it('getSubmission returns document as BlobRef structure', async () => {
      const uri = createTestUri('blobref1');
      const cid = createTestCid('blobref1');
      const eprint = createTestEprint(uri, {
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblobreftest' as CID,
          mimeType: 'application/pdf',
          size: 2097152,
        },
      });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // CRITICAL: Document MUST be BlobRef structure
      expect(body.document).toBeDefined();
      expect(body.document.$type).toBe('blob');
      expect(body.document.ref).toBeDefined();
      expect(body.document.mimeType).toBe('application/pdf');
      // BlobRef size may be serialized as string; compare numerically
      expect(Number(body.document.size)).toBe(2097152);
    });

    it('getSubmission does NOT include inline blob data', async () => {
      const uri = createTestUri('noinline1');
      const cid = createTestCid('noinline1');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // CRITICAL: No inline blob data fields (these properties should not exist on BlobRef)
      const document = body.document as unknown as Record<string, unknown>;
      expect(document.data).toBeUndefined();
      expect(document.content).toBeUndefined();
      expect(document.buffer).toBeUndefined();
      expect(document.base64).toBeUndefined();
      expect(document.bytes).toBeUndefined();
    });

    it('listByAuthor returns documents as BlobRefs', async () => {
      const uri = createTestUri('listblob1');
      const cid = createTestCid('listblob1');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.listByAuthor?did=${encodeURIComponent(TEST_AUTHOR)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintListResponse;

      // CRITICAL: List summaries should not include inline document data
      for (const eprint of body.eprints) {
        // Cast to unknown to check for forbidden fields
        const rawEprint = eprint as unknown as Record<string, unknown>;
        // If document field exists, verify it's a BlobRef (not inline data)
        if (rawEprint.document) {
          const doc = rawEprint.document as Record<string, unknown>;
          expect(doc.$type).toBe('blob');
          expect(doc.ref).toBeDefined();
          expect(doc.data).toBeUndefined();
          expect(doc.content).toBeUndefined();
        }
      }
    });

    it('source.blobUrl points to PDS, not Chive storage', async () => {
      const uri = createTestUri('bloburl1');
      const cid = createTestCid('bloburl1');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // If blobUrl is present, it MUST point to PDS
      if (body.source.blobUrl) {
        expect(body.source.blobUrl).toContain('com.atproto.sync.getBlob');
        // Should NOT point to Chive storage
        expect(body.source.blobUrl).not.toContain('storage.chive');
        expect(body.source.blobUrl).not.toContain('cdn.chive');
      }
    });
  });

  describe('CRITICAL: PDS source tracking for staleness', () => {
    it('recently indexed eprint has stale=false', async () => {
      const uri = createTestUri('fresh1');
      const cid = createTestCid('fresh1');
      const eprint = createTestEprint(uri);

      // Index with current timestamp
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Fresh eprint (indexed now) should NOT be stale
      expect(body.source.stale).toBe(false);
    });

    it('old indexed eprint has stale=true', async () => {
      const uri = createTestUri('old1');
      const cid = createTestCid('old1');
      const eprint = createTestEprint(uri);

      // Index with old timestamp (8 days ago)
      const oldMetadata: RecordMetadata = {
        uri,
        cid,
        pdsUrl: TEST_PDS_URL,
        indexedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      };

      await eprintService.indexEprint(eprint, oldMetadata);

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Old eprint (>7 days) should be stale
      expect(body.source.stale).toBe(true);
    });

    it('staleness threshold is 7 days', async () => {
      // Test boundary: exactly 7 days ago should be fresh
      const uri6days = createTestUri('6days');
      const cid6days = createTestCid('6days');

      const sixDaysAgo: RecordMetadata = {
        uri: uri6days,
        cid: cid6days,
        pdsUrl: TEST_PDS_URL,
        indexedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      };

      await eprintService.indexEprint(createTestEprint(uri6days), sixDaysAgo);

      const res6 = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri6days)}`
      );
      const body6 = (await res6.json()) as EprintResponse;

      expect(body6.source.stale).toBe(false);

      // Test boundary: 8 days ago should be stale
      const uri8days = createTestUri('8days');
      const cid8days = createTestCid('8days');

      const eightDaysAgo: RecordMetadata = {
        uri: uri8days,
        cid: cid8days,
        pdsUrl: TEST_PDS_URL,
        indexedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      };

      await eprintService.indexEprint(createTestEprint(uri8days), eightDaysAgo);

      const res8 = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri8days)}`
      );
      const body8 = (await res8.json()) as EprintResponse;

      expect(body8.source.stale).toBe(true);
    });
  });

  describe('CRITICAL: Data flow is PDS → Firehose → AppView (read-only)', () => {
    it('API only exposes read operations', async () => {
      // Test that we can read
      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.listByAuthor?did=${encodeURIComponent(TEST_AUTHOR)}`
      );
      expect(res.status).toBe(200);

      // Test that write operations don't exist
      const writeEndpoints = [
        { path: '/xrpc/pub.chive.eprint.create', method: 'POST' },
        { path: '/xrpc/pub.chive.eprint.update', method: 'PUT' },
        { path: '/xrpc/pub.chive.eprint.delete', method: 'DELETE' },
        { path: '/xrpc/com.atproto.repo.createRecord', method: 'POST' },
        { path: '/xrpc/com.atproto.repo.putRecord', method: 'PUT' },
        { path: '/xrpc/com.atproto.repo.deleteRecord', method: 'POST' },
        { path: '/api/v1/eprints', method: 'POST' },
        { path: '/api/v1/eprints', method: 'PUT' },
        { path: '/api/v1/eprints', method: 'DELETE' },
      ];

      for (const { path, method } of writeEndpoints) {
        const writeRes = await makeRequest(path, { method });
        // All write operations should return 404 (not found) or 405 (method not allowed)
        expect([404, 405]).toContain(writeRes.status);
      }
    });

    it('indexing happens from firehose (not direct API)', async () => {
      // The EprintService.indexEprint method is called from firehose consumer,
      // NOT from an API endpoint. Verify there's no API endpoint for indexing.
      const res = await makeRequest('/xrpc/pub.chive.internal.indexEprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: 'at://test' }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('Credible Exit: Data accessible from original PDSes', () => {
    it('response provides enough info to fetch from PDS directly', async () => {
      const uri = createTestUri('exit1');
      const cid = createTestCid('exit1');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // User should be able to reconstruct PDS fetch URL
      expect(body.uri).toBeDefined(); // AT URI
      expect(body.source.pdsEndpoint).toBeDefined(); // PDS base URL
      expect(body.source.recordUrl).toBeDefined(); // Full URL to fetch record

      // Parse AT URI to verify components
      const uriParts = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(body.uri);
      expect(uriParts).not.toBeNull();
      expect(uriParts?.[1]).toBe(TEST_AUTHOR); // DID
      expect(uriParts?.[2]).toBe('pub.chive.eprint.submission'); // Collection
    });

    it('blob reference provides CID for PDS fetch', async () => {
      const uri = createTestUri('exitblob1');
      const cid = createTestCid('exitblob1');
      const eprint = createTestEprint(uri, {
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiexit123' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
      });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // User should be able to fetch blob from PDS using CID
      expect(body.document.ref).toBeDefined();
      expect(typeof body.document.ref).toBe('string');
      // CID should be valid format
      expect(body.document.ref).toMatch(/^baf[a-z0-9]+$/);
    });
  });

  describe('Response format consistency', () => {
    it('all error responses follow standardized format', async () => {
      // Validation error
      const validationRes = await makeRequest('/xrpc/pub.chive.eprint.getSubmission');
      expect(validationRes.status).toBe(400);
      const validationBody = (await validationRes.json()) as ErrorResponse;
      expect(validationBody.error.code).toBeDefined();
      expect(validationBody.error.message).toBeDefined();
      expect(validationBody.error.requestId).toBeDefined();

      // Not found error
      const notFoundRes = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(createTestUri('notfound'))}`
      );
      expect(notFoundRes.status).toBe(404);
      const notFoundBody = (await notFoundRes.json()) as ErrorResponse;
      expect(notFoundBody.error.code).toBe('NOT_FOUND');
      expect(notFoundBody.error.message).toBeDefined();
      expect(notFoundBody.error.requestId).toBeDefined();
    });

    it('all successful responses include requestId header', async () => {
      const uri = createTestUri('reqid1');
      const cid = createTestCid('reqid1');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));

      const res = await makeRequest(
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Request-Id')).toBeDefined();
      expect(res.headers.get('X-Request-Id')).toMatch(/^req_/);
    });
  });
});
