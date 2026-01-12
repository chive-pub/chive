/**
 * Unit tests for LingBuzzPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LingBuzzPlugin } from '../../../../src/plugins/builtin/lingbuzz.js';
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
 * Sample LingBuzz RSS feed response.
 *
 * Based on the actual Feedburner RSS format used by LingBuzz (as of 2025):
 * - Uses dc:creator for author names (format: "Lastname, Firstname; Lastname, Firstname")
 * - Uses description for abstracts (with CDATA)
 * - Uses category for keywords (with CDATA)
 * - Items may not have pubDate elements
 * - Uses guid for version info (e.g., "009611v1")
 */
const SAMPLE_RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>LingBuzz</title>
    <description>archive of linguistics articles</description>
    <link>http://ling.auf.net/lingbuzz</link>
    <item>
      <title><![CDATA[On the Semantics of Exceptional Scope, by Simon Charlow]]></title>
      <description><![CDATA[This dissertation motivates a new theory of exceptional scope phenomena based on continuations and monadic composition.]]></description>
      <link>http://ling.auf.net/lingbuzz/006789</link>
      <guid isPermaLink="false">006789v1</guid>
      <pubDate>Mon, 01 Sep 2014 00:00:00 GMT</pubDate>
      <category><![CDATA[semantics]]></category>
      <category><![CDATA[syntax]]></category>
    </item>
    <item>
      <title><![CDATA[Dynamic Semantics and the Grammar of Degree]]></title>
      <description><![CDATA[This paper explores the interaction between dynamic semantics and degree constructions in natural language.]]></description>
      <link>http://ling.auf.net/lingbuzz/007890</link>
      <guid isPermaLink="false">007890v2</guid>
      <dc:creator><![CDATA[Bumford, Dylan]]></dc:creator>
      <category><![CDATA[semantics]]></category>
    </item>
  </channel>
</rss>`;

/**
 * Sample LingBuzz paper detail page HTML.
 *
 * Based on actual LingBuzz page structure (as of 2025):
 * - Title is linked to the PDF
 * - Authors are links with query params (e.g., /lingbuzz/006789?_s=...)
 * - Abstract is plain paragraph text
 * - Keywords appear as "Keywords: term1, term2, term3"
 * - Date appears as "Month YYYY"
 * - Reference, journal info, download count are plain text
 */
const SAMPLE_PAPER_HTML = `<!DOCTYPE html>
<html>
<head><title>LingBuzz - On the Semantics of Exceptional Scope</title></head>
<body>
<a href="/lingbuzz/006789/current.pdf">On the Semantics of Exceptional Scope</a>
<a href="/lingbuzz/006789?_s=author123">Simon Charlow</a>
<p>Format: pdf</p>
<p>Reference: lingbuzz/006789</p>
<p>Published in: Linguistic Inquiry</p>
<p>This dissertation motivates a new theory of exceptional scope phenomena based on continuations and monadic composition. We develop a continuation-based semantics that captures the scopal flexibility of indefinites.</p>
<p>Keywords: semantics, syntax, scope, continuations</p>
<p>September 2014</p>
<p>Downloaded 142 times</p>
</body>
</html>`;

// ============================================================================
// Tests
// ============================================================================

describe('LingBuzzPlugin', () => {
  let plugin: LingBuzzPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new LingBuzzPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.lingbuzz');
    });

    it('should have correct source', () => {
      expect(plugin.source).toBe('lingbuzz');
    });

    it('should declare network permissions for lingbuzz domains', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('ling.auf.net');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('lingbuzz.net');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain(
        'feeds.feedburner.com'
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
        'LingBuzz plugin initialized',
        expect.any(Object)
      );
    });
  });

  describe('buildEprintUrl', () => {
    it('should build correct LingBuzz URL', async () => {
      await plugin.initialize(context);

      const url = plugin.buildEprintUrl('006789');

      expect(url).toBe('https://ling.auf.net/lingbuzz/006789');
    });
  });

  describe('buildPdfUrl', () => {
    it('should build correct PDF URL', async () => {
      await plugin.initialize(context);

      const url = plugin.buildPdfUrl('006789');

      expect(url).toBe('https://ling.auf.net/lingbuzz/006789/current.pdf');
    });
  });

  describe('parseExternalId', () => {
    it('should parse LingBuzz URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://ling.auf.net/lingbuzz/006789');

      expect(id).toBe('006789');
    });

    it('should parse lingbuzz.net URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://lingbuzz.net/lingbuzz/006789');

      expect(id).toBe('006789');
    });

    it('should return null for invalid URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://example.com/paper');

      expect(id).toBeNull();
    });
  });

  describe('fetchEprints', () => {
    it('should fetch papers from RSS feed', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_RSS_FEED),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 10 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(2);
      expect(papers[0]).toMatchObject({
        externalId: '006789',
        title: expect.stringContaining('Exceptional Scope'),
      });
    });

    it('should parse authors from RSS title format', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_RSS_FEED),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers[0]).toMatchObject({
        authors: expect.arrayContaining([expect.objectContaining({ name: 'Simon Charlow' })]),
      });
    });

    it('should parse authors from RSS dc:creator field', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_RSS_FEED),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 10 })) {
        papers.push(paper);
      }

      // dc:creator format is "Lastname, Firstname" - plugin parses as-is
      expect(papers[1]).toMatchObject({
        authors: expect.arrayContaining([expect.objectContaining({ name: 'Bumford, Dylan' })]),
      });
    });

    it('should extract abstract from RSS description field', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_RSS_FEED),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers[0]).toMatchObject({
        abstract: expect.stringContaining('new theory of exceptional scope phenomena'),
      });
    });

    it('should include categories from RSS', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_RSS_FEED),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers[0]).toMatchObject({
        categories: expect.arrayContaining(['semantics', 'syntax']),
      });
    });

    it('should use correct User-Agent header', async () => {
      await plugin.initialize(context);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_RSS_FEED),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
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
        text: () => Promise.resolve(SAMPLE_RSS_FEED),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(1);
    });

    it('should throw on RSS feed error', async () => {
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
      }).rejects.toThrow('LingBuzz RSS feed error: 503');
    });
  });

  describe('fetchPaperDetails', () => {
    it('should return cached paper if available', async () => {
      await plugin.initialize(context);
      const cachedPaper = {
        id: '006789',
        title: 'Cached Paper',
        authors: ['Simon Charlow'],
        url: 'https://ling.auf.net/lingbuzz/006789',
        pubDate: '2014-09-01',
        source: 'lingbuzz' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedPaper);

      const result = await plugin.fetchPaperDetails('006789');

      expect(result).toEqual(cachedPaper);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should scrape paper page if not cached', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_PAPER_HTML),
      } as Response);

      const result = await plugin.fetchPaperDetails('006789');

      expect(result).toMatchObject({
        id: '006789',
        title: 'On the Semantics of Exceptional Scope',
      });
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should extract abstract from paper page', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_PAPER_HTML),
      } as Response);

      const result = await plugin.fetchPaperDetails('006789');

      expect(result?.abstract).toContain('new theory of exceptional scope');
    });

    it('should return null on scraping error', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.fetchPaperDetails('nonexistent');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to fetch LingBuzz paper',
        expect.any(Object)
      );
    });
  });

  describe('getPaper', () => {
    it('should return paper from cache', async () => {
      await plugin.initialize(context);
      const cachedPaper = {
        id: '006789',
        title: 'Test Paper',
        authors: ['Author'],
        url: 'https://ling.auf.net/lingbuzz/006789',
        pubDate: '2024-01-15',
        source: 'lingbuzz' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedPaper);

      const result = await plugin.getPaper('006789');

      expect(result).toEqual(cachedPaper);
      expect(context.cache.get).toHaveBeenCalledWith('lingbuzz:006789');
    });

    it('should return null if not in cache', async () => {
      await plugin.initialize(context);
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);

      const result = await plugin.getPaper('006789');

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
                id: 'lingbuzz:007123',
                source: 'lingbuzz',
                externalId: '007123',
                title: 'A Study of Semantics',
                authors: ['Jane Doe'],
                url: 'https://lingbuzz.net/lingbuzz/007123',
                abstract: 'This paper studies semantics...',
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

      const result = await plugin.searchPapers('semantics', 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '007123',
        title: 'A Study of Semantics',
      });
      expect(mockPaperSearch.search).toHaveBeenCalledWith({
        q: 'semantics',
        sources: ['lingbuzz'],
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

  describe('rate limiting', () => {
    it('should set 10 second rate limit for scraping', async () => {
      await plugin.initialize(context);

      // Rate limit is set in onInitialize
      expect(context.logger.info).toHaveBeenCalledWith(
        'LingBuzz plugin initialized',
        expect.objectContaining({
          rateLimit: '10s between scraping requests',
        })
      );
    });
  });
});
