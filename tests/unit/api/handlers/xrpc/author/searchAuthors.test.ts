/**
 * Unit tests for searchAuthors handler.
 *
 * @remarks
 * Tests author search functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { searchAuthors } from '@/api/handlers/xrpc/author/searchAuthors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// Mocks
// =============================================================================

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

interface MockSearch {
  search: ReturnType<typeof vi.fn>;
}

interface MockEprint {
  getEprint: ReturnType<typeof vi.fn>;
}

// =============================================================================
// Tests
// =============================================================================

describe('searchAuthors', () => {
  let mockLogger: ILogger;
  let mockSearch: MockSearch;
  let mockEprint: MockEprint;
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockSearch = {
      search: vi.fn().mockResolvedValue({ hits: [], total: 0 }),
    };
    mockEprint = {
      getEprint: vi.fn().mockResolvedValue(null),
    };
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              search: mockSearch,
              eprint: mockEprint,
            };
          case 'logger':
            return mockLogger;
          case 'redis':
            return mockRedis;
          default:
            return undefined;
        }
      }),
    };

    // Mock global fetch for DID resolution
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    });
  });

  describe('basic functionality', () => {
    it('returns empty array when no results found', async () => {
      mockSearch.search.mockResolvedValue({ hits: [], total: 0 });

      const result = await searchAuthors.handler({
        params: { q: 'nonexistent', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(result.body.authors).toEqual([]);
    });

    it('searches for authors by query', async () => {
      await searchAuthors.handler({
        params: { q: 'john', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(mockSearch.search).toHaveBeenCalledWith({
        q: 'john',
        limit: 30, // limit * 3
      });
    });

    it('extracts authors from search results', async () => {
      mockSearch.search.mockResolvedValue({
        hits: [{ uri: 'at://did:plc:test1/pub.chive.eprint.submission/123', score: 1 }],
        total: 1,
      });

      mockEprint.getEprint.mockResolvedValue({
        uri: 'at://did:plc:test1/pub.chive.eprint.submission/123',
        authors: [{ did: 'did:plc:author1', name: 'John Doe' }],
      });

      const result = await searchAuthors.handler({
        params: { q: 'john', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(result.body.authors).toHaveLength(1);
      const firstAuthor = result.body.authors[0];
      expect(firstAuthor).toBeDefined();
      if (firstAuthor) {
        expect(firstAuthor.did).toBe('did:plc:author1');
      }
    });

    it('deduplicates authors across multiple eprints', async () => {
      mockSearch.search.mockResolvedValue({
        hits: [
          { uri: 'at://did:plc:test1/pub.chive.eprint.submission/123', score: 1 },
          { uri: 'at://did:plc:test2/pub.chive.eprint.submission/456', score: 0.9 },
        ],
        total: 2,
      });

      mockEprint.getEprint
        .mockResolvedValueOnce({
          uri: 'at://did:plc:test1/pub.chive.eprint.submission/123',
          authors: [{ did: 'did:plc:author1', name: 'John Doe' }],
        })
        .mockResolvedValueOnce({
          uri: 'at://did:plc:test2/pub.chive.eprint.submission/456',
          authors: [{ did: 'did:plc:author1', name: 'John Doe' }], // Same author
        });

      const result = await searchAuthors.handler({
        params: { q: 'john', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(result.body.authors).toHaveLength(1);
    });

    it('respects limit parameter', async () => {
      mockSearch.search.mockResolvedValue({
        hits: Array.from({ length: 10 }, (_, i) => ({
          uri: `at://did:plc:test${i}/pub.chive.eprint.submission/123`,
          score: 1 - i * 0.1,
        })),
        total: 10,
      });

      // Each eprint has a different author
      mockEprint.getEprint.mockImplementation((uri: string) => {
        const match = /test(\d+)/.exec(uri);
        const index = match ? match[1] : '0';
        return {
          uri,
          authors: [{ did: `did:plc:author${index}`, name: `John${index}` }],
        };
      });

      const result = await searchAuthors.handler({
        params: { q: 'john', limit: 3 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(result.body.authors.length).toBeLessThanOrEqual(3);
    });

    it('logs search completion', async () => {
      mockSearch.search.mockResolvedValue({ hits: [], total: 0 });

      await searchAuthors.handler({
        params: { q: 'test', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Searching authors', {
        q: 'test',
        limit: 10,
      });
    });
  });

  describe('error handling', () => {
    it('returns empty array on search error', async () => {
      mockSearch.search.mockRejectedValue(new Error('Search failed'));

      const result = await searchAuthors.handler({
        params: { q: 'test', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(result.body.authors).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('continues when eprint fetch fails', async () => {
      mockSearch.search.mockResolvedValue({
        hits: [{ uri: 'at://did:plc:test1/pub.chive.eprint.submission/123', score: 1 }],
        total: 1,
      });
      mockEprint.getEprint.mockResolvedValue(null);

      const result = await searchAuthors.handler({
        params: { q: 'test', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(result.body.authors).toEqual([]);
    });
  });

  describe('author filtering', () => {
    it('only returns authors whose name matches the query', async () => {
      mockSearch.search.mockResolvedValue({
        hits: [{ uri: 'at://did:plc:test1/pub.chive.eprint.submission/123', score: 1 }],
        total: 1,
      });

      mockEprint.getEprint.mockResolvedValue({
        uri: 'at://did:plc:test1/pub.chive.eprint.submission/123',
        authors: [
          { did: 'did:plc:author1', name: 'John Doe' },
          { did: 'did:plc:author2', name: 'Jane Smith' },
        ],
      });

      const result = await searchAuthors.handler({
        params: { q: 'john', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(result.body.authors).toHaveLength(1);
      const matchedAuthor = result.body.authors[0];
      expect(matchedAuthor).toBeDefined();
      if (matchedAuthor) {
        expect(matchedAuthor.did).toBe('did:plc:author1');
      }
    });

    it('matches by DID when name does not match', async () => {
      mockSearch.search.mockResolvedValue({
        hits: [{ uri: 'at://did:plc:test1/pub.chive.eprint.submission/123', score: 1 }],
        total: 1,
      });

      mockEprint.getEprint.mockResolvedValue({
        uri: 'at://did:plc:test1/pub.chive.eprint.submission/123',
        authors: [{ did: 'did:plc:john123', name: 'Some Author' }],
      });

      const result = await searchAuthors.handler({
        params: { q: 'john', limit: 10 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof searchAuthors.handler>[0]['c'],
      });

      expect(result.body.authors).toHaveLength(1);
      const didMatchAuthor = result.body.authors[0];
      expect(didMatchAuthor).toBeDefined();
      if (didMatchAuthor) {
        expect(didMatchAuthor.did).toBe('did:plc:john123');
      }
    });
  });

  describe('XRPCMethod configuration', () => {
    it('has auth set to false', () => {
      expect(searchAuthors.auth).toBe(false);
    });
  });
});
