/**
 * Unit tests for CrossRefPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CrossRefPlugin } from '../../../../src/plugins/builtin/crossref.js';
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
// Sample Data (based on CrossRef API)
// ============================================================================

/**
 * Sample CrossRef work response.
 *
 * Based on real CrossRef API response structure.
 */
const SAMPLE_WORK_RESPONSE = {
  status: 'ok',
  'message-type': 'work',
  message: {
    DOI: '10.5334/gjgl.1001',
    title: ['Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding'],
    type: 'journal-article',
    author: [
      {
        given: 'Aaron Steven',
        family: 'White',
        ORCID: 'https://orcid.org/0000-0002-4519-6259',
        affiliation: [{ name: 'University of Rochester' }],
        sequence: 'first',
      },
      {
        given: 'Kyle',
        family: 'Rawlins',
        affiliation: [{ name: 'Johns Hopkins University' }],
        sequence: 'additional',
      },
    ],
    'container-title': ['Glossa: a journal of general linguistics'],
    publisher: 'Open Library of Humanities',
    published: {
      'date-parts': [[2020, 5, 29]],
    },
    abstract: 'The MegaAcceptability dataset provides acceptability judgments.',
    subject: ['Linguistics', 'Semantics'],
    'references-count': 45,
    'is-referenced-by-count': 12,
    reference: [
      {
        DOI: '10.1162/tacl_a_00285',
        'article-title': 'Syntactic Data Augmentation',
        author: 'Iyyer',
        year: '2019',
      },
    ],
    license: [
      {
        URL: 'https://creativecommons.org/licenses/by/4.0/',
        start: { 'date-parts': [[2020, 5, 29]] },
        'content-version': 'vor',
      },
    ],
    URL: 'https://doi.org/10.5334/gjgl.1001',
  },
};

/**
 * Sample CrossRef search response.
 */
const SAMPLE_SEARCH_RESPONSE = {
  status: 'ok',
  'message-type': 'work-list',
  message: {
    items: [SAMPLE_WORK_RESPONSE.message],
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('CrossRefPlugin', () => {
  let plugin: CrossRefPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new CrossRefPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.crossref');
    });

    it('should declare network permissions for CrossRef API', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('api.crossref.org');
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'CrossRef plugin initialized',
        expect.objectContaining({
          note: 'Using polite pool with contact email',
        })
      );
    });
  });

  describe('getWork', () => {
    it('should return cached work if available', async () => {
      await plugin.initialize(context);
      const cachedWork = {
        doi: '10.5334/gjgl.1001',
        title: ['Cached Work'],
        type: 'journal-article',
        authors: [],
        source: 'crossref' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedWork);

      const result = await plugin.getWork('10.5334/gjgl.1001');

      expect(result).toEqual(cachedWork);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWork('10.5334/gjgl.1001');

      expect(result?.doi).toBe('10.5334/gjgl.1001');
      expect(result?.title[0]).toContain('Frequency, Acceptability');
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should normalize DOI with https://doi.org/ prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      await plugin.getWork('https://doi.org/10.5334/gjgl.1001');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('10.5334%2Fgjgl.1001'),
        expect.any(Object)
      );
    });

    it('should normalize DOI with doi: prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      await plugin.getWork('doi:10.5334/gjgl.1001');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('10.5334%2Fgjgl.1001'),
        expect.any(Object)
      );
    });

    it('should return null for invalid DOI format', async () => {
      await plugin.initialize(context);

      const result = await plugin.getWork('not-a-valid-doi');

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null on 404', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.getWork('10.5334/nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await plugin.getWork('10.5334/gjgl.1001');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith('CrossRef API error', expect.any(Object));
    });

    it('should extract author ORCID without prefix', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const result = await plugin.getWork('10.5334/gjgl.1001');

      expect(result?.authors[0]?.orcid).toBe('0000-0002-4519-6259');
    });

    it('should use polite pool User-Agent', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      await plugin.getWork('10.5334/gjgl.1001');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Chive-AppView'),
          }),
        })
      );
    });
  });

  describe('searchWorks', () => {
    it('should search works by query', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      const results = await plugin.searchWorks('acceptability semantics');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        doi: '10.5334/gjgl.1001',
      });
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchWorks('test', { limit: 50 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('rows=50'),
        expect.any(Object)
      );
    });

    it('should cap limit at 100', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchWorks('test', { limit: 200 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('rows=100'),
        expect.any(Object)
      );
    });

    it('should include filter if provided', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SEARCH_RESPONSE),
      } as Response);

      await plugin.searchWorks('test', { filter: 'type:journal-article' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter=type%3Ajournal-article'),
        expect.any(Object)
      );
    });

    it('should return empty array on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchWorks('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith('CrossRef search error', expect.any(Object));
    });
  });

  describe('getReferences', () => {
    it('should return references from work', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const refs = await plugin.getReferences('10.5334/gjgl.1001');

      expect(refs).toHaveLength(1);
      expect(refs[0]).toMatchObject({
        doi: '10.1162/tacl_a_00285',
      });
    });

    it('should return empty array if work not found', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const refs = await plugin.getReferences('10.5334/nonexistent');

      expect(refs).toEqual([]);
    });
  });

  describe('getCitationCount', () => {
    it('should return citation count from work', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_WORK_RESPONSE),
      } as Response);

      const count = await plugin.getCitationCount('10.5334/gjgl.1001');

      expect(count).toBe(12);
    });

    it('should return 0 if work not found', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const count = await plugin.getCitationCount('10.5334/nonexistent');

      expect(count).toBe(0);
    });
  });
});
