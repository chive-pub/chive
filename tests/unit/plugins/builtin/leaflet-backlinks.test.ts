/**
 * Unit tests for LeafletBacklinksPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LeafletBacklinksPlugin } from '../../../../src/plugins/builtin/leaflet-backlinks.js';
import type { FirehoseRecord } from '../../../../src/plugins/core/backlink-plugin.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type {
  ICacheProvider,
  IMetrics,
  IPluginContext,
  IPluginEventBus,
  IBacklinkService,
  Backlink,
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
    sourceUri: 'at://did:plc:user/xyz.leaflet.list/abc123',
    sourceType: 'leaflet.list',
    targetUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz789',
    indexedAt: new Date(),
    deleted: false,
  } as Backlink),
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
 * Sample Leaflet reading list with eprints.
 */
const SAMPLE_LEAFLET_LIST = {
  $type: 'xyz.leaflet.list',
  name: 'Reading Queue: Semantics Papers',
  description: 'Papers on semantics and pragmatics I want to read',
  visibility: 'public' as const,
  items: [
    {
      uri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
      addedAt: '2024-01-15T10:00:00Z',
      status: 'unread' as const,
      notes: 'Interesting approach to quantifier scope',
      rating: 5,
    },
    {
      uri: 'at://did:plc:author2/pub.chive.eprint.submission/def456',
      addedAt: '2024-01-16T11:30:00Z',
      status: 'reading' as const,
    },
    {
      uri: 'at://did:plc:author3/pub.chive.eprint.submission/ghi789',
      addedAt: '2024-01-17T14:00:00Z',
      status: 'read' as const,
      rating: 4,
    },
  ],
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-17T14:00:00Z',
  tags: ['semantics', 'pragmatics'],
};

/**
 * Sample Leaflet list with mixed URIs (eprints and non-eprints).
 */
const SAMPLE_MIXED_LIST = {
  $type: 'xyz.leaflet.list',
  name: 'Mixed Reading List',
  visibility: 'public' as const,
  items: [
    {
      uri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
      addedAt: '2024-01-15T10:00:00Z',
    },
    {
      uri: 'at://did:plc:user/app.bsky.feed.post/xyz789',
      addedAt: '2024-01-15T11:00:00Z',
    },
    {
      uri: 'at://did:plc:author2/pub.chive.eprint.submission/def456',
      addedAt: '2024-01-15T12:00:00Z',
    },
    {
      uri: 'https://example.com/paper',
      addedAt: '2024-01-15T13:00:00Z',
    },
  ],
  createdAt: '2024-01-15T10:00:00Z',
};

/**
 * Sample private Leaflet list.
 */
const SAMPLE_PRIVATE_LIST = {
  $type: 'xyz.leaflet.list',
  name: 'Private Reading List',
  visibility: 'private' as const,
  items: [
    {
      uri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
      addedAt: '2024-01-15T10:00:00Z',
    },
  ],
  createdAt: '2024-01-15T10:00:00Z',
};

/**
 * Sample followers-only Leaflet list.
 */
const SAMPLE_FOLLOWERS_LIST = {
  $type: 'xyz.leaflet.list',
  name: 'Followers Only List',
  visibility: 'followers' as const,
  items: [
    {
      uri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
      addedAt: '2024-01-15T10:00:00Z',
    },
  ],
  createdAt: '2024-01-15T10:00:00Z',
};

/**
 * Sample Leaflet list with empty items array.
 */
const SAMPLE_EMPTY_LIST = {
  $type: 'xyz.leaflet.list',
  name: 'Empty List',
  visibility: 'public' as const,
  items: [],
  createdAt: '2024-01-15T10:00:00Z',
};

/**
 * Sample Leaflet list without items field.
 */
const SAMPLE_NO_ITEMS_LIST = {
  $type: 'xyz.leaflet.list',
  name: 'No Items List',
  visibility: 'public' as const,
  createdAt: '2024-01-15T10:00:00Z',
};

// ============================================================================
// Testable Subclass
// ============================================================================

/**
 * Testable subclass that exposes protected methods and properties for testing.
 */
class TestableLeafletBacklinksPlugin extends LeafletBacklinksPlugin {
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

  /**
   * Exposes the protected backlinkService for testing.
   */
  public getBacklinkService(): IBacklinkService | undefined {
    return this.backlinkService;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('LeafletBacklinksPlugin', () => {
  let plugin: TestableLeafletBacklinksPlugin;
  let context: IPluginContext;
  let backlinkService: IBacklinkService;

  beforeEach(() => {
    backlinkService = createMockBacklinkService();
    context = createMockContext({
      config: {
        backlinkService,
      },
    });
    plugin = new TestableLeafletBacklinksPlugin();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('manifest and properties', () => {
    it('should have correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.leaflet-backlinks');
    });

    it('should have correct tracked collection', () => {
      expect(plugin.trackedCollection).toBe('xyz.leaflet.list');
    });

    it('should have correct source type', () => {
      expect(plugin.sourceType).toBe('leaflet.list');
    });

    it('should have correct manifest ID', () => {
      expect(plugin.manifest.id).toBe('pub.chive.plugin.leaflet-backlinks');
    });

    it('should have correct manifest name', () => {
      expect(plugin.manifest.name).toBe('Leaflet Backlinks');
    });

    it('should have correct manifest version', () => {
      expect(plugin.manifest.version).toBe('0.1.0');
    });

    it('should have correct manifest description', () => {
      expect(plugin.manifest.description).toBe(
        'Tracks references to Chive eprints from Leaflet reading lists'
      );
    });

    it('should have correct manifest author', () => {
      expect(plugin.manifest.author).toBe('Aaron Steven White');
    });

    it('should have correct manifest license', () => {
      expect(plugin.manifest.license).toBe('MIT');
    });

    it('should declare correct firehose hook permission', () => {
      expect(plugin.manifest.permissions.hooks).toContain('firehose.xyz.leaflet.list');
    });

    it('should declare storage permission with correct max size', () => {
      expect(plugin.manifest.permissions.storage?.maxSize).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should have correct entrypoint', () => {
      expect(plugin.manifest.entrypoint).toBe('leaflet-backlinks.js');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await plugin.initialize(context);

      expect(context.logger.info).toHaveBeenCalledWith(
        'Backlink tracking initialized',
        expect.objectContaining({
          collection: 'xyz.leaflet.list',
          sourceType: 'leaflet.list',
        })
      );
    });

    it('should subscribe to firehose events for xyz.leaflet.list', async () => {
      await plugin.initialize(context);

      expect(context.eventBus.on).toHaveBeenCalledWith(
        'firehose.xyz.leaflet.list',
        expect.any(Function)
      );
    });

    it('should retrieve backlink service from context', async () => {
      await plugin.initialize(context);

      expect(plugin.getBacklinkService()).toBe(backlinkService);
    });
  });

  describe('extractEprintRefs', () => {
    it('should extract eprint URIs from list items', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_LEAFLET_LIST);

      expect(refs).toHaveLength(3);
      expect(refs).toContain('at://did:plc:author1/pub.chive.eprint.submission/abc123');
      expect(refs).toContain('at://did:plc:author2/pub.chive.eprint.submission/def456');
      expect(refs).toContain('at://did:plc:author3/pub.chive.eprint.submission/ghi789');
    });

    it('should filter out non-eprint URIs', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_MIXED_LIST);

      expect(refs).toHaveLength(2);
      expect(refs).toContain('at://did:plc:author1/pub.chive.eprint.submission/abc123');
      expect(refs).toContain('at://did:plc:author2/pub.chive.eprint.submission/def456');
      expect(refs).not.toContain('at://did:plc:user/app.bsky.feed.post/xyz789');
      expect(refs).not.toContain('https://example.com/paper');
    });

    it('should return empty array for empty items', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_EMPTY_LIST);

      expect(refs).toEqual([]);
    });

    it('should return empty array when items field is missing', () => {
      const refs = plugin.extractEprintRefs(SAMPLE_NO_ITEMS_LIST);

      expect(refs).toEqual([]);
    });

    it('should return empty array when items is not an array', () => {
      const invalidList = {
        $type: 'xyz.leaflet.list',
        name: 'Invalid List',
        visibility: 'public',
        items: 'not-an-array',
        createdAt: '2024-01-15T10:00:00Z',
      };

      const refs = plugin.extractEprintRefs(invalidList);

      expect(refs).toEqual([]);
    });

    it('should handle items with undefined URIs', () => {
      const listWithUndefinedUris = {
        $type: 'xyz.leaflet.list',
        name: 'List with Undefined URIs',
        visibility: 'public' as const,
        items: [
          {
            uri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
            addedAt: '2024-01-15T10:00:00Z',
          },
          {
            uri: undefined as unknown as string,
            addedAt: '2024-01-15T11:00:00Z',
          },
          {
            uri: 'at://did:plc:author2/pub.chive.eprint.submission/def456',
            addedAt: '2024-01-15T12:00:00Z',
          },
        ],
        createdAt: '2024-01-15T10:00:00Z',
      };

      const refs = plugin.extractEprintRefs(listWithUndefinedUris);

      expect(refs).toHaveLength(2);
      expect(refs).toContain('at://did:plc:author1/pub.chive.eprint.submission/abc123');
      expect(refs).toContain('at://did:plc:author2/pub.chive.eprint.submission/def456');
    });
  });

  describe('extractContext', () => {
    it('should extract list name when description is present', () => {
      const extractedContext = plugin.testExtractContext(SAMPLE_LEAFLET_LIST);

      expect(extractedContext).toBe(
        'Reading Queue: Semantics Papers: Papers on semantics and pragmatics I want to read'
      );
    });

    it('should extract only list name when description is absent', () => {
      const listWithoutDescription = {
        $type: 'xyz.leaflet.list',
        name: 'My Reading List',
        visibility: 'public' as const,
        items: [],
        createdAt: '2024-01-15T10:00:00Z',
      };

      const extractedContext = plugin.testExtractContext(listWithoutDescription);

      expect(extractedContext).toBe('My Reading List');
    });

    it('should return undefined when name is missing', () => {
      const listWithoutName = {
        $type: 'xyz.leaflet.list',
        visibility: 'public' as const,
        items: [],
        createdAt: '2024-01-15T10:00:00Z',
      };

      const extractedContext = plugin.testExtractContext(listWithoutName);

      expect(extractedContext).toBeUndefined();
    });

    it('should handle empty string name', () => {
      const listWithEmptyName = {
        $type: 'xyz.leaflet.list',
        name: '',
        description: 'Some description',
        visibility: 'public' as const,
        items: [],
        createdAt: '2024-01-15T10:00:00Z',
      };

      const extractedContext = plugin.testExtractContext(listWithEmptyName);

      expect(extractedContext).toBeUndefined();
    });
  });

  describe('shouldProcess', () => {
    it('should return true for public lists', () => {
      const result = plugin.testShouldProcess(SAMPLE_LEAFLET_LIST);

      expect(result).toBe(true);
    });

    it('should return false for private lists', () => {
      const result = plugin.testShouldProcess(SAMPLE_PRIVATE_LIST);

      expect(result).toBe(false);
    });

    it('should return false for followers-only lists', () => {
      const result = plugin.testShouldProcess(SAMPLE_FOLLOWERS_LIST);

      expect(result).toBe(false);
    });

    it('should handle missing visibility field', () => {
      const listWithoutVisibility = {
        $type: 'xyz.leaflet.list',
        name: 'List Without Visibility',
        items: [],
        createdAt: '2024-01-15T10:00:00Z',
      };

      const result = plugin.testShouldProcess(listWithoutVisibility);

      expect(result).toBe(false);
    });
  });

  describe('firehose event handling', () => {
    it('should process public list and create backlinks', async () => {
      await plugin.initialize(context);

      // Get the event handler that was registered
      const onCall = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.xyz.leaflet.list');
      expect(onCall).toBeDefined();
      expect(onCall).toBeDefined();
      const handler = onCall?.[1];
      if (!handler) throw new Error('Handler not found');

      // Create a firehose record
      const firehoseRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.leaflet.list/abc123',
        collection: 'xyz.leaflet.list',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_LEAFLET_LIST,
        deleted: false,
        cid: 'bafyreicid',
        timestamp: new Date(),
      };

      // Call the handler
      handler(firehoseRecord);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalledTimes(3);
      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:user/xyz.leaflet.list/abc123',
        sourceType: 'leaflet.list',
        targetUri: 'at://did:plc:author1/pub.chive.eprint.submission/abc123',
        context:
          'Reading Queue: Semantics Papers: Papers on semantics and pragmatics I want to read',
      });
    });

    it('should not process private lists', async () => {
      await plugin.initialize(context);

      const onCall = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.xyz.leaflet.list');
      expect(onCall).toBeDefined();
      const handler = onCall?.[1];
      if (!handler) throw new Error('Handler not found');

      const firehoseRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.leaflet.list/xyz789',
        collection: 'xyz.leaflet.list',
        did: 'did:plc:user',
        rkey: 'xyz789',
        record: SAMPLE_PRIVATE_LIST,
        deleted: false,
        cid: 'bafyreicid',
        timestamp: new Date(),
      };

      handler(firehoseRecord);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should handle deletion events', async () => {
      await plugin.initialize(context);

      const onCall = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.xyz.leaflet.list');
      expect(onCall).toBeDefined();
      const handler = onCall?.[1];
      if (!handler) throw new Error('Handler not found');

      const deletionRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.leaflet.list/abc123',
        collection: 'xyz.leaflet.list',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: null,
        deleted: true,
        timestamp: new Date(),
      };

      handler(deletionRecord);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.deleteBacklink).toHaveBeenCalledWith(
        'at://did:plc:user/xyz.leaflet.list/abc123'
      );
    });

    it('should emit backlink.created event when backlink is created', async () => {
      await plugin.initialize(context);

      const onCall = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.xyz.leaflet.list');
      expect(onCall).toBeDefined();
      const handler = onCall?.[1];
      if (!handler) throw new Error('Handler not found');

      const firehoseRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.leaflet.list/abc123',
        collection: 'xyz.leaflet.list',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_LEAFLET_LIST,
        deleted: false,
        cid: 'bafyreicid',
        timestamp: new Date(),
      };

      handler(firehoseRecord);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.eventBus.emit).toHaveBeenCalledWith(
        'backlink.created',
        expect.objectContaining({
          sourceUri: 'at://did:plc:user/xyz.leaflet.list/abc123',
          sourceType: 'leaflet.list',
        })
      );
    });

    it('should emit backlink.deleted event when deletion is processed', async () => {
      await plugin.initialize(context);

      const onCall = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.xyz.leaflet.list');
      expect(onCall).toBeDefined();
      const handler = onCall?.[1];
      if (!handler) throw new Error('Handler not found');

      const deletionRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.leaflet.list/abc123',
        collection: 'xyz.leaflet.list',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: null,
        deleted: true,
        timestamp: new Date(),
      };

      handler(deletionRecord);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.eventBus.emit).toHaveBeenCalledWith(
        'backlink.deleted',
        expect.objectContaining({
          sourceUri: 'at://did:plc:user/xyz.leaflet.list/abc123',
          sourceType: 'leaflet.list',
        })
      );
    });

    it('should record metrics when backlinks are created', async () => {
      await plugin.initialize(context);

      const onCall = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.xyz.leaflet.list');
      expect(onCall).toBeDefined();
      const handler = onCall?.[1];
      if (!handler) throw new Error('Handler not found');

      const firehoseRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.leaflet.list/abc123',
        collection: 'xyz.leaflet.list',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_LEAFLET_LIST,
        deleted: false,
        cid: 'bafyreicid',
        timestamp: new Date(),
      };

      handler(firehoseRecord);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlinks_created',
        {
          source_type: 'leaflet.list',
        },
        undefined
      );
    });

    it('should log warnings on processing errors', async () => {
      await plugin.initialize(context);

      // Make createBacklink throw an error
      vi.mocked(backlinkService.createBacklink).mockRejectedValueOnce(new Error('Database error'));

      const onCall = vi
        .mocked(context.eventBus.on)
        .mock.calls.find((call) => call[0] === 'firehose.xyz.leaflet.list');
      expect(onCall).toBeDefined();
      const handler = onCall?.[1];
      if (!handler) throw new Error('Handler not found');

      const firehoseRecord: FirehoseRecord = {
        uri: 'at://did:plc:user/xyz.leaflet.list/abc123',
        collection: 'xyz.leaflet.list',
        did: 'did:plc:user',
        rkey: 'abc123',
        record: SAMPLE_LEAFLET_LIST,
        deleted: false,
        cid: 'bafyreicid',
        timestamp: new Date(),
      };

      handler(firehoseRecord);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to process firehose record',
        expect.objectContaining({
          error: 'Database error',
          uri: 'at://did:plc:user/xyz.leaflet.list/abc123',
        })
      );
    });
  });
});
