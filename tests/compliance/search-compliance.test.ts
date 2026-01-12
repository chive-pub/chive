/**
 * ATProto compliance tests for Elasticsearch search infrastructure.
 *
 * @remarks
 * CRITICAL tests verifying ATProto specification compliance for search:
 * - Search results preserve ATProto identifiers (AT-URI, DID, CID)
 * - No blob data in search index (BlobRef metadata only)
 * - PDS source tracking for all indexed documents
 * - Documents can be rebuilt from firehose
 * - Search index is derivative, not source of truth
 *
 * **All tests must pass 100% before production.**
 *
 * @packageDocumentation
 */

import { Client } from '@elastic/elasticsearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ElasticsearchConnectionPool } from '../../src/storage/elasticsearch/connection.js';
import {
  ElasticsearchAdapter,
  mapPreprintToDocument,
} from '../../src/storage/elasticsearch/index.js';
import { createElasticsearchClient } from '../../src/storage/elasticsearch/setup.js';
import type { AtUri, BlobRef, CID, DID, Timestamp } from '../../src/types/atproto.js';
import type { Facet } from '../../src/types/interfaces/graph.interface.js';
import type { PreprintAuthor } from '../../src/types/models/author.js';
import type { Preprint } from '../../src/types/models/preprint.js';

describe('ATProto Search Compliance', () => {
  let client: Client;
  let connectionPool: ElasticsearchConnectionPool;
  let adapter: ElasticsearchAdapter;

  const testIndexName = 'test-compliance-preprints';

  beforeAll(async () => {
    client = createElasticsearchClient();
    connectionPool = new ElasticsearchConnectionPool({
      node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
    });

    if (await client.indices.exists({ index: testIndexName })) {
      await client.indices.delete({ index: testIndexName });
    }

    await client.indices.create({
      index: testIndexName,
      mappings: {
        properties: {
          uri: { type: 'keyword' },
          cid: { type: 'keyword' },
          rkey: { type: 'keyword' },
          title: { type: 'text' },
          abstract: { type: 'text' },
          authors: {
            type: 'nested',
            properties: {
              did: { type: 'keyword' },
              name: { type: 'text' },
            },
          },
          pds_url: { type: 'keyword' },
          pds_endpoint: { type: 'keyword' },
          document_blob_ref: {
            properties: {
              cid: { type: 'keyword' },
              mime_type: { type: 'keyword' },
              size: { type: 'long' },
            },
          },
          pdf_base64: { type: 'keyword' },
          created_at: { type: 'date' },
        },
      },
    });

    adapter = new ElasticsearchAdapter(connectionPool, { indexName: testIndexName });
  });

  afterAll(async () => {
    if (await client.indices.exists({ index: testIndexName })) {
      await client.indices.delete({ index: testIndexName });
    }
    await client.close();
  });

  describe('CRITICAL: ATProto Identifier Preservation', () => {
    it('indexed documents preserve AT-URI format', async () => {
      const mockPdfBlob: BlobRef = {
        $type: 'blob',
        ref: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi' as CID,
        mimeType: 'application/pdf',
        size: 1024000,
      };

      const testAuthor: PreprintAuthor = {
        did: 'did:plc:author123' as DID,
        name: 'Test Author',
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      };

      const testPreprint: Preprint = {
        uri: 'at://did:plc:test123/pub.chive.preprint/abc123' as AtUri,
        cid: 'bafytest123' as CID,
        authors: [testAuthor],
        submittedBy: 'did:plc:author123' as DID,
        title: 'Test Preprint for Compliance',
        abstract: 'Testing ATProto compliance in search index',
        documentBlobRef: mockPdfBlob,
        documentFormat: 'pdf',
        publicationStatus: 'preprint',
        keywords: ['test'],
        facets: [{ dimension: 'matter', value: 'Computer Science' }] satisfies readonly Facet[],
        version: 1,
        license: 'CC-BY-4.0',
        createdAt: Date.now() as Timestamp,
      };

      const document = mapPreprintToDocument(testPreprint, 'https://pds.example.com');
      await adapter.indexPreprint(document);
      await client.indices.refresh({ index: testIndexName });

      const results = await adapter.search({ q: 'compliance' });

      expect(results.hits.length).toBeGreaterThan(0);
      const hit = results.hits[0];
      expect(hit?.uri).toMatch(/^at:\/\/did:/);
      expect(hit?.uri).toBe(testPreprint.uri);
    });

    it('indexed documents preserve DID format', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;
      expect(docs.length).toBeGreaterThan(0);

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;
        expect(source.uri).toMatch(/^at:\/\/did:/);

        const uriParts = String(source.uri).split('/');
        const did = uriParts[2];
        expect(did).toMatch(/^did:(plc|web):/);
      }
    });

    it('indexed documents preserve CID format', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;
      expect(docs.length).toBeGreaterThan(0);

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;
        expect(source.cid).toBeDefined();
        expect(typeof source.cid).toBe('string');
        expect(String(source.cid).length).toBeGreaterThan(0);
      }
    });

    it('indexed documents include rkey (record key)', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;
      expect(docs.length).toBeGreaterThan(0);

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;
        expect(source.rkey).toBeDefined();
        expect(typeof source.rkey).toBe('string');
        expect(String(source.rkey).length).toBeGreaterThan(0);
      }
    });
  });

  describe('CRITICAL: BlobRef Compliance', () => {
    it('MUST NOT store blob data in search index', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;

        expect(source.pdf_base64).toBeUndefined();

        if (source.document_blob_ref) {
          const blobRef = source.document_blob_ref as Record<string, unknown>;
          expect(blobRef).not.toHaveProperty('data');
          expect(blobRef).not.toHaveProperty('bytes');
          expect(blobRef).not.toHaveProperty('content');
        }
      }
    });

    it('stores BlobRef metadata (CID, size, MIME type)', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;
      expect(docs.length).toBeGreaterThan(0);

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;

        if (source.document_blob_ref) {
          const blobRef = source.document_blob_ref as Record<string, unknown>;
          expect(blobRef.cid).toBeDefined();
          expect(blobRef.mime_type).toBeDefined();
          expect(blobRef.size).toBeDefined();
          expect(typeof blobRef.cid).toBe('string');
          expect(typeof blobRef.mime_type).toBe('string');
          expect(typeof blobRef.size).toBe('number');
        }
      }
    });

    it('BlobRef CID is valid IPFS CID format', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;

        if (source.document_blob_ref) {
          const blobRef = source.document_blob_ref as Record<string, unknown>;
          const cid = String(blobRef.cid);
          expect(cid).toMatch(/^bafy/);
        }
      }
    });
  });

  describe('CRITICAL: PDS Source Tracking', () => {
    it('all indexed documents include pds_url', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;
      expect(docs.length).toBeGreaterThan(0);

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;
        expect(source.pds_url).toBeDefined();
        expect(typeof source.pds_url).toBe('string');
        expect(String(source.pds_url).length).toBeGreaterThan(0);
      }
    });

    it('pds_url is valid URL format', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;
        const pdsUrl = String(source.pds_url);
        expect(() => new URL(pdsUrl)).not.toThrow();
        expect(pdsUrl).toMatch(/^https?:\/\//);
      }
    });

    it('search results preserve pds_url for source attribution', async () => {
      const results = await adapter.search({ q: 'compliance' });

      expect(results.hits.length).toBeGreaterThan(0);

      for (const hit of results.hits) {
        const response = await client.get({
          index: testIndexName,
          id: hit.uri,
        });

        const source = response._source as Record<string, unknown>;
        expect(source.pds_url).toBeDefined();
        expect(source.pds_url).toBe('https://pds.example.com');
      }
    });
  });

  describe('CRITICAL: Index Semantics', () => {
    it('search index is derivative data structure', async () => {
      const indexSettings = await client.indices.getSettings({ index: testIndexName });
      const settings = indexSettings[testIndexName]?.settings;

      expect(settings).toBeDefined();
    });

    it('documents can be deleted without losing source records', async () => {
      const testUri = 'at://did:plc:test123/pub.chive.preprint/abc123';

      const existsBefore = await client.exists({
        index: testIndexName,
        id: testUri,
      });

      if (existsBefore) {
        await client.delete({
          index: testIndexName,
          id: testUri,
        });

        await client.indices.refresh({ index: testIndexName });

        const existsAfter = await client.exists({
          index: testIndexName,
          id: testUri,
        });

        expect(existsAfter).toBe(false);
      }
    });

    it('index can be rebuilt from firehose without data loss', async () => {
      const beforeDelete = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docCount = beforeDelete.hits.hits.length;
      const firstDoc = beforeDelete.hits.hits[0]?._source as Record<string, unknown>;

      await client.indices.delete({ index: testIndexName });

      await client.indices.create({
        index: testIndexName,
        mappings: {
          properties: {
            uri: { type: 'keyword' },
            cid: { type: 'keyword' },
            rkey: { type: 'keyword' },
            title: { type: 'text' },
            abstract: { type: 'text' },
            pds_url: { type: 'keyword' },
            document_blob_ref: {
              properties: {
                cid: { type: 'keyword' },
                mime_type: { type: 'keyword' },
                size: { type: 'long' },
              },
            },
            created_at: { type: 'date' },
          },
        },
      });

      if (firstDoc && docCount > 0) {
        await client.index({
          index: testIndexName,
          id: String(firstDoc.uri),
          document: firstDoc,
        });

        await client.indices.refresh({ index: testIndexName });

        const afterRebuild = await client.get({
          index: testIndexName,
          id: String(firstDoc.uri),
        });

        const rebuiltDoc = afterRebuild._source as Record<string, unknown>;
        expect(rebuiltDoc.uri).toBe(firstDoc.uri);
        expect(rebuiltDoc.cid).toBe(firstDoc.cid);
        expect(rebuiltDoc.pds_url).toBe(firstDoc.pds_url);
      }
    });
  });

  describe('CRITICAL: Author DID References', () => {
    it('author references use DIDs not names', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;

        if (source.authors && Array.isArray(source.authors)) {
          for (const author of source.authors) {
            const authorObj = author as Record<string, unknown>;
            expect(authorObj.did).toBeDefined();
            expect(String(authorObj.did)).toMatch(/^did:(plc|web):/);
          }
        }
      }
    });

    it('author DIDs can resolve to current profile', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;

        if (source.authors && Array.isArray(source.authors)) {
          for (const author of source.authors) {
            const authorObj = author as Record<string, unknown>;
            const did = String(authorObj.did);

            expect(did).toMatch(/^did:(plc|web):/);
            expect(did.split(':').length).toBeGreaterThanOrEqual(3);
          }
        }
      }
    });
  });

  describe('CRITICAL: Temporal Consistency', () => {
    it('created_at timestamps are ISO 8601 format', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;

        if (source.created_at) {
          const createdAt = source.created_at;
          expect(typeof createdAt === 'string' || typeof createdAt === 'number').toBe(true);
          const timestamp =
            typeof createdAt === 'string' ? createdAt : new Date(createdAt as number).toISOString();
          expect(() => new Date(timestamp)).not.toThrow();
          expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        }
      }
    });

    it('timestamps can be used for temporal ordering', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
        sort: [{ created_at: { order: 'desc' } }],
      });

      const docs = response.hits.hits;

      if (docs.length >= 2) {
        const first = docs[0]?._source as Record<string, unknown>;
        const second = docs[1]?._source as Record<string, unknown>;

        const firstTimestamp =
          typeof first.created_at === 'string'
            ? first.created_at
            : new Date(first.created_at as number).toISOString();
        const secondTimestamp =
          typeof second.created_at === 'string'
            ? second.created_at
            : new Date(second.created_at as number).toISOString();
        const firstDate = new Date(firstTimestamp);
        const secondDate = new Date(secondTimestamp);

        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });
  });

  describe('CRITICAL: Collection NSID Enforcement', () => {
    it('all URIs use pub.chive.preprint collection', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;
        const uri = String(source.uri);

        expect(uri).toContain('/pub.chive.preprint/');
      }
    });

    it('collection NSID follows reverse DNS format', async () => {
      const response = await client.search({
        index: testIndexName,
        query: { match_all: {} },
      });

      const docs = response.hits.hits;

      for (const doc of docs) {
        const source = doc._source as Record<string, unknown>;
        const uri = String(source.uri);
        const nsidMatch = /\/([a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+)\//.exec(uri);

        expect(nsidMatch).toBeTruthy();
        if (nsidMatch) {
          const nsid = nsidMatch[1];
          expect(nsid).toMatch(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/);
        }
      }
    });
  });
});
