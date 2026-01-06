/**
 * Unit tests for SearchService.
 *
 * @remarks
 * Tests search indexing, querying, and autocomplete functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SearchService } from '@/services/search/search-service.js';
import { toDID } from '@/types/atproto-validators.js';
import type { AtUri } from '@/types/atproto.js';
import { DatabaseError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type {
  ISearchEngine,
  IndexablePreprintDocument,
  SearchQuery,
  SearchResults,
} from '@/types/interfaces/search.interface.js';

interface MockLogger extends ILogger {
  debugMock: ReturnType<typeof vi.fn>;
  warnMock: ReturnType<typeof vi.fn>;
}

const createMockLogger = (): MockLogger => {
  const debugMock = vi.fn();
  const warnMock = vi.fn();
  const logger: MockLogger = {
    debug: debugMock,
    info: vi.fn(),
    warn: warnMock,
    error: vi.fn(),
    child: vi.fn(function (this: void) {
      return logger;
    }),
    debugMock,
    warnMock,
  };
  return logger;
};

interface MockSearchEngine extends ISearchEngine {
  indexPreprintMock: ReturnType<typeof vi.fn>;
  searchMock: ReturnType<typeof vi.fn>;
  deleteDocumentMock: ReturnType<typeof vi.fn>;
  autocompleteMock: ReturnType<typeof vi.fn>;
}

const createMockSearchEngine = (): MockSearchEngine => {
  const indexPreprintMock = vi.fn().mockResolvedValue(undefined);
  const searchMock = vi.fn().mockResolvedValue({ hits: [], total: 0, took: 0 });
  const deleteDocumentMock = vi.fn().mockResolvedValue(undefined);
  const autocompleteMock = vi.fn().mockResolvedValue([]);
  return {
    indexPreprint: indexPreprintMock,
    search: searchMock,
    facetedSearch: vi.fn().mockResolvedValue({ hits: [], total: 0, took: 0, facets: {} }),
    deleteDocument: deleteDocumentMock,
    autocomplete: autocompleteMock,
    indexPreprintMock,
    searchMock,
    deleteDocumentMock,
    autocompleteMock,
  };
};

const createMockIndexableDocument = (
  overrides?: Partial<IndexablePreprintDocument>
): IndexablePreprintDocument => {
  const author = toDID('did:plc:author');
  if (!author) {
    throw new Error('Invalid DID');
  }
  return {
    uri: 'at://did:plc:author/pub.chive.preprint.submission/abc123' as AtUri,
    author,
    authorName: 'Alice Researcher',
    title: 'Test Preprint',
    abstract: 'Test abstract content',
    keywords: ['test', 'preprint'],
    subjects: ['Computer Science'],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    indexedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  };
};

describe('SearchService', () => {
  let searchEngine: MockSearchEngine;
  let logger: MockLogger;
  let service: SearchService;

  beforeEach(() => {
    searchEngine = createMockSearchEngine();
    logger = createMockLogger();
    service = new SearchService({ search: searchEngine, logger });
  });

  describe('indexPreprintForSearch', () => {
    it('indexes preprint successfully', async () => {
      const doc = createMockIndexableDocument();

      const result = await service.indexPreprintForSearch(doc);

      expect(result.ok).toBe(true);
      expect(searchEngine.indexPreprintMock).toHaveBeenCalledWith(doc);
      expect(logger.debugMock).toHaveBeenCalledWith('Indexed preprint for search', {
        uri: doc.uri,
      });
    });

    it('returns DatabaseError when indexing fails', async () => {
      searchEngine.indexPreprintMock.mockRejectedValue(new Error('Elasticsearch down'));

      const doc = createMockIndexableDocument();
      const result = await service.indexPreprintForSearch(doc);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.operation).toBe('INDEX');
        expect(result.error.message).toContain('Elasticsearch down');
      }
    });

    it('handles non-Error exceptions', async () => {
      searchEngine.indexPreprintMock.mockRejectedValue('String error');

      const doc = createMockIndexableDocument();
      const result = await service.indexPreprintForSearch(doc);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('String error');
      }
    });
  });

  describe('search', () => {
    it('delegates to search engine', async () => {
      const query: SearchQuery = {
        q: 'quantum computing',
        limit: 20,
      };

      const mockResults: SearchResults = {
        hits: [
          {
            uri: 'at://did:plc:author1/pub.chive.preprint.submission/abc1' as AtUri,
            score: 1.5,
          },
        ],
        total: 1,
        took: 10,
      };

      searchEngine.searchMock.mockResolvedValue(mockResults);

      const results = await service.search(query);

      expect(searchEngine.searchMock).toHaveBeenCalledWith(query);
      expect(results).toEqual(mockResults);
    });

    it('returns empty results when no matches', async () => {
      const query: SearchQuery = {
        q: 'nonexistent topic',
        limit: 10,
      };

      const emptyResults: SearchResults = {
        hits: [],
        total: 0,
        took: 5,
      };

      searchEngine.searchMock.mockResolvedValue(emptyResults);

      const results = await service.search(query);

      expect(results.total).toBe(0);
      expect(results.hits).toHaveLength(0);
    });

    it('handles filters in search query', async () => {
      const authorDID = toDID('did:plc:author');
      if (!authorDID) {
        throw new Error('Invalid DID');
      }
      const query: SearchQuery = {
        q: 'machine learning',
        limit: 10,
        filters: {
          author: authorDID,
          subjects: ['Computer Science'],
        },
      };

      await service.search(query);

      expect(searchEngine.searchMock).toHaveBeenCalledWith(query);
    });
  });

  describe('autocomplete', () => {
    it('returns autocomplete suggestions', async () => {
      const suggestions = ['neural networks', 'neural architecture', 'neuromorphic'];
      searchEngine.autocompleteMock.mockResolvedValue(suggestions);

      const results = await service.autocomplete('neura');

      expect(searchEngine.autocompleteMock).toHaveBeenCalledWith('neura', 10);
      expect(results).toEqual(suggestions);
    });

    it('respects custom limit parameter', async () => {
      searchEngine.autocompleteMock.mockResolvedValue(['suggestion1', 'suggestion2']);

      await service.autocomplete('test', 5);

      expect(searchEngine.autocompleteMock).toHaveBeenCalledWith('test', 5);
    });

    it('returns empty array when no suggestions', async () => {
      searchEngine.autocompleteMock.mockResolvedValue([]);

      const results = await service.autocomplete('zzz');

      expect(results).toEqual([]);
    });
  });

  describe('removeFromSearch', () => {
    it('removes preprint from search index', async () => {
      const uri = 'at://did:plc:author/pub.chive.preprint.submission/abc123' as AtUri;

      const result = await service.removeFromSearch(uri);

      expect(result.ok).toBe(true);
      expect(searchEngine.deleteDocumentMock).toHaveBeenCalledWith(uri);
      expect(logger.debugMock).toHaveBeenCalledWith('Removed preprint from search', { uri });
    });

    it('returns DatabaseError when deletion fails', async () => {
      searchEngine.deleteDocumentMock.mockRejectedValue(new Error('Delete failed'));

      const uri = 'at://did:plc:author/pub.chive.preprint.submission/abc123' as AtUri;
      const result = await service.removeFromSearch(uri);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.operation).toBe('INDEX');
        expect(result.error.message).toContain('Delete failed');
      }
    });

    it('handles non-Error exceptions', async () => {
      searchEngine.deleteDocumentMock.mockRejectedValue('String error');

      const uri = 'at://did:plc:author/pub.chive.preprint.submission/abc123' as AtUri;
      const result = await service.removeFromSearch(uri);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('String error');
      }
    });
  });
});
