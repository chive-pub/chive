/**
 * Unit tests for Elasticsearch More Like This functionality.
 *
 * @remarks
 * Tests the `findSimilarByText()` method on {@link ElasticsearchAdapter},
 * which uses the ES `more_like_this` query on title, abstract, and keywords
 * fields to find content-similar documents.
 *
 * @packageDocumentation
 */

import { errors } from '@elastic/elasticsearch';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  ElasticsearchAdapter,
  SearchError,
} from '../../../../src/storage/elasticsearch/adapter.js';
import type { ElasticsearchConnectionPool } from '../../../../src/storage/elasticsearch/connection.js';
import type { AtUri } from '../../../../src/types/atproto.js';

// Mock the tracer so withSpan just executes the callback directly
vi.mock('../../../../src/observability/tracer.js', () => ({
  withSpan: vi.fn(async (_name: string, fn: () => Promise<unknown>, _options?: unknown) => fn()),
}));

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Mock Elasticsearch client with a search method.
 */
interface MockEsClient {
  search: ReturnType<typeof vi.fn>;
  index: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock ES client.
 */
function createMockEsClient(): MockEsClient {
  return {
    search: vi.fn(),
    index: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * Creates a mock connection pool wrapping the given client.
 *
 * @param client - Mock ES client
 * @returns Mock connection pool
 */
function createMockConnectionPool(client: MockEsClient): ElasticsearchConnectionPool {
  return {
    getClient: () => client,
  } as unknown as ElasticsearchConnectionPool;
}

// ============================================================================
// Sample Data
// ============================================================================

const SOURCE_URI = 'at://did:plc:test/pub.chive.eprint.submission/abc123' as AtUri;

/**
 * Builds a mock ES search response for MLT queries.
 *
 * @param hits - Array of hit objects
 * @returns Mock ES search response
 */
function buildMltResponse(
  hits: { _id: string; _score: number; _source?: { uri?: string; title?: string } }[]
): {
  hits: {
    total: { value: number; relation: string };
    hits: { _id: string; _score: number; _source?: { uri?: string; title?: string } }[];
  };
  took: number;
} {
  return {
    hits: {
      total: { value: hits.length, relation: 'eq' },
      hits,
    },
    took: 5,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ElasticsearchAdapter', () => {
  let mockClient: MockEsClient;
  let adapter: ElasticsearchAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockEsClient();
    const pool = createMockConnectionPool(mockClient);
    adapter = new ElasticsearchAdapter(pool, { indexName: 'test-eprints' });
  });

  describe('findSimilarByText', () => {
    it('returns similar documents based on text', async () => {
      const esResponse = buildMltResponse([
        {
          _id: 'at://did:plc:other/pub.chive.eprint.submission/similar1',
          _score: 12.5,
          _source: {
            uri: 'at://did:plc:other/pub.chive.eprint.submission/similar1',
            title: 'A Similar Paper on Neural Networks',
          },
        },
        {
          _id: 'at://did:plc:other/pub.chive.eprint.submission/similar2',
          _score: 8.3,
          _source: {
            uri: 'at://did:plc:other/pub.chive.eprint.submission/similar2',
            title: 'Another Related Work',
          },
        },
      ]);
      mockClient.search.mockResolvedValueOnce(esResponse);

      const results = await adapter.findSimilarByText(SOURCE_URI);

      expect(results).toHaveLength(2);

      const first = results[0];
      expect(first).toBeDefined();
      expect(first!.uri).toBe('at://did:plc:other/pub.chive.eprint.submission/similar1');
      expect(first!.score).toBe(12.5);
      expect(first!.title).toBe('A Similar Paper on Neural Networks');

      const second = results[1];
      expect(second).toBeDefined();
      expect(second!.uri).toBe('at://did:plc:other/pub.chive.eprint.submission/similar2');
      expect(second!.score).toBe(8.3);
      expect(second!.title).toBe('Another Related Work');
    });

    it('respects the limit option', async () => {
      const esResponse = buildMltResponse([
        {
          _id: 'at://did:plc:other/pub.chive.eprint.submission/hit1',
          _score: 10.0,
          _source: {
            uri: 'at://did:plc:other/pub.chive.eprint.submission/hit1',
            title: 'Hit 1',
          },
        },
      ]);
      mockClient.search.mockResolvedValueOnce(esResponse);

      await adapter.findSimilarByText(SOURCE_URI, { limit: 3 });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 3,
        })
      );
    });

    it('excludes the source document from results', async () => {
      // ES may return the source document itself; the adapter should filter it out
      const esResponse = buildMltResponse([
        {
          _id: String(SOURCE_URI),
          _score: 100.0,
          _source: {
            uri: String(SOURCE_URI),
            title: 'The Source Document',
          },
        },
        {
          _id: 'at://did:plc:other/pub.chive.eprint.submission/different',
          _score: 8.0,
          _source: {
            uri: 'at://did:plc:other/pub.chive.eprint.submission/different',
            title: 'A Different Paper',
          },
        },
      ]);
      mockClient.search.mockResolvedValueOnce(esResponse);

      const results = await adapter.findSimilarByText(SOURCE_URI);

      expect(results).toHaveLength(1);
      expect(results[0]!.uri).toBe('at://did:plc:other/pub.chive.eprint.submission/different');
    });

    it('handles empty results', async () => {
      const esResponse = buildMltResponse([]);
      mockClient.search.mockResolvedValueOnce(esResponse);

      const results = await adapter.findSimilarByText(SOURCE_URI);

      expect(results).toHaveLength(0);
      expect(results).toEqual([]);
    });

    it('propagates Elasticsearch ResponseError as SearchError', async () => {
      const responseError = new errors.ResponseError({
        statusCode: 500,
        body: { error: { reason: 'internal server error' } },
        headers: {},
        warnings: null,
        meta: {} as never,
      });
      mockClient.search.mockRejectedValue(responseError);

      await expect(adapter.findSimilarByText(SOURCE_URI)).rejects.toThrow(SearchError);
      await expect(adapter.findSimilarByText(SOURCE_URI)).rejects.toThrow(
        /More Like This query failed/
      );
    });

    it('propagates unexpected errors as SearchError', async () => {
      mockClient.search.mockRejectedValue(new Error('Connection refused'));

      await expect(adapter.findSimilarByText(SOURCE_URI)).rejects.toThrow(SearchError);
      await expect(adapter.findSimilarByText(SOURCE_URI)).rejects.toThrow(
        /Unexpected error in More Like This query/
      );
    });

    it('uses correct MLT query parameters', async () => {
      const esResponse = buildMltResponse([]);
      mockClient.search.mockResolvedValueOnce(esResponse);

      await adapter.findSimilarByText(SOURCE_URI, {
        minTermFreq: 2,
        minDocFreq: 5,
        maxQueryTerms: 50,
        minimumShouldMatch: '50%',
      });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'test-eprints',
          query: {
            more_like_this: {
              fields: ['title', 'abstract', 'keywords'],
              like: [
                {
                  _index: 'test-eprints',
                  _id: String(SOURCE_URI),
                },
              ],
              min_term_freq: 2,
              min_doc_freq: 5,
              max_query_terms: 50,
              minimum_should_match: '50%',
            },
          },
          size: 10,
          _source: ['uri', 'title'],
        })
      );
    });

    it('applies default MLT parameters when no options provided', async () => {
      const esResponse = buildMltResponse([]);
      mockClient.search.mockResolvedValueOnce(esResponse);

      await adapter.findSimilarByText(SOURCE_URI);

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            more_like_this: {
              fields: ['title', 'abstract', 'keywords'],
              like: [
                {
                  _index: 'test-eprints',
                  _id: String(SOURCE_URI),
                },
              ],
              min_term_freq: 1,
              min_doc_freq: 2,
              max_query_terms: 25,
              minimum_should_match: '30%',
            },
          },
          size: 10,
          _source: ['uri', 'title'],
        })
      );
    });

    it('falls back to _id when _source.uri is missing', async () => {
      const esResponse = buildMltResponse([
        {
          _id: 'at://did:plc:other/pub.chive.eprint.submission/fallback',
          _score: 5.0,
          _source: { title: 'Fallback Document' },
        },
      ]);
      mockClient.search.mockResolvedValueOnce(esResponse);

      const results = await adapter.findSimilarByText(SOURCE_URI);

      expect(results).toHaveLength(1);
      expect(results[0]!.uri).toBe('at://did:plc:other/pub.chive.eprint.submission/fallback');
    });

    it('defaults score to 0 when _score is null', async () => {
      const esResponse = buildMltResponse([
        {
          _id: 'at://did:plc:other/pub.chive.eprint.submission/noscore',
          _score: null as unknown as number,
          _source: {
            uri: 'at://did:plc:other/pub.chive.eprint.submission/noscore',
            title: 'No Score Document',
          },
        },
      ]);
      mockClient.search.mockResolvedValueOnce(esResponse);

      const results = await adapter.findSimilarByText(SOURCE_URI);

      expect(results).toHaveLength(1);
      expect(results[0]!.score).toBe(0);
    });

    it('clamps limit to maxLimit', async () => {
      const esResponse = buildMltResponse([]);
      mockClient.search.mockResolvedValueOnce(esResponse);

      // Default maxLimit is 100
      await adapter.findSimilarByText(SOURCE_URI, { limit: 500 });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 100,
        })
      );
    });
  });
});
