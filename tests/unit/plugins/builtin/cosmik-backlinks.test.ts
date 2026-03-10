/**
 * Unit tests for CosmikBacklinksPlugin.
 *
 * @remarks
 * Tests backlink tracking from Cosmik cards to Chive eprints.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CosmikBacklinksPlugin } from '../../../../src/plugins/builtin/cosmik-backlinks.js';
import type { FirehoseRecord } from '../../../../src/plugins/core/backlink-plugin.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ICacheProvider,
  IMetrics,
  IPluginContext,
  IPluginEventBus,
  IBacklinkService,
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

const createMockBacklinkService = (): IBacklinkService => ({
  createBacklink: vi.fn().mockResolvedValue({
    id: 1,
    sourceUri: 'at://did:plc:user/network.cosmik.card/abc123',
    sourceType: 'cosmik.collection',
    targetUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz789',
    context: 'Test Card',
    indexedAt: new Date(),
    deleted: false,
  }),
  deleteBacklink: vi.fn().mockResolvedValue(undefined),
  getBacklinks: vi.fn().mockResolvedValue({ backlinks: [], cursor: undefined }),
  getCounts: vi.fn().mockResolvedValue({
    cosmikCollections: 0,
    leafletLists: 0,
    whitewindBlogs: 0,
    blueskyShares: 0,
    total: 0,
    updatedAt: new Date(),
  }),
  updateCounts: vi.fn().mockResolvedValue(undefined),
});

const createMockContext = (overrides?: Partial<IPluginContext>): IPluginContext => ({
  logger: createMockLogger(),
  cache: createMockCache(),
  metrics: createMockMetrics(),
  eventBus: createMockEventBus(),
  config: {
    backlinkService: createMockBacklinkService(),
  },
  ...overrides,
});

// ============================================================================
// Sample Data
// ============================================================================

/**
 * Sample Cosmik card with an eprint URL.
 */
const SAMPLE_EPRINT_CARD = {
  $type: 'network.cosmik.card',
  type: 'URL' as const,
  url: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
  content: {
    $type: 'network.cosmik.card#urlContent',
    url: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
    metadata: {
      title: 'Semantics of Natural Language',
      description: 'A paper on semantic theory',
    },
  },
  createdAt: '2024-01-15T00:00:00Z',
};

/**
 * Sample Cosmik card with a non-eprint URL.
 */
const SAMPLE_EXTERNAL_CARD = {
  $type: 'network.cosmik.card',
  type: 'URL' as const,
  url: 'https://example.com/some-article',
  content: {
    $type: 'network.cosmik.card#urlContent',
    url: 'https://example.com/some-article',
    metadata: {
      title: 'External Article',
    },
  },
  createdAt: '2024-01-15T00:00:00Z',
};

/**
 * Sample Cosmik card with no content block.
 */
const SAMPLE_MINIMAL_CARD = {
  $type: 'network.cosmik.card',
  type: 'URL' as const,
  url: 'at://did:plc:author2/pub.chive.eprint.submission/def456',
  createdAt: '2024-01-15T00:00:00Z',
};

/**
 * Sample Cosmik card with no metadata in content.
 */
const SAMPLE_NO_METADATA_CARD = {
  $type: 'network.cosmik.card',
  type: 'URL' as const,
  url: 'at://did:plc:author3/pub.chive.eprint.submission/ghi789',
  content: {
    $type: 'network.cosmik.card#urlContent',
    url: 'at://did:plc:author3/pub.chive.eprint.submission/ghi789',
  },
  createdAt: '2024-01-15T00:00:00Z',
};

// ============================================================================
// Testable Subclass
// ============================================================================

/**
 * Testable subclass that exposes protected methods for testing.
 */
class TestableCosmikBacklinksPlugin extends CosmikBacklinksPlugin {
  /**
   * Exposes the protected extractContext method for testing.
   */
  public testExtractContext(record: unknown): string | undefined {
    return this.extractContext(record);
  }

  /**
   * Exposes the protected shouldProcess method for testing.
   */
  public testShouldProcess(record: unknown): boolean {
    return this.shouldProcess(record);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('CosmikBacklinksPlugin', () => {
  let plugin: TestableCosmikBacklinksPlugin;
  let context: IPluginContext;
  let backlinkService: IBacklinkService;

  beforeEach(() => {
    backlinkService = createMockBacklinkService();
    context = createMockContext({
      config: { backlinkService },
    });
    plugin = new TestableCosmikBacklinksPlugin();
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.cosmik-backlinks');
    });

    it('should have correct name', () => {
      expect(plugin.manifest.name).toBe('Cosmik Backlinks');
    });

    it('should have correct version', () => {
      expect(plugin.manifest.version).toBe('0.3.0');
    });

    it('should have descriptive text', () => {
      expect(plugin.manifest.description).toBe(
        'Tracks references to Chive eprints from Cosmik cards'
      );
    });

    it('should have correct author', () => {
      expect(plugin.manifest.author).toBe('Aaron Steven White');
    });

    it('should have MIT license', () => {
      expect(plugin.manifest.license).toBe('MIT');
    });

    it('should declare firehose hook permission for cards', () => {
      expect(plugin.manifest.permissions.hooks).toContain('firehose.network.cosmik.card');
    });

    it('should declare storage permission', () => {
      expect(plugin.manifest.permissions.storage?.maxSize).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should have correct entrypoint', () => {
      expect(plugin.manifest.entrypoint).toBe('cosmik-backlinks.js');
    });
  });

  describe('plugin properties', () => {
    it('should track network.cosmik.card collection', () => {
      expect(plugin.trackedCollection).toBe('network.cosmik.card');
    });

    it('should have correct source type', () => {
      expect(plugin.sourceType).toBe('cosmik.collection');
    });
  });

  describe('initialize', () => {
    it('should subscribe to firehose events for cards', async () => {
      await plugin.initialize(context);

      expect(context.eventBus.on).toHaveBeenCalledWith(
        'firehose.network.cosmik.card',
        expect.any(Function)
      );
    });

    it('should store backlink service from context', async () => {
      await plugin.initialize(context);

      const firehoseHandler = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.network.cosmik.card')?.[1];

      expect(firehoseHandler).toBeDefined();

      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/abc123',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_EPRINT_CARD,
        deleted: false,
        cid: 'bafyreiabc123',
        timestamp: new Date(),
      };

      firehoseHandler?.(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalled();
    });

    it('should log initialization info', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Backlink tracking initialized',
        expect.objectContaining({
          collection: 'network.cosmik.card',
          sourceType: 'cosmik.collection',
        })
      );
    });
  });

  describe('extractEprintRefs', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should extract eprint URI from card url', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_EPRINT_CARD);

      expect(refs).toHaveLength(1);
      expect(refs).toContain('at://did:plc:author1/pub.chive.eprint.submission/abc123');
    });

    it('should extract eprint URI from minimal card without content block', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_MINIMAL_CARD);

      expect(refs).toHaveLength(1);
      expect(refs).toContain('at://did:plc:author2/pub.chive.eprint.submission/def456');
    });

    it('should not duplicate when url and content.url match', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_EPRINT_CARD);

      // Both url and content.url point to the same eprint
      expect(refs).toHaveLength(1);
    });

    it('should extract both urls when they differ and both are eprints', () => {
      const card = {
        ...SAMPLE_EPRINT_CARD,
        url: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
        content: {
          $type: 'network.cosmik.card#urlContent',
          url: 'at://did:plc:author2/pub.chive.eprint.submission/def456',
        },
      };

      const refs = plugin.extractEprintRefs(card);

      expect(refs).toHaveLength(2);
      expect(refs).toContain('at://did:plc:author1/pub.chive.eprint.submission/abc123');
      expect(refs).toContain('at://did:plc:author2/pub.chive.eprint.submission/def456');
    });

    it('should return empty array for non-eprint card', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_EXTERNAL_CARD);

      expect(refs).toEqual([]);
    });

    it('should handle card with no url field', () => {
      const malformed = {
        $type: 'network.cosmik.card',
        type: 'URL',
        createdAt: '2024-01-15T00:00:00Z',
      };

      const refs = plugin.extractEprintRefs(malformed);

      expect(refs).toEqual([]);
    });
  });

  describe('extractContext', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should extract title from content metadata', () => {
      const extractedContext = plugin.testExtractContext(SAMPLE_EPRINT_CARD);

      expect(extractedContext).toBe('Semantics of Natural Language');
    });

    it('should return undefined when content has no metadata', () => {
      const extractedContext = plugin.testExtractContext(SAMPLE_NO_METADATA_CARD);

      expect(extractedContext).toBeUndefined();
    });

    it('should return undefined when content block is missing', () => {
      const extractedContext = plugin.testExtractContext(SAMPLE_MINIMAL_CARD);

      expect(extractedContext).toBeUndefined();
    });

    it('should return undefined for empty title', () => {
      const card = {
        ...SAMPLE_EPRINT_CARD,
        content: {
          ...SAMPLE_EPRINT_CARD.content,
          metadata: { title: '' },
        },
      };

      const extractedContext = plugin.testExtractContext(card);

      expect(extractedContext).toBeUndefined();
    });
  });

  describe('shouldProcess', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should always return true for cards', () => {
      expect(plugin.testShouldProcess(SAMPLE_EPRINT_CARD)).toBe(true);
      expect(plugin.testShouldProcess(SAMPLE_EXTERNAL_CARD)).toBe(true);
      expect(plugin.testShouldProcess(SAMPLE_MINIMAL_CARD)).toBe(true);
    });
  });

  describe('firehose record handling', () => {
    let firehoseHandler: (...args: readonly unknown[]) => void;

    beforeEach(async () => {
      await plugin.initialize(context);

      const call = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((c) => c[0] === 'firehose.network.cosmik.card');
      expect(call).toBeDefined();
      expect(call?.[1]).toBeDefined();
      firehoseHandler =
        call?.[1] ??
        ((): void => {
          throw new Error('Handler should have been defined');
        });
    });

    it('should create backlink for eprint card', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/abc123',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_EPRINT_CARD,
        deleted: false,
        cid: 'bafyreiabc123',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalledTimes(1);
      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:user/network.cosmik.card/abc123',
        sourceType: 'cosmik.collection',
        targetUri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
        context: 'Semantics of Natural Language',
      });
    });

    it('should not create backlinks for non-eprint card', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/ext456',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'ext456',
        record: SAMPLE_EXTERNAL_CARD,
        deleted: false,
        cid: 'bafyreiext456',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should create backlink for minimal card with eprint url', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/min789',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'min789',
        record: SAMPLE_MINIMAL_CARD,
        deleted: false,
        cid: 'bafyreimin789',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalledTimes(1);
      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:user/network.cosmik.card/min789',
        sourceType: 'cosmik.collection',
        targetUri: 'at://did:plc:author2/pub.chive.eprint.submission/def456',
        context: undefined,
      });
    });

    it('should handle deletion events', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/deleted123',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'deleted123',
        record: null,
        deleted: true,
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.deleteBacklink).toHaveBeenCalledWith(
        'at://did:plc:user/network.cosmik.card/deleted123'
      );
      expect(context.eventBus.emit).toHaveBeenCalledWith('backlink.deleted', {
        sourceUri: 'at://did:plc:user/network.cosmik.card/deleted123',
        sourceType: 'cosmik.collection',
      });
    });

    it('should emit backlink.created event', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/abc123',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_EPRINT_CARD,
        deleted: false,
        cid: 'bafyreiabc123',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.eventBus.emit).toHaveBeenCalledWith(
        'backlink.created',
        expect.objectContaining({
          sourceType: 'cosmik.collection',
          targetUri: expect.stringContaining('pub.chive.eprint.submission'),
        })
      );
    });

    it('should record metrics on backlink creation', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/abc123',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_EPRINT_CARD,
        deleted: false,
        cid: 'bafyreiabc123',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlinks_created',
        { source_type: 'cosmik.collection' },
        undefined
      );
    });

    it('should record metrics on backlink deletion', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/deleted123',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'deleted123',
        record: null,
        deleted: true,
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlinks_deleted',
        { source_type: 'cosmik.collection' },
        undefined
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(backlinkService.createBacklink).mockRejectedValueOnce(new Error('Database error'));

      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/abc123',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_EPRINT_CARD,
        deleted: false,
        cid: 'bafyreiabc123',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to process firehose record',
        expect.objectContaining({
          error: 'Database error',
          uri: 'at://did:plc:user/network.cosmik.card/abc123',
        })
      );
      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlink_errors',
        { source_type: 'cosmik.collection' },
        undefined
      );
    });
  });

  describe('backlink service unavailable', () => {
    let contextWithoutService: IPluginContext;

    beforeEach(async () => {
      contextWithoutService = createMockContext({
        config: {},
      });
      plugin = new TestableCosmikBacklinksPlugin();
      await plugin.initialize(contextWithoutService);
    });

    it('should not create backlinks when service is unavailable', async () => {
      const handlerCall = vi
        .mocked(contextWithoutService.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.network.cosmik.card');
      expect(handlerCall).toBeDefined();
      expect(handlerCall?.[1]).toBeDefined();
      const firehoseHandler =
        handlerCall?.[1] ??
        ((): void => {
          throw new Error('Handler should have been defined');
        });

      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/network.cosmik.card/abc123',
        collection: 'network.cosmik.card',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_EPRINT_CARD,
        deleted: false,
        cid: 'bafyreiabc123',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw, just log warning
      expect(contextWithoutService.logger.warn).toHaveBeenCalled();
    });
  });
});
