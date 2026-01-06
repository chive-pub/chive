/**
 * Unit tests for ZenodoIntegrationPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ZenodoIntegrationPlugin } from '../../../../src/plugins/builtin/zenodo-integration.js';
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
// Sample Data (based on Zenodo API v1)
// ============================================================================

/**
 * Sample Zenodo record for computational linguistics software.
 *
 * Based on real Zenodo API response structure.
 * Example: Universal Decompositional Semantics toolkit.
 */
const SAMPLE_RECORD_DECOMP = {
  id: 5678901,
  conceptrecid: 5678900,
  doi: '10.5281/zenodo.5678901',
  conceptdoi: '10.5281/zenodo.5678900',
  metadata: {
    title: 'Decomp: Universal Decompositional Semantics Toolkit',
    description:
      'Python toolkit for working with Universal Decompositional Semantics annotations. Provides data structures, loading utilities, and analysis tools for semantic annotation datasets.',
    resource_type: {
      type: 'software',
      subtype: 'code',
    },
    creators: [
      {
        name: 'Aaron Steven White',
        orcid: '0000-0003-0057-9246',
        affiliation: 'University of Rochester',
      },
      {
        name: 'Kyle Rawlins',
        affiliation: 'Johns Hopkins University',
      },
    ],
    publication_date: '2020-05-15',
    keywords: ['computational semantics', 'natural language processing', 'linguistics', 'python'],
    license: {
      id: 'MIT',
      title: 'MIT License',
      url: 'https://opensource.org/licenses/MIT',
    },
    related_identifiers: [
      {
        identifier: 'https://github.com/decompositional-semantics-initiative/decomp',
        relation: 'isSupplementTo',
        resource_type: 'software',
        scheme: 'url',
      },
      {
        identifier: '10.5334/gjgl.1001',
        relation: 'isSupplementTo',
        resource_type: 'publication-article',
        scheme: 'doi',
      },
    ],
    access_right: 'open',
    version: 'v0.3.0',
  },
  files: [
    {
      key: 'decomp-v0.3.0.tar.gz',
      size: 45678901,
      checksum: 'md5:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
      links: {
        self: 'https://zenodo.org/api/files/abc123/decomp-v0.3.0.tar.gz',
      },
    },
    {
      key: 'megaattitude_data.json',
      size: 523456789,
      checksum: 'md5:q6r5s4t3u2v1w0x9y8z7a6b5c4d3e2f1',
      links: {
        self: 'https://zenodo.org/api/files/abc123/megaattitude_data.json',
      },
    },
  ],
  stats: {
    downloads: 3456,
    unique_downloads: 2134,
    views: 8765,
    unique_views: 5432,
    version_downloads: 1234,
    version_unique_downloads: 987,
    version_views: 3456,
    version_unique_views: 2345,
  },
  links: {
    self: 'https://zenodo.org/api/records/5678901',
    html: 'https://zenodo.org/record/5678901',
    doi: 'https://doi.org/10.5281/zenodo.5678901',
    latest: 'https://zenodo.org/api/records/5678901',
    latest_html: 'https://zenodo.org/record/5678901',
  },
  state: 'done',
  created: '2020-05-15T10:30:00.000000+00:00',
  updated: '2020-05-15T10:45:00.000000+00:00',
};

/**
 * Sample Zenodo record for ecological research dataset.
 *
 * Example: Bird migration tracking data from field research.
 */
const SAMPLE_RECORD_ECOLOGY = {
  id: 7654321,
  conceptrecid: 7654320,
  doi: '10.5281/zenodo.7654321',
  conceptdoi: '10.5281/zenodo.7654320',
  metadata: {
    title: 'Bird Migration Tracking Data 2020-2023: Northern Hemisphere',
    description:
      'GPS tracking data from 245 individual birds across 12 migratory species in the Northern Hemisphere. Data collected from 2020-2023 as part of the Global Migration Study. Includes coordinates, timestamps, and environmental metadata.',
    resource_type: {
      type: 'dataset',
    },
    creators: [
      {
        name: 'Elena Vasquez',
        orcid: '0000-0001-9876-5432',
        affiliation: 'Cornell Lab of Ornithology',
      },
      {
        name: 'James Thompson',
        affiliation: 'University of Oxford',
      },
    ],
    publication_date: '2024-01-10',
    keywords: ['ornithology', 'migration', 'GPS tracking', 'ecology', 'birds'],
    license: {
      id: 'CC-BY-4.0',
      title: 'Creative Commons Attribution 4.0 International',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    related_identifiers: [
      {
        identifier: '10.1111/jav.02345',
        relation: 'isSupplementTo',
        resource_type: 'publication-article',
        scheme: 'doi',
      },
    ],
    access_right: 'open',
    version: 'v1.0',
  },
  files: [
    {
      key: 'migration_data_2020_2023.csv',
      size: 125678901,
      checksum: 'md5:z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4',
      links: {
        self: 'https://zenodo.org/api/files/xyz789/migration_data_2020_2023.csv',
      },
    },
    {
      key: 'metadata.json',
      size: 456789,
      checksum: 'md5:j3i2h1g0f9e8d7c6b5a4z3y2x1w0v9u8',
      links: {
        self: 'https://zenodo.org/api/files/xyz789/metadata.json',
      },
    },
  ],
  stats: {
    downloads: 567,
    unique_downloads: 423,
    views: 1234,
    unique_views: 876,
    version_downloads: 567,
    version_unique_downloads: 423,
    version_views: 1234,
    version_unique_views: 876,
  },
  links: {
    self: 'https://zenodo.org/api/records/7654321',
    html: 'https://zenodo.org/record/7654321',
    doi: 'https://doi.org/10.5281/zenodo.7654321',
    latest: 'https://zenodo.org/api/records/7654321',
    latest_html: 'https://zenodo.org/record/7654321',
  },
  state: 'done',
  created: '2024-01-10T14:20:00.000000+00:00',
  updated: '2024-01-10T14:35:00.000000+00:00',
};

/**
 * Sample Zenodo record for climate model output.
 *
 * Example: Climate simulation data with restricted access.
 */
const SAMPLE_RECORD_CLIMATE = {
  id: 8765432,
  conceptrecid: 8765430,
  doi: '10.5281/zenodo.8765432',
  metadata: {
    title: 'High-Resolution Climate Model Output: Arctic Region 2100',
    description:
      'Climate simulation outputs from CMIP6 models for the Arctic region, projecting conditions through 2100. Includes temperature, precipitation, sea ice extent, and atmospheric circulation patterns.',
    resource_type: {
      type: 'dataset',
      subtype: 'model',
    },
    creators: [
      {
        name: 'Arctic Climate Research Consortium',
      },
    ],
    publication_date: '2023-11-30',
    keywords: ['climate change', 'arctic', 'CMIP6', 'modeling'],
    license: {
      id: 'CC-BY-NC-4.0',
      title: 'Creative Commons Attribution Non Commercial 4.0 International',
      url: 'https://creativecommons.org/licenses/by-nc/4.0/',
    },
    access_right: 'embargoed',
  },
  links: {
    self: 'https://zenodo.org/api/records/8765432',
    html: 'https://zenodo.org/record/8765432',
    doi: 'https://doi.org/10.5281/zenodo.8765432',
  },
  state: 'done',
  created: '2023-11-30T09:00:00.000000+00:00',
  updated: '2023-11-30T09:15:00.000000+00:00',
};

/**
 * Sample Zenodo search response for software.
 */
const SAMPLE_SEARCH_RESPONSE_SOFTWARE = {
  hits: {
    total: 2,
    hits: [
      SAMPLE_RECORD_DECOMP,
      {
        id: 5678902,
        conceptrecid: 5678900,
        doi: '10.5281/zenodo.5678902',
        metadata: {
          title: 'Decomp Toolkit - Previous Version',
          resource_type: {
            type: 'software',
          },
          creators: [
            {
              name: 'Aaron Steven White',
            },
          ],
          publication_date: '2020-01-15',
          access_right: 'open',
          version: 'v0.2.0',
        },
        links: {
          self: 'https://zenodo.org/api/records/5678902',
          html: 'https://zenodo.org/record/5678902',
          doi: 'https://doi.org/10.5281/zenodo.5678902',
        },
        state: 'done',
        created: '2020-01-15T10:00:00.000000+00:00',
        updated: '2020-01-15T10:15:00.000000+00:00',
      },
    ],
  },
};

/**
 * Sample Zenodo search response for datasets.
 */
const SAMPLE_SEARCH_RESPONSE_DATASETS = {
  hits: {
    total: 2,
    hits: [SAMPLE_RECORD_ECOLOGY, SAMPLE_RECORD_CLIMATE],
  },
};

/**
 * Sample Zenodo versions response.
 */
const SAMPLE_VERSIONS_RESPONSE = {
  hits: {
    total: 2,
    hits: [
      SAMPLE_RECORD_DECOMP,
      {
        id: 5678902,
        conceptrecid: 5678900,
        doi: '10.5281/zenodo.5678902',
        conceptdoi: '10.5281/zenodo.5678900',
        metadata: {
          title: 'Decomp: Universal Decompositional Semantics Toolkit',
          resource_type: {
            type: 'software',
          },
          creators: [
            {
              name: 'Aaron Steven White',
            },
          ],
          publication_date: '2020-01-15',
          access_right: 'open',
          version: 'v0.2.0',
        },
        links: {
          self: 'https://zenodo.org/api/records/5678902',
          html: 'https://zenodo.org/record/5678902',
          doi: 'https://doi.org/10.5281/zenodo.5678902',
        },
        state: 'done',
        created: '2020-01-15T10:00:00.000000+00:00',
        updated: '2020-01-15T10:15:00.000000+00:00',
      },
    ],
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('ZenodoIntegrationPlugin', () => {
  let plugin: ZenodoIntegrationPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new ZenodoIntegrationPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.zenodo');
    });

    it('should declare network permissions for Zenodo API', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('zenodo.org');
    });

    it('should have storage permission for caching', () => {
      expect(plugin.manifest.permissions?.storage?.maxSize).toBe(50 * 1024 * 1024);
    });

    it('should have correct manifest metadata', () => {
      expect(plugin.manifest.name).toBe('Zenodo Integration');
      expect(plugin.manifest.version).toBe('0.1.0');
      expect(plugin.manifest.author).toBe('Aaron Steven White');
      expect(plugin.manifest.license).toBe('MIT');
      expect(plugin.manifest.id).toBe('pub.chive.plugin.zenodo');
    });

    it('should have correct entrypoint', () => {
      expect(plugin.manifest.entrypoint).toBe('zenodo-integration.js');
    });
  });

  describe('initialize', () => {
    it('should log initialization info with rate limit', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Zenodo plugin initialized',
        expect.objectContaining({
          rateLimit: '1000ms between requests',
        })
      );
    });
  });

  describe('getRecord', () => {
    it('should return cached record if available', async () => {
      await plugin.initialize(context);
      const cachedRecord = {
        id: 5678901,
        conceptRecId: 5678900,
        doi: '10.5281/zenodo.5678901',
        title: 'Cached Record',
        resourceType: { type: 'software' },
        creators: [],
        publicationDate: '2023-08-15',
        accessRight: 'open' as const,
        links: {
          self: 'https://zenodo.org/api/records/5678901',
          html: 'https://zenodo.org/record/5678901',
          doi: 'https://doi.org/10.5281/zenodo.5678901',
        },
        state: 'done' as const,
        created: '2023-08-15T10:30:00.000000+00:00',
        updated: '2023-08-15T10:45:00.000000+00:00',
        source: 'zenodo' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedRecord);

      const result = await plugin.getRecord(5678901);

      expect(result).toEqual(cachedRecord);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result?.id).toBe(5678901);
      expect(result?.doi).toBe('10.5281/zenodo.5678901');
      expect(result?.title).toBe('Decomp: Universal Decompositional Semantics Toolkit');
      expect(result?.source).toBe('zenodo');
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should include complete metadata from API response', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result?.conceptRecId).toBe(5678900);
      expect(result?.conceptDoi).toBe('10.5281/zenodo.5678900');
      expect(result?.description).toContain('Universal Decompositional Semantics');
      expect(result?.resourceType.type).toBe('software');
      expect(result?.resourceType.subtype).toBe('code');
      expect(result?.publicationDate).toBe('2020-05-15');
      expect(result?.version).toBe('v0.3.0');
      expect(result?.accessRight).toBe('open');
      expect(result?.state).toBe('done');
    });

    it('should parse creators with ORCID and affiliations', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result?.creators).toHaveLength(2);
      expect(result?.creators[0]?.name).toBe('Aaron Steven White');
      expect(result?.creators[0]?.orcid).toBe('0000-0003-0057-9246');
      expect(result?.creators[0]?.affiliation).toBe('University of Rochester');
      expect(result?.creators[1]?.name).toBe('Kyle Rawlins');
      expect(result?.creators[1]?.affiliation).toBe('Johns Hopkins University');
    });

    it('should parse keywords', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result?.keywords).toContain('computational semantics');
      expect(result?.keywords).toContain('natural language processing');
      expect(result?.keywords).toContain('linguistics');
      expect(result?.keywords).toContain('python');
    });

    it('should parse license information', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result?.license?.id).toBe('MIT');
      expect(result?.license?.title).toBe('MIT License');
      expect(result?.license?.url).toBe('https://opensource.org/licenses/MIT');
    });

    it('should parse related identifiers', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result?.relatedIdentifiers).toHaveLength(2);
      expect(result?.relatedIdentifiers?.[0]?.identifier).toBe(
        'https://github.com/decompositional-semantics-initiative/decomp'
      );
      expect(result?.relatedIdentifiers?.[0]?.relation).toBe('isSupplementTo');
      expect(result?.relatedIdentifiers?.[0]?.resourceType).toBe('software');
      expect(result?.relatedIdentifiers?.[1]?.identifier).toBe('10.5334/gjgl.1001');
    });

    it('should parse file metadata', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result?.files).toHaveLength(2);
      expect(result?.files?.[0]?.key).toBe('decomp-v0.3.0.tar.gz');
      expect(result?.files?.[0]?.size).toBe(45678901);
      expect(result?.files?.[0]?.checksum).toBe('md5:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');
      expect(result?.files?.[0]?.links.self).toContain('zenodo.org/api/files');
    });

    it('should parse statistics', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result?.stats?.downloads).toBe(3456);
      expect(result?.stats?.uniqueDownloads).toBe(2134);
      expect(result?.stats?.views).toBe(8765);
      expect(result?.stats?.uniqueViews).toBe(5432);
      expect(result?.stats?.version_downloads).toBe(1234);
    });

    it('should parse links', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result?.links.self).toBe('https://zenodo.org/api/records/5678901');
      expect(result?.links.html).toBe('https://zenodo.org/record/5678901');
      expect(result?.links.doi).toBe('https://doi.org/10.5281/zenodo.5678901');
      expect(result?.links.latest).toBe('https://zenodo.org/api/records/5678901');
      expect(result?.links.latest_html).toBe('https://zenodo.org/record/5678901');
    });

    it('should return null on 404', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getRecord(9999999);

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getRecord(5678901);

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Zenodo API error',
        expect.objectContaining({ recordId: 5678901 })
      );
    });

    it('should handle fetch errors gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await plugin.getRecord(5678901);

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error fetching Zenodo record',
        expect.objectContaining({ error: 'Network error' })
      );
    });

    it('should use correct API endpoint', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      await plugin.getRecord(5678901);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://zenodo.org/api/records/5678901',
        expect.objectContaining({
          headers: {
            Accept: 'application/json',
          },
        })
      );
    });
  });

  describe('getRecordByDoi', () => {
    it('should extract record ID from Zenodo DOI', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const result = await plugin.getRecordByDoi('10.5281/zenodo.5678901');

      expect(result?.id).toBe(5678901);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://zenodo.org/api/records/5678901',
        expect.any(Object)
      );
    });

    it('should fallback to search for non-Zenodo DOI', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            hits: {
              total: 1,
              hits: [SAMPLE_RECORD_ECOLOGY],
            },
          }),
      } as Response);

      const result = await plugin.getRecordByDoi('10.1234/other-doi');

      expect(result?.id).toBe(7654321);
      // URL-encoded: doi%3A10.1234%2Fother-doi
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/doi.*10\.1234.*other-doi/),
        expect.any(Object)
      );
    });

    it('should return null if DOI not found', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            hits: {
              total: 0,
              hits: [],
            },
          }),
      } as Response);

      const result = await plugin.getRecordByDoi('10.1234/nonexistent');

      expect(result).toBeNull();
    });

    it('should return cached record if available', async () => {
      await plugin.initialize(context);
      const cachedRecord = {
        id: 5678901,
        conceptRecId: 5678900,
        doi: '10.5281/zenodo.5678901',
        title: 'Cached Record',
        resourceType: { type: 'software' },
        creators: [],
        publicationDate: '2023-08-15',
        accessRight: 'open' as const,
        links: {
          self: 'https://zenodo.org/api/records/5678901',
          html: 'https://zenodo.org/record/5678901',
          doi: 'https://doi.org/10.5281/zenodo.5678901',
        },
        state: 'done' as const,
        created: '2023-08-15T10:30:00.000000+00:00',
        updated: '2023-08-15T10:45:00.000000+00:00',
        source: 'zenodo' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedRecord);

      const result = await plugin.getRecordByDoi('10.5281/zenodo.5678901');

      expect(result).toEqual(cachedRecord);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('searchRecords', () => {
    it('should search for records', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      const results = await plugin.searchRecords('decompositional semantics');

      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe(5678901);
      expect(results[0]?.title).toContain('Decomp');
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      await plugin.searchRecords('test', { limit: 20 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('size=20'),
        expect.any(Object)
      );
    });

    it('should cap limit at 100', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      await plugin.searchRecords('test', { limit: 500 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('size=100'),
        expect.any(Object)
      );
    });

    it('should default to limit of 10', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      await plugin.searchRecords('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('size=10'),
        expect.any(Object)
      );
    });

    it('should filter by type', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      await plugin.searchRecords('machine learning', { type: 'software' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=software'),
        expect.any(Object)
      );
    });

    it('should filter by subtype', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      await plugin.searchRecords('code', { type: 'software', subtype: 'code' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('subtype=code'),
        expect.any(Object)
      );
    });

    it('should support sort option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      await plugin.searchRecords('test', { sort: 'mostrecent' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=mostrecent'),
        expect.any(Object)
      );
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchRecords('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith('Zenodo search error', expect.any(Object));
    });

    it('should handle fetch errors gracefully', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const results = await plugin.searchRecords('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Error searching Zenodo',
        expect.objectContaining({ error: 'Network error' })
      );
    });

    it('should skip invalid records in search results', async () => {
      await plugin.initialize(context);
      const responseWithInvalidRecord = {
        hits: {
          total: 2,
          hits: [
            SAMPLE_RECORD_DECOMP,
            {
              id: 123,
              // Missing required fields (metadata with title, doi)
              links: {},
            },
          ],
        },
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithInvalidRecord),
      } as Response);

      const results = await plugin.searchRecords('test');

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(5678901);
    });
  });

  describe('getVersions', () => {
    it('should fetch all versions by concept ID', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_VERSIONS_RESPONSE),
      } as Response);

      const results = await plugin.getVersions(5678900);

      expect(results).toHaveLength(2);
      expect(results[0]?.conceptRecId).toBe(5678900);
      expect(results[1]?.conceptRecId).toBe(5678900);
    });

    it('should sort by version descending', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_VERSIONS_RESPONSE),
      } as Response);

      await plugin.getVersions(5678900);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=-version'),
        expect.any(Object)
      );
    });

    it('should search by conceptrecid', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_VERSIONS_RESPONSE),
      } as Response);

      await plugin.getVersions(5678900);

      // URL-encoded: conceptrecid%3A5678900
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/conceptrecid.*5678900/),
        expect.any(Object)
      );
    });

    it('should limit to 100 results', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_VERSIONS_RESPONSE),
      } as Response);

      await plugin.getVersions(5678900);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('size=100'),
        expect.any(Object)
      );
    });
  });

  describe('searchSoftware', () => {
    it('should search for software records', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      const results = await plugin.searchSoftware('machine learning');

      expect(results).toHaveLength(2);
      expect(results[0]?.resourceType.type).toBe('software');
    });

    it('should set type=software parameter', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      await plugin.searchSoftware('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=software'),
        expect.any(Object)
      );
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_SOFTWARE),
      } as Response);

      await plugin.searchSoftware('test', { limit: 25 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('size=25'),
        expect.any(Object)
      );
    });
  });

  describe('searchDatasets', () => {
    it('should search for dataset records', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_DATASETS),
      } as Response);

      const results = await plugin.searchDatasets('ecology');

      expect(results).toHaveLength(2);
      expect(results[0]?.resourceType.type).toBe('dataset');
    });

    it('should set type=dataset parameter', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_DATASETS),
      } as Response);

      await plugin.searchDatasets('test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=dataset'),
        expect.any(Object)
      );
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE_DATASETS),
      } as Response);

      await plugin.searchDatasets('test', { limit: 30 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('size=30'),
        expect.any(Object)
      );
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limit between requests', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const start = Date.now();
      await plugin.getRecord(5678901);
      await plugin.getRecord(5678902);
      const elapsed = Date.now() - start;

      // Should take at least 1000ms between requests
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });

    it('should not delay first request', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      const start = Date.now();
      await plugin.getRecord(5678901);
      const elapsed = Date.now() - start;

      // First request should not be delayed
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('API response parsing', () => {
    it('should handle record without optional fields', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const minimalRecord = {
        id: 123456,
        doi: '10.5281/zenodo.123456',
        metadata: {
          title: 'Minimal Record',
          resource_type: {
            type: 'other',
          },
          creators: [
            {
              name: 'Test Creator',
            },
          ],
          publication_date: '2024-01-01',
          access_right: 'open',
        },
        links: {
          self: 'https://zenodo.org/api/records/123456',
          html: 'https://zenodo.org/record/123456',
          doi: 'https://doi.org/10.5281/zenodo.123456',
        },
        state: 'done',
        created: '2024-01-01T00:00:00.000000+00:00',
        updated: '2024-01-01T00:00:00.000000+00:00',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(minimalRecord),
      } as Response);

      const result = await plugin.getRecord(123456);

      expect(result?.id).toBe(123456);
      expect(result?.title).toBe('Minimal Record');
      expect(result?.conceptRecId).toBe(123456); // Falls back to id
      expect(result?.keywords).toBeUndefined();
      expect(result?.license).toBeUndefined();
      expect(result?.files).toBeUndefined();
      expect(result?.stats).toBeUndefined();
    });

    it('should return null if record missing required ID', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const invalidRecord = {
        doi: '10.5281/zenodo.123456',
        metadata: {
          title: 'Invalid Record',
        },
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidRecord),
      } as Response);

      const result = await plugin.getRecord(123456);

      expect(result).toBeNull();
    });

    it('should return null if record missing required title', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const invalidRecord = {
        id: 123456,
        doi: '10.5281/zenodo.123456',
        metadata: {
          // Missing title
          resource_type: {
            type: 'other',
          },
        },
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidRecord),
      } as Response);

      const result = await plugin.getRecord(123456);

      expect(result).toBeNull();
    });

    it('should return null if record missing required DOI', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const invalidRecord = {
        id: 123456,
        metadata: {
          title: 'Invalid Record',
        },
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidRecord),
      } as Response);

      const result = await plugin.getRecord(123456);

      expect(result).toBeNull();
    });

    it('should handle creator without name', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const recordWithUnnamedCreator = {
        id: 123456,
        doi: '10.5281/zenodo.123456',
        metadata: {
          title: 'Test Record',
          creators: [
            {
              orcid: '0000-0001-2345-6789',
            },
          ],
          publication_date: '2024-01-01',
          access_right: 'open',
        },
        links: {
          self: 'https://zenodo.org/api/records/123456',
          html: 'https://zenodo.org/record/123456',
          doi: 'https://doi.org/10.5281/zenodo.123456',
        },
        state: 'done',
        created: '2024-01-01T00:00:00.000000+00:00',
        updated: '2024-01-01T00:00:00.000000+00:00',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(recordWithUnnamedCreator),
      } as Response);

      const result = await plugin.getRecord(123456);

      expect(result?.creators[0]?.name).toBe('Unknown');
      expect(result?.creators[0]?.orcid).toBe('0000-0001-2345-6789');
    });

    it('should handle different access rights', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_CLIMATE),
      } as Response);

      const result = await plugin.getRecord(8765432);

      expect(result?.accessRight).toBe('embargoed');
    });
  });

  describe('caching', () => {
    it('should cache records with correct TTL', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_DECOMP),
      } as Response);

      await plugin.getRecord(5678901);

      expect(context.cache.set).toHaveBeenCalledWith(
        'zenodo:record:5678901',
        expect.any(Object),
        86400 // 1 day
      );
    });

    it('should use correct cache key format', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_RECORD_ECOLOGY),
      } as Response);

      await plugin.getRecord(7654321);

      expect(context.cache.get).toHaveBeenCalledWith('zenodo:record:7654321');
      expect(context.cache.set).toHaveBeenCalledWith(
        'zenodo:record:7654321',
        expect.any(Object),
        86400
      );
    });

    it('should not cache if API returns error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await plugin.getRecord(5678901);

      expect(context.cache.set).not.toHaveBeenCalled();
    });

    it('should not cache if parsing returns null', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      const invalidRecord = {
        id: 123456,
        // Missing required fields
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidRecord),
      } as Response);

      await plugin.getRecord(123456);

      expect(context.cache.set).not.toHaveBeenCalled();
    });
  });
});
