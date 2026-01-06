/**
 * Unit tests for WhiteWindBacklinksPlugin.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { WhiteWindBacklinksPlugin } from '../../../../src/plugins/builtin/whitewind-backlinks.js';
import type { FirehoseRecord } from '../../../../src/plugins/core/backlink-plugin.js';
import type { ICacheProvider } from '../../../../src/types/interfaces/cache.interface.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { IMetrics } from '../../../../src/types/interfaces/metrics.interface.js';
import type {
  Backlink,
  IBacklinkService,
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
    sourceUri: 'at://did:plc:test/com.whitewind.blog.entry/rkey',
    sourceType: 'whitewind.blog',
    targetUri: 'at://did:plc:author/pub.chive.preprint.submission/xyz',
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
// Testable Subclass
// ============================================================================

/**
 * Testable subclass that exposes protected methods for testing.
 */
class TestableWhiteWindBacklinksPlugin extends WhiteWindBacklinksPlugin {
  /** Exposes protected extractContext for testing. */
  extractContext(record: unknown): string | undefined {
    return super.extractContext(record);
  }

  /** Exposes protected shouldProcess for testing. */
  shouldProcess(record: unknown): boolean {
    return super.shouldProcess(record);
  }

  /** Exposes protected backlinkService for testing. */
  getBacklinkService(): unknown {
    return this.backlinkService;
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

const createWhiteWindEntry = (
  overrides: Partial<{
    title: string;
    content: string;
    contentFormat: 'markdown' | 'html' | 'plaintext';
    visibility: 'public' | 'unlisted' | 'private';
    embed: { $type: string; uri: string; cid?: string };
    tags: string[];
  }> = {}
): Record<string, unknown> => ({
  $type: 'com.whitewind.blog.entry' as const,
  title: 'Test Blog Post',
  content: 'Test content',
  contentFormat: 'markdown' as const,
  visibility: 'public' as const,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('WhiteWindBacklinksPlugin', () => {
  let plugin: TestableWhiteWindBacklinksPlugin;
  let context: ReturnType<typeof createMockContext>;
  let backlinkService: IBacklinkService;

  beforeEach(() => {
    plugin = new TestableWhiteWindBacklinksPlugin();
    backlinkService = createMockBacklinkService();
    context = createMockContext({ backlinkService });
  });

  afterEach(() => {
    vi.clearAllMocks();
    context.eventBus.removeAllListeners();
  });

  describe('plugin metadata', () => {
    it('should have correct plugin id', () => {
      expect(plugin.id).toBe('pub.chive.plugin.whitewind-backlinks');
    });

    it('should have correct tracked collection', () => {
      expect(plugin.trackedCollection).toBe('com.whitewind.blog.entry');
    });

    it('should have correct source type', () => {
      expect(plugin.sourceType).toBe('whitewind.blog');
    });
  });

  describe('manifest', () => {
    it('should have correct manifest id', () => {
      expect(plugin.manifest.id).toBe('pub.chive.plugin.whitewind-backlinks');
    });

    it('should have correct manifest name', () => {
      expect(plugin.manifest.name).toBe('WhiteWind Backlinks');
    });

    it('should have correct version', () => {
      expect(plugin.manifest.version).toBe('0.1.0');
    });

    it('should have correct description', () => {
      expect(plugin.manifest.description).toBe(
        'Tracks references to Chive preprints from WhiteWind blog posts'
      );
    });

    it('should have correct author', () => {
      expect(plugin.manifest.author).toBe('Aaron Steven White');
    });

    it('should have correct license', () => {
      expect(plugin.manifest.license).toBe('MIT');
    });

    it('should have correct permissions', () => {
      expect(plugin.manifest.permissions).toEqual({
        hooks: ['firehose.com.whitewind.blog.entry'],
        storage: {
          maxSize: 10 * 1024 * 1024, // 10MB
        },
      });
    });

    it('should have correct entrypoint', () => {
      expect(plugin.manifest.entrypoint).toBe('whitewind-backlinks.js');
    });
  });

  describe('initialization', () => {
    it('should initialize and subscribe to firehose events', async () => {
      await plugin.initialize(context);

      expect(context.eventBus.on).toHaveBeenCalledWith(
        'firehose.com.whitewind.blog.entry',
        expect.any(Function)
      );
      expect(context.logger.info).toHaveBeenCalledWith(
        'Backlink tracking initialized',
        expect.objectContaining({
          collection: 'com.whitewind.blog.entry',
          sourceType: 'whitewind.blog',
        })
      );
    });

    it('should store backlink service from context config', async () => {
      await plugin.initialize(context);

      // The service should be set internally
      expect(plugin.getBacklinkService()).toBe(backlinkService);
    });
  });

  describe('extractPreprintRefs - embed only', () => {
    it('should extract preprint URI from embed', () => {
      const entry = createWhiteWindEntry({
        embed: {
          $type: 'com.whitewind.blog.embed#record',
          uri: 'at://did:plc:author/pub.chive.preprint.submission/xyz',
        },
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual(['at://did:plc:author/pub.chive.preprint.submission/xyz']);
    });

    it('should not extract non-preprint URI from embed', () => {
      const entry = createWhiteWindEntry({
        embed: {
          $type: 'com.whitewind.blog.embed#record',
          uri: 'at://did:plc:someone/app.bsky.feed.post/xyz',
        },
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([]);
    });

    it('should handle entry without embed', () => {
      const entry = createWhiteWindEntry();

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([]);
    });
  });

  describe('extractPreprintRefs - markdown content', () => {
    it('should extract preprint URI from markdown content', () => {
      const entry = createWhiteWindEntry({
        content: 'Check out this paper: at://did:plc:author/pub.chive.preprint.submission/abc123',
        contentFormat: 'markdown',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual(['at://did:plc:author/pub.chive.preprint.submission/abc123']);
    });

    it('should extract multiple preprint URIs from markdown content', () => {
      const entry = createWhiteWindEntry({
        content: `
          First paper: at://did:plc:author1/pub.chive.preprint.submission/paper1
          Second paper: at://did:plc:author2/pub.chive.preprint.submission/paper2
          Third paper: at://did:plc:author3/pub.chive.preprint.submission/paper3
        `,
        contentFormat: 'markdown',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([
        'at://did:plc:author1/pub.chive.preprint.submission/paper1',
        'at://did:plc:author2/pub.chive.preprint.submission/paper2',
        'at://did:plc:author3/pub.chive.preprint.submission/paper3',
      ]);
    });

    it('should filter out non-preprint URIs from markdown content', () => {
      const entry = createWhiteWindEntry({
        content: `
          Preprint: at://did:plc:author/pub.chive.preprint.submission/paper1
          Bluesky post: at://did:plc:someone/app.bsky.feed.post/xyz
          Other collection: at://did:plc:other/some.collection/abc
        `,
        contentFormat: 'markdown',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual(['at://did:plc:author/pub.chive.preprint.submission/paper1']);
    });

    it('should return empty array for markdown content without AT-URIs', () => {
      const entry = createWhiteWindEntry({
        content: 'Just some regular blog post text without any AT-URIs.',
        contentFormat: 'markdown',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([]);
    });
  });

  describe('extractPreprintRefs - HTML content', () => {
    it('should extract preprint URI from HTML content', () => {
      const entry = createWhiteWindEntry({
        content:
          '<p>Check out <a href="at://did:plc:author/pub.chive.preprint.submission/abc">this paper</a></p>',
        contentFormat: 'html',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual(['at://did:plc:author/pub.chive.preprint.submission/abc']);
    });

    it('should extract multiple preprint URIs from HTML content', () => {
      const entry = createWhiteWindEntry({
        content: `
          <p>Papers: at://did:plc:author1/pub.chive.preprint.submission/paper1</p>
          <p>And: at://did:plc:author2/pub.chive.preprint.submission/paper2</p>
        `,
        contentFormat: 'html',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([
        'at://did:plc:author1/pub.chive.preprint.submission/paper1',
        'at://did:plc:author2/pub.chive.preprint.submission/paper2',
      ]);
    });
  });

  describe('extractPreprintRefs - plaintext content', () => {
    it('should not extract URIs from plaintext content', () => {
      const entry = createWhiteWindEntry({
        content: 'Some plaintext with at://did:plc:author/pub.chive.preprint.submission/abc123',
        contentFormat: 'plaintext',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([]);
    });
  });

  describe('extractPreprintRefs - embed and content', () => {
    it('should extract from both embed and content', () => {
      const entry = createWhiteWindEntry({
        embed: {
          $type: 'com.whitewind.blog.embed#record',
          uri: 'at://did:plc:author1/pub.chive.preprint.submission/paper1',
        },
        content: 'Also see: at://did:plc:author2/pub.chive.preprint.submission/paper2',
        contentFormat: 'markdown',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toContain('at://did:plc:author1/pub.chive.preprint.submission/paper1');
      expect(refs).toContain('at://did:plc:author2/pub.chive.preprint.submission/paper2');
      expect(refs).toHaveLength(2);
    });
  });

  describe('extractPreprintRefs - deduplication', () => {
    it('should deduplicate same URI in embed and content', () => {
      const uri = 'at://did:plc:author/pub.chive.preprint.submission/paper1';
      const entry = createWhiteWindEntry({
        embed: {
          $type: 'com.whitewind.blog.embed#record',
          uri,
        },
        content: `This paper: ${uri} is great!`,
        contentFormat: 'markdown',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([uri]);
      expect(refs).toHaveLength(1);
    });

    it('should deduplicate same URI mentioned multiple times in content', () => {
      const uri = 'at://did:plc:author/pub.chive.preprint.submission/paper1';
      const entry = createWhiteWindEntry({
        content: `First mention: ${uri}. Second mention: ${uri}. Third: ${uri}`,
        contentFormat: 'markdown',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([uri]);
      expect(refs).toHaveLength(1);
    });
  });

  describe('extractContext', () => {
    it('should extract title as context', () => {
      const entry = createWhiteWindEntry({
        title: 'My Awesome Blog Post',
      });

      const context = plugin.extractContext(entry);

      expect(context).toBe('My Awesome Blog Post');
    });

    it('should return title even if empty string', () => {
      const entry = createWhiteWindEntry({
        title: '',
      });

      const context = plugin.extractContext(entry);

      expect(context).toBe('');
    });
  });

  describe('shouldProcess - visibility filtering', () => {
    it('should return true for public entries', () => {
      const entry = createWhiteWindEntry({
        visibility: 'public',
      });

      const shouldProcess = plugin.shouldProcess(entry);

      expect(shouldProcess).toBe(true);
    });

    it('should return false for unlisted entries', () => {
      const entry = createWhiteWindEntry({
        visibility: 'unlisted',
      });

      const shouldProcess = plugin.shouldProcess(entry);

      expect(shouldProcess).toBe(false);
    });

    it('should return false for private entries', () => {
      const entry = createWhiteWindEntry({
        visibility: 'private',
      });

      const shouldProcess = plugin.shouldProcess(entry);

      expect(shouldProcess).toBe(false);
    });
  });

  describe('integration - firehose event handling', () => {
    beforeEach(async () => {
      await plugin.initialize(context);
    });

    it('should create backlink from public entry with embed', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:blogger/com.whitewind.blog.entry/post123',
        collection: 'com.whitewind.blog.entry',
        did: 'did:plc:blogger',
        rkey: 'post123',
        record: createWhiteWindEntry({
          title: 'Great Paper Review',
          embed: {
            $type: 'com.whitewind.blog.embed#record',
            uri: 'at://did:plc:author/pub.chive.preprint.submission/xyz',
          },
        }),
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.com.whitewind.blog.entry', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:blogger/com.whitewind.blog.entry/post123',
        sourceType: 'whitewind.blog',
        targetUri: 'at://did:plc:author/pub.chive.preprint.submission/xyz',
        context: 'Great Paper Review',
      });
    });

    it('should create backlinks from markdown content', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:blogger/com.whitewind.blog.entry/post456',
        collection: 'com.whitewind.blog.entry',
        did: 'did:plc:blogger',
        rkey: 'post456',
        record: createWhiteWindEntry({
          title: 'Reading List',
          content: `
            Paper 1: at://did:plc:author1/pub.chive.preprint.submission/paper1
            Paper 2: at://did:plc:author2/pub.chive.preprint.submission/paper2
          `,
          contentFormat: 'markdown',
        }),
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.com.whitewind.blog.entry', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).toHaveBeenCalledTimes(2);
      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:blogger/com.whitewind.blog.entry/post456',
        sourceType: 'whitewind.blog',
        targetUri: 'at://did:plc:author1/pub.chive.preprint.submission/paper1',
        context: 'Reading List',
      });
      expect(backlinkService.createBacklink).toHaveBeenCalledWith({
        sourceUri: 'at://did:plc:blogger/com.whitewind.blog.entry/post456',
        sourceType: 'whitewind.blog',
        targetUri: 'at://did:plc:author2/pub.chive.preprint.submission/paper2',
        context: 'Reading List',
      });
    });

    it('should not create backlink for unlisted entry', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:blogger/com.whitewind.blog.entry/post789',
        collection: 'com.whitewind.blog.entry',
        did: 'did:plc:blogger',
        rkey: 'post789',
        record: createWhiteWindEntry({
          visibility: 'unlisted',
          embed: {
            $type: 'com.whitewind.blog.embed#record',
            uri: 'at://did:plc:author/pub.chive.preprint.submission/xyz',
          },
        }),
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.com.whitewind.blog.entry', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should not create backlink for private entry', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:blogger/com.whitewind.blog.entry/post000',
        collection: 'com.whitewind.blog.entry',
        did: 'did:plc:blogger',
        rkey: 'post000',
        record: createWhiteWindEntry({
          visibility: 'private',
          embed: {
            $type: 'com.whitewind.blog.embed#record',
            uri: 'at://did:plc:author/pub.chive.preprint.submission/xyz',
          },
        }),
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.com.whitewind.blog.entry', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should not create backlink for entry without preprint refs', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:blogger/com.whitewind.blog.entry/post111',
        collection: 'com.whitewind.blog.entry',
        did: 'did:plc:blogger',
        rkey: 'post111',
        record: createWhiteWindEntry({
          content: 'Just a regular blog post without any preprint references.',
          contentFormat: 'markdown',
        }),
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.com.whitewind.blog.entry', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.createBacklink).not.toHaveBeenCalled();
    });

    it('should handle deletion events', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:blogger/com.whitewind.blog.entry/post222',
        collection: 'com.whitewind.blog.entry',
        did: 'did:plc:blogger',
        rkey: 'post222',
        record: null,
        deleted: true,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.com.whitewind.blog.entry', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(backlinkService.deleteBacklink).toHaveBeenCalledWith(
        'at://did:plc:blogger/com.whitewind.blog.entry/post222'
      );
      expect(context.eventBus.emit).toHaveBeenCalledWith('backlink.deleted', {
        sourceUri: 'at://did:plc:blogger/com.whitewind.blog.entry/post222',
        sourceType: 'whitewind.blog',
      });
    });

    it('should emit backlink.created events', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:blogger/com.whitewind.blog.entry/post333',
        collection: 'com.whitewind.blog.entry',
        did: 'did:plc:blogger',
        rkey: 'post333',
        record: createWhiteWindEntry({
          embed: {
            $type: 'com.whitewind.blog.embed#record',
            uri: 'at://did:plc:author/pub.chive.preprint.submission/xyz',
          },
        }),
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.com.whitewind.blog.entry', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.eventBus.emit).toHaveBeenCalledWith('backlink.created', {
        sourceUri: 'at://did:plc:blogger/com.whitewind.blog.entry/post333',
        sourceType: 'whitewind.blog',
        targetUri: 'at://did:plc:author/pub.chive.preprint.submission/xyz',
      });
    });

    it('should record metrics for created backlinks', async () => {
      const record: FirehoseRecord = {
        uri: 'at://did:plc:blogger/com.whitewind.blog.entry/post444',
        collection: 'com.whitewind.blog.entry',
        did: 'did:plc:blogger',
        rkey: 'post444',
        record: createWhiteWindEntry({
          embed: {
            $type: 'com.whitewind.blog.embed#record',
            uri: 'at://did:plc:author/pub.chive.preprint.submission/xyz',
          },
        }),
        deleted: false,
        timestamp: new Date(),
      };

      await context.eventBus.trigger('firehose.com.whitewind.blog.entry', record);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.metrics.incrementCounter).toHaveBeenCalledWith(
        'backlinks_created',
        { source_type: 'whitewind.blog' },
        undefined
      );
    });
  });

  describe('edge cases', () => {
    it('should handle entry with empty content', () => {
      const entry = createWhiteWindEntry({
        content: '',
        contentFormat: 'markdown',
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([]);
    });

    it('should handle entry with null-like values gracefully', () => {
      const entry = {
        $type: 'com.whitewind.blog.entry' as const,
        title: 'Test',
        content: '',
        contentFormat: 'markdown' as const,
        visibility: 'public' as const,
        createdAt: new Date().toISOString(),
      };

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([]);
    });

    it('should handle malformed embed gracefully', () => {
      const entry = createWhiteWindEntry({
        embed: {
          $type: 'com.whitewind.blog.embed#record',
          uri: '',
        },
      });

      const refs = plugin.extractPreprintRefs(entry);

      expect(refs).toEqual([]);
    });
  });
});
