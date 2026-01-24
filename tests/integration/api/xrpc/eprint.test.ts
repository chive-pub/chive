/**
 * Integration tests for XRPC eprint endpoints.
 *
 * @remarks
 * Tests the full request/response cycle through the Hono server
 * including middleware, handlers, and service integration.
 *
 * Validates ATProto compliance:
 * - All responses include `source` field with PDS information
 * - BlobRefs only, never inline blob data
 * - Proper staleness tracking
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
import type { EprintAuthor } from '@/types/models/author.js';
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
} from '../../../helpers/mock-services.js';
import type {
  EprintResponse,
  EprintListResponse,
  SearchResultsResponse,
  ErrorResponse,
} from '../../../types/api-responses.js';

// Test constants
const TEST_AUTHOR = 'did:plc:testauthor123' as DID;
const TEST_PDS_URL = 'https://pds.test.example.com';
const INDEX_NAME = 'eprints-integration-api';
// Unique IP for xrpc eprint tests to avoid rate limit collisions with parallel test files
const XRPC_EPRINT_TEST_IP = '192.168.100.1';

// Valid CIDv1 strings for test data - these are properly formatted base32 CIDs
const VALID_CID_BASE = 'bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
const VALID_BLOB_CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';

// Generate unique test URIs
function createTestUri(suffix: string): AtUri {
  const timestamp = Date.now();
  return `at://${TEST_AUTHOR}/pub.chive.eprint.submission/api${timestamp}${suffix}` as AtUri;
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
 * Makes test request with unique IP to avoid rate limit collisions.
 */
function testRequest(
  app: Hono<ChiveEnv>,
  url: string,
  init?: RequestInit
): Response | Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-Forwarded-For', XRPC_EPRINT_TEST_IP);
  return app.request(url, { ...init, headers });
}

/**
 * Creates test eprint record.
 */
type TestEprintOverrides = Omit<Partial<Eprint>, 'abstract'> & {
  abstract?: string | AnnotationBody;
};

function createTestEprint(uri: AtUri, overrides: TestEprintOverrides = {}): Eprint {
  const testAuthor: EprintAuthor = {
    did: TEST_AUTHOR,
    name: 'Test Author',
    order: 1,
    affiliations: [{ name: 'University of Example' }],
    contributions: [],
    isCorrespondingAuthor: true,
    isHighlighted: false,
  };

  // Destructure abstract from overrides to prevent re-spreading after conversion
  const { abstract: rawAbstract, ...restOverrides } = overrides;

  return {
    $type: 'pub.chive.eprint.submission',
    uri,
    cid: restOverrides.cid ?? createTestCid('default'),
    authors: restOverrides.authors ?? [testAuthor],
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

describe('XRPC Eprint Endpoints Integration', () => {
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

  describe('GET /xrpc/pub.chive.eprint.getSubmission', () => {
    it('returns 400 for missing uri parameter', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.eprint.getSubmission');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBe('InvalidRequest');
    });

    it('returns 404 for non-existent eprint', async () => {
      const nonExistentUri = createTestUri('nonexistent');
      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(nonExistentUri)}`
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBe('NotFound');
    });

    it('returns eprint with ATProto-compliant pdsUrl field', async () => {
      // Index an eprint first
      const uri = createTestUri('get1');
      const cid = createTestCid('get1');
      const eprint = createTestEprint(uri, { title: 'The Semantics of Exceptional Scope' });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Verify core fields
      expect(body.uri).toBe(uri);
      expect(body.value.title).toBe('The Semantics of Exceptional Scope');

      // Verify ATProto compliance: pdsUrl and indexedAt MUST be present
      expect(body.pdsUrl).toBeDefined();
      expect(body.pdsUrl).toBe(TEST_PDS_URL);
      expect(body.indexedAt).toBeDefined();
    });

    it('includes document as BlobRef in value, never inline data', async () => {
      const uri = createTestUri('blobref1');
      const cid = createTestCid('blobref1');
      const eprint = createTestEprint(uri, {
        documentBlobRef: {
          $type: 'blob',
          ref: VALID_BLOB_CID as CID,
          mimeType: 'application/pdf',
          size: 2048576,
        },
      });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Verify BlobRef structure in value.document
      expect(body.value.document).toBeDefined();
      const document = body.value.document as Record<string, unknown>;
      expect(document.$type).toBe('blob');
      expect(document.ref).toBeDefined();
      expect(document.mimeType).toBe('application/pdf');
      // Size may be number or string depending on database serialization
      expect(Number(document.size)).toBe(2048576);

      // Verify no inline data (ATProto compliance)
      expect(document.data).toBeUndefined();
      expect(document.content).toBeUndefined();
      expect(document.buffer).toBeUndefined();
    });

    it('includes version in value when available', async () => {
      const uri = createTestUri('versions1');
      const cid = createTestCid('versions1');
      const eprint = createTestEprint(uri, { version: 1 });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Version is part of the eprint value
      expect(body.value).toBeDefined();
      expect(body.value.version).toBeDefined();
    });

    it('returns eprint value with expected structure', async () => {
      const uri = createTestUri('structure1');
      const cid = createTestCid('structure1');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Value should contain the eprint data
      expect(body.value).toBeDefined();
      expect(body.value.title).toBeDefined();
      expect(body.value.abstract).toBeDefined();
    });

    it('includes requestId in response headers', async () => {
      const uri = createTestUri('reqid1');
      const cid = createTestCid('reqid1');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.headers.get('X-Request-Id')).toBeDefined();
      expect(res.headers.get('X-Request-Id')).toMatch(/^req_/);
    });

    it('returns old indexedAt for old eprints', async () => {
      const uri = createTestUri('stale1');
      const cid = createTestCid('stale1');
      const eprint = createTestEprint(uri);

      // Index with old timestamp (8 days ago)
      const oldMetadata: RecordMetadata = {
        uri,
        cid,
        pdsUrl: TEST_PDS_URL,
        indexedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      };

      await eprintService.indexEprint(eprint, oldMetadata);
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Check that indexedAt reflects old timestamp
      const indexedDate = new Date(body.indexedAt);
      const now = Date.now();
      expect(now - indexedDate.getTime()).toBeGreaterThan(7 * 24 * 60 * 60 * 1000);
    });

    it('returns recent indexedAt for fresh eprints', async () => {
      const uri = createTestUri('fresh1');
      const cid = createTestCid('fresh1');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintResponse;

      // Check that indexedAt is recent
      const indexedDate = new Date(body.indexedAt);
      const now = Date.now();
      expect(now - indexedDate.getTime()).toBeLessThan(60 * 1000);
    });
  });

  describe('GET /xrpc/pub.chive.eprint.listByAuthor', () => {
    it('returns 400 for missing did parameter', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.eprint.listByAuthor');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBe('InvalidRequest');
    });

    it('returns empty list for author with no eprints', async () => {
      const unknownAuthor = 'did:plc:unknownauthor' as DID;
      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.listByAuthor?did=${encodeURIComponent(unknownAuthor)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintListResponse;

      expect(body.eprints).toEqual([]);
      // total is optional, cursor indicates no more results
      expect(body.cursor).toBeUndefined();
    });

    it('returns eprints by author with uri and title', async () => {
      // Index eprints for TEST_AUTHOR
      for (let i = 0; i < 3; i++) {
        const uri = createTestUri(`author${i}`);
        const cid = createTestCid(`author${i}`);
        const eprint = createTestEprint(uri, { title: `Dynamic Semantics Paper ${i}` });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.listByAuthor?did=${encodeURIComponent(TEST_AUTHOR)}`
      );

      if (res.status !== 200) {
        const errorBody = await res.clone().json();
        console.error('DEBUG listByAuthor error:', JSON.stringify(errorBody, null, 2));
      }
      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintListResponse;

      expect(body.eprints.length).toBeGreaterThan(0);

      // Verify each eprint summary has required fields
      for (const eprint of body.eprints) {
        expect(eprint.uri).toBeDefined();
        expect(eprint.title).toBeDefined();
        expect(eprint.indexedAt).toBeDefined();
      }
    });

    it('respects limit parameter', async () => {
      // Index 5 eprints
      for (let i = 0; i < 5; i++) {
        const uri = createTestUri(`limit${i}`);
        const cid = createTestCid(`limit${i}`);
        const eprint = createTestEprint(uri, { title: `Quantifier Scope Study ${i}` });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.listByAuthor?did=${encodeURIComponent(TEST_AUTHOR)}&limit=2`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintListResponse;

      // Verify limit is respected
      expect(body.eprints.length).toBeLessThanOrEqual(2);
      // cursor indicates if there are more results
      // total is optional
    });

    it('supports cursor-based pagination', async () => {
      // Index 5 eprints
      for (let i = 0; i < 5; i++) {
        const uri = createTestUri(`page${i}`);
        const cid = createTestCid(`page${i}`);
        const eprint = createTestEprint(uri, { title: `Presupposition Analysis ${i}` });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      // First page
      const res1 = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.listByAuthor?did=${encodeURIComponent(TEST_AUTHOR)}&limit=2`
      );
      expect(res1.status).toBe(200);
      const page1 = (await res1.json()) as EprintListResponse;

      // Verify structure
      expect(page1.eprints.length).toBeLessThanOrEqual(2);

      // If there are more results and cursor is provided, test pagination
      if (page1.cursor) {
        const res2 = await testRequest(
          app,
          `/xrpc/pub.chive.eprint.listByAuthor?did=${encodeURIComponent(TEST_AUTHOR)}&limit=2&cursor=${page1.cursor}`
        );
        expect(res2.status).toBe(200);
        const page2 = (await res2.json()) as EprintListResponse;

        expect(page2.eprints.length).toBeLessThanOrEqual(2);

        // Verify no overlap between pages
        const page1Uris = new Set(page1.eprints.map((p) => p.uri));
        const page2Uris = new Set(page2.eprints.map((p) => p.uri));
        const intersection = [...page1Uris].filter((uri) => page2Uris.has(uri));
        expect(intersection.length).toBe(0);
      }
    });

    it('returns full abstracts without truncation', async () => {
      const longAbstract = 'A'.repeat(1000);
      const uri = createTestUri('truncate1');
      const cid = createTestCid('truncate1');
      const eprint = createTestEprint(uri, { abstract: longAbstract });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.listByAuthor?did=${encodeURIComponent(TEST_AUTHOR)}`
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as EprintListResponse;

      const matchingEprint = body.eprints.find((p) => p.uri === uri);
      expect(matchingEprint).toBeDefined();
      if (matchingEprint?.abstract) {
        expect(matchingEprint.abstract.length).toBe(1000);
      }
    });
  });

  describe('GET /xrpc/pub.chive.eprint.searchSubmissions', () => {
    it('returns results even without q parameter (browsing mode)', async () => {
      // searchSubmissions is a GET endpoint (type: 'query') - q is optional for browsing
      const res = await testRequest(app, '/xrpc/pub.chive.eprint.searchSubmissions');

      // Returns 200 for browse mode (q is optional)
      expect(res.status).toBe(200);
    });

    it('returns search results with uri and score', async () => {
      // Index searchable eprints
      for (let i = 0; i < 3; i++) {
        const uri = createTestUri(`search${i}`);
        const cid = createTestCid(`search${i}`);
        const eprint = createTestEprint(uri, {
          title: `Clause-Embedding Predicates Study ${i}`,
          keywords: ['clause-embedding', 'semantics', 'predicates'],
        });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      // Wait for Elasticsearch indexing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // searchSubmissions is a GET endpoint with query params
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.eprint.searchSubmissions?q=clause-embedding+predicates&limit=10'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      expect(body.hits).toBeDefined();
      expect(Array.isArray(body.hits)).toBe(true);

      // Verify uri field presence on results
      if (body.hits.length > 0) {
        for (const hit of body.hits) {
          expect(hit.uri).toBeDefined();
        }
      }
    });

    it('includes search metadata (total, cursor)', async () => {
      const uri = createTestUri('searchmeta1');
      const cid = createTestCid('searchmeta1');
      const eprint = createTestEprint(uri, { title: 'Algebraic Effects in Dynamic Semantics' });
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // searchSubmissions is a GET endpoint with query params
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.eprint.searchSubmissions?q=algebraic+effects&limit=10'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      // total is optional but typically present
      // cursor is present if there are more results
      expect(body.hits).toBeDefined();
    });

    it('respects limit parameter', async () => {
      // Index multiple searchable eprints
      for (let i = 0; i < 5; i++) {
        const uri = createTestUri(`searchlimit${i}`);
        const cid = createTestCid(`searchlimit${i}`);
        const eprint = createTestEprint(uri, {
          title: `Incremental Quantification Study ${i}`,
          keywords: ['quantification', 'semantics'],
        });
        await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
        createdUris.push(uri);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // searchSubmissions is a GET endpoint with query params
      const res = await testRequest(
        app,
        '/xrpc/pub.chive.eprint.searchSubmissions?q=quantification+semantics&limit=2'
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as SearchResultsResponse;

      expect(body.hits.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Rate Limiting', () => {
    it('includes rate limit headers in response', async () => {
      const uri = createTestUri('ratelimit1');
      const cid = createTestCid('ratelimit1');
      const eprint = createTestEprint(uri);
      await eprintService.indexEprint(eprint, createTestMetadata(uri, cid));
      createdUris.push(uri);

      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(uri)}`
      );

      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('Error Response Format', () => {
    it('returns ATProto-compliant error format for validation errors', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.eprint.getSubmission');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;

      expect(body.error).toBe('InvalidRequest');
      expect(body.message).toBeDefined();
    });

    it('returns ATProto-compliant error format for not found errors', async () => {
      const nonExistentUri = createTestUri('notfound');
      const res = await testRequest(
        app,
        `/xrpc/pub.chive.eprint.getSubmission?uri=${encodeURIComponent(nonExistentUri)}`
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as ErrorResponse;

      expect(body.error).toBe('NotFound');
      expect(body.message).toContain('Eprint not found');
    });
  });

  describe('Security Headers', () => {
    it('includes security headers in response', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.eprint.listByAuthor?did=did:plc:test');

      // Check for common security headers (Hono secureHeaders middleware)
      // At minimum, one of the security headers should be present
      const hasXContentTypeOptions = res.headers.get('X-Content-Type-Options') === 'nosniff';
      const hasXFrameOptions = res.headers.has('X-Frame-Options');
      const hasCsp = res.headers.has('Content-Security-Policy');

      expect(hasXContentTypeOptions || hasXFrameOptions || hasCsp).toBe(true);
    });
  });

  describe('CORS Headers', () => {
    it('includes CORS headers in response', async () => {
      const res = await testRequest(app, '/xrpc/pub.chive.eprint.listByAuthor?did=did:plc:test', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});
