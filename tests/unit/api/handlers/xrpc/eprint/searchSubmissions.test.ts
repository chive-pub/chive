/**
 * Unit tests for pub.chive.eprint.searchSubmissions handler.
 *
 * @remarks
 * Tests the search handler, focusing on the sort parameter behavior (WS3).
 *
 * Key scenarios:
 * - Passes sort='recent' to search query when provided
 * - Defaults to relevance sort when sort not provided
 * - sort param combined with fieldUris works correctly
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { searchSubmissions } from '@/api/handlers/xrpc/eprint/searchSubmissions.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// MOCK FACTORIES
// =============================================================================

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

interface MockSearchService {
  search: ReturnType<typeof vi.fn>;
}

interface MockEprintService {
  getEprint: ReturnType<typeof vi.fn>;
}

interface MockRelevanceLogger {
  createImpressionId: ReturnType<typeof vi.fn>;
  computeQueryId: ReturnType<typeof vi.fn>;
  logImpression: ReturnType<typeof vi.fn>;
}

const createMockSearchService = (): MockSearchService => ({
  search: vi.fn().mockResolvedValue({
    hits: [],
    total: 0,
    took: 0,
  }),
});

const createMockEprintService = (): MockEprintService => ({
  getEprint: vi.fn().mockResolvedValue(null),
});

const createMockRelevanceLogger = (): MockRelevanceLogger => ({
  createImpressionId: vi.fn().mockReturnValue('impression-1'),
  computeQueryId: vi.fn().mockReturnValue('query-1'),
  logImpression: vi.fn().mockResolvedValue(undefined),
});

interface MockContext {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

const createMockContext = (options: {
  user?: { did: DID } | null;
  searchService: MockSearchService;
  eprintService: MockEprintService;
  relevanceLogger: MockRelevanceLogger;
  graph?: unknown;
  ranking?: unknown;
  nodeRepository?: unknown;
  logger?: ILogger;
}): MockContext => {
  const logger = options.logger ?? createMockLogger();

  return {
    get: vi.fn((key: string) => {
      switch (key) {
        case 'services':
          return {
            search: options.searchService,
            eprint: options.eprintService,
            relevanceLogger: options.relevanceLogger,
            graph: options.graph ?? undefined,
            ranking: options.ranking ?? undefined,
            nodeRepository: options.nodeRepository ?? { getNode: vi.fn().mockResolvedValue(null) },
          };
        case 'logger':
          return logger;
        case 'user':
          return options.user ?? null;
        case 'requestId':
          return 'test-request-id';
        default:
          return undefined;
      }
    }),
    set: vi.fn(),
  };
};

// =============================================================================
// TESTS
// =============================================================================

describe('searchSubmissions', () => {
  let mockSearchService: MockSearchService;
  let mockEprintService: MockEprintService;
  let mockRelevanceLogger: MockRelevanceLogger;
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchService = createMockSearchService();
    mockEprintService = createMockEprintService();
    mockRelevanceLogger = createMockRelevanceLogger();
    mockLogger = createMockLogger();

    // Mock global fetch for avatar fetching
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ profiles: [] }),
      })
    );
  });

  describe('sort parameter', () => {
    it('passes sort=recent to search query when provided', async () => {
      const mockContext = createMockContext({
        searchService: mockSearchService,
        eprintService: mockEprintService,
        relevanceLogger: mockRelevanceLogger,
        logger: mockLogger,
      });

      await searchSubmissions.handler({
        params: { q: 'test', sort: 'recent', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: 'recent',
        })
      );
    });

    it('defaults to undefined sort (relevance) when sort not provided', async () => {
      const mockContext = createMockContext({
        searchService: mockSearchService,
        eprintService: mockEprintService,
        relevanceLogger: mockRelevanceLogger,
        logger: mockLogger,
      });

      await searchSubmissions.handler({
        params: { q: 'test', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: undefined,
        })
      );
    });

    it('uses sort=recent combined with fieldUris', async () => {
      const fieldUris = [
        'at://did:plc:chive-governance/pub.chive.graph.node/f39a6280-d70a-5e59-9022-1ce485cc5bf4',
      ];

      const mockContext = createMockContext({
        searchService: mockSearchService,
        eprintService: mockEprintService,
        relevanceLogger: mockRelevanceLogger,
        logger: mockLogger,
      });

      await searchSubmissions.handler({
        params: { fieldUris, sort: 'recent', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: 'recent',
          filters: expect.objectContaining({
            subjects: expect.arrayContaining(fieldUris),
          }),
        })
      );
    });
  });

  describe('browsing mode', () => {
    it('uses wildcard query when q is not provided', async () => {
      const mockContext = createMockContext({
        searchService: mockSearchService,
        eprintService: mockEprintService,
        relevanceLogger: mockRelevanceLogger,
        logger: mockLogger,
      });

      await searchSubmissions.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          q: '*',
        })
      );
    });
  });

  describe('response format', () => {
    it('returns cursor when there are more results', async () => {
      mockSearchService.search.mockResolvedValue({
        hits: [
          { uri: 'at://did:plc:test/pub.chive.eprint.submission/1', score: 1.5 },
          { uri: 'at://did:plc:test/pub.chive.eprint.submission/2', score: 1.2 },
        ],
        total: 50,
        took: 10,
      });

      const mockContext = createMockContext({
        searchService: mockSearchService,
        eprintService: mockEprintService,
        relevanceLogger: mockRelevanceLogger,
        logger: mockLogger,
      });

      const result = await searchSubmissions.handler({
        params: { q: 'test', limit: 2 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.cursor).toBe('2');
      expect(result.body.total).toBe(50);
    });

    it('returns undefined cursor when all results returned', async () => {
      mockSearchService.search.mockResolvedValue({
        hits: [{ uri: 'at://did:plc:test/pub.chive.eprint.submission/1', score: 1.0 }],
        total: 1,
        took: 5,
      });

      const mockContext = createMockContext({
        searchService: mockSearchService,
        eprintService: mockEprintService,
        relevanceLogger: mockRelevanceLogger,
        logger: mockLogger,
      });

      const result = await searchSubmissions.handler({
        params: { q: 'test', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.cursor).toBeUndefined();
    });
  });
});
