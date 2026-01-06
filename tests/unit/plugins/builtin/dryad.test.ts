/**
 * Unit tests for DryadPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DryadPlugin } from '../../../../src/plugins/builtin/dryad.js';
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
// Sample Data (based on Dryad API)
// ============================================================================

/**
 * Sample Dryad dataset response.
 *
 * Based on real Dryad API response structure for a climate change dataset.
 * Example: "Global patterns of terrestrial nitrogen and phosphorus limitation"
 */
const SAMPLE_DATASET_RESPONSE = {
  identifier: 'doi:10.5061/dryad.7wm37pvsb',
  id: 285697,
  doi: '10.5061/dryad.7wm37pvsb',
  title: 'Global patterns of terrestrial nitrogen and phosphorus limitation',
  abstract:
    'Nitrogen (N) and phosphorus (P) are essential nutrients for plant growth, and their availability can limit primary productivity in terrestrial ecosystems. We compiled a global database of plant tissue nutrient concentrations and resorption efficiencies from published studies to examine the patterns of N and P limitation across different biomes.',
  authors: [
    {
      firstName: 'Yao',
      lastName: 'Du',
      orcid: 'https://orcid.org/0000-0002-8890-7846',
      affiliation: 'Institute of Geographic Sciences and Natural Resources Research, CAS',
    },
    {
      firstName: 'Zhiyao',
      lastName: 'Tang',
      orcid: 'https://orcid.org/0000-0001-9477-3490',
      affiliation: 'Peking University',
    },
    {
      firstName: 'Jingyun',
      lastName: 'Fang',
      affiliation: 'Peking University',
    },
  ],
  keywords: [
    'nitrogen limitation',
    'phosphorus limitation',
    'nutrient resorption',
    'terrestrial ecosystems',
    'global patterns',
  ],
  relatedWorks: [
    {
      relationship: 'IsSupplementTo',
      identifierType: 'DOI',
      identifier: '10.1038/s41561-020-0530-4',
    },
  ],
  license: 'CC0 1.0',
  storageSize: 245678901,
  versionNumber: 2,
  publicationDate: '2020-01-20',
  lastModificationDate: '2020-02-15',
  curationStatus: 'published',
  sharingLink: 'https://datadryad.org/stash/dataset/doi:10.5061/dryad.7wm37pvsb',
};

/**
 * Sample Dryad search response.
 */
const SAMPLE_SEARCH_RESPONSE = {
  count: 1,
  _embedded: {
    'stash:datasets': [SAMPLE_DATASET_RESPONSE],
  },
  _links: {
    next: {
      href: 'https://datadryad.org/api/v2/search?page=2',
    },
  },
};

/**
 * Sample dataset with minimal fields.
 */
const MINIMAL_DATASET_RESPONSE = {
  identifier: 'doi:10.5061/dryad.minimal',
  doi: '10.5061/dryad.minimal',
  title: 'Minimal Dataset',
};

/**
 * Sample dataset with related publication as primary publication.
 */
const DATASET_WITH_PRIMARY_PUB = {
  identifier: 'doi:10.5061/dryad.primary',
  doi: '10.5061/dryad.primary',
  title: 'Dataset with Primary Publication',
  authors: [],
  relatedWorks: [
    {
      relationship: 'IsPrimaryPublicationOf',
      identifierType: 'DOI',
      identifier: '10.1371/journal.pbio.3001234',
    },
  ],
};

// ============================================================================
// Tests
// ============================================================================

describe('DryadPlugin', () => {
  let plugin: DryadPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new DryadPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.dryad');
    });

    it('should declare network permissions for Dryad API', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('datadryad.org');
    });

    it('should have correct manifest properties', () => {
      expect(plugin.manifest).toMatchObject({
        id: 'pub.chive.plugin.dryad',
        name: 'Dryad Integration',
        version: '0.1.0',
        description: 'Provides research data linking via Dryad',
        author: 'Aaron Steven White',
        license: 'MIT',
      });
    });

    it('should declare storage limit', () => {
      expect(plugin.manifest.permissions?.storage?.maxSize).toBe(30 * 1024 * 1024);
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Dryad plugin initialized',
        expect.objectContaining({
          rateLimit: '500ms between requests',
        })
      );
    });
  });

  describe('getDataset', () => {
    it('should return cached dataset if available', async () => {
      await plugin.initialize(context);
      const cachedDataset = {
        id: 'doi:10.5061/dryad.cached',
        doi: '10.5061/dryad.cached',
        title: 'Cached Dataset',
        authors: [],
        license: 'CC0 1.0',
        totalSize: 0,
        fileCount: 0,
        versionNumber: 1,
        sharingLink: 'https://datadryad.org/stash/dataset/doi:10.5061/dryad.cached',
        source: 'dryad' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedDataset);

      const result = await plugin.getDataset('doi:10.5061/dryad.cached');

      expect(result).toEqual(cachedDataset);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getDataset('doi:10.5061/dryad.7wm37pvsb');

      expect(result?.doi).toBe('10.5061/dryad.7wm37pvsb');
      expect(result?.title).toContain('nitrogen and phosphorus');
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should parse dataset with all fields', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getDataset('doi:10.5061/dryad.7wm37pvsb');

      expect(result).toMatchObject({
        id: 'doi:10.5061/dryad.7wm37pvsb',
        doi: '10.5061/dryad.7wm37pvsb',
        title: 'Global patterns of terrestrial nitrogen and phosphorus limitation',
        abstract: expect.stringContaining('Nitrogen (N) and phosphorus (P)'),
        license: 'CC0 1.0',
        totalSize: 245678901,
        versionNumber: 2,
        publicationDate: '2020-01-20',
        lastModificationDate: '2020-02-15',
        curationStatus: 'published',
        sharingLink: 'https://datadryad.org/stash/dataset/doi:10.5061/dryad.7wm37pvsb',
        source: 'dryad',
      });
    });

    it('should parse authors with ORCID', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getDataset('doi:10.5061/dryad.7wm37pvsb');

      expect(result?.authors).toHaveLength(3);
      expect(result?.authors[0]).toMatchObject({
        firstName: 'Yao',
        lastName: 'Du',
        orcid: 'https://orcid.org/0000-0002-8890-7846',
        affiliation: 'Institute of Geographic Sciences and Natural Resources Research, CAS',
      });
    });

    it('should parse keywords', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getDataset('doi:10.5061/dryad.7wm37pvsb');

      expect(result?.keywords).toContain('nitrogen limitation');
      expect(result?.keywords).toContain('phosphorus limitation');
    });

    it('should parse related publication', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getDataset('doi:10.5061/dryad.7wm37pvsb');

      expect(result?.relatedPublication).toMatchObject({
        type: 'IsSupplementTo',
        identifier: '10.1038/s41561-020-0530-4',
        identifierType: 'DOI',
      });
    });

    it('should handle primary publication relationship', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DATASET_WITH_PRIMARY_PUB),
      } as Response);

      const result = await plugin.getDataset('doi:10.5061/dryad.primary');

      expect(result?.relatedPublication).toMatchObject({
        type: 'IsPrimaryPublicationOf',
        identifier: '10.1371/journal.pbio.3001234',
        identifierType: 'DOI',
      });
    });

    it('should handle minimal dataset response', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MINIMAL_DATASET_RESPONSE),
      } as Response);

      const result = await plugin.getDataset('doi:10.5061/dryad.minimal');

      expect(result).toMatchObject({
        id: 'doi:10.5061/dryad.minimal',
        doi: '10.5061/dryad.minimal',
        title: 'Minimal Dataset',
        authors: [],
        license: 'CC0 1.0',
        totalSize: 0,
        fileCount: 0,
        versionNumber: 1,
        source: 'dryad',
      });
    });

    it('should return null for 404', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getDataset('doi:10.5061/dryad.nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getDataset('doi:10.5061/dryad.7wm37pvsb');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Dryad API error',
        expect.objectContaining({
          datasetId: 'doi:10.5061/dryad.7wm37pvsb',
          status: 500,
        })
      );
    });

    it('should return null on fetch exception', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getDataset('doi:10.5061/dryad.7wm37pvsb');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching Dryad dataset',
        expect.objectContaining({
          error: 'Network error',
        })
      );
    });

    it('should cache successful results', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      await plugin.getDataset('doi:10.5061/dryad.7wm37pvsb');

      expect(context.cache.set).toHaveBeenCalledWith(
        'dryad:dataset:doi:10.5061/dryad.7wm37pvsb',
        expect.objectContaining({
          doi: '10.5061/dryad.7wm37pvsb',
        }),
        86400 // 1 day TTL
      );
    });

    it('should return null for dataset without identifier or DOI', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response);

      const result = await plugin.getDataset('invalid');

      expect(result).toBeNull();
    });
  });

  describe('getDatasetByDoi', () => {
    it('should normalize DOI and search', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const result = await plugin.getDatasetByDoi('10.5061/dryad.7wm37pvsb');

      expect(result?.doi).toBe('10.5061/dryad.7wm37pvsb');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('doi%3A%2210.5061%2Fdryad.7wm37pvsb%22'),
        expect.any(Object)
      );
    });

    it('should normalize DOI with https://doi.org/ prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.getDatasetByDoi('https://doi.org/10.5061/dryad.7wm37pvsb');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('doi%3A%2210.5061%2Fdryad.7wm37pvsb%22'),
        expect.any(Object)
      );
    });

    it('should normalize DOI with http://doi.org/ prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.getDatasetByDoi('http://doi.org/10.5061/dryad.7wm37pvsb');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('doi%3A%2210.5061%2Fdryad.7wm37pvsb%22'),
        expect.any(Object)
      );
    });

    it('should normalize DOI with doi: prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.getDatasetByDoi('doi:10.5061/dryad.7wm37pvsb');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('doi%3A%2210.5061%2Fdryad.7wm37pvsb%22'),
        expect.any(Object)
      );
    });

    it('should return null for invalid DOI format', async () => {
      await plugin.initialize(context);

      const result = await plugin.getDatasetByDoi('not-a-valid-doi');

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null if no results found', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 0,
            _embedded: {
              'stash:datasets': [],
            },
          }),
      } as Response);

      const result = await plugin.getDatasetByDoi('10.5061/dryad.nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('searchDatasets', () => {
    it('should search datasets by query', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.searchDatasets('nitrogen phosphorus');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        doi: '10.5061/dryad.7wm37pvsb',
        title: expect.stringContaining('nitrogen and phosphorus'),
      });
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchDatasets('climate', { limit: 50 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=50'),
        expect.any(Object)
      );
    });

    it('should cap limit at 100', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchDatasets('climate', { limit: 200 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=100'),
        expect.any(Object)
      );
    });

    it('should respect page option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchDatasets('climate', { page: 3 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=3'),
        expect.any(Object)
      );
    });

    it('should default to page 1 and limit 10', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchDatasets('climate');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/per_page=10.*page=1|page=1.*per_page=10/),
        expect.any(Object)
      );
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchDatasets('climate');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Dryad search error',
        expect.objectContaining({
          query: 'climate',
          status: 500,
        })
      );
    });

    it('should return empty array on fetch exception', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const results = await plugin.searchDatasets('climate');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error searching Dryad',
        expect.objectContaining({
          error: 'Network error',
        })
      );
    });

    it('should handle empty results', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 0,
            _embedded: {
              'stash:datasets': [],
            },
          }),
      } as Response);

      const results = await plugin.searchDatasets('nonexistent query');

      expect(results).toEqual([]);
    });

    it('should handle missing _embedded field', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 0,
          }),
      } as Response);

      const results = await plugin.searchDatasets('test');

      expect(results).toEqual([]);
    });

    it('should filter out invalid datasets', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 2,
            _embedded: {
              'stash:datasets': [
                SAMPLE_DATASET_RESPONSE,
                {}, // Invalid dataset without identifier or DOI
              ],
            },
          }),
      } as Response);

      const results = await plugin.searchDatasets('test');

      expect(results).toHaveLength(1);
      expect(results[0]?.doi).toBe('10.5061/dryad.7wm37pvsb');
    });

    it('should use Accept header', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchDatasets('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });
  });

  describe('findByPublicationDoi', () => {
    it('should search by publication DOI in relatedWorks', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.findByPublicationDoi('10.1038/s41561-020-0530-4');

      expect(results).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('relatedWorks.identifier%3A%2210.1038%2Fs41561-020-0530-4%22'),
        expect.any(Object)
      );
    });

    it('should return empty array if no datasets found', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 0,
            _embedded: {
              'stash:datasets': [],
            },
          }),
      } as Response);

      const results = await plugin.findByPublicationDoi('10.1234/nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limit between requests', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const start = Date.now();
      await plugin.searchDatasets('query1');
      await plugin.searchDatasets('query2');
      const elapsed = Date.now() - start;

      // Should take at least 500ms due to rate limit
      expect(elapsed).toBeGreaterThanOrEqual(450); // Allow some margin
    });

    it('should apply rate limit to getDataset', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DATASET_RESPONSE),
      } as Response);

      const start = Date.now();
      await plugin.getDataset('id1');
      await plugin.getDataset('id2');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(450);
    });
  });

  describe('DOI normalization', () => {
    it('should handle DOI with trailing whitespace', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const result = await plugin.getDatasetByDoi('  10.5061/dryad.7wm37pvsb  ');

      expect(result).not.toBeNull();
    });

    it('should reject DOI not starting with 10.', async () => {
      await plugin.initialize(context);

      const result = await plugin.getDatasetByDoi('99.1234/invalid');

      expect(result).toBeNull();
    });

    it('should reject DOI with invalid format', async () => {
      await plugin.initialize(context);

      const result = await plugin.getDatasetByDoi('10.123'); // Too short after 10.

      expect(result).toBeNull();
    });
  });
});
