/**
 * Unit tests for pub.chive.claiming.searchEprints handler.
 *
 * @remarks
 * Tests the federated search handler that queries external eprint sources.
 * Focuses on sourceErrors reporting behavior (WS8 changes).
 *
 * Key scenarios:
 * - Returns sourceErrors when some plugins fail
 * - Returns empty/undefined sourceErrors when all plugins succeed
 * - Logs warnings when sourceErrors are present
 * - Maps results to proper response format
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { searchEprints } from '@/api/handlers/xrpc/claiming/searchEprints.js';
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

interface MockClaimingService {
  searchAllSources: ReturnType<typeof vi.fn>;
}

interface MockEprintService {
  findByExternalIds: ReturnType<typeof vi.fn>;
}

const createMockClaimingService = (): MockClaimingService => ({
  searchAllSources: vi.fn().mockResolvedValue({ results: [], sourceErrors: [] }),
});

const createMockEprintService = (): MockEprintService => ({
  findByExternalIds: vi.fn().mockResolvedValue(null),
});

interface MockContext {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

const createMockContext = (options: {
  user?: { did: DID } | null;
  claimingService: MockClaimingService;
  eprintService: MockEprintService;
  logger?: ILogger;
}): MockContext => {
  const logger = options.logger ?? createMockLogger();

  return {
    get: vi.fn((key: string) => {
      switch (key) {
        case 'services':
          return {
            claiming: options.claimingService,
            eprint: options.eprintService,
          };
        case 'logger':
          return logger;
        case 'user':
          return options.user ?? null;
        default:
          return undefined;
      }
    }),
    set: vi.fn(),
  };
};

const createMockSearchResult = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  externalId: 'arxiv-2401.12345',
  url: 'https://arxiv.org/abs/2401.12345',
  title: 'Test Paper on Machine Learning',
  abstract: 'This paper presents...',
  authors: [{ name: 'Test Author', orcid: undefined, affiliation: undefined, email: undefined }],
  publicationDate: new Date('2024-01-15'),
  doi: '10.1234/test',
  pdfUrl: 'https://arxiv.org/pdf/2401.12345',
  categories: ['cs.AI'],
  source: 'arxiv',
  ...overrides,
});

// =============================================================================
// TESTS
// =============================================================================

describe('searchEprints', () => {
  let mockClaimingService: MockClaimingService;
  let mockEprintService: MockEprintService;
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClaimingService = createMockClaimingService();
    mockEprintService = createMockEprintService();
    mockLogger = createMockLogger();
  });

  describe('sourceErrors reporting', () => {
    it('returns sourceErrors in response when plugins fail', async () => {
      const sourceErrors = ['arxiv: connection timeout', 'biorxiv: rate limited'];
      mockClaimingService.searchAllSources.mockResolvedValue({
        results: [createMockSearchResult({ source: 'semanticscholar' })],
        sourceErrors,
      });

      const mockContext = createMockContext({
        claimingService: mockClaimingService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      const result = await searchEprints.handler({
        params: { query: 'machine learning', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.sourceErrors).toEqual(sourceErrors);
    });

    it('returns undefined sourceErrors when all plugins succeed', async () => {
      mockClaimingService.searchAllSources.mockResolvedValue({
        results: [createMockSearchResult()],
        sourceErrors: [],
      });

      const mockContext = createMockContext({
        claimingService: mockClaimingService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      const result = await searchEprints.handler({
        params: { query: 'machine learning', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.sourceErrors).toBeUndefined();
    });

    it('logs warning when sourceErrors are present', async () => {
      const sourceErrors = ['arxiv: connection timeout'];
      mockClaimingService.searchAllSources.mockResolvedValue({
        results: [],
        sourceErrors,
      });

      const mockContext = createMockContext({
        claimingService: mockClaimingService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      await searchEprints.handler({
        params: { query: 'quantum computing', author: 'Einstein', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Some sources failed during search',
        expect.objectContaining({
          sourceErrors,
          query: 'quantum computing',
          author: 'Einstein',
        })
      );
    });

    it('does not log warning when no sourceErrors', async () => {
      mockClaimingService.searchAllSources.mockResolvedValue({
        results: [],
        sourceErrors: [],
      });

      const mockContext = createMockContext({
        claimingService: mockClaimingService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      await searchEprints.handler({
        params: { query: 'machine learning', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        'Some sources failed during search',
        expect.anything()
      );
    });
  });

  describe('result mapping', () => {
    it('maps results to response format with source facets', async () => {
      const results = [
        createMockSearchResult({ source: 'arxiv', externalId: 'arxiv-1' }),
        createMockSearchResult({ source: 'arxiv', externalId: 'arxiv-2' }),
        createMockSearchResult({ source: 'semanticscholar', externalId: 'ss-1' }),
      ];

      mockClaimingService.searchAllSources.mockResolvedValue({
        results,
        sourceErrors: [],
      });

      const mockContext = createMockContext({
        claimingService: mockClaimingService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      const result = await searchEprints.handler({
        params: { query: 'test', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.eprints).toHaveLength(3);
      expect(result.body.facets?.sources).toEqual({
        arxiv: 2,
        semanticscholar: 1,
      });
    });

    it('includes existingChivePaper for duplicates', async () => {
      const results = [createMockSearchResult({ doi: '10.1234/existing' })];

      mockClaimingService.searchAllSources.mockResolvedValue({
        results,
        sourceErrors: [],
      });

      mockEprintService.findByExternalIds.mockResolvedValue({
        uri: 'at://did:plc:existing/pub.chive.eprint.submission/abc',
        title: 'Existing Paper',
        authors: [{ did: 'did:plc:existing' as DID, name: 'Author' }],
        createdAt: new Date('2024-01-01'),
      });

      const mockContext = createMockContext({
        claimingService: mockClaimingService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      const result = await searchEprints.handler({
        params: { query: 'existing paper', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(result.body.eprints[0]?.existingChivePaper).toBeDefined();
      expect(result.body.eprints[0]?.existingChivePaper?.uri).toBe(
        'at://did:plc:existing/pub.chive.eprint.submission/abc'
      );
    });

    it('passes sources filter from comma-separated param', async () => {
      const mockContext = createMockContext({
        claimingService: mockClaimingService,
        eprintService: mockEprintService,
        logger: mockLogger,
      });

      await searchEprints.handler({
        params: { query: 'test', sources: 'arxiv, biorxiv', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as never,
      });

      expect(mockClaimingService.searchAllSources).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: ['arxiv', 'biorxiv'],
        })
      );
    });
  });
});
