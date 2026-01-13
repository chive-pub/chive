/**
 * Unit tests for PsyArxivPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PsyArxivPlugin } from '../../../../src/plugins/builtin/psyarxiv.js';
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
// Sample Data (based on OSF Eprints API v2)
// ============================================================================

/**
 * Sample OSF Eprints API response.
 *
 * Uses JSON:API format as specified in OSF API documentation.
 */
const SAMPLE_EPRINTS_RESPONSE = {
  data: [
    {
      id: 'abc123',
      type: 'eprints',
      attributes: {
        title:
          'Implicit Causality and the Strength of Association Between Verb Types and Pronoun Resolution',
        description: 'This study examines implicit causality biases in pronoun resolution.',
        date_created: '2024-01-15T10:00:00Z',
        date_modified: '2024-01-15T12:00:00Z',
        date_published: '2024-01-15T10:00:00Z',
        doi: '10.31234/osf.io/abc123',
        is_published: true,
        is_eprint_orphan: false,
        tags: ['psycholinguistics', 'pronoun resolution'],
        subjects: [
          { id: 'psych', text: 'Psychology' },
          { id: 'ling', text: 'Linguistics' },
        ],
      },
      relationships: {
        contributors: {
          links: {
            related: {
              href: 'https://api.osf.io/v2/eprints/abc123/contributors/',
            },
          },
        },
      },
      links: {
        self: 'https://api.osf.io/v2/eprints/abc123/',
        html: 'https://psyarxiv.com/abc123',
      },
    },
  ],
  links: {
    next: null,
    prev: null,
  },
};

/**
 * Sample OSF Contributors response.
 */
const SAMPLE_CONTRIBUTORS_RESPONSE = {
  data: [
    {
      id: 'contrib1',
      attributes: {
        bibliographic: true,
        permission: 'admin',
        index: 0,
      },
      embeds: {
        users: {
          data: {
            attributes: {
              full_name: 'Tyler Knowlton',
              given_name: 'Tyler',
              family_name: 'Knowlton',
            },
          },
        },
      },
    },
    {
      id: 'contrib2',
      attributes: {
        bibliographic: true,
        permission: 'write',
        index: 1,
      },
      embeds: {
        users: {
          data: {
            attributes: {
              full_name: 'Laurel Perkins',
              given_name: 'Laurel',
              family_name: 'Perkins',
            },
          },
        },
      },
    },
  ],
};

// ============================================================================
// Tests
// ============================================================================

describe('PsyArxivPlugin', () => {
  let plugin: PsyArxivPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new PsyArxivPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.psyarxiv');
    });

    it('should have correct source', () => {
      expect(plugin.source).toBe('psyarxiv');
    });

    it('should declare network permissions for OSF and PsyArXiv domains', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('api.osf.io');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('osf.io');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('psyarxiv.com');
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'PsyArXiv plugin initialized (search-based)',
        expect.objectContaining({
          apiVersion: 'OSF Eprints API v2',
          rateLimit: '600ms between requests',
        })
      );
    });
  });

  describe('buildEprintUrl', () => {
    it('should build correct PsyArXiv URL', async () => {
      await plugin.initialize(context);

      const url = plugin.buildEprintUrl('abc123');

      expect(url).toBe('https://psyarxiv.com/abc123');
    });
  });

  describe('buildPdfUrl', () => {
    it('should build correct PDF download URL', async () => {
      await plugin.initialize(context);

      const url = plugin.buildPdfUrl('abc123');

      expect(url).toBe('https://psyarxiv.com/abc123/download');
    });
  });

  describe('parseExternalId', () => {
    it('should parse psyarxiv.com URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://psyarxiv.com/abc123');

      expect(id).toBe('abc123');
    });

    it('should parse osf.io eprints URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://osf.io/eprints/psyarxiv/abc123');

      expect(id).toBe('abc123');
    });

    it('should return null for invalid URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://example.com/paper');

      expect(id).toBeNull();
    });
  });

  describe('fetchEprints', () => {
    it('should fetch papers from OSF API', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_EPRINTS_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(1);
      expect(papers[0]).toMatchObject({
        externalId: 'abc123',
        title: expect.stringContaining('Implicit Causality'),
      });
    });

    it('should fetch contributors for each eprint', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_EPRINTS_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers[0]).toMatchObject({
        authors: expect.arrayContaining([
          expect.objectContaining({ name: 'Tyler Knowlton' }),
          expect.objectContaining({ name: 'Laurel Perkins' }),
        ]),
      });
    });

    it('should use JSON:API accept header', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_EPRINTS_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/vnd.api+json',
          }),
        })
      );
    });

    it('should skip unpublished eprints', async () => {
      await plugin.initialize(context);
      const responseWithUnpublished = {
        ...SAMPLE_EPRINTS_RESPONSE,
        data: [
          ...SAMPLE_EPRINTS_RESPONSE.data,
          {
            ...SAMPLE_EPRINTS_RESPONSE.data[0],
            id: 'xyz789',
            attributes: {
              ...SAMPLE_EPRINTS_RESPONSE.data[0]?.attributes,
              is_published: false,
            },
          },
        ],
      };
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(responseWithUnpublished),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 10 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(1);
      expect(papers[0]).toMatchObject({ externalId: 'abc123' });
    });

    it('should skip orphaned eprints', async () => {
      await plugin.initialize(context);
      const responseWithOrphaned = {
        ...SAMPLE_EPRINTS_RESPONSE,
        data: [
          {
            ...SAMPLE_EPRINTS_RESPONSE.data[0],
            attributes: {
              ...SAMPLE_EPRINTS_RESPONSE.data[0]?.attributes,
              is_eprint_orphan: true,
            },
          },
        ],
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithOrphaned),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 10 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(0);
    });

    it('should throw on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      await expect(async () => {
        const papers: unknown[] = [];
        for await (const paper of plugin.fetchEprints({ limit: 1 })) {
          papers.push(paper);
        }
      }).rejects.toThrow('PsyArXiv API error: 503');
    });
  });

  describe('fetchEprintDetails', () => {
    it('should return cached eprint if available', async () => {
      await plugin.initialize(context);
      const cachedPaper = {
        id: 'abc123',
        title: 'Cached Paper',
        authors: ['Author'],
        url: 'https://psyarxiv.com/abc123',
        publicationDate: '2024-01-15',
        source: 'psyarxiv' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedPaper);

      const result = await plugin.fetchEprintDetails('abc123');

      expect(result).toEqual(cachedPaper);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: SAMPLE_EPRINTS_RESPONSE.data[0] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      const result = await plugin.fetchEprintDetails('abc123');

      expect(result).toMatchObject({
        id: 'abc123',
        title: expect.stringContaining('Implicit Causality'),
      });
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.fetchEprintDetails('nonexistent');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to fetch eprint details',
        expect.any(Object)
      );
    });
  });

  describe('searchEprints', () => {
    it('should search eprints by query', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_EPRINTS_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      const results = await plugin.searchEprints('causality');

      expect(results).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter[title]=causality'),
        expect.any(Object)
      );
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_EPRINTS_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(SAMPLE_CONTRIBUTORS_RESPONSE),
        } as Response);

      await plugin.searchEprints('test', { limit: 10 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page[size]=10'),
        expect.any(Object)
      );
    });

    it('should return empty array on search error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await plugin.searchEprints('test');

      expect(results).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith('Search request failed', expect.any(Object));
    });
  });

  describe('getPaper', () => {
    it('should return paper from cache', async () => {
      await plugin.initialize(context);
      const cachedPaper = {
        id: 'abc123',
        title: 'Test Paper',
        authors: ['Author'],
        url: 'https://psyarxiv.com/abc123',
        publicationDate: '2024-01-15',
        source: 'psyarxiv' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedPaper);

      const result = await plugin.getPaper('abc123');

      expect(result).toEqual(cachedPaper);
      expect(context.cache.get).toHaveBeenCalledWith('psyarxiv:abc123');
    });

    it('should return null if not in cache', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);

      const result = await plugin.getPaper('abc123');

      expect(result).toBeNull();
    });
  });
});
