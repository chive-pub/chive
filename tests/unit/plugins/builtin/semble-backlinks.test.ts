/**
 * Unit tests for SembleBacklinksPlugin.
 *
 * @remarks
 * Tests backlink tracking from Semble collections to Chive eprints.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SembleBacklinksPlugin } from '../../../../src/plugins/builtin/semble-backlinks.js';
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
    sourceUri: 'at://did:plc:user/xyz.semble.collection/abc123',
    sourceType: 'semble.collection',
    targetUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz789',
    context: 'Test Collection',
    indexedAt: new Date(),
    deleted: false,
  }),
  deleteBacklink: vi.fn().mockResolvedValue(undefined),
  getBacklinks: vi.fn().mockResolvedValue({ backlinks: [], cursor: undefined }),
  getCounts: vi.fn().mockResolvedValue({
    sembleCollections: 0,
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
 * Sample Semble collection with eprint references.
 */
const SAMPLE_PUBLIC_COLLECTION = {
  $type: 'xyz.semble.collection',
  title: 'Linguistics Reading List',
  description: 'Papers on semantic theory',
  visibility: 'public' as const,
  items: [
    {
      uri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
      addedAt: '2024-01-15T00:00:00Z',
      note: 'Great paper on semantics',
    },
    {
      uri: 'at://did:plc:author2/pub.chive.eprint.submission/def456',
      addedAt: '2024-01-16T00:00:00Z',
    },
    {
      uri: 'https://example.com/some-article',
      addedAt: '2024-01-17T00:00:00Z',
      note: 'Not a Chive eprint',
    },
  ],
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-17T00:00:00Z',
};

/**
 * Sample private Semble collection.
 */
const SAMPLE_PRIVATE_COLLECTION = {
  $type: 'xyz.semble.collection',
  title: 'Private Collection',
  description: 'Private research notes',
  visibility: 'private' as const,
  items: [
    {
      uri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
      addedAt: '2024-01-15T00:00:00Z',
    },
  ],
  createdAt: '2024-01-15T00:00:00Z',
};

/**
 * Sample unlisted Semble collection.
 */
const SAMPLE_UNLISTED_COLLECTION = {
  $type: 'xyz.semble.collection',
  title: 'Unlisted Collection',
  visibility: 'unlisted' as const,
  items: [
    {
      uri: 'at://did:plc:author1/pub.chive.eprint.submission/xyz789',
      addedAt: '2024-01-15T00:00:00Z',
    },
  ],
  createdAt: '2024-01-15T00:00:00Z',
};

/**
 * Sample collection with no items.
 */
const SAMPLE_EMPTY_COLLECTION = {
  $type: 'xyz.semble.collection',
  title: 'Empty Collection',
  visibility: 'public' as const,
  items: [],
  createdAt: '2024-01-15T00:00:00Z',
};

/**
 * Sample collection with missing items field.
 */
const SAMPLE_MALFORMED_COLLECTION = {
  $type: 'xyz.semble.collection',
  title: 'Malformed Collection',
  visibility: 'public' as const,
  createdAt: '2024-01-15T00:00:00Z',
};

// ============================================================================
// Testable Subclass
// ============================================================================

/**
 * Testable subclass that exposes protected methods for testing.
 */
class TestableSembleBacklinksPlugin extends SembleBacklinksPlugin {
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

describe('SembleBacklinksPlugin', () => {
  let plugin: TestableSembleBacklinksPlugin;
  let context: IPluginContext;
  let backlinkService: IBacklinkService;

  beforeEach(() => {
    backlinkService = createMockBacklinkService();
    context = createMockContext({
      config: { backlinkService },
    });
    plugin = new TestableSembleBacklinksPlugin();
  });

  describe('manifest', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.semble-backlinks');
    });

    it('should have correct name', () => {
      expect(plugin.manifest.name).toBe('Semble Backlinks');
    });

    it('should have correct version', () => {
      expect(plugin.manifest.version).toBe('0.1.0');
    });

    it('should have descriptive text', () => {
      expect(plugin.manifest.description).toBe(
        'Tracks references to Chive eprints from Semble collections'
      );
    });

    it('should have correct author', () => {
      expect(plugin.manifest.author).toBe('Aaron Steven White');
    });

    it('should have MIT license', () => {
      expect(plugin.manifest.license).toBe('MIT');
    });

    it('should declare firehose hook permission', () => {
      expect(plugin.manifest.permissions.hooks).toContain('firehose.xyz.semble.collection');
    });

    it('should declare storage permission', () => {
      expect(plugin.manifest.permissions.storage?.maxSize).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should have correct entrypoint', () => {
      expect(plugin.manifest.entrypoint).toBe('semble-backlinks.js');
    });
  });

  describe('plugin properties', () => {
    it('should have correct tracked collection', () => {
      expect(plugin.trackedCollection).toBe('xyz.semble.collection');
    });

    it('should have correct source type', () => {
      expect(plugin.sourceType).toBe('semble.collection');
    });
  });

  describe('initialize', () => {
    it('should subscribe to firehose events', async () => {
      await plugin.initialize(context);

      expect(context.eventBus.on).toHaveBeenCalledWith(
        'firehose.xyz.semble.collection',
        expect.any(Function)
      );
    });

    it('should store backlink service from context', async () => {
      await plugin.initialize(context);

      // Verify backlink service is available by triggering a record event
      const firehoseHandler = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.xyz.semble.collection')?.[1];

      expect(firehoseHandler).toBeDefined();

      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/abc123',
        collection: 'xyz.semble.collection',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_PUBLIC_COLLECTION,
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
          collection: 'xyz.semble.collection',
          sourceType: 'semble.collection',
        })
      );
    });
  });

  describe('extractEprintRefs', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should extract eprint URIs from collection items', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_PUBLIC_COLLECTION);

      expect(refs).toHaveLength(2);
      expect(refs).toContain('at://did:plc:author1/pub.chive.eprint.submission/abc123');
      expect(refs).toContain('at://did:plc:author2/pub.chive.eprint.submission/def456');
    });

    it('should filter out non-eprint URIs', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_PUBLIC_COLLECTION);

      expect(refs).not.toContain('https://example.com/some-article');
    });

    it('should return empty array for collection with no items', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_EMPTY_COLLECTION);

      expect(refs).toEqual([]);
    });

    it('should return empty array for collection with missing items field', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_MALFORMED_COLLECTION);

      expect(refs).toEqual([]);
    });

    it('should handle collection with items not being an array', () => {
      const malformed = {
        ...SAMPLE_PUBLIC_COLLECTION,
        items: 'not-an-array',
      };

      const refs = plugin.extractEprintRefs(malformed);

      expect(refs).toEqual([]);
    });

    it('should handle collection with null items', () => {
      const malformed = {
        ...SAMPLE_PUBLIC_COLLECTION,
        items: null,
      };

      const refs = plugin.extractEprintRefs(malformed);

      expect(refs).toEqual([]);
    });

    it('should only extract URIs containing pub.chive.eprint.submission', () => {
      const collection = {
        $type: 'xyz.semble.collection',
        title: 'Mixed Collection',
        visibility: 'public' as const,
        items: [
          {
            uri: 'at://did:plc:user/pub.chive.eprint.submission/abc123',
            addedAt: '2024-01-15T00:00:00Z',
          },
          {
            uri: 'at://did:plc:user/pub.chive.review.comment/def456',
            addedAt: '2024-01-15T00:00:00Z',
          },
          {
            uri: 'at://did:plc:user/app.bsky.feed.post/xyz789',
            addedAt: '2024-01-15T00:00:00Z',
          },
        ],
        createdAt: '2024-01-15T00:00:00Z',
      };

      const refs = plugin.extractEprintRefs(collection);

      expect(refs).toHaveLength(1);
      expect(refs[0]).toBe('at://did:plc:user/pub.chive.eprint.submission/abc123');
    });
  });

  describe('extractContext', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should extract title and description when both present', () => {
      const extractedContext = plugin.testExtractContext(SAMPLE_PUBLIC_COLLECTION);

      expect(extractedContext).toBe('Linguistics Reading List: Papers on semantic theory');
    });

    it('should extract title only when description is missing', () => {
      const collection = {
        ...SAMPLE_PUBLIC_COLLECTION,
        description: undefined,
      };

      const extractedContext = plugin.testExtractContext(collection);

      expect(extractedContext).toBe('Linguistics Reading List');
    });

    it('should return undefined when title is missing', () => {
      const collection = {
        ...SAMPLE_PUBLIC_COLLECTION,
        title: '',
      };

      const extractedContext = plugin.testExtractContext(collection);

      expect(extractedContext).toBeUndefined();
    });

    it('should handle collection with empty description', () => {
      const collection = {
        ...SAMPLE_PUBLIC_COLLECTION,
        description: '',
      };

      const extractedContext = plugin.testExtractContext(collection);

      // Empty description is falsy, so it only returns the title
      expect(extractedContext).toBe('Linguistics Reading List');
    });
  });

  describe('shouldProcess', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should return true for public collections', () => {
      const shouldProcess = plugin.testShouldProcess(SAMPLE_PUBLIC_COLLECTION);

      expect(shouldProcess).toBe(true);
    });

    it('should return true for unlisted collections', () => {
      const shouldProcess = plugin.testShouldProcess(SAMPLE_UNLISTED_COLLECTION);

      expect(shouldProcess).toBe(true);
    });

    it('should return false for private collections', () => {
      const shouldProcess = plugin.testShouldProcess(SAMPLE_PRIVATE_COLLECTION);

      expect(shouldProcess).toBe(false);
    });
  });

  describe('firehose record handling', () => {
    let firehoseHandler: (...args: readonly unknown[]) => void;

    beforeEach(async () => {
      await plugin.initialize(context);

      const call = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((c) => c[0] === 'firehose.xyz.semble.collection');
      expect(call).toBeDefined();
      expect(call?.[1]).toBeDefined();
      firehoseHandler =
        call?.[1] ??
        ((): void => {
          throw new Error('Handler should have been defined');
        });
    });

    it('should create backlinks for public collection', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/abc123',
        collection: 'xyz.semble.collection',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_PUBLIC_COLLECTION,
        deleted: false,
        cid: 'bafyreiabc123',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalledTimes(2);
      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:user/xyz.semble.collection/abc123',
        sourceType: 'semble.collection',
        targetUri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
        context: 'Linguistics Reading List: Papers on semantic theory',
      });
      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:user/xyz.semble.collection/abc123',
        sourceType: 'semble.collection',
        targetUri: 'at://did:plc:author2/pub.chive.eprint.submission/def456',
        context: 'Linguistics Reading List: Papers on semantic theory',
      });
    });

    it('should not create backlinks for private collection', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/private123',
        collection: 'xyz.semble.collection',
        did: 'did:plc:user',
        rkey: 'private123',
        record: SAMPLE_PRIVATE_COLLECTION,
        deleted: false,
        cid: 'bafyreiprivate',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should create backlinks for unlisted collection', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/unlisted123',
        collection: 'xyz.semble.collection',
        did: 'did:plc:user',
        rkey: 'unlisted123',
        record: SAMPLE_UNLISTED_COLLECTION,
        deleted: false,
        cid: 'bafyreiunlisted',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalledTimes(1);
    });

    it('should not create backlinks for empty collection', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/empty123',
        collection: 'xyz.semble.collection',
        did: 'did:plc:user',
        rkey: 'empty123',
        record: SAMPLE_EMPTY_COLLECTION,
        deleted: false,
        cid: 'bafyreiempty',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should handle deletion events', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/deleted123',
        collection: 'xyz.semble.collection',
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
        'at://did:plc:user/xyz.semble.collection/deleted123'
      );
      expect(context.eventBus.emit).toHaveBeenCalledWith('backlink.deleted', {
        sourceUri: 'at://did:plc:user/xyz.semble.collection/deleted123',
        sourceType: 'semble.collection',
      });
    });

    it('should emit backlink.created event', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/abc123',
        collection: 'xyz.semble.collection',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_PUBLIC_COLLECTION,
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
          sourceType: 'semble.collection',
          targetUri: expect.stringContaining('pub.chive.eprint.submission'),
        })
      );
    });

    it('should record metrics on backlink creation', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/abc123',
        collection: 'xyz.semble.collection',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_PUBLIC_COLLECTION,
        deleted: false,
        cid: 'bafyreiabc123',
        timestamp: new Date(),
      };

      firehoseHandler(record);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlinks_created',
        { source_type: 'semble.collection' },
        undefined
      );
    });

    it('should record metrics on backlink deletion', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/deleted123',
        collection: 'xyz.semble.collection',
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
        { source_type: 'semble.collection' },
        undefined
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(backlinkService.createBacklink).mockRejectedValueOnce(new Error('Database error'));

      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/abc123',
        collection: 'xyz.semble.collection',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_PUBLIC_COLLECTION,
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
          uri: 'at://did:plc:user/xyz.semble.collection/abc123',
        })
      );
      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlink_errors',
        { source_type: 'semble.collection' },
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
      plugin = new TestableSembleBacklinksPlugin();
      await plugin.initialize(contextWithoutService);
    });

    it('should not create backlinks when service is unavailable', async () => {
      const handlerCall = vi
        .mocked(contextWithoutService.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.xyz.semble.collection');
      expect(handlerCall).toBeDefined();
      expect(handlerCall?.[1]).toBeDefined();
      const firehoseHandler =
        handlerCall?.[1] ??
        ((): void => {
          throw new Error('Handler should have been defined');
        });

      const record: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.semble.collection/abc123',
        collection: 'xyz.semble.collection',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_PUBLIC_COLLECTION,
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
