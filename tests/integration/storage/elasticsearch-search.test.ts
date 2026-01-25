/**
 * Integration tests for Elasticsearch search functionality.
 *
 * @remarks
 * Tests the complete search infrastructure including:
 * - Full-text search with field boosting
 * - Faceted search with aggregations
 * - Autocomplete with completion suggester
 * - Filter combinations
 * - Pagination
 *
 * Requires running Elasticsearch instance.
 *
 * @packageDocumentation
 */

import { Client } from '@elastic/elasticsearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ElasticsearchConnectionPool } from '../../../src/storage/elasticsearch/connection.js';
import {
  ElasticsearchAdapter,
  mapEprintToDocument,
} from '../../../src/storage/elasticsearch/index.js';
import {
  createElasticsearchClient,
  setupElasticsearch,
} from '../../../src/storage/elasticsearch/setup.js';
import type { AtUri, BlobRef, CID, DID, Timestamp } from '../../../src/types/atproto.js';
import type { Facet } from '../../../src/types/interfaces/graph.interface.js';
import type { AnnotationBody } from '../../../src/types/models/annotation.js';
import type { EprintAuthor } from '../../../src/types/models/author.js';
import type { Eprint } from '../../../src/types/models/eprint.js';

/** Creates a mock rich text abstract from plain text. */
function createMockAbstract(text: string): AnnotationBody {
  return {
    type: 'RichText',
    items: [{ type: 'text', content: text }],
    format: 'application/x-chive-gloss+json',
  };
}

describe('Elasticsearch Search Integration', () => {
  let client: Client;
  let connectionPool: ElasticsearchConnectionPool;
  let adapter: ElasticsearchAdapter;

  const testIndexName = 'test-eprints-search';

  beforeAll(async () => {
    client = createElasticsearchClient();
    connectionPool = new ElasticsearchConnectionPool({
      node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
    });

    await setupElasticsearch(client);

    if (await client.indices.exists({ index: testIndexName })) {
      await client.indices.delete({ index: testIndexName });
    }

    await client.indices.create({
      index: testIndexName,
      mappings: {
        properties: {
          uri: { type: 'keyword' },
          title: {
            type: 'text',
            fields: {
              suggest: { type: 'completion' },
            },
          },
          abstract: { type: 'text' },
          authors: {
            type: 'nested',
            properties: {
              did: { type: 'keyword' },
              name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            },
          },
          field_nodes: {
            type: 'nested',
            properties: {
              id: { type: 'keyword' },
              label: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            },
          },
          facets: {
            properties: {
              matter: { type: 'keyword', fields: { text: { type: 'text' } } },
              energy: { type: 'keyword', fields: { text: { type: 'text' } } },
              personality: { type: 'keyword', fields: { text: { type: 'text' } } },
              space: { type: 'keyword', fields: { text: { type: 'text' } } },
              time: { type: 'keyword', fields: { text: { type: 'text' } } },
              person: { type: 'keyword', fields: { text: { type: 'text' } } },
              organization: { type: 'keyword', fields: { text: { type: 'text' } } },
              event: { type: 'keyword', fields: { text: { type: 'text' } } },
              work: { type: 'keyword', fields: { text: { type: 'text' } } },
              form_genre: { type: 'keyword', fields: { text: { type: 'text' } } },
            },
          },
          created_at: { type: 'date' },
        },
      },
    });

    adapter = new ElasticsearchAdapter(connectionPool, { indexName: testIndexName });

    const mockPdfBlob: BlobRef = {
      $type: 'blob',
      ref: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi' as CID,
      mimeType: 'application/pdf',
      size: 1024000,
    };

    const author1: EprintAuthor = {
      did: 'did:plc:author1' as DID,
      name: 'Test Author 1',
      order: 1,
      affiliations: [],
      contributions: [],
      isCorrespondingAuthor: true,
      isHighlighted: false,
    };

    const author2: EprintAuthor = {
      did: 'did:plc:author2' as DID,
      name: 'Test Author 2',
      order: 1,
      affiliations: [],
      contributions: [],
      isCorrespondingAuthor: true,
      isHighlighted: false,
    };

    const testEprints: Eprint[] = [
      {
        uri: 'at://did:plc:test1/pub.chive.eprint/abc123' as AtUri,
        cid: 'bafytest1' as CID,
        authors: [author1],
        submittedBy: 'did:plc:author1' as DID,
        title: 'Machine Learning in Healthcare',
        abstract: createMockAbstract('Deep learning models for medical diagnosis'),
        documentBlobRef: mockPdfBlob,
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        keywords: ['machine learning', 'healthcare', 'diagnosis'],
        facets: [
          { dimension: 'matter', value: 'Computer Science' },
          { dimension: 'matter', value: 'Healthcare' },
          { dimension: 'energy', value: 'Classification' },
        ] satisfies readonly Facet[],
        version: 1,
        license: 'CC-BY-4.0',
        createdAt: new Date('2024-01-15').getTime() as Timestamp,
      },
      {
        uri: 'at://did:plc:test2/pub.chive.eprint/def456' as AtUri,
        cid: 'bafytest2' as CID,
        authors: [author2],
        submittedBy: 'did:plc:author2' as DID,
        title: 'Neural Networks for Image Classification',
        abstract: createMockAbstract('Convolutional neural networks and computer vision'),
        documentBlobRef: mockPdfBlob,
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        keywords: ['neural networks', 'image classification'],
        facets: [
          { dimension: 'matter', value: 'Computer Science' },
          { dimension: 'matter', value: 'Artificial Intelligence' },
          { dimension: 'energy', value: 'Recognition' },
        ] satisfies readonly Facet[],
        version: 1,
        license: 'CC-BY-4.0',
        createdAt: new Date('2024-02-20').getTime() as Timestamp,
      },
      {
        uri: 'at://did:plc:test3/pub.chive.eprint/ghi789' as AtUri,
        cid: 'bafytest3' as CID,
        authors: [author1],
        submittedBy: 'did:plc:author1' as DID,
        title: 'Quantum Computing Algorithms',
        abstract: createMockAbstract('Novel quantum algorithms for optimization problems'),
        documentBlobRef: mockPdfBlob,
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        keywords: ['quantum computing', 'algorithms'],
        facets: [
          { dimension: 'matter', value: 'Physics' },
          { dimension: 'matter', value: 'Quantum Computing' },
          { dimension: 'energy', value: 'Computation' },
        ] satisfies readonly Facet[],
        version: 1,
        license: 'CC-BY-4.0',
        createdAt: new Date('2024-03-10').getTime() as Timestamp,
      },
    ];

    for (const eprint of testEprints) {
      const document = mapEprintToDocument(eprint, 'https://pds.test');
      await adapter.indexEprint(document);
    }

    await client.indices.refresh({ index: testIndexName });
  });

  afterAll(async () => {
    if (await client.indices.exists({ index: testIndexName })) {
      await client.indices.delete({ index: testIndexName });
    }
    await client.close();
  });

  describe('Full-text Search', () => {
    it('should search by query text', async () => {
      const results = await adapter.search({ q: 'machine learning' });

      expect(results.hits.length).toBeGreaterThan(0);
      expect(results.hits[0]?.uri).toBe('at://did:plc:test1/pub.chive.eprint/abc123');
      expect(results.total).toBeGreaterThan(0);
      expect(results.took).toBeGreaterThan(0);
    });

    it('should boost title matches', async () => {
      const results = await adapter.search({ q: 'neural networks' });

      expect(results.hits.length).toBeGreaterThan(0);
      const topResult = results.hits[0];
      expect(topResult?.uri).toBe('at://did:plc:test2/pub.chive.eprint/def456');
      if (topResult?.score !== undefined) {
        expect(topResult.score).toBeGreaterThan(0);
      }
    });

    it('should handle fuzzy matching', async () => {
      const results = await adapter.search({ q: 'machne lerning' });

      expect(results.hits.length).toBeGreaterThan(0);
    });

    it('should return empty results for non-matching query', async () => {
      const results = await adapter.search({ q: 'nonexistent term xyz' });

      expect(results.hits).toEqual([]);
      expect(results.total).toBe(0);
    });
  });

  describe('Filtered Search', () => {
    it('should filter by author', async () => {
      const results = await adapter.search({
        q: '',
        filters: {
          author: 'did:plc:author1' as DID,
        },
      });

      expect(results.hits.length).toBe(2);
      results.hits.forEach((hit) => {
        expect(hit.uri).toMatch(/test1|test3/);
      });
    });

    it('should filter by subjects', async () => {
      const results = await adapter.search({
        q: '',
        filters: {
          subjects: ['Computer Science'],
        },
      });

      expect(results.hits.length).toBe(2);
      results.hits.forEach((hit) => {
        expect(hit.uri).toMatch(/test1|test2/);
      });
    });

    it('should filter by date range', async () => {
      const results = await adapter.search({
        q: '',
        filters: {
          dateFrom: new Date('2024-02-01'),
          dateTo: new Date('2024-03-31'),
        },
      });

      expect(results.hits.length).toBe(2);
    });

    it('should combine query with filters', async () => {
      const results = await adapter.search({
        q: 'computer',
        filters: {
          author: 'did:plc:author1' as DID,
        },
      });

      expect(results.hits.length).toBeGreaterThan(0);
      results.hits.forEach((hit) => {
        expect(hit.uri).toMatch(/test1|test3/);
      });
    });
  });

  describe('Pagination', () => {
    it('should paginate results', async () => {
      const page1 = await adapter.search({ q: '', limit: 2, offset: 0 });
      const page2 = await adapter.search({ q: '', limit: 2, offset: 2 });

      expect(page1.hits.length).toBe(2);
      expect(page2.hits.length).toBe(1);
      expect(page1.hits[0]?.uri).not.toBe(page2.hits[0]?.uri);
    });

    it('should respect limit parameter', async () => {
      const results = await adapter.search({ q: '', limit: 1 });

      expect(results.hits.length).toBe(1);
    });
  });

  describe('Faceted Search', () => {
    it('should return facet aggregations', async () => {
      const results = await adapter.facetedSearch({
        q: '',
        facets: ['matter', 'energy', 'personality'],
      });

      expect(results.facets).toBeDefined();
      expect(results.facets?.matter).toBeDefined();
      expect(results.facets?.matter?.length).toBeGreaterThan(0);
    });

    it('should return matter facet counts', async () => {
      const results = await adapter.facetedSearch({
        q: '',
        facets: ['matter'],
      });

      expect(results.facets?.matter).toBeDefined();
      const computerScience = results.facets?.matter?.find((f) => f.value === 'Computer Science');
      expect(computerScience?.count).toBe(2);
    });

    it('should return energy facet counts', async () => {
      const results = await adapter.facetedSearch({
        q: '',
        facets: ['energy'],
      });

      expect(results.facets?.energy).toBeDefined();
      expect(results.facets?.energy?.length).toBeGreaterThan(0);
    });

    it('should return personality facet counts', async () => {
      const results = await adapter.facetedSearch({
        q: '',
        facets: ['personality'],
      });

      expect(results.facets?.personality).toBeDefined();
      expect(results.facets?.personality?.length).toBeGreaterThanOrEqual(0);
    });

    it('should combine search with facets', async () => {
      const results = await adapter.facetedSearch({
        q: 'computer',
        facets: ['matter'],
      });

      expect(results.hits.length).toBeGreaterThan(0);
      expect(results.facets?.matter).toBeDefined();
    });

    it('should handle multiple facet dimensions', async () => {
      const results = await adapter.facetedSearch({
        q: '',
        facets: ['matter', 'energy', 'personality'],
      });

      expect(results.facets?.matter).toBeDefined();
      expect(results.facets?.energy).toBeDefined();
      expect(results.facets?.personality).toBeDefined();
    });
  });

  describe('Autocomplete', () => {
    it('should suggest completions', async () => {
      const suggestions = await adapter.autocomplete('mach');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('Machine');
    });

    it('should suggest completions for partial words', async () => {
      const suggestions = await adapter.autocomplete('neur');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('Neural');
    });

    it('should return empty array for no matches', async () => {
      const suggestions = await adapter.autocomplete('xyz');

      expect(suggestions).toEqual([]);
    });

    it('should limit number of suggestions', async () => {
      const suggestions = await adapter.autocomplete('qu', 1);

      expect(suggestions.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Query Caching', () => {
    it('should cache repeated queries', async () => {
      const query = { q: 'machine learning' };

      const result1 = await adapter.search(query);
      const result2 = await adapter.search(query);

      expect(result1.hits).toEqual(result2.hits);
    });

    it('should cache faceted queries separately', async () => {
      const query = { q: 'computer', facets: ['matter'] };

      const result1 = await adapter.facetedSearch(query);
      const result2 = await adapter.facetedSearch(query);

      expect(result1.hits).toEqual(result2.hits);
      expect(result1.facets).toEqual(result2.facets);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed queries gracefully', async () => {
      const results = await adapter.search({ q: '' });

      expect(results.hits).toBeDefined();
      expect(Array.isArray(results.hits)).toBe(true);
    });

    it('should handle invalid facet names', async () => {
      const results = await adapter.facetedSearch({
        q: '',
        facets: ['invalid_facet'],
      });

      expect(results.facets).toBeDefined();
      expect(Object.keys(results.facets ?? {})).toHaveLength(0);
    });
  });
});
