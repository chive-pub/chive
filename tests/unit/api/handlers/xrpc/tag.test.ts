/**
 * Unit tests for XRPC tag handlers.
 *
 * @remarks
 * Tests getSuggestions, getTrending, search, listForPreprint, and getDetail handlers.
 * Validates TagManager integration and ATProto compliance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getDetailHandler } from '@/api/handlers/xrpc/tag/getDetail.js';
import { getSuggestionsHandler } from '@/api/handlers/xrpc/tag/getSuggestions.js';
import { getTrendingHandler } from '@/api/handlers/xrpc/tag/getTrending.js';
import { listForPreprintHandler } from '@/api/handlers/xrpc/tag/listForPreprint.js';
import { searchHandler } from '@/api/handlers/xrpc/tag/search.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

// Mock tag data matching TagManager's expected return format
interface MockTagData {
  normalizedForm: string;
  rawForm: string;
  usageCount: number;
  qualityScore: number;
  spamScore: number;
  createdAt: Date;
}

interface MockTagManager {
  getTag: ReturnType<typeof vi.fn>;
  getTagsForRecord: ReturnType<typeof vi.fn>;
  searchTags: ReturnType<typeof vi.fn>;
  getTrendingTags: ReturnType<typeof vi.fn>;
  getTagSuggestions: ReturnType<typeof vi.fn>;
  normalizeTag: ReturnType<typeof vi.fn>;
}

const createMockTagManager = (): MockTagManager => ({
  getTag: vi.fn(),
  getTagsForRecord: vi.fn(),
  searchTags: vi.fn(),
  getTrendingTags: vi.fn(),
  getTagSuggestions: vi.fn(),
  normalizeTag: vi.fn((tag: string) => tag.toLowerCase().replace(/\s+/g, '-')),
});

const createMockTagData = (overrides?: Partial<MockTagData>): MockTagData => ({
  normalizedForm: 'machine-learning',
  rawForm: 'machine learning',
  usageCount: 150,
  qualityScore: 0.85,
  spamScore: 0.1,
  createdAt: new Date(),
  ...overrides,
});

describe('XRPC Tag Handlers', () => {
  let mockLogger: ILogger;
  let mockTagManager: MockTagManager;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockTagManager = createMockTagManager();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              tagManager: mockTagManager,
            };
          case 'logger':
            return mockLogger;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  });

  describe('getSuggestionsHandler', () => {
    it('returns tag suggestions for a query', async () => {
      const tags: MockTagData[] = [
        createMockTagData(),
        createMockTagData({
          normalizedForm: 'machine-vision',
          rawForm: 'machine vision',
          usageCount: 75,
        }),
      ];
      // getSuggestionsHandler uses searchTags internally
      mockTagManager.searchTags.mockResolvedValue({ tags, total: 2 });

      const result = await getSuggestionsHandler(
        mockContext as unknown as Parameters<typeof getSuggestionsHandler>[0],
        { q: 'machine', limit: 10 }
      );

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0]).toMatchObject({
        normalizedForm: 'machine-learning',
        displayForm: 'machine learning',
      });
      expect(mockTagManager.searchTags).toHaveBeenCalledWith('machine', 10);
    });

    it('uses default limit of 10', async () => {
      mockTagManager.searchTags.mockResolvedValue({ tags: [], total: 0 });

      await getSuggestionsHandler(
        mockContext as unknown as Parameters<typeof getSuggestionsHandler>[0],
        { q: 'test' }
      );

      expect(mockTagManager.searchTags).toHaveBeenCalledWith('test', 10);
    });

    it('returns empty array when no suggestions found', async () => {
      mockTagManager.searchTags.mockResolvedValue({ tags: [], total: 0 });

      const result = await getSuggestionsHandler(
        mockContext as unknown as Parameters<typeof getSuggestionsHandler>[0],
        { q: 'nonexistent', limit: 10 }
      );

      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('getTrendingHandler', () => {
    it('returns trending tags', async () => {
      const tags: MockTagData[] = [
        createMockTagData({ normalizedForm: 'ai', rawForm: 'AI', usageCount: 500 }),
        createMockTagData({ normalizedForm: 'climate', rawForm: 'climate', usageCount: 350 }),
        createMockTagData({ normalizedForm: 'quantum', rawForm: 'quantum', usageCount: 200 }),
      ];
      mockTagManager.getTrendingTags.mockResolvedValue(tags);

      const result = await getTrendingHandler(
        mockContext as unknown as Parameters<typeof getTrendingHandler>[0],
        { timeWindow: 'week', limit: 10 }
      );

      expect(result.tags).toHaveLength(3);
      expect(result.tags[0]?.normalizedForm).toBe('ai');
      expect(result.timeWindow).toBe('week');
      expect(mockTagManager.getTrendingTags).toHaveBeenCalledWith(10, { timeWindow: 'week' });
    });

    it('uses default limit of 20', async () => {
      mockTagManager.getTrendingTags.mockResolvedValue([]);

      await getTrendingHandler(mockContext as unknown as Parameters<typeof getTrendingHandler>[0], {
        timeWindow: 'week',
      });

      expect(mockTagManager.getTrendingTags).toHaveBeenCalledWith(20, { timeWindow: 'week' });
    });
  });

  describe('searchHandler', () => {
    it('returns search results for tags', async () => {
      const tags: MockTagData[] = [
        createMockTagData({
          normalizedForm: 'neural-networks',
          rawForm: 'neural networks',
          usageCount: 100,
        }),
      ];
      mockTagManager.searchTags.mockResolvedValue({ tags, total: 1 });

      const result = await searchHandler(
        mockContext as unknown as Parameters<typeof searchHandler>[0],
        { q: 'neural', limit: 20 }
      );

      expect(result.tags).toHaveLength(1);
      expect(result.tags[0]?.normalizedForm).toBe('neural-networks');
      expect(mockTagManager.searchTags).toHaveBeenCalledWith('neural', 20);
    });

    it('filters out spam tags by default', async () => {
      const tags: MockTagData[] = [
        createMockTagData({ normalizedForm: 'good-tag', rawForm: 'good tag', spamScore: 0.1 }),
        createMockTagData({ normalizedForm: 'spam-tag', rawForm: 'spam tag', spamScore: 0.8 }),
      ];
      mockTagManager.searchTags.mockResolvedValue({ tags, total: 2 });

      const result = await searchHandler(
        mockContext as unknown as Parameters<typeof searchHandler>[0],
        { q: 'tag', limit: 20 }
      );

      expect(result.tags).toHaveLength(1);
      expect(result.tags[0]?.normalizedForm).toBe('good-tag');
    });
  });

  describe('listForPreprintHandler', () => {
    it('returns tags for a specific preprint', async () => {
      const preprintTags: MockTagData[] = [
        createMockTagData({ normalizedForm: 'quantum-computing', rawForm: 'quantum computing' }),
        createMockTagData({ normalizedForm: 'algorithms', rawForm: 'algorithms' }),
      ];
      mockTagManager.getTagsForRecord.mockResolvedValue(preprintTags);
      mockTagManager.getTagSuggestions.mockResolvedValue([
        {
          tag: createMockTagData({ normalizedForm: 'cryptography', rawForm: 'cryptography' }),
          coOccurrenceCount: 5,
        },
      ]);

      const result = await listForPreprintHandler(
        mockContext as unknown as Parameters<typeof listForPreprintHandler>[0],
        { preprintUri: 'at://did:plc:abc/pub.chive.preprint.submission/xyz' }
      );

      expect(result.tags).toHaveLength(2);
      expect(result.suggestions).toHaveLength(1);
      expect(mockTagManager.getTagsForRecord).toHaveBeenCalled();
    });

    it('returns empty arrays when no tags exist', async () => {
      mockTagManager.getTagsForRecord.mockResolvedValue([]);

      const result = await listForPreprintHandler(
        mockContext as unknown as Parameters<typeof listForPreprintHandler>[0],
        { preprintUri: 'at://did:plc:abc/pub.chive.preprint.submission/xyz' }
      );

      expect(result.tags).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('getDetailHandler', () => {
    it('returns tag details with usage statistics', async () => {
      const tagDetail = createMockTagData();
      mockTagManager.getTag.mockResolvedValue(tagDetail);

      const result = await getDetailHandler(
        mockContext as unknown as Parameters<typeof getDetailHandler>[0],
        { tag: 'machine-learning' }
      );

      expect(result.normalizedForm).toBe('machine-learning');
      expect(result.displayForms).toContain('machine learning');
      expect(result.usageCount).toBe(150);
    });

    it('throws NotFoundError when tag does not exist', async () => {
      mockTagManager.getTag.mockResolvedValue(null);

      await expect(
        getDetailHandler(mockContext as unknown as Parameters<typeof getDetailHandler>[0], {
          tag: 'nonexistent-tag',
        })
      ).rejects.toThrow();
    });
  });
});
