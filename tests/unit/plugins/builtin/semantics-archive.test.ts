/**
 * Unit tests for SemanticsArchivePlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SemanticsArchivePlugin } from '../../../../src/plugins/builtin/semantics-archive.js';
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
// Sample Data
// ============================================================================

/**
 * Sample Semantics Archive browse page HTML.
 *
 * Based on actual Semantics Archive browse page format (as of 2025):
 * - Papers listed as "YYYY MM DD Author(s) [Title](link)"
 * - Date in space-separated YYYY MM DD format
 * - Author names appear before the linked title
 * - Title is the link text, pointing to /Archive/[ID]
 */
const SAMPLE_BROWSE_HTML = `<!DOCTYPE html>
<html>
<head><title>Semantics Archive - Browse</title></head>
<body>
<h1>Browse the Semantics Archive</h1>
<p>Papers listed by submission date:</p>
2024 08 26 Aaron Steven White, Kyle Rawlins <a href="/Archive/WhiteRawlins2020">Frequency, Acceptability, and Selection</a>
<br>
2024 03 15 Simon Charlow <a href="/Archive/Charlow2014">On the Semantics of Exceptional Scope</a>
<br>
2023 11 02 Julian Grove <a href="/Archive/Grove2023">Algebraic Effects for Extensible Dynamic Semantics</a>
<br>
<a href="/Archive/browse">Browse</a>
<a href="/Archive/search">Search</a>
</body>
</html>`;

// ============================================================================
// Tests
// ============================================================================

describe('SemanticsArchivePlugin', () => {
  let plugin: SemanticsArchivePlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new SemanticsArchivePlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.semanticsarchive');
    });

    it('should have correct source', () => {
      expect(plugin.source).toBe('semanticsarchive');
    });

    it('should declare network permissions for semanticsarchive.net', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain(
        'semanticsarchive.net'
      );
    });
  });

  describe('initialize', () => {
    it('should register event handler for system.startup', async () => {
      await plugin.initialize(context);

      expect(context.eventBus.on).toHaveBeenCalledWith('system.startup', expect.any(Function));
    });

    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Semantics Archive plugin initialized',
        expect.any(Object)
      );
    });

    it('should set 5 second rate limit', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Semantics Archive plugin initialized',
        expect.objectContaining({
          rateLimit: '5s between requests',
        })
      );
    });
  });

  describe('buildPreprintUrl', () => {
    it('should build correct Semantics Archive URL', async () => {
      await plugin.initialize(context);

      const url = plugin.buildPreprintUrl('WhiteRawlins2020');

      expect(url).toBe('https://semanticsarchive.net/Archive/WhiteRawlins2020');
    });
  });

  describe('parseExternalId', () => {
    it('should parse Semantics Archive URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://semanticsarchive.net/Archive/WhiteRawlins2020');

      expect(id).toBe('WhiteRawlins2020');
    });

    it('should return null for invalid URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://example.com/paper');

      expect(id).toBeNull();
    });
  });

  describe('fetchPreprints', () => {
    it('should fetch papers from browse page', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_BROWSE_HTML),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 10 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(3);
      expect(papers[0]).toMatchObject({
        externalId: 'WhiteRawlins2020',
        title: expect.stringContaining('Frequency, Acceptability'),
      });
    });

    it('should parse authors from title', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_BROWSE_HTML),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers[0]).toMatchObject({
        authors: expect.arrayContaining([
          expect.objectContaining({ name: 'Aaron Steven White' }),
          expect.objectContaining({ name: 'Kyle Rawlins' }),
        ]),
      });
    });

    it('should extract dates from listing format', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_BROWSE_HTML),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 1 })) {
        papers.push(paper);
      }

      // First paper has date 2024 08 26 - verify by checking ISO string
      const firstPaper = papers[0] as { publicationDate: Date };
      const isoDate = firstPaper.publicationDate.toISOString();
      expect(isoDate).toContain('2024-08-26');
    });

    it('should skip navigation links', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_BROWSE_HTML),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 10 })) {
        papers.push(paper);
      }

      // Should not include 'browse' or 'search' navigation links
      const ids = papers.map((p) => (p as { externalId: string }).externalId);
      expect(ids).not.toContain('browse');
      expect(ids).not.toContain('search');
    });

    it('should use correct User-Agent header', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_BROWSE_HTML),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Chive-AppView'),
          }),
        })
      );
    });

    it('should respect limit option', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_BROWSE_HTML),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchPreprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(1);
    });

    it('should throw on scraping error', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      await expect(async () => {
        const papers: unknown[] = [];
        for await (const paper of plugin.fetchPreprints({ limit: 1 })) {
          papers.push(paper);
        }
      }).rejects.toThrow('Semantics Archive error: 503');
    });
  });

  describe('getPaper', () => {
    it('should return paper from cache', async () => {
      await plugin.initialize(context);
      const cachedPaper = {
        id: 'WhiteRawlins2020',
        title: 'Test Paper',
        authors: ['Author'],
        url: 'https://semanticsarchive.net/Archive/WhiteRawlins2020',
        addedDate: '2024-01-15',
        source: 'semanticsarchive' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedPaper);

      const result = await plugin.getPaper('WhiteRawlins2020');

      expect(result).toEqual(cachedPaper);
      expect(context.cache.get).toHaveBeenCalledWith('semarch:WhiteRawlins2020');
    });

    it('should return null if not in cache', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);

      const result = await plugin.getPaper('WhiteRawlins2020');

      expect(result).toBeNull();
    });
  });

  describe('searchPapers', () => {
    it('should return empty array when paperSearch service is not available', async () => {
      await plugin.initialize(context);

      const result = await plugin.searchPapers('semantics');

      expect(result).toEqual([]);
      expect(context.logger.debug).toHaveBeenCalledWith(
        'Paper search not available, returning empty results',
        expect.objectContaining({ query: 'semantics' })
      );
    });

    it('should search via ExternalPaperSearch when service is available', async () => {
      const mockPaperSearch = {
        search: vi.fn().mockResolvedValue({
          hits: [
            {
              paper: {
                id: 'semanticsarchive:WhiteRawlins2020',
                source: 'semanticsarchive',
                externalId: 'WhiteRawlins2020',
                title: 'Question Semantics',
                authors: ['Aaron Steven White', 'Kyle Rawlins'],
                url: 'https://semanticsarchive.net/Archive/WhiteRawlins2020',
                abstract: 'This paper studies question semantics...',
                indexedAt: new Date(),
              },
              score: 1.5,
            },
          ],
          total: 1,
          took: 10,
        }),
        indexPaper: vi.fn(),
        bulkIndexPapers: vi.fn(),
        getPaper: vi.fn(),
        deletePaper: vi.fn(),
        deleteBySource: vi.fn(),
      };

      // Initialize with paperSearch service
      const contextWithPaperSearch = {
        ...context,
        config: {
          ...context.config,
          paperSearch: mockPaperSearch,
        },
      };

      await plugin.initialize(contextWithPaperSearch);

      const result = await plugin.searchPapers('question semantics', 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'WhiteRawlins2020',
        title: 'Question Semantics',
      });
      expect(mockPaperSearch.search).toHaveBeenCalledWith({
        q: 'question semantics',
        sources: ['semanticsarchive'],
        limit: 10,
      });
    });

    it('should return empty array and log warning when search fails', async () => {
      const mockPaperSearch = {
        search: vi.fn().mockRejectedValue(new Error('Search failed')),
        indexPaper: vi.fn(),
        bulkIndexPapers: vi.fn(),
        getPaper: vi.fn(),
        deletePaper: vi.fn(),
        deleteBySource: vi.fn(),
      };

      const contextWithPaperSearch = {
        ...context,
        config: {
          ...context.config,
          paperSearch: mockPaperSearch,
        },
      };

      await plugin.initialize(contextWithPaperSearch);

      const result = await plugin.searchPapers('semantics');

      expect(result).toEqual([]);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Paper search failed',
        expect.objectContaining({ query: 'semantics' })
      );
    });
  });
});
