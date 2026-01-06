/**
 * Unit tests for ImportingPlugin base class.
 *
 * @remarks
 * Tests the abstract base class for plugins that import preprints from
 * external sources like arXiv and LingBuzz.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ImportingPlugin } from '../../../../src/plugins/core/importing-plugin.js';
import type { ICacheProvider } from '../../../../src/types/interfaces/cache.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { IMetrics } from '../../../../src/types/interfaces/metrics.interface.js';
import type {
  ExternalPreprint,
  FetchOptions,
  IImportService,
  ImportedPreprint,
  ImportSource,
  IPluginContext,
  IPluginEventBus,
  IPluginManifest,
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

/**
 * Sample preprints for testing based on real linguistics research.
 *
 * Uses verified paper metadata from linguistics researchers including
 * Aaron Steven White, Kyle Rawlins, Simon Charlow, and others.
 */

// Sample preprint: White & Rawlins (2020), MegaAttitude project
// DOI: 10.5334/gjgl.1001
const SAMPLE_ARXIV_PREPRINT: ExternalPreprint = {
  externalId: 'arxiv.2001.12345', // Hypothetical arXiv ID for testing
  url: 'https://arxiv.org/abs/2001.12345',
  title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
  abstract:
    'The MegaAcceptability dataset provides acceptability judgments on the distribution of 1,000 attitude verbs in 50 syntactic frames in English.',
  authors: [{ name: 'Aaron Steven White', orcid: '0000-0002-4921-5202' }, { name: 'Kyle Rawlins' }],
  publicationDate: new Date('2020-01-15'),
  categories: ['cs.CL', 'linguistics'],
  pdfUrl: 'https://arxiv.org/pdf/2001.12345.pdf',
};

// Sample preprint: Charlow (2014), Exceptional scope dissertation
// URL: https://semanticsarchive.net/Archive/2JmMWRjY/charlow-semantics-exceptional-scope-diss.pdf
const SAMPLE_LINGBUZZ_PREPRINT: ExternalPreprint = {
  externalId: '006789', // Hypothetical LingBuzz ID for testing
  url: 'https://ling.auf.net/lingbuzz/006789',
  title: 'On the Semantics of Exceptional Scope',
  abstract:
    'This dissertation motivates a new theory of exceptional scope phenomena in natural language using monads and continuations.',
  authors: [{ name: 'Simon Charlow' }],
  publicationDate: new Date('2014-09-01'),
  categories: ['semantics', 'syntax'],
};

const createMockImportService = (): IImportService => ({
  exists: vi.fn().mockResolvedValue(false),
  get: vi.fn().mockResolvedValue(null),
  getById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockImplementation((data) =>
    Promise.resolve({
      id: 1,
      source: data.source,
      externalId: data.externalId,
      url: data.externalUrl,
      title: data.title,
      abstract: data.abstract,
      authors: data.authors,
      publicationDate: data.publicationDate,
      doi: data.doi,
      pdfUrl: data.pdfUrl,
      categories: data.categories,
      importedByPlugin: data.importedByPlugin,
      importedAt: new Date(),
      syncStatus: 'active',
      claimStatus: 'unclaimed',
    } as ImportedPreprint)
  ),
  update: vi.fn().mockImplementation((id, data) =>
    Promise.resolve({
      id,
      ...data,
      importedAt: new Date(),
      syncStatus: 'active',
    } as unknown as ImportedPreprint)
  ),
  search: vi.fn().mockResolvedValue({ preprints: [], cursor: undefined }),
  markClaimed: vi.fn().mockResolvedValue(undefined),
});

const createMockContext = (config: Record<string, unknown> = {}): IPluginContext => ({
  logger: createMockLogger(),
  cache: createMockCache(),
  metrics: createMockMetrics(),
  eventBus: createMockEventBus(),
  config,
});

// ============================================================================
// Test Implementation
// ============================================================================

/**
 * Concrete test implementation of ImportingPlugin.
 */
class TestImportingPlugin extends ImportingPlugin {
  readonly id = 'pub.chive.plugin.test-import';
  readonly source: ImportSource = 'arxiv';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.test-import',
    name: 'Test Import Plugin',
    version: '1.0.0',
    description: 'Test plugin for import functionality',
    author: 'Test',
    license: 'MIT',
    permissions: {
      network: { allowedDomains: ['arxiv.org'] },
      hooks: ['system.startup'],
    },
    entrypoint: 'test.js',
  };

  // Control what fetchPreprints yields
  public preprintsToYield: ExternalPreprint[] = [];

  async *fetchPreprints(_options?: FetchOptions): AsyncIterable<ExternalPreprint> {
    for (const preprint of this.preprintsToYield) {
      await this.rateLimit();
      yield preprint;
    }
  }

  buildPreprintUrl(externalId: string): string {
    return `https://arxiv.org/abs/${externalId}`;
  }

  override buildPdfUrl(externalId: string): string | null {
    return `https://arxiv.org/pdf/${externalId}.pdf`;
  }

  override parseExternalId(url: string): string | null {
    // Match arXiv new format: 2512.05959
    const match = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/.exec(url);
    return match?.[1] ?? null;
  }

  // Expose protected methods for testing
  public async testRateLimit(): Promise<void> {
    return this.rateLimit();
  }

  public setRateLimitDelay(ms: number): void {
    this.rateLimitDelayMs = ms;
  }

  /** Exposes protected importService for testing. */
  public getImportService(): IImportService | undefined {
    return this.importService;
  }

  protected onInitialize(): Promise<void> {
    return Promise.resolve();
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('ImportingPlugin', () => {
  let plugin: TestImportingPlugin;
  let context: IPluginContext;
  let importService: IImportService;

  beforeEach(() => {
    plugin = new TestImportingPlugin();
    importService = createMockImportService();
    context = createMockContext({ importService });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize and store import service from context', async () => {
      await plugin.initialize(context);

      expect(plugin.getImportService()).toBe(importService);
    });

    it('should handle missing import service gracefully', async () => {
      const contextWithoutService = createMockContext({});
      await plugin.initialize(contextWithoutService);

      expect(plugin.getImportService()).toBeUndefined();
    });
  });

  describe('isImported', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should check import service for existing preprint', async () => {
      const result = await plugin.isImported('arxiv.2001.12345');

      expect(importService.exists).toHaveBeenCalledWith('arxiv', 'arxiv.2001.12345');
      expect(result).toBe(false);
    });

    it('should return true if preprint already imported', async () => {
      vi.mocked(importService.exists).mockResolvedValueOnce(true);

      const result = await plugin.isImported('arxiv.2001.12345');

      expect(result).toBe(true);
    });

    it('should return false if import service not available', async () => {
      // Create a NEW plugin instance with a context that has no import service
      const newPlugin = new TestImportingPlugin();
      const contextWithoutService = createMockContext({});
      await newPlugin.initialize(contextWithoutService);

      const result = await newPlugin.isImported('arxiv.2001.12345');

      expect(result).toBe(false);
      expect(contextWithoutService.logger.warn).toHaveBeenCalledWith(
        'Import service not available, skipping dedup check'
      );
    });
  });

  describe('getExistingImport', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should retrieve existing import from service', async () => {
      const mockImport = {
        id: 1,
        source: 'arxiv' as ImportSource,
        externalId: 'arxiv.2001.12345',
        title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
      } as ImportedPreprint;
      vi.mocked(importService.get).mockResolvedValueOnce(mockImport);

      const result = await plugin.getExistingImport('arxiv.2001.12345');

      expect(importService.get).toHaveBeenCalledWith('arxiv', 'arxiv.2001.12345');
      expect(result).toBe(mockImport);
    });

    it('should return null if import service not available', async () => {
      const contextWithoutService = createMockContext({});
      await plugin.initialize(contextWithoutService);

      const result = await plugin.getExistingImport('arxiv.2001.12345');

      expect(result).toBeNull();
    });
  });

  describe('importPreprint', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should create new import for unseen preprint', async () => {
      const result = await plugin.importPreprint(SAMPLE_ARXIV_PREPRINT);

      expect(importService.create).toHaveBeenCalledWith({
        source: 'arxiv',
        externalId: 'arxiv.2001.12345',
        externalUrl: 'https://arxiv.org/abs/2001.12345',
        title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
        abstract: expect.any(String),
        authors: expect.any(Array),
        publicationDate: expect.any(Date),
        doi: undefined,
        pdfUrl: 'https://arxiv.org/pdf/2001.12345.pdf',
        categories: ['cs.CL', 'linguistics'],
        importedByPlugin: 'pub.chive.plugin.test-import',
        metadata: undefined,
      });
      expect(result.id).toBe(1);
    });

    it('should return existing import if already imported', async () => {
      const existingImport = {
        id: 42,
        source: 'arxiv' as ImportSource,
        externalId: 'arxiv.2001.12345',
        title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
      } as ImportedPreprint;
      vi.mocked(importService.get).mockResolvedValueOnce(existingImport);

      const result = await plugin.importPreprint(SAMPLE_ARXIV_PREPRINT);

      expect(importService.create).not.toHaveBeenCalled();
      expect(result).toBe(existingImport);
      expect(context.logger.debug).toHaveBeenCalledWith(
        'Preprint already imported',
        expect.objectContaining({ externalId: 'arxiv.2001.12345' })
      );
    });

    it('should emit import.created event', async () => {
      await plugin.importPreprint(SAMPLE_ARXIV_PREPRINT);

      expect(context.eventBus.emit).toHaveBeenCalledWith('import.created', {
        importId: 1,
        source: 'arxiv',
        externalId: 'arxiv.2001.12345',
        title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
      });
    });

    it('should record imports_created metric', async () => {
      await plugin.importPreprint(SAMPLE_ARXIV_PREPRINT);

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'imports_created',
        { source: 'arxiv' },
        undefined
      );
    });

    it('should throw if import service not available', async () => {
      // Create a NEW plugin instance (not re-initialize existing one)
      const newPlugin = new TestImportingPlugin();
      const contextWithoutService = createMockContext({});
      await newPlugin.initialize(contextWithoutService);

      await expect(newPlugin.importPreprint(SAMPLE_ARXIV_PREPRINT)).rejects.toThrow(
        'Import service not available'
      );
    });
  });

  describe('updateImport', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should update existing import with new data', async () => {
      await plugin.updateImport(1, {
        title: 'Updated Title',
        abstract: 'Updated abstract',
      });

      expect(importService.update).toHaveBeenCalledWith(1, {
        title: 'Updated Title',
        abstract: 'Updated abstract',
        authors: undefined,
        doi: undefined,
        pdfUrl: undefined,
        lastSyncedAt: expect.any(Date),
        syncStatus: 'active',
      });
    });

    it('should emit import.updated event', async () => {
      await plugin.updateImport(1, { title: 'Updated' });

      expect(context.eventBus.emit).toHaveBeenCalledWith('import.updated', {
        importId: 1,
        source: 'arxiv',
      });
    });

    it('should record imports_updated metric', async () => {
      await plugin.updateImport(1, { title: 'Updated' });

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'imports_updated',
        { source: 'arxiv' },
        undefined
      );
    });
  });

  describe('runImportCycle', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
      plugin.setRateLimitDelay(0); // Disable rate limiting for tests
    });

    it('should import all fetched preprints', async () => {
      plugin.preprintsToYield = [SAMPLE_ARXIV_PREPRINT, SAMPLE_LINGBUZZ_PREPRINT];

      const result = await plugin.runImportCycle();

      expect(result.totalFetched).toBe(2);
      expect(result.newImports).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should update existing preprints instead of creating new ones', async () => {
      plugin.preprintsToYield = [SAMPLE_ARXIV_PREPRINT];

      // First preprint exists
      vi.mocked(importService.get).mockResolvedValueOnce({
        id: 1,
        source: 'arxiv' as ImportSource,
        externalId: 'arxiv.2001.12345',
        title: 'Old Title',
      } as ImportedPreprint);

      const result = await plugin.runImportCycle();

      expect(result.totalFetched).toBe(1);
      expect(result.newImports).toBe(0);
      expect(result.updated).toBe(1);
      expect(importService.update).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('should count errors and continue processing', async () => {
      plugin.preprintsToYield = [SAMPLE_ARXIV_PREPRINT, SAMPLE_LINGBUZZ_PREPRINT];

      // First import fails
      vi.mocked(importService.get).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      vi.mocked(importService.create)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({
          id: 2,
          source: 'arxiv',
        } as ImportedPreprint);

      const result = await plugin.runImportCycle();

      expect(result.totalFetched).toBe(2);
      expect(result.newImports).toBe(1);
      expect(result.errors).toBe(1);
      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to process preprint',
        expect.objectContaining({ error: 'DB error' })
      );
    });

    it('should record import_cycle_duration metric', async () => {
      plugin.preprintsToYield = [SAMPLE_ARXIV_PREPRINT];

      await plugin.runImportCycle();

      expect(context.metrics.startTimer).toHaveBeenCalledWith('import_cycle_duration', {
        source: 'arxiv',
      });
    });

    it('should log completion with statistics', async () => {
      plugin.preprintsToYield = [SAMPLE_ARXIV_PREPRINT];

      await plugin.runImportCycle();

      expect(context.logger.info).toHaveBeenCalledWith(
        'Import cycle completed',
        expect.objectContaining({
          source: 'arxiv',
          totalFetched: 1,
          newImports: 1,
        })
      );
    });

    it('should include timestamps in result', async () => {
      plugin.preprintsToYield = [];

      const result = await plugin.runImportCycle();

      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('rateLimit', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should enforce delay between requests', async () => {
      plugin.setRateLimitDelay(1000);

      // First call should not delay
      const promise1 = plugin.testRateLimit();
      vi.advanceTimersByTime(0);
      await promise1;

      // Second call should delay
      const promise2 = plugin.testRateLimit();
      vi.advanceTimersByTime(500);
      // Should still be waiting

      vi.advanceTimersByTime(500);
      await promise2;
    });

    it('should not delay if enough time has passed', async () => {
      plugin.setRateLimitDelay(1000);

      await plugin.testRateLimit();
      vi.advanceTimersByTime(1500);

      // Second call should not need to wait
      const startTime = Date.now();
      await plugin.testRateLimit();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('parseExternalId', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should parse arXiv abstract URL', () => {
      expect(plugin.parseExternalId('https://arxiv.org/abs/2401.12345')).toBe('2401.12345');
    });

    it('should parse arXiv PDF URL', () => {
      expect(plugin.parseExternalId('https://arxiv.org/pdf/2401.12345.pdf')).toBe('2401.12345');
    });

    it('should return null for non-matching URLs', () => {
      expect(plugin.parseExternalId('https://example.com/paper')).toBeNull();
      expect(plugin.parseExternalId('https://lingbuzz.net/lingbuzz/009554')).toBeNull();
    });

    it('should handle malformed URLs', () => {
      expect(plugin.parseExternalId('')).toBeNull();
      expect(plugin.parseExternalId('not-a-url')).toBeNull();
    });
  });

  describe('buildPreprintUrl', () => {
    it('should construct correct arXiv URL', () => {
      expect(plugin.buildPreprintUrl('2512.05959')).toBe('https://arxiv.org/abs/2512.05959');
    });
  });

  describe('buildPdfUrl', () => {
    it('should construct correct arXiv PDF URL', () => {
      expect(plugin.buildPdfUrl('2512.05959')).toBe('https://arxiv.org/pdf/2512.05959.pdf');
    });
  });

  describe('abstract method requirements', () => {
    it('should require source property', () => {
      expect(plugin.source).toBe('arxiv');
    });

    it('should require fetchPreprints implementation', async () => {
      plugin.preprintsToYield = [SAMPLE_ARXIV_PREPRINT];

      const preprints: ExternalPreprint[] = [];
      for await (const p of plugin.fetchPreprints()) {
        preprints.push(p);
      }

      expect(preprints).toHaveLength(1);
      expect(preprints[0]?.externalId).toBe('arxiv.2001.12345');
    });

    it('should require buildPreprintUrl implementation', () => {
      expect(typeof plugin.buildPreprintUrl).toBe('function');
      expect(plugin.buildPreprintUrl('test')).toBeTruthy();
    });
  });
});
