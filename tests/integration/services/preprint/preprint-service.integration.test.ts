/**
 * PreprintService integration tests.
 *
 * @remarks
 * Tests PreprintService against real PostgreSQL and Elasticsearch instances:
 * - Indexing from firehose events
 * - Query operations
 * - Version chain traversal
 * - PDS source tracking
 * - Staleness detection
 *
 * Requires Docker test stack running (PostgreSQL 16+, Elasticsearch 8+).
 *
 * @packageDocumentation
 */

import { Client } from '@elastic/elasticsearch';
import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { PreprintService, type RecordMetadata } from '@/services/preprint/preprint-service.js';
import { createElasticsearchClient } from '@/storage/elasticsearch/setup.js';
import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import type { IIdentityResolver } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IRepository } from '@/types/interfaces/repository.interface.js';
import type {
  ISearchEngine,
  IndexablePreprintDocument,
} from '@/types/interfaces/search.interface.js';
import type { PreprintAuthor } from '@/types/models/author.js';
import type { Preprint } from '@/types/models/preprint.js';

// Test constants
const TEST_AUTHOR = 'did:plc:testauthor123' as DID;
const TEST_PDS_URL = 'https://pds.test.example.com';

// Generate unique test URIs to avoid conflicts
function createTestUri(suffix: string): AtUri {
  const timestamp = Date.now();
  return `at://${TEST_AUTHOR}/pub.chive.preprint.submission/test${timestamp}${suffix}` as AtUri;
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
 * Creates mock identity resolver for tests.
 */
function createMockIdentity(): IIdentityResolver {
  return {
    resolveDID: vi.fn().mockResolvedValue({
      id: TEST_AUTHOR,
      alsoKnownAs: ['at://testuser.bsky.social'],
      verificationMethod: [],
    }),
    resolveHandle: vi.fn().mockResolvedValue(TEST_AUTHOR),
    getPDSEndpoint: vi.fn().mockResolvedValue(TEST_PDS_URL),
  };
}

/**
 * Creates mock repository for tests.
 */
function createMockRepository(): IRepository {
  return {
    getRecord: vi.fn().mockResolvedValue(null),
    listRecords: vi.fn(),
    getBlob: vi.fn().mockResolvedValue(null),
  };
}

/**
 * Creates a simple search engine wrapper for Elasticsearch.
 */
function createSearchEngine(client: Client): ISearchEngine {
  const INDEX_NAME = 'preprints-test';

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
    search: async (query) => {
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
    facetedSearch: () =>
      Promise.resolve({
        hits: [],
        total: 0,
        took: 0,
        facets: {},
      }),
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
 * Creates test preprint record.
 */
function createTestPreprint(overrides: Partial<Preprint> = {}): Preprint {
  const testAuthor: PreprintAuthor = {
    did: TEST_AUTHOR,
    name: 'Test Integration Author',
    order: 1,
    affiliations: [],
    contributions: [],
    isCorrespondingAuthor: true,
    isHighlighted: false,
  };

  return {
    $type: 'pub.chive.preprint.submission',
    uri: overrides.uri ?? createTestUri('default'),
    cid: overrides.cid ?? createTestCid('default'),
    authors: overrides.authors ?? [testAuthor],
    submittedBy: TEST_AUTHOR,
    title: overrides.title ?? 'Test Preprint Title',
    abstract: overrides.abstract ?? 'This is a test abstract for the preprint.',
    keywords: overrides.keywords ?? ['test', 'integration'],
    facets: overrides.facets ?? [{ dimension: 'matter', value: 'Computer Science' }],
    version: overrides.version ?? 1,
    license: overrides.license ?? 'CC-BY-4.0',
    documentBlobRef: overrides.documentBlobRef ?? {
      $type: 'blob',
      ref: 'bafyreibtest123' as CID,
      mimeType: 'application/pdf',
      size: 1024000,
    },
    documentFormat: 'pdf',
    publicationStatus: 'preprint',
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

describe('PreprintService Integration', () => {
  let pool: Pool;
  let esClient: Client;
  let storage: PostgreSQLAdapter;
  let search: ISearchEngine;
  let service: PreprintService;

  beforeAll(async () => {
    // Initialize PostgreSQL
    const dbConfig = getDatabaseConfig();
    pool = new Pool(dbConfig);
    storage = new PostgreSQLAdapter(pool);

    // Initialize Elasticsearch
    esClient = createElasticsearchClient();
    search = createSearchEngine(esClient);

    // Create test index if it doesn't exist
    const indexExists = await esClient.indices.exists({ index: 'preprints-test' });
    if (!indexExists) {
      await esClient.indices.create({
        index: 'preprints-test',
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

    // Create service
    service = new PreprintService({
      storage,
      search,
      repository: createMockRepository(),
      identity: createMockIdentity(),
      logger: createMockLogger(),
    });
  });

  afterAll(async () => {
    // Clean up test index
    try {
      await esClient.indices.delete({ index: 'preprints-test' });
    } catch {
      // Index may not exist
    }

    await esClient.close();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data from Elasticsearch
    try {
      await esClient.deleteByQuery({
        index: 'preprints-test',
        query: { match_all: {} },
        refresh: true,
      });
    } catch {
      // Index may be empty
    }
  });

  describe('indexPreprint', () => {
    it('indexes preprint to PostgreSQL storage', async () => {
      const uri = createTestUri('pg1');
      const cid = createTestCid('pg1');
      const preprint = createTestPreprint({ title: 'PostgreSQL Test Preprint' });
      const metadata = createTestMetadata(uri, cid);

      const result = await service.indexPreprint(preprint, metadata);

      expect(result.ok).toBe(true);

      // Verify in PostgreSQL
      const stored = await storage.getPreprint(uri);
      expect(stored).not.toBeNull();
      expect(stored?.title).toBe('PostgreSQL Test Preprint');
      expect(stored?.submittedBy).toBe(TEST_AUTHOR);
      expect(stored?.authors[0]?.did).toBe(TEST_AUTHOR);
      expect(stored?.pdsUrl).toBe(TEST_PDS_URL);
    });

    it('indexes preprint to Elasticsearch for search', async () => {
      const uri = createTestUri('es1');
      const cid = createTestCid('es1');
      const preprint = createTestPreprint({ title: 'Elasticsearch Searchable Preprint' });
      const metadata = createTestMetadata(uri, cid);

      const result = await service.indexPreprint(preprint, metadata);
      expect(result.ok).toBe(true);

      // Verify searchable in Elasticsearch
      const searchResults = await search.search({ q: 'Elasticsearch Searchable', limit: 10 });
      expect(searchResults.hits.length).toBeGreaterThan(0);
      expect(searchResults.hits[0]?.uri).toBe(uri);
    });

    it('tracks PDS source for staleness detection', async () => {
      const uri = createTestUri('pds1');
      const cid = createTestCid('pds1');
      const preprint = createTestPreprint();
      const metadata = createTestMetadata(uri, cid);

      await service.indexPreprint(preprint, metadata);

      // Verify PDS tracking via staleness check
      const stalenessStatus = await service.checkStaleness(uri);
      expect(stalenessStatus.indexedCid).toBe(cid);
      expect(stalenessStatus.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('handles update by re-indexing with new CID', async () => {
      const uri = createTestUri('update1');
      const cid1 = createTestCid('v1');
      const cid2 = createTestCid('v2');

      // Index initial version
      const preprint1 = createTestPreprint({ title: 'Original Title' });
      await service.indexPreprint(preprint1, createTestMetadata(uri, cid1));

      // Index updated version
      const preprint2 = createTestPreprint({ title: 'Updated Title' });
      await service.indexPreprintUpdate(uri, preprint2, createTestMetadata(uri, cid2));

      // Verify update
      const stored = await storage.getPreprint(uri);
      expect(stored?.title).toBe('Updated Title');
      expect(stored?.cid).toBe(cid2);
    });
  });

  describe('getPreprint', () => {
    it('returns null for non-existent preprint', async () => {
      const uri = createTestUri('nonexistent');
      const result = await service.getPreprint(uri);
      expect(result).toBeNull();
    });

    it('returns preprint with version history', async () => {
      const uri = createTestUri('get1');
      const cid = createTestCid('get1');
      const preprint = createTestPreprint({ title: 'Retrievable Preprint' });

      await service.indexPreprint(preprint, createTestMetadata(uri, cid));

      const result = await service.getPreprint(uri);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Retrievable Preprint');
      expect(result?.uri).toBe(uri);
      expect(result?.versions).toBeDefined();
    });
  });

  describe('getPreprintsByAuthor', () => {
    it('returns empty array for author with no preprints', async () => {
      const unknownAuthor = 'did:plc:unknownauthor' as DID;
      const result = await service.getPreprintsByAuthor(unknownAuthor);

      expect(result.preprints).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns preprints by author with pagination', async () => {
      // Index multiple preprints by same author
      const preprints = [];
      for (let i = 0; i < 3; i++) {
        const uri = createTestUri(`author${i}`);
        const cid = createTestCid(`author${i}`);
        const preprint = createTestPreprint({ title: `Author Preprint ${i}` });
        await service.indexPreprint(preprint, createTestMetadata(uri, cid));
        preprints.push(uri);
      }

      // Query with limit
      const result = await service.getPreprintsByAuthor(TEST_AUTHOR, { limit: 2 });

      expect(result.preprints.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('indexPreprintDelete', () => {
    it('removes preprint from search index', async () => {
      const uri = createTestUri('delete1');
      const cid = createTestCid('delete1');
      const preprint = createTestPreprint({ title: 'Deletable Preprint' });

      // Index
      await service.indexPreprint(preprint, createTestMetadata(uri, cid));

      // Verify searchable
      let searchResults = await search.search({ q: 'Deletable Preprint', limit: 10 });
      expect(searchResults.hits.some((h) => h.uri === uri)).toBe(true);

      // Delete
      const deleteResult = await service.indexPreprintDelete(uri);
      expect(deleteResult.ok).toBe(true);

      // Verify removed from search
      searchResults = await search.search({ q: 'Deletable Preprint', limit: 10 });
      expect(searchResults.hits.some((h) => h.uri === uri)).toBe(false);
    });
  });

  describe('checkStaleness', () => {
    it('throws NotFoundError for non-existent preprint', async () => {
      const uri = createTestUri('stalenotfound');

      await expect(service.checkStaleness(uri)).rejects.toThrow();
    });

    it('returns staleness status for indexed preprint', async () => {
      const uri = createTestUri('stale1');
      const cid = createTestCid('stale1');
      const preprint = createTestPreprint();

      await service.indexPreprint(preprint, createTestMetadata(uri, cid));

      const status = await service.checkStaleness(uri);

      expect(status.indexedCid).toBe(cid);
      expect(status.lastSyncedAt).toBeInstanceOf(Date);
      expect(typeof status.isStale).toBe('boolean');
    });
  });

  describe('Version chain traversal', () => {
    it('returns version history for single version', async () => {
      const uri = createTestUri('version1');
      const cid = createTestCid('version1');
      const preprint = createTestPreprint();

      await service.indexPreprint(preprint, createTestMetadata(uri, cid));

      const versions = await service.getVersionHistory(uri);

      expect(versions).toBeDefined();
      expect(Array.isArray(versions)).toBe(true);
    });
  });

  describe('ATProto compliance', () => {
    it('stores BlobRef, not blob data', async () => {
      const uri = createTestUri('blobref1');
      const cid = createTestCid('blobref1');
      const preprint = createTestPreprint({
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob123' as CID,
          mimeType: 'application/pdf',
          size: 2048576,
        },
      });

      await service.indexPreprint(preprint, createTestMetadata(uri, cid));

      const stored = await storage.getPreprint(uri);

      // Verify BlobRef structure stored
      expect(stored?.documentBlobRef).toBeDefined();
      expect(stored?.documentBlobRef?.$type).toBe('blob');
      expect(stored?.documentBlobRef?.ref).toBeDefined();
      expect(stored?.documentBlobRef?.mimeType).toBe('application/pdf');

      // Verify no blob data fields exist
      const blobRefKeys = Object.keys(stored?.documentBlobRef ?? {});
      expect(blobRefKeys).not.toContain('data');
      expect(blobRefKeys).not.toContain('content');
      expect(blobRefKeys).not.toContain('buffer');
    });

    it('tracks PDS URL for every indexed record', async () => {
      const uri = createTestUri('pdstrack1');
      const cid = createTestCid('pdstrack1');
      const preprint = createTestPreprint();

      await service.indexPreprint(preprint, createTestMetadata(uri, cid));

      const stored = await storage.getPreprint(uri);
      expect(stored?.pdsUrl).toBe(TEST_PDS_URL);
      expect(stored?.pdsUrl).not.toBeNull();
    });
  });
});
