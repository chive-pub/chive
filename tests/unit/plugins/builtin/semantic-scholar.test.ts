/**
 * Unit tests for Semantic Scholar plugin.
 *
 * @remarks
 * Tests the Semantic Scholar integration including paper lookup,
 * recommendations, and citation retrieval.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SemanticScholarPlugin } from '../../../../src/plugins/builtin/semantic-scholar.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import {
  mockPaper,
  mockAuthor,
  mockS2ApiResponses,
  createMockS2Fetch,
} from '../../../mocks/semantic-scholar-api.js';

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLogger = (): ILogger => {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
};

const createMockCache = (): {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
} => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
});

// ============================================================================
// Plugin Test Helper
// ============================================================================

/**
 * Creates a plugin instance with mocked dependencies.
 */
function createTestPlugin(): {
  plugin: SemanticScholarPlugin;
  logger: ReturnType<typeof createMockLogger>;
  cache: ReturnType<typeof createMockCache>;
} {
  const logger = createMockLogger();
  const cache = createMockCache();

  const plugin = new SemanticScholarPlugin();

  // Use reflection to inject mocks
  (plugin as unknown as { logger: ILogger }).logger = logger;
  (plugin as unknown as { cache: typeof cache }).cache = cache;

  // Set rate limit to 0 for tests
  (plugin as unknown as { rateLimitDelayMs: number }).rateLimitDelayMs = 0;

  return { plugin, logger, cache };
}

// ============================================================================
// Tests
// ============================================================================

describe('SemanticScholarPlugin', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    const fetchImpl = createMockS2Fetch();
    mockFetch = vi.fn(fetchImpl);
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Plugin Metadata
  // ==========================================================================

  describe('plugin metadata', () => {
    it('should have correct ID', () => {
      const { plugin } = createTestPlugin();
      expect(plugin.id).toBe('pub.chive.plugin.semantic-scholar');
    });

    it('should have correct manifest', () => {
      const { plugin } = createTestPlugin();
      expect(plugin.manifest.name).toBe('Semantic Scholar Integration');
      expect(plugin.manifest.version).toBe('0.1.0');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain(
        'api.semanticscholar.org'
      );
    });
  });

  // ==========================================================================
  // getPaperByDoi
  // ==========================================================================

  describe('getPaperByDoi', () => {
    it('should fetch paper by DOI', async () => {
      const { plugin } = createTestPlugin();

      const result = await plugin.getPaperByDoi('10.1234/test.2024.001');

      expect(result).not.toBeNull();
      expect(result?.paperId).toBe(mockPaper.paperId);
      expect(result?.title).toBe(mockPaper.title);
      expect(result?.source).toBe('semanticscholar');
    });

    it('should normalize DOI with https prefix', async () => {
      const { plugin } = createTestPlugin();

      const result = await plugin.getPaperByDoi('https://doi.org/10.1234/test.2024.001');

      expect(result).not.toBeNull();
      expect(result?.paperId).toBe(mockPaper.paperId);
    });

    it('should return null for invalid DOI format', async () => {
      const { plugin } = createTestPlugin();

      const result = await plugin.getPaperByDoi('invalid-doi');

      expect(result).toBeNull();
    });

    it('should return null for not found DOI', async () => {
      const { plugin } = createTestPlugin();

      const result = await plugin.getPaperByDoi('10.1234/nonexistent');

      expect(result).toBeNull();
    });

    it('should use cached value if available', async () => {
      const { plugin, cache } = createTestPlugin();
      cache.get.mockResolvedValueOnce(mockPaper);

      const result = await plugin.getPaperByDoi('10.1234/test.2024.001');

      expect(result).toEqual(mockPaper);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should cache successful responses', async () => {
      const { plugin, cache } = createTestPlugin();

      await plugin.getPaperByDoi('10.1234/test.2024.001');

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('s2:paper:doi:'),
        expect.objectContaining({ paperId: mockPaper.paperId }),
        expect.any(Number)
      );
    });
  });

  // ==========================================================================
  // getPaperByArxiv
  // ==========================================================================

  describe('getPaperByArxiv', () => {
    it('should fetch paper by arXiv ID', async () => {
      const { plugin } = createTestPlugin();

      // Mock arXiv lookup
      mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(mockS2ApiResponses.paper), { status: 200 }));
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getPaperByArxiv('2401.12345');

      expect(result).not.toBeNull();
      expect(result?.paperId).toBe(mockPaper.paperId);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ARXIV:2401.12345'),
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // getAuthor
  // ==========================================================================

  describe('getAuthor', () => {
    it('should fetch author by ID', async () => {
      const { plugin } = createTestPlugin();

      const result = await plugin.getAuthor(mockAuthor.authorId);

      expect(result).not.toBeNull();
      expect(result?.authorId).toBe(mockAuthor.authorId);
      expect(result?.name).toBe(mockAuthor.name);
      expect(result?.source).toBe('semanticscholar');
    });

    it('should return null for not found author', async () => {
      const { plugin } = createTestPlugin();

      const result = await plugin.getAuthor('nonexistent');

      expect(result).toBeNull();
    });

    it('should include ORCID when available', async () => {
      const { plugin } = createTestPlugin();

      const result = await plugin.getAuthor(mockAuthor.authorId);

      expect(result?.externalIds?.ORCID).toBe(mockAuthor.externalIds?.ORCID);
    });
  });

  // ==========================================================================
  // getRecommendations
  // ==========================================================================

  describe('getRecommendations', () => {
    it('should fetch recommendations for a paper', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(mockS2ApiResponses.recommendations), { status: 200 })
        );
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getRecommendations(mockPaper.paperId);
      const firstResult = result[0];

      expect(result.length).toBeGreaterThan(0);
      expect(firstResult?.source).toBe('semanticscholar');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/recommendations/v1/papers/forpaper/'),
        expect.any(Object)
      );
    });

    it('should respect limit option', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(mockS2ApiResponses.recommendations), { status: 200 })
        );
      global.fetch = mockFetch as unknown as typeof fetch;

      await plugin.getRecommendations(mockPaper.paperId, { limit: 5 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=5'),
        expect.any(Object)
      );
    });

    it('should return empty array for not found paper', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getRecommendations('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getRecommendationsFromLists
  // ==========================================================================

  describe('getRecommendationsFromLists', () => {
    it('should fetch recommendations from positive examples', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(mockS2ApiResponses.recommendations), { status: 200 })
        );
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getRecommendationsFromLists({
        positivePaperIds: [mockPaper.paperId],
      });

      expect(result.length).toBeGreaterThan(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/recommendations/v1/papers/'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(mockPaper.paperId),
        })
      );
    });

    it('should include negative examples when provided', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(mockS2ApiResponses.recommendations), { status: 200 })
        );
      global.fetch = mockFetch as unknown as typeof fetch;

      await plugin.getRecommendationsFromLists({
        positivePaperIds: [mockPaper.paperId],
        negativePaperIds: ['negative1'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('negativePaperIds'),
        })
      );
    });

    it('should return empty array for empty positive list', async () => {
      const { plugin } = createTestPlugin();

      const result = await plugin.getRecommendationsFromLists({
        positivePaperIds: [],
      });

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getCitations
  // ==========================================================================

  describe('getCitations', () => {
    it('should fetch citations for a paper', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(mockS2ApiResponses.citations), { status: 200 })
        );
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getCitations(mockPaper.paperId);
      const firstCitation = result.citations[0];

      expect(result.citations.length).toBeGreaterThan(0);
      expect(firstCitation?.isInfluential).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/paper/${mockPaper.paperId}/citations`),
        expect.any(Object)
      );
    });

    it('should include influence markers', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(mockS2ApiResponses.citations), { status: 200 })
        );
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getCitations(mockPaper.paperId);

      const hasInfluential = result.citations.some((c) => c.isInfluential);
      expect(hasInfluential).toBe(true);
    });

    it('should support pagination', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(mockS2ApiResponses.citations), { status: 200 })
        );
      global.fetch = mockFetch as unknown as typeof fetch;

      await plugin.getCitations(mockPaper.paperId, { limit: 50, offset: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=10'),
        expect.any(Object)
      );
    });

    it('should return empty for not found paper', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getCitations('nonexistent');

      expect(result.citations).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================================================
  // getReferences
  // ==========================================================================

  describe('getReferences', () => {
    it('should fetch references for a paper', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(mockS2ApiResponses.references), { status: 200 })
        );
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getReferences(mockPaper.paperId);

      expect(result.references.length).toBeGreaterThan(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/paper/${mockPaper.paperId}/references`),
        expect.any(Object)
      );
    });

    it('should include citation intent when available', async () => {
      const { plugin } = createTestPlugin();

      mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(mockS2ApiResponses.references), { status: 200 })
        );
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getReferences(mockPaper.paperId);

      const hasIntent = result.references.some((r) => r.intent && r.intent.length > 0);
      expect(hasIntent).toBe(true);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const { plugin, logger } = createTestPlugin();

      mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getPaperByDoi('10.1234/test.2024.001');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching'),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      const { plugin, logger } = createTestPlugin();

      mockFetch = vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await plugin.getPaper('some-id');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Semantic Scholar API error', expect.any(Object));
    });
  });
});
