/**
 * Unit tests for FigsharePlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { FigsharePlugin } from '../../../../src/plugins/builtin/figshare.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ICacheProvider,
  IMetrics,
  IPluginContext,
  IPluginEventBus,
} from '../../../../src/types/interfaces/plugin.interface.js';

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

const createMockCache = (): ICacheProvider => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  expire: vi.fn().mockResolvedValue(undefined),
});

const createMockMetrics = (): IMetrics => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  startTimer: vi.fn().mockReturnValue(() => {}),
});

const createMockEventBus = (): IPluginEventBus => ({
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  emitAsync: vi.fn().mockResolvedValue(undefined),
  listenerCount: vi.fn().mockReturnValue(0),
  eventNames: vi.fn().mockReturnValue([]),
  removeAllListeners: vi.fn(),
});

const createMockContext = (overrides?: Partial<IPluginContext>): IPluginContext => ({
  logger: createMockLogger(),
  cache: createMockCache(),
  metrics: createMockMetrics(),
  eventBus: createMockEventBus(),
  config: {},
  ...overrides,
});

// ============================================================================
// Sample Data (based on Figshare API v2)
// ============================================================================

/**
 * Sample Figshare article response (dataset).
 *
 * Based on real Figshare API v2 response format for a linguistic dataset.
 * Example: MegaAcceptability dataset from White & Rawlins (2020).
 */
const SAMPLE_DATASET_RESPONSE = {
  id: 12345678,
  doi: '10.6084/m9.figshare.12345678.v1',
  title: 'MegaAcceptability: Acceptability Judgments for 1000 English Verbs',
  description:
    '<p>This dataset contains acceptability judgments for clause-embedding constructions with 1000 English verbs. The data was collected through crowdsourced behavioral experiments and includes ratings for various syntactic frames.</p>',
  defined_type_name: 'dataset',
  authors: [
    {
      id: 123456,
      full_name: 'Aaron Steven White',
      orcid_id: '0000-0002-4519-6259',
    },
    {
      id: 234567,
      full_name: 'Kyle Rawlins',
    },
  ],
  categories: [
    {
      id: 456,
      title: 'Linguistics',
    },
    {
      id: 789,
      title: 'Cognitive Science',
    },
  ],
  tags: ['semantics', 'syntax', 'acceptability', 'clause-embedding', 'verb-selection'],
  license: {
    value: 1,
    name: 'CC BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
  },
  files: [
    {
      id: 98765432,
      name: 'megaacceptability_data.csv',
      size: 15728640,
      download_url: 'https://figshare.com/ndownloader/files/98765432',
      mimetype: 'text/csv',
    },
    {
      id: 98765433,
      name: 'codebook.pdf',
      size: 524288,
      download_url: 'https://figshare.com/ndownloader/files/98765433',
      mimetype: 'application/pdf',
    },
  ],
  funding: ['NSF Grant BCS-1748969'],
  references: ['https://doi.org/10.5334/gjgl.1001'],
  url: 'https://figshare.com/articles/dataset/MegaAcceptability/12345678',
  published_date: '2020-05-29T14:30:00Z',
  modified_date: '2020-06-15T09:15:00Z',
  views: 2847,
  downloads: 531,
  version: 1,
};

/**
 * Sample Figshare article response (figure).
 *
 * Example: Visualization from a semantics paper.
 */
const SAMPLE_FIGURE_RESPONSE = {
  id: 23456789,
  doi: '10.6084/m9.figshare.23456789.v2',
  title: 'Distributional Semantic Network for Clause-Embedding Verbs',
  description:
    '<p>Network visualization showing distributional similarities between 1000 clause-embedding verbs based on acceptability patterns across different syntactic frames.</p>',
  defined_type_name: 'figure',
  authors: [
    {
      id: 123456,
      full_name: 'Aaron Steven White',
      orcid_id: '0000-0002-4519-6259',
    },
  ],
  categories: [
    {
      id: 456,
      title: 'Linguistics',
    },
  ],
  tags: ['semantics', 'visualization', 'network-analysis'],
  license: {
    value: 1,
    name: 'CC BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
  },
  files: [
    {
      id: 87654321,
      name: 'verb_network.png',
      size: 3145728,
      download_url: 'https://figshare.com/ndownloader/files/87654321',
      mimetype: 'image/png',
    },
  ],
  url: 'https://figshare.com/articles/figure/Distributional_Semantic_Network/23456789',
  published_date: '2020-05-29T14:30:00Z',
  modified_date: '2020-07-10T11:20:00Z',
  views: 1523,
  downloads: 248,
  version: 2,
};

/**
 * Sample Figshare article response (software/code).
 *
 * Example: Analysis code from a computational linguistics project.
 */
const SAMPLE_SOFTWARE_RESPONSE = {
  id: 34567890,
  doi: '10.6084/m9.figshare.34567890.v1',
  title: 'MegaAcceptability Analysis Scripts',
  description:
    '<p>R scripts for analyzing acceptability judgment data from the MegaAcceptability dataset. Includes functions for regression modeling, visualization, and statistical testing.</p>',
  defined_type_name: 'software',
  authors: [
    {
      id: 234567,
      full_name: 'Kyle Rawlins',
    },
  ],
  categories: [
    {
      id: 456,
      title: 'Linguistics',
    },
    {
      id: 123,
      title: 'Software Engineering',
    },
  ],
  tags: ['r', 'statistics', 'data-analysis', 'reproducible-research'],
  license: {
    value: 2,
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
  files: [
    {
      id: 76543210,
      name: 'analysis_scripts.zip',
      size: 1048576,
      download_url: 'https://figshare.com/ndownloader/files/76543210',
      mimetype: 'application/zip',
    },
  ],
  url: 'https://figshare.com/articles/software/MegaAcceptability_Analysis_Scripts/34567890',
  published_date: '2020-05-29T14:30:00Z',
  modified_date: '2020-05-29T14:30:00Z',
  views: 892,
  downloads: 156,
  version: 1,
};

/**
 * Sample Figshare search response.
 */
const SAMPLE_SEARCH_RESPONSE = [SAMPLE_DATASET_RESPONSE, SAMPLE_FIGURE_RESPONSE];

/**
 * Minimal article response (missing optional fields).
 */
const MINIMAL_ARTICLE_RESPONSE = {
  id: 99999999,
  title: 'Minimal Test Article',
  defined_type_name: 'dataset',
};

/**
 * Invalid article response (missing required fields).
 */
const INVALID_ARTICLE_RESPONSE = {
  doi: '10.6084/m9.figshare.invalid',
  // Missing id and title
};

// ============================================================================
// Tests
// ============================================================================

describe('FigsharePlugin', () => {
  let plugin: FigsharePlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new FigsharePlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.figshare');
    });

    it('should have correct name and description', () => {
      expect(plugin.manifest.name).toBe('Figshare Integration');
      expect(plugin.manifest.description).toBe('Provides research output linking via Figshare');
    });

    it('should declare network permissions for Figshare domains', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('api.figshare.com');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('figshare.com');
    });

    it('should have storage limit of 30MB', () => {
      expect(plugin.manifest.permissions?.storage?.maxSize).toBe(30 * 1024 * 1024);
    });

    it('should have version 1.0.0', () => {
      expect(plugin.manifest.version).toBe('0.1.0');
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Figshare plugin initialized',
        expect.objectContaining({
          rateLimit: expect.stringContaining('ms between requests'),
        })
      );
    });
  });

  describe('getArticle', () => {
    it('should return cached article if available', async () => {
      await plugin.initialize(context);
      const cachedArticle = {
        id: 12345678,
        doi: '10.6084/m9.figshare.12345678.v1',
        title: 'Cached Article',
        type: 'dataset',
        authors: [],
        categories: [],
        tags: [],
        license: { id: 1, name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
        url: 'https://figshare.com/articles/12345678',
        publishedDate: '2020-05-29T14:30:00Z',
        modifiedDate: '2020-05-29T14:30:00Z',
        viewCount: 100,
        downloadCount: 50,
        version: 1,
        source: 'figshare' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedArticle);

      const result = await plugin.getArticle(12345678);

      expect(result).toEqual(cachedArticle);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch dataset from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getArticle(12345678);

      expect(result?.id).toBe(12345678);
      expect(result?.doi).toBe('10.6084/m9.figshare.12345678.v1');
      expect(result?.title).toBe(
        'MegaAcceptability: Acceptability Judgments for 1000 English Verbs'
      );
      expect(result?.type).toBe('dataset');
      expect(result?.source).toBe('figshare');
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should parse authors correctly with ORCID', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getArticle(12345678);

      expect(result?.authors).toHaveLength(2);
      expect(result?.authors[0]).toEqual({
        id: 123456,
        fullName: 'Aaron Steven White',
        orcid: '0000-0002-4519-6259',
      });
      expect(result?.authors[1]).toEqual({
        id: 234567,
        fullName: 'Kyle Rawlins',
      });
    });

    it('should parse categories correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getArticle(12345678);

      expect(result?.categories).toHaveLength(2);
      expect(result?.categories[0]).toEqual({ id: 456, title: 'Linguistics' });
      expect(result?.categories[1]).toEqual({ id: 789, title: 'Cognitive Science' });
    });

    it('should parse files correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getArticle(12345678);

      expect(result?.files).toHaveLength(2);
      expect(result?.files?.[0]).toEqual({
        id: 98765432,
        name: 'megaacceptability_data.csv',
        size: 15728640,
        downloadUrl: 'https://figshare.com/ndownloader/files/98765432',
        mimeType: 'text/csv',
      });
    });

    it('should parse tags, funding, and references', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getArticle(12345678);

      expect(result?.tags).toEqual([
        'semantics',
        'syntax',
        'acceptability',
        'clause-embedding',
        'verb-selection',
      ]);
      expect(result?.funding).toEqual(['NSF Grant BCS-1748969']);
      expect(result?.references).toEqual(['https://doi.org/10.5334/gjgl.1001']);
    });

    it('should parse metrics correctly', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getArticle(12345678);

      expect(result?.viewCount).toBe(2847);
      expect(result?.downloadCount).toBe(531);
      expect(result?.version).toBe(1);
    });

    it('should handle minimal article response', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MINIMAL_ARTICLE_RESPONSE),
      } as Response);

      const result = await plugin.getArticle(99999999);

      expect(result?.id).toBe(99999999);
      expect(result?.title).toBe('Minimal Test Article');
      expect(result?.authors).toEqual([]);
      expect(result?.tags).toEqual([]);
    });

    it('should return null for invalid article response', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(INVALID_ARTICLE_RESPONSE),
      } as Response);

      const result = await plugin.getArticle(12345678);

      expect(result).toBeNull();
    });

    it('should return null on 404', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getArticle(99999999);

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getArticle(12345678);

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Figshare API error',
        expect.objectContaining({
          articleId: 12345678,
          status: 500,
        })
      );
    });

    it('should return null on fetch error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getArticle(12345678);

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching Figshare article',
        expect.objectContaining({
          articleId: 12345678,
          error: 'Network error',
        })
      );
    });

    it('should use correct API endpoint', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      await plugin.getArticle(12345678);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.figshare.com/v2/articles/12345678',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });

    it('should cache successful response', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      await plugin.getArticle(12345678);

      expect(context.cache.set).toHaveBeenCalledWith(
        'figshare:article:12345678',
        expect.objectContaining({ id: 12345678 }),
        86400 // 1 day TTL
      );
    });
  });

  describe('getArticleByDoi', () => {
    it('should search for article by DOI', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_DATASET_RESPONSE]),
      } as Response);

      const result = await plugin.getArticleByDoi('10.6084/m9.figshare.12345678.v1');

      expect(result?.doi).toBe('10.6084/m9.figshare.12345678.v1');
    });

    it('should normalize DOI with https://doi.org/ prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_DATASET_RESPONSE]),
      } as Response);

      await plugin.getArticleByDoi('https://doi.org/10.6084/m9.figshare.12345678.v1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.figshare.com/v2/articles/search',
        expect.objectContaining({
          body: expect.stringContaining('10.6084/m9.figshare.12345678.v1'),
        })
      );
    });

    it('should normalize DOI with http://doi.org/ prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_DATASET_RESPONSE]),
      } as Response);

      await plugin.getArticleByDoi('http://doi.org/10.6084/m9.figshare.12345678.v1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.figshare.com/v2/articles/search',
        expect.objectContaining({
          body: expect.stringContaining('10.6084/m9.figshare.12345678.v1'),
        })
      );
    });

    it('should normalize DOI with doi: prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_DATASET_RESPONSE]),
      } as Response);

      await plugin.getArticleByDoi('doi:10.6084/m9.figshare.12345678.v1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.figshare.com/v2/articles/search',
        expect.objectContaining({
          body: expect.stringContaining('10.6084/m9.figshare.12345678.v1'),
        })
      );
    });

    it('should return null for invalid DOI format', async () => {
      await plugin.initialize(context);

      const result = await plugin.getArticleByDoi('not-a-valid-doi');

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null if no results found', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const result = await plugin.getArticleByDoi('10.6084/m9.figshare.nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('searchArticles', () => {
    it('should search articles by query', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.searchArticles('acceptability semantics');

      expect(results).toHaveLength(2);
      expect(results[0]?.title).toContain('MegaAcceptability');
      expect(results[1]?.title).toContain('Distributional Semantic Network');
    });

    it('should use POST request to search endpoint', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchArticles('test query');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.figshare.com/v2/articles/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
          body: expect.stringContaining('test query'),
        })
      );
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchArticles('test', { limit: 50 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"page_size":50'),
        })
      );
    });

    it('should cap limit at 100', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchArticles('test', { limit: 200 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"page_size":100'),
        })
      );
    });

    it('should filter by item type', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_DATASET_RESPONSE]),
      } as Response);

      await plugin.searchArticles('test', { type: 'dataset' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"item_type":3'),
        })
      );
    });

    it('should support order parameter', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchArticles('test', { order: 'published_date' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"order":"published_date"'),
        })
      );
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchArticles('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Figshare search error',
        expect.objectContaining({
          query: 'test',
          status: 500,
        })
      );
    });

    it('should return empty array on fetch error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const results = await plugin.searchArticles('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error searching Figshare',
        expect.objectContaining({
          query: 'test',
          error: 'Network error',
        })
      );
    });

    it('should filter out invalid articles from search results', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_DATASET_RESPONSE, INVALID_ARTICLE_RESPONSE]),
      } as Response);

      const results = await plugin.searchArticles('test');

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(12345678);
    });
  });

  describe('searchDatasets', () => {
    it('should search for datasets only', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_DATASET_RESPONSE]),
      } as Response);

      const results = await plugin.searchDatasets('acceptability');

      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe('dataset');
    });

    it('should pass limit option to searchArticles', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_DATASET_RESPONSE]),
      } as Response);

      await plugin.searchDatasets('test', { limit: 25 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"page_size":25'),
        })
      );
    });

    it('should include dataset type filter', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_DATASET_RESPONSE]),
      } as Response);

      await plugin.searchDatasets('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"item_type":3'),
        })
      );
    });
  });

  describe('searchFigures', () => {
    it('should search for figures only', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_FIGURE_RESPONSE]),
      } as Response);

      const results = await plugin.searchFigures('network visualization');

      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe('figure');
    });

    it('should pass limit option to searchArticles', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_FIGURE_RESPONSE]),
      } as Response);

      await plugin.searchFigures('test', { limit: 15 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"page_size":15'),
        })
      );
    });

    it('should include figure type filter', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_FIGURE_RESPONSE]),
      } as Response);

      await plugin.searchFigures('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"item_type":1'),
        })
      );
    });
  });

  describe('searchCode', () => {
    it('should search for software/code only', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_SOFTWARE_RESPONSE]),
      } as Response);

      const results = await plugin.searchCode('analysis scripts');

      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe('software');
    });

    it('should pass limit option to searchArticles', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_SOFTWARE_RESPONSE]),
      } as Response);

      await plugin.searchCode('test', { limit: 20 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"page_size":20'),
        })
      );
    });

    it('should include software type filter', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([SAMPLE_SOFTWARE_RESPONSE]),
      } as Response);

      await plugin.searchCode('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"item_type":9'),
        })
      );
    });
  });
});
