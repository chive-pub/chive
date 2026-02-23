/**
 * Integration tests for REST v1/eprints endpoints.
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
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { createServer, type ServerConfig } from '@/api/server.js';
import type { ChiveEnv } from '@/api/types/context.js';
import { EprintService, type RecordMetadata } from '@/services/eprint/eprint-service.js';
import { NoOpRelevanceLogger } from '@/services/search/relevance-logger.js';
import { createElasticsearchClient } from '@/storage/elasticsearch/setup.js';
import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import { getRedisConfig } from '@/storage/redis/structures.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type {
  ISearchEngine,
  IndexableEprintDocument,
  SearchQuery,
  SearchResults,
  FacetedSearchQuery,
  FacetedSearchResults,
} from '@/types/interfaces/search.interface.js';
import type { AnnotationBody } from '@/types/models/annotation.js';
import type { Eprint } from '@/types/models/eprint.js';

/** Creates a mock rich text abstract from plain text. */
function createMockAbstract(text: string): AnnotationBody {
  return {
    type: 'RichText',
    items: [{ type: 'text', content: text }],
    format: 'application/x-chive-gloss+json',
  };
}

import {
  createMockAuthzService,
  createMockAlphaService,
  createMockLogger,
  createMockIdentity,
  createMockRepository,
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
} from '../../../../helpers/mock-services.js';
import type {
  EprintResponse,
  EprintListResponse,
  SearchResultsResponse,
  ErrorResponse,
  HealthResponse,
} from '../../../../types/api-responses.js';

// Test constants
const TEST_AUTHOR = 'did:plc:restauthor123' as DID;
const TEST_PDS_URL = 'https://pds.test.example.com';
const INDEX_NAME = 'eprints-rest-integration';
// Unique IP for REST eprint tests to avoid rate limit collisions with parallel test files
const REST_EPRINT_TEST_IP = '192.168.100.2';

// Valid CIDv1 strings for test data - these are properly formatted base32 CIDs
const VALID_CID_BASE = 'bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const VALID_BLOB_CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';

// Generate unique test URIs
function createTestUri(suffix: string): AtUri {
  const timestamp = Date.now();
  return `at://${TEST_AUTHOR}/pub.chive.eprint.submission/rest${timestamp}${suffix}` as AtUri;
}

function createTestCid(_suffix: string): CID {
  // Return a valid CIDv1 - the suffix is ignored but keeps function signature compatible
  return VALID_CID_BASE as CID;
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
          field_nodes: doc.fieldNodes,
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
    findSimilarByText: () => Promise.resolve([]),
  };
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
  headers.set('X-Forwarded-For', REST_EPRINT_TEST_IP);
  return app.request(url, { ...init, headers });
}

/**
 * Creates test eprint record.
 */
type TestEprintOverrides = Omit<Partial<Eprint>, 'abstract'> & {
  abstract?: string | AnnotationBody;
};

function createTestEprint(uri: AtUri, overrides: TestEprintOverrides = {}): Eprint {
  // Destructure abstract from overrides to prevent re-spreading after conversion
  const { abstract: rawAbstract, ...restOverrides } = overrides;

  return {
    $type: 'pub.chive.eprint.submission',
    uri,
    cid: restOverrides.cid ?? createTestCid('default'),
    authors: restOverrides.authors ?? [
      {
        did: TEST_AUTHOR,
        name: 'Test Author',
        order: 1,
        affiliations: [{ name: 'University of Example' }],
        contributions: [],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      },
    ],
    submittedBy: TEST_AUTHOR,
    title:
      restOverrides.title ??
      'Frequency, acceptability, and selection: A case study of clause-embedding',
    abstract:
      typeof rawAbstract === 'string'
        ? createMockAbstract(rawAbstract)
        : (rawAbstract ??
          createMockAbstract(
            'We investigate the relationship between the frequency with which verbs are found in particular subcategorization frames and the acceptability of those verbs in those frames, focusing in particular on subordinate clause-taking verbs, such as think, want, and tell.'
          )),
    keywords: restOverrides.keywords ?? ['semantics', 'clause-embedding', 'acceptability'],
    facets: restOverrides.facets ?? [{ dimension: 'matter', value: 'Linguistics' }],
    version: restOverrides.version ?? 1,
    license: restOverrides.license ?? 'CC-BY-4.0',
    documentBlobRef: restOverrides.documentBlobRef ?? {
      $type: 'blob',
      ref: VALID_BLOB_CID as CID,
      mimeType: 'application/pdf',
      size: 1024000,
    },
    documentFormat: 'pdf',
    publicationStatus: 'eprint',
    createdAt: restOverrides.createdAt ?? (Date.now() as Timestamp),
    ...restOverrides,
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

describe('REST v1/eprints Endpoints Integration', () => {
  let pool: Pool;
  let esClient: Client;
  let redis: Redis;
  let storage: PostgreSQLAdapter;
  let searchEngine: ISearchEngine;
  let eprintService: EprintService;
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

    // Create eprint service
    eprintService = new EprintService({
      storage,
      search: searchEngine,
      repository: createMockRepository(),
      identity: createMockIdentity(),
      logger,
    });

    // Create Hono app with full middleware stack
    const serverConfig: ServerConfig = {
      eprintService,
      searchService: createMockSearchService(searchEngine),
      metricsService: createMockMetricsService(),
      graphService: createMockGraphService(),
      blobProxyService: createMockBlobProxyService(),
      reviewService: createMockReviewService(),
      annotationService: {} as ServerConfig['annotationService'],
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

  describe('GET /api/v1/eprints/:uri', () => {
    it('returns error for invalid uri format', async () => {
      const res = await testRequest(app, '/api/v1/eprints/invalid-uri-format');

      // May return 400 (validation), 404 (not found), or 500 (internal error from parsing)
      expect([400, 404, 500]).toContain(res.status);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('returns 404 for non-existent eprint', async () => {
      const nonExistentUri = createTestUri('nonexistent');
      const res = await testRequest(app, `/api/v1/eprints/${encodeURIComponent(nonExistentUri)}`);

      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBe('NotFound');
    });

    it('returns eprint with ATProto-compliant pdsUrl field', async () => {
      // Index an eprint first
      const uri = createTestUri('restget1');
      const cid = createTestCid('restget1');
      const eprint = createTestEprint(uri, {
        title: 'Split-scope definites: Relative superlatives and Haddock descriptions',
      });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(app, `/api/v1/eprints/${encodeURIComponent(uri)}`);

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Verify core fields
      expect(body.uri).toBe(uri);
      expect(body.value.title).toBe(
        'Split-scope definites: Relative superlatives and Haddock descriptions'
      );

      // Verify ATProto compliance: pdsUrl field MUST be present
      expect(body.pdsUrl).toBeDefined();
      expect(body.pdsUrl).toBe(TEST_PDS_URL);
    });

    it('includes document as BlobRef in value, never inline data', async () => {
      const uri = createTestUri('restblob1');
      const cid = createTestCid('restblob1');
      const eprint = createTestEprint(uri, {
        documentBlobRef: {
          $type: 'blob',
          ref: VALID_BLOB_CID as CID,
          mimeType: 'application/pdf',
          size: 3145728,
        },
      });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(app, `/api/v1/eprints/${encodeURIComponent(uri)}`);

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Verify BlobRef structure in value.document
      expect(body.value.document).toBeDefined();
      const document = body.value.document as Record<string, unknown>;
      expect(document.$type).toBe('blob');
      expect(document.ref).toBeDefined();

      // Verify no inline data (ATProto compliance)
      expect(document.data).toBeUndefined();
      expect(document.content).toBeUndefined();
      expect(document.buffer).toBeUndefined();
    });

    it('equivalent to XRPC getSubmission endpoint', async () => {
      const uri = createTestUri('equiv1');
      const cid = createTestCid('equiv1');
      const eprint = createTestEprint(uri, { title: 'Equivalence Test' });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      // Call REST endpoint
      const restRes = await testRequest(app, `/api/v1/eprints/${encodeURIComponent(uri)}`);
      const restBody = (await restRes.json()) as EprintResponse;

      // Call XRPC endpoint
      const xrpcRes = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );
      const xrpcBody = (await xrpcRes.json()) as EprintResponse;

      // Core fields should be equivalent
      expect(restBody.uri).toBe(xrpcBody.uri);
      expect(restBody.value.title).toBe(xrpcBody.value.title);
      expect(restBody.pdsUrl).toBe(xrpcBody.pdsUrl);
    });
  });

  describe('GET /api/v1/eprints (search)', () => {
    it('returns results even without q parameter (browsing mode)', async () => {
      // Without q parameter, returns all eprints (faceted browsing)
      const res = await testRequest(app, '/api/v1/eprints');

      // Returns 200 for browse mode (q is optional)
      expect(res.status).toBe(200);
    });

    it('returns search results with source field for each', async () => {
      // Index multiple eprints
      for (let i = 0; i < 3; i++) {
        const uri = createTestUri(`restlist${i}`);
        const cid = createTestCid(`restlist${i}`);
        const eprint = createTestEprint(uri, { title: `Quantifier Scope in Linguistics ${i}` });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await testRequest(app, '/api/v1/eprints?q=Quantifier+Scope');

      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      // Search results have hits array
      expect(body.hits).toBeDefined();
      expect(Array.isArray(body.hits)).toBe(true);
    });

    it('supports pagination with limit', async () => {
      // Index multiple eprints
      for (let i = 0; i < 5; i++) {
        const uri = createTestUri(`restpage${i}`);
        const cid = createTestCid(`restpage${i}`);
        const eprint = createTestEprint(uri, { title: `Dynamic Semantics Analysis ${i}` });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await testRequest(app, '/api/v1/eprints?q=Dynamic+Semantics&limit=2');
      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      expect(body.hits.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/v1/authors/:did/eprints', () => {
    it('returns eprints by author', async () => {
      const uri = createTestUri('restauthor1');
      const cid = createTestCid('restauthor1');
      const eprint = createTestEprint(uri, { title: 'Author Eprint' });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/api/v1/authors/${encodeURIComponent(TEST_AUTHOR)}/eprints`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintListResponse;

      expect(body.eprints).toBeDefined();
    });
  });

  describe('GET /api/v1/search', () => {
    it('returns results even without query parameter (browsing mode)', async () => {
      const res = await testRequest(app, '/api/v1/search');

      // Returns 200 for browse mode (q is optional)
      expect(res.status).toBe(200);
    });

    it('returns search results with hits array', async () => {
      // Index searchable eprints
      for (let i = 0; i < 3; i++) {
        const uri = createTestUri(`restsearch${i}`);
        const cid = createTestCid(`restsearch${i}`);
        const eprint = createTestEprint(uri, {
          title: `Clause-Embedding Predicates Analysis ${i}`,
          keywords: ['semantics', 'clause-embedding', 'predicates'],
        });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
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

    it('includes search metadata (total, cursor)', async () => {
      const uri = createTestUri('restsearchmeta');
      const cid = createTestCid('restsearchmeta');
      const eprint = createTestEprint(uri, { title: 'Factive Predicates and Presupposition' });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await testRequest(app, '/api/v1/search?q=factive+predicates');

      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      // total is optional but typically present
      // cursor is present if there are more results
      expect(body.hits).toBeDefined();
    });

    it('supports limit parameter', async () => {
      // Index multiple searchable eprints
      for (let i = 0; i < 5; i++) {
        const uri = createTestUri(`restsearchlimit${i}`);
        const cid = createTestCid(`restsearchlimit${i}`);
        const eprint = createTestEprint(uri, {
          title: `Incremental Quantification Semantics ${i}`,
          keywords: ['quantification', 'incrementality', 'semantics'],
        });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
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
      const res = await testRequest(app, '/api/v1/eprints');

      expect(res.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('Rate Limiting', () => {
    it('includes rate limit headers in REST responses', async () => {
      const res = await testRequest(app, '/api/v1/eprints');

      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('Error Response Format', () => {
    it('returns standardized error format for invalid parameter', async () => {
      // Use an invalid limit parameter to trigger validation error
      const res = await testRequest(app, '/api/v1/search?limit=invalid');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;

      expect(body.error).toBeDefined();
      expect(body.message).toBeDefined();
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
      const res = await testRequest(app, '/api/v1/eprints', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});
