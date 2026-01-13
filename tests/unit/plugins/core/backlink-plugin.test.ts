/**
 * Unit tests for BacklinkTrackingPlugin base class.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  BacklinkTrackingPlugin,
  type FirehoseRecord,
} from '../../../../src/plugins/core/backlink-plugin.js';
import type { ICacheProvider } from '../../../../src/types/interfaces/cache.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { IMetrics } from '../../../../src/types/interfaces/metrics.interface.js';
import type {
  Backlink,
  BacklinkSourceType,
  IBacklinkService,
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

const createMockEventBus = (): IPluginEventBus & {
  handlers: Map<string, ((...args: unknown[]) => void)[]>;
  trigger: (event: string, ...args: unknown[]) => Promise<void>;
} => {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();

  return {
    handlers,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const existing = handlers.get(event) ?? [];
      existing.push(handler);
      handlers.set(event, existing);
    }),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    emitAsync: vi.fn().mockResolvedValue(undefined),
    listenerCount: vi.fn().mockReturnValue(0),
    eventNames: vi.fn().mockReturnValue([]),
    removeAllListeners: vi.fn(),
    async trigger(event: string, ...args: unknown[]): Promise<void> {
      const eventHandlers = handlers.get(event) ?? [];
      for (const handler of eventHandlers) {
        await Promise.resolve(handler(...args));
      }
    },
  };
};

const createMockBacklinkService = (): IBacklinkService => ({
  createBacklink: vi.fn().mockResolvedValue({
    id: 1,
    sourceUri: 'at://did:plc:test/collection/rkey',
    sourceType: 'semble.collection',
    targetUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz',
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

const createMockContext = (
  config: Record<string, unknown> = {}
): IPluginContext & { eventBus: ReturnType<typeof createMockEventBus> } => {
  const eventBus = createMockEventBus();
  return {
    logger: createMockLogger(),
    cache: createMockCache(),
    metrics: createMockMetrics(),
    eventBus,
    config,
  };
};

// ============================================================================
// Test Implementation
// ============================================================================

/**
 * Concrete test implementation of BacklinkTrackingPlugin.
 */
class TestBacklinkPlugin extends BacklinkTrackingPlugin {
  readonly id = 'pub.chive.plugin.test-backlink';
  readonly trackedCollection = 'test.collection';
  readonly sourceType: BacklinkSourceType = 'semble.collection';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.test-backlink',
    name: 'Test Backlink Plugin',
    version: '1.0.0',
    description: 'Test plugin for backlink tracking',
    author: 'Test',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.test.collection'],
    },
    entrypoint: 'test.js',
  };

  // Expose for testing
  public extractEprintRefs(record: unknown): string[] {
    const rec = record as { items?: { uri?: string }[] };
    if (!rec.items) return [];
    return rec.items.filter((item) => this.isEprintUri(item.uri)).map((item) => item.uri ?? '');
  }

  // Expose for testing: override visibility filtering
  public shouldProcessPublic = true;
  protected override shouldProcess(_record: unknown): boolean {
    return this.shouldProcessPublic;
  }

  protected override extractContext(record: unknown): string | undefined {
    const rec = record as { title?: string; description?: string };
    return rec.title ?? rec.description;
  }

  // Make protected methods accessible for testing
  public testIsEprintUri(uri: string | undefined | null): boolean {
    return this.isEprintUri(uri);
  }

  public testExtractUrisFromText(text: string): string[] {
    return this.extractUrisFromText(text);
  }

  public async testHandleRecord(uri: string, record: Record<string, unknown>): Promise<void> {
    return this.handleRecord(uri, record);
  }

  public async testHandleDeletion(uri: string): Promise<void> {
    return this.handleDeletion(uri);
  }

  /** Exposes protected backlinkService for testing. */
  public getBacklinkService(): IBacklinkService | undefined {
    return this.backlinkService;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('BacklinkTrackingPlugin', () => {
  let plugin: TestBacklinkPlugin;
  let context: ReturnType<typeof createMockContext>;
  let backlinkService: IBacklinkService;

  beforeEach(() => {
    plugin = new TestBacklinkPlugin();
    backlinkService = createMockBacklinkService();
    context = createMockContext({ backlinkService });
  });

  afterEach(() => {
    vi.clearAllMocks();
    context.eventBus.removeAllListeners();
  });

  describe('initialization', () => {
    it('should initialize and subscribe to firehose events', async () => {
      await plugin.initialize(context);

      expect(context.eventBus.on).toHaveBeenCalledWith(
        'firehose.test.collection',
        expect.any(Function)
      );
      expect(context.logger.info).toHaveBeenCalledWith(
        'Backlink tracking initialized',
        expect.objectContaining({
          collection: 'test.collection',
          sourceType: 'semble.collection',
        })
      );
    });

    it('should store backlink service from context config', async () => {
      await plugin.initialize(context);

      // The service should be set internally
      expect(plugin.getBacklinkService()).toBe(backlinkService);
    });

    it('should handle missing backlink service gracefully', async () => {
      const contextWithoutService = createMockContext({});
      await plugin.initialize(contextWithoutService);

      expect(plugin.getBacklinkService()).toBeUndefined();
    });
  });

  describe('handleFirehoseRecord', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should route create/update events to handleRecord', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:test/test.collection/rkey',
        collection: 'test.collection',
        did: 'did:plc:test',
        rkey: 'rkey',
        record: {
          items: [{ uri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' }],
        },
        deleted: false,
        timestamp: new Date(),
      };

      await plugin.handleFirehoseRecord(record);

      expect(backlinkService.createBacklink).toHaveBeenCalled();
    });

    it('should route deletion events to handleDeletion', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:test/test.collection/rkey',
        collection: 'test.collection',
        did: 'did:plc:test',
        rkey: 'rkey',
        record: null,
        deleted: true,
        timestamp: new Date(),
      };

      await plugin.handleFirehoseRecord(record);

      expect(backlinkService.deleteBacklink).toHaveBeenCalledWith(
        'at://did:plc:test/test.collection/rkey'
      );
    });

    it('should log and count errors on failure', async () => {
      vi.mocked(backlinkService.createBacklink).mockRejectedValueOnce(new Error('DB error'));

      const record: FirehoseRecord = {
        uri: 'at://did:plc:test/test.collection/rkey',
        collection: 'test.collection',
        did: 'did:plc:test',
        rkey: 'rkey',
        record: {
          items: [{ uri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' }],
        },
        deleted: false,
        timestamp: new Date(),
      };

      await plugin.handleFirehoseRecord(record);

      expect(context.logger.warn).toHaveBeenCalledWith(
        'Failed to process firehose record',
        expect.objectContaining({
          error: 'DB error',
          uri: 'at://did:plc:test/test.collection/rkey',
        })
      );
      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlink_errors',
        { source_type: 'semble.collection' },
        undefined
      );
    });
  });

  describe('handleRecord', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should create backlinks for each eprint reference', async () => {
      const record = {
        title: 'My Reading List',
        items: [
          { uri: 'at://did:plc:author1/pub.chive.eprint.submission/paper1' },
          { uri: 'at://did:plc:author2/pub.chive.eprint.submission/paper2' },
        ],
      };

      await plugin.testHandleRecord('at://did:plc:test/test.collection/rkey', record);

      expect(backlinkService.createBacklink).toHaveBeenCalledTimes(2);
      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:test/test.collection/rkey',
        sourceType: 'semble.collection',
        targetUri: 'at://did:plc:author1/pub.chive.eprint.submission/paper1',
        context: 'My Reading List',
      });
    });

    it('should skip records that fail shouldProcess check', async () => {
      plugin.shouldProcessPublic = false;

      const record = {
        items: [{ uri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' }],
      };

      await plugin.testHandleRecord('at://did:plc:test/test.collection/rkey', record);

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should skip records with no eprint references', async () => {
      const record = {
        items: [
          { uri: 'at://did:plc:someone/other.collection/xyz' },
          { uri: 'https://example.com/paper' },
        ],
      };

      await plugin.testHandleRecord('at://did:plc:test/test.collection/rkey', record);

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should log debug message after processing', async () => {
      const record = {
        items: [{ uri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' }],
      };

      await plugin.testHandleRecord('at://did:plc:test/test.collection/rkey', record);

      expect(context.logger.debug).toHaveBeenCalledWith(
        'Processed backlinks from record',
        expect.objectContaining({
          uri: 'at://did:plc:test/test.collection/rkey',
          targetCount: 1,
        })
      );
    });
  });

  describe('handleDeletion', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should call deleteBacklink on service', async () => {
      await plugin.testHandleDeletion('at://did:plc:test/test.collection/rkey');

      expect(backlinkService.deleteBacklink).toHaveBeenCalledWith(
        'at://did:plc:test/test.collection/rkey'
      );
    });

    it('should emit backlink.deleted event', async () => {
      await plugin.testHandleDeletion('at://did:plc:test/test.collection/rkey');

      expect(context.eventBus.emit).toHaveBeenCalledWith('backlink.deleted', {
        sourceUri: 'at://did:plc:test/test.collection/rkey',
        sourceType: 'semble.collection',
      });
    });

    it('should record deletion metric', async () => {
      await plugin.testHandleDeletion('at://did:plc:test/test.collection/rkey');

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlinks_deleted',
        { source_type: 'semble.collection' },
        undefined
      );
    });

    it('should skip if backlink service not available', async () => {
      const contextWithoutService = createMockContext({});
      await plugin.initialize(contextWithoutService);

      await plugin.testHandleDeletion('at://did:plc:test/test.collection/rkey');

      // Should not throw, just silently skip
      expect(context.eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('createBacklink', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should create backlink and emit event', async () => {
      const record = {
        title: 'Test Collection',
        items: [{ uri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' }],
      };

      await plugin.testHandleRecord('at://did:plc:test/test.collection/rkey', record);

      expect(context.eventBus.emit).toHaveBeenCalledWith('backlink.created', {
        sourceUri: 'at://did:plc:test/test.collection/rkey',
        sourceType: 'semble.collection',
        targetUri: 'at://did:plc:author/pub.chive.eprint.submission/xyz',
      });
    });

    it('should record creation metric', async () => {
      const record = {
        items: [{ uri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' }],
      };

      await plugin.testHandleRecord('at://did:plc:test/test.collection/rkey', record);

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlinks_created',
        { source_type: 'semble.collection' },
        undefined
      );
    });

    it('should return null if backlink service not available', async () => {
      // Create a new plugin instance with a context that has no backlink service
      const newPlugin = new TestBacklinkPlugin();
      const contextWithoutService = createMockContext({});
      await newPlugin.initialize(contextWithoutService);

      const record = {
        items: [{ uri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' }],
      };

      // Should not throw
      await newPlugin.testHandleRecord('at://did:plc:test/test.collection/rkey', record);

      expect(contextWithoutService.logger.warn).toHaveBeenCalledWith(
        'Backlink service not available'
      );
    });
  });

  describe('isEprintUri', () => {
    it('should return true for valid eprint URIs', () => {
      expect(plugin.testIsEprintUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')).toBe(true);
    });

    it('should return false for non-eprint URIs', () => {
      expect(plugin.testIsEprintUri('at://did:plc:abc/other.collection/xyz')).toBe(false);
      expect(plugin.testIsEprintUri('https://example.com/paper')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(plugin.testIsEprintUri(null)).toBe(false);
      expect(plugin.testIsEprintUri(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(plugin.testIsEprintUri('')).toBe(false);
    });
  });

  describe('extractUrisFromText', () => {
    it('should extract AT-URIs from markdown text', () => {
      const text = `
        Check out this paper: at://did:plc:author/pub.chive.eprint.submission/abc123
        And this one too: at://did:plc:other/pub.chive.eprint.submission/def456
      `;

      const uris = plugin.testExtractUrisFromText(text);

      expect(uris).toEqual([
        'at://did:plc:author/pub.chive.eprint.submission/abc123',
        'at://did:plc:other/pub.chive.eprint.submission/def456',
      ]);
    });

    it('should filter out non-eprint AT-URIs', () => {
      const text = `
        at://did:plc:author/pub.chive.eprint.submission/paper1
        at://did:plc:someone/app.bsky.feed.post/xyz
        at://did:plc:other/some.other.collection/abc
      `;

      const uris = plugin.testExtractUrisFromText(text);

      expect(uris).toEqual(['at://did:plc:author/pub.chive.eprint.submission/paper1']);
    });

    it('should return empty array for text without AT-URIs', () => {
      const text = 'Just some regular text without any AT-URIs.';

      const uris = plugin.testExtractUrisFromText(text);

      expect(uris).toEqual([]);
    });

    it('should handle empty string', () => {
      expect(plugin.testExtractUrisFromText('')).toEqual([]);
    });
  });

  describe('firehose event subscription', () => {
    it('should handle firehose events correctly', async () => {
      await plugin.initialize(context);

      const record: FirehoseRecord = {
        uri: 'at://did:plc:test/test.collection/rkey',
        collection: 'test.collection',
        did: 'did:plc:test',
        rkey: 'rkey',
        record: {
          items: [{ uri: 'at://did:plc:author/pub.chive.eprint.submission/xyz' }],
        },
        deleted: false,
        timestamp: new Date(),
      };

      // Trigger the event
      await context.eventBus.trigger('firehose.test.collection', record);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalled();
    });
  });
});
