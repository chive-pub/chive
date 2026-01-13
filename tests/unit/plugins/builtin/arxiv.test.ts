/**
 * Unit tests for ArxivPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ArxivPlugin } from '../../../../src/plugins/builtin/arxiv.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ICacheProvider,
  IMetrics,
  IPluginContext,
  IPluginEventBus,
} from '../../../../src/types/interfaces/plugin.interface.js';

// ============================================================================
// Test Subclass
// ============================================================================

/**
 * Testable ArxivPlugin that exposes protected members for testing.
 */
class TestableArxivPlugin extends ArxivPlugin {
  /** Disables rate limiting for fast tests. */
  disableRateLimiting(): void {
    this.rateLimitDelayMs = 0;
  }
}

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
  startTimer: vi.fn().mockReturnValue(() => {
    /* timer end callback */
  }),
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
 * Sample arXiv OAI-PMH response XML.
 *
 * Based on arXiv OAI-PMH format with realistic metadata.
 */
const SAMPLE_OAI_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <ListRecords>
    <record>
      <metadata>
        <arXiv xmlns="http://arxiv.org/OAI/arXiv/">
          <id>2401.12345</id>
          <title>Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding</title>
          <authors>
            <author><keyname>White</keyname><forenames>Aaron Steven</forenames></author>
            <author><keyname>Rawlins</keyname><forenames>Kyle</forenames></author>
          </authors>
          <abstract>The MegaAcceptability dataset provides acceptability judgments.</abstract>
          <created>2024-01-15</created>
          <categories>cs.CL linguistics</categories>
          <doi>10.5334/gjgl.1001</doi>
        </arXiv>
      </metadata>
    </record>
    <resumptionToken>token123</resumptionToken>
  </ListRecords>
</OAI-PMH>`;

/**
 * Sample arXiv Atom API response for single paper lookup.
 */
const SAMPLE_ATOM_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.12345</id>
    <title>Frequency, Acceptability, and Selection</title>
    <author><name>Aaron Steven White</name></author>
    <author><name>Kyle Rawlins</name></author>
    <summary>The MegaAcceptability dataset provides acceptability judgments.</summary>
    <published>2024-01-15T00:00:00Z</published>
    <arxiv:doi xmlns:arxiv="http://arxiv.org/schemas/atom">10.5334/gjgl.1001</arxiv:doi>
  </entry>
</feed>`;

// ============================================================================
// Tests
// ============================================================================

describe('ArxivPlugin', () => {
  let plugin: TestableArxivPlugin;
  let context: IPluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    context = createMockContext();
    plugin = new TestableArxivPlugin();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.arxiv');
    });

    it('should have correct source', () => {
      expect(plugin.source).toBe('arxiv');
    });

    it('should declare network permissions for arxiv domains', () => {
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('arxiv.org');
      expect(plugin.manifest.permissions?.network?.allowedDomains).toContain('export.arxiv.org');
    });
  });

  describe('initialize', () => {
    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'arXiv plugin initialized (search-based)',
        expect.objectContaining({
          rateLimit: '3s between requests',
          searchEndpoint: 'http://export.arxiv.org/api/query',
        })
      );
    });
  });

  describe('buildEprintUrl', () => {
    it('should build correct abstract URL for new format ID', async () => {
      await plugin.initialize(context);

      const url = plugin.buildEprintUrl('2401.12345');

      expect(url).toBe('https://arxiv.org/abs/2401.12345');
    });

    it('should build correct abstract URL for old format ID', async () => {
      await plugin.initialize(context);

      const url = plugin.buildEprintUrl('hep-th/9901001');

      expect(url).toBe('https://arxiv.org/abs/hep-th/9901001');
    });
  });

  describe('buildPdfUrl', () => {
    it('should build correct PDF URL', async () => {
      await plugin.initialize(context);

      const url = plugin.buildPdfUrl('2401.12345');

      expect(url).toBe('https://arxiv.org/pdf/2401.12345.pdf');
    });
  });

  describe('parseExternalId', () => {
    it('should parse new format arXiv URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://arxiv.org/abs/2401.12345');

      expect(id).toBe('2401.12345');
    });

    it('should parse new format with version', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://arxiv.org/abs/2401.12345v2');

      expect(id).toBe('2401.12345v2');
    });

    it('should parse PDF URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://arxiv.org/pdf/2401.12345');

      expect(id).toBe('2401.12345');
    });

    it('should parse old format arXiv URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://arxiv.org/abs/hep-th/9901001');

      expect(id).toBe('hep-th/9901001');
    });

    it('should return null for invalid URL', async () => {
      await plugin.initialize(context);

      const id = plugin.parseExternalId('https://example.com/paper');

      expect(id).toBeNull();
    });
  });

  describe('fetchEprints', () => {
    it('should fetch papers from OAI-PMH endpoint', async () => {
      await plugin.initialize(context);
      plugin.disableRateLimiting();
      // Mock returns same response for all category requests (cs.CL, cs.AI, cs.LG)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_OAI_RESPONSE),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(1);
      expect(papers[0]).toMatchObject({
        externalId: '2401.12345',
        title: expect.stringContaining('Frequency, Acceptability'),
      });
    });

    it('should use correct User-Agent header', async () => {
      await plugin.initialize(context);
      plugin.disableRateLimiting();
      // Mock returns same response for all category requests
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_OAI_RESPONSE),
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
      plugin.disableRateLimiting();
      const multipleRecords = SAMPLE_OAI_RESPONSE.replace(
        '</ListRecords>',
        `<record>
          <metadata>
            <arXiv xmlns="http://arxiv.org/OAI/arXiv/">
              <id>2401.99999</id>
              <title>Second Paper</title>
              <authors><author><keyname>Doe</keyname><forenames>Jane</forenames></author></authors>
              <abstract>Abstract</abstract>
              <created>2024-01-16</created>
              <categories>cs.CL</categories>
            </arXiv>
          </metadata>
        </record>
        </ListRecords>`
      );
      // Mock returns same response for all category requests
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(multipleRecords),
      } as Response);

      const papers: unknown[] = [];
      for await (const paper of plugin.fetchEprints({ limit: 1 })) {
        papers.push(paper);
      }

      expect(papers).toHaveLength(1);
    });

    it('should throw on API error', async () => {
      await plugin.initialize(context);
      plugin.disableRateLimiting();
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      await expect(async () => {
        const papers: unknown[] = [];
        for await (const paper of plugin.fetchEprints({ limit: 1 })) {
          papers.push(paper);
        }
      }).rejects.toThrow('arXiv OAI-PMH error: 503');
    });
  });

  describe('fetchPaperDetails', () => {
    it('should return cached paper if available', async () => {
      await plugin.initialize(context);
      const cachedPaper = {
        id: '2401.12345',
        title: 'Cached Paper',
        authors: ['Author'],
        url: 'https://arxiv.org/abs/2401.12345',
        submittedDate: '2024-01-15',
        primaryCategory: 'cs.CL',
        categories: ['cs.CL'],
        source: 'arxiv' as const,
      };
      vi.mocked(context.cache.get).mockResolvedValueOnce(cachedPaper);

      const result = await plugin.fetchPaperDetails('2401.12345');

      expect(result).toEqual(cachedPaper);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not cached', async () => {
      await plugin.initialize(context);
      plugin.disableRateLimiting();
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_ATOM_RESPONSE),
      } as Response);

      const result = await plugin.fetchPaperDetails('2401.12345');

      expect(result).toMatchObject({
        id: '2401.12345',
        title: expect.stringContaining('Frequency'),
      });
      expect(context.cache.set).toHaveBeenCalled();
    });

    it('should return null on API error', async () => {
      await plugin.initialize(context);
      plugin.disableRateLimiting();
      vi.mocked(context.cache.get).mockResolvedValueOnce(null);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await plugin.fetchPaperDetails('nonexistent');

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to fetch arXiv paper',
        expect.any(Object)
      );
    });
  });
});
